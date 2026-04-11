import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { authenticate, requireFeature, AuthRequest } from '../middleware/auth';
import { uploadToR2, deleteFromR2 } from '../lib/r2';
import { extractReceiptFromImage } from '../lib/receipt-extract';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(authenticate);
router.use(requireFeature('traceability'));

// ─── List receipts (optionally filter by date range) ───
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const where: any = { userId: req.userId! };
    if (from || to) {
      where.receivedAt = {};
      if (from) where.receivedAt.gte = new Date(from);
      if (to) where.receivedAt.lte = new Date(to);
    }
    const receipts = await prisma.receipt.findMany({
      where,
      include: { items: true },
      orderBy: { receivedAt: 'desc' },
    });
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// ─── Get single receipt ───
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const receipt = await prisma.receipt.findFirst({
      where: { id, userId: req.userId! },
      include: { items: true },
    });
    if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// ─── Capture receipt: upload photo → extract via AI → create immediately ───
// Single-shot flow: the chef snaps a photo and the receipt is saved right away.
// They can edit it afterwards via PUT if anything is wrong.
// receivedAt defaults to "today" (server time) — the date on the receipt
// itself lives in rawText for reference and the user can change it in the edit flow.
router.post('/', upload.single('photo'), async (req: AuthRequest, res) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No photo uploaded' }); return; }

    // Run vision extraction + R2 upload in parallel. The folder path is
    // supplier-agnostic (date-based) so the upload doesn't have to wait for
    // the extraction result — big latency win.
    const receivedAt = new Date(); // today — user can edit afterwards
    const dateSlug = receivedAt.toISOString().slice(0, 10);
    const ext = path.extname(file.originalname) || '.jpg';

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { name: true },
    });
    const userSlug = (user?.name || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const folderPath = `${userSlug}/traceability/${dateSlug}`;

    const uploadPromise = uploadToR2(file.buffer, file.mimetype, folderPath, ext, {
      label: 'receipt',
    });
    const extractPromise = extractReceiptFromImage(file.buffer, file.mimetype).catch(
      (err: any) => {
        console.error('Vision extraction failed:', err);
        return { items: [], rawText: err?.message || 'extraction failed' } as any;
      },
    );

    const [photoUrl, extracted] = await Promise.all([uploadPromise, extractPromise]);

    const receipt = await prisma.receipt.create({
      data: {
        userId: req.userId!,
        photoUrl,
        supplier: extracted.supplier || null,
        receivedAt,
        currency: extracted.currency || 'USD',
        total: extracted.total != null ? extracted.total : null,
        notes: extracted.notes || null,
        rawText: extracted.rawText || null,
        status: 'CONFIRMED',
        items: {
          create: (extracted.items || []).map((it: any) => ({
            name: it.name || 'Unnamed',
            quantity: it.quantity != null ? it.quantity : null,
            unit: it.unit || null,
            unitPrice: it.unitPrice != null ? it.unitPrice : null,
            total: it.total != null ? it.total : null,
            notes: it.notes || null,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json(receipt);
  } catch (error: any) {
    console.error('Create receipt failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to create receipt' });
  }
});

// ─── Update receipt (metadata + items) ───
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.receipt.findFirst({
      where: { id, userId: req.userId! },
    });
    if (!existing) { res.status(404).json({ error: 'Receipt not found' }); return; }

    const { supplier, receivedAt, currency, total, notes, items } = req.body;

    const data: any = {};
    if (supplier !== undefined) data.supplier = supplier || null;
    if (receivedAt !== undefined) data.receivedAt = new Date(receivedAt);
    if (currency !== undefined) data.currency = currency || 'USD';
    if (total !== undefined) data.total = total != null && total !== '' ? parseFloat(total) : null;
    if (notes !== undefined) data.notes = notes || null;

    if (items) {
      await prisma.receiptItem.deleteMany({ where: { receiptId: existing.id } });
      data.items = {
        create: items.map((it: any) => ({
          name: it.name || 'Unnamed',
          quantity: it.quantity != null && it.quantity !== '' ? parseFloat(it.quantity) : null,
          unit: it.unit || null,
          unitPrice: it.unitPrice != null && it.unitPrice !== '' ? parseFloat(it.unitPrice) : null,
          total: it.total != null && it.total !== '' ? parseFloat(it.total) : null,
          notes: it.notes || null,
        })),
      };
    }

    const updated = await prisma.receipt.update({
      where: { id: existing.id },
      data,
      include: { items: true },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update receipt' });
  }
});

// ─── Delete receipt ───
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const receipt = await prisma.receipt.findFirst({
      where: { id, userId: req.userId! },
    });
    if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }

    await deleteFromR2(receipt.photoUrl).catch(() => {});
    await prisma.receipt.delete({ where: { id: receipt.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
});

export default router;
