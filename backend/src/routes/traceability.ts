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
  // 10 MB per file (frontend compresses before upload, so in practice ~500 KB)
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(authenticate);
router.use(requireFeature('traceability'));

// ─── Helpers ───

async function getUserSlug(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return (user?.name || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

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

// ─── Capture receipt(s): upload photo → extract via AI → create ───
// Accepts 1..N photos as field "photo" (single) or "photos" (multiple).
// Processes each sequentially (AI extraction for every file).
// Returns a Receipt[] — even for a single file.
router.post('/', upload.single('photo'), async (req: AuthRequest, res) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No photo uploaded' }); return; }

    const receivedAt = new Date();
    const dateSlug = receivedAt.toISOString().slice(0, 10);
    const ext = path.extname(file.originalname) || '.jpg';
    const userSlug = await getUserSlug(req.userId!);
    const folderPath = `${userSlug}/traceability/${dateSlug}`;

    const [photoUrl, extracted] = await Promise.all([
      uploadToR2(file.buffer, file.mimetype, folderPath, ext, { label: 'receipt' }),
      extractReceiptFromImage(file.buffer, file.mimetype).catch((err: any) => {
        console.error('Vision extraction failed:', err);
        return { items: [], rawText: err?.message || 'extraction failed' } as any;
      }),
    ]);

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

    // Always return an array for consistent frontend handling
    res.status(201).json([receipt]);
  } catch (error: any) {
    console.error('Create receipt failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to create receipt' });
  }
});

// ─── Add supplementary photos to an existing receipt (NO AI extraction) ───
// These are reference documents (delivery notes, packaging, etc.).
// Path: POST /traceability/:id/photos  field: "photos" (1..20 files)
router.post('/:id/photos', upload.array('photos', 20), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const files = req.files as Express.Multer.File[];

    const receipt = await prisma.receipt.findFirst({ where: { id, userId: req.userId! } });
    if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }
    if (!files || files.length === 0) { res.status(400).json({ error: 'No photos uploaded' }); return; }

    // Store under the same date folder as the main receipt photo
    const dateSlug = receipt.receivedAt.toISOString().slice(0, 10);
    const userSlug = await getUserSlug(req.userId!);
    const folderPath = `${userSlug}/traceability/${dateSlug}`;

    // Upload all in parallel (no AI — fast)
    const newUrls = await Promise.all(
      files.map((file) =>
        uploadToR2(
          file.buffer,
          file.mimetype,
          folderPath,
          path.extname(file.originalname) || '.jpg',
          { label: 'doc' },
        ),
      ),
    );

    const updated = await prisma.receipt.update({
      where: { id },
      data: { extraPhotoUrls: { push: newUrls } },
      include: { items: true },
    });
    res.json(updated);
  } catch (error: any) {
    console.error('Add photos failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to add photos' });
  }
});

// ─── Remove a supplementary photo from a receipt ───
// Body: { url: string }
router.delete('/:id/photos', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { url } = req.body as { url: string };
    if (!url) { res.status(400).json({ error: 'url is required' }); return; }

    const receipt = await prisma.receipt.findFirst({ where: { id, userId: req.userId! } });
    if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }
    if (!receipt.extraPhotoUrls.includes(url)) { res.status(400).json({ error: 'Photo not found in this receipt' }); return; }

    await deleteFromR2(url).catch(() => {});
    const updated = await prisma.receipt.update({
      where: { id },
      data: { extraPhotoUrls: receipt.extraPhotoUrls.filter((u) => u !== url) },
      include: { items: true },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove photo' });
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

// ─── Delete receipt (cleans up all R2 objects) ───
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const receipt = await prisma.receipt.findFirst({
      where: { id, userId: req.userId! },
    });
    if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }

    // Delete main photo + all supplementary photos from R2
    await Promise.all([
      deleteFromR2(receipt.photoUrl).catch(() => {}),
      ...receipt.extraPhotoUrls.map((url) => deleteFromR2(url).catch(() => {})),
    ]);
    await prisma.receipt.delete({ where: { id: receipt.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
});

export default router;
