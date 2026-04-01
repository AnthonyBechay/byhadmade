import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadToR2, deleteFromR2 } from '../lib/r2';

const router = Router();
const prisma = new PrismaClient();

// Multer: memory storage (upload to R2, not disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(authenticate);

// Verify restaurant ownership
async function verifyRestaurant(restaurantId: string, userId: string) {
  return prisma.restaurant.findFirst({ where: { id: restaurantId, userId } });
}

// ─── List orders (optionally by restaurant) ───
router.get('/', async (req: AuthRequest, res) => {
  try {
    const restaurantId = req.query.restaurantId as string | undefined;
    const status = req.query.status as string | undefined;
    const where: any = { restaurant: { userId: req.userId! } };
    if (restaurantId) where.restaurantId = restaurantId;
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        restaurant: { select: { id: true, name: true } },
        items: { include: { ingredient: { select: { id: true, name: true, unit: true, purchaseUnit: true, unitPrice: true, supplier: true } } } },
        photos: true,
      },
      orderBy: { orderDate: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// ─── Get single order ───
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findFirst({
      where: { id, restaurant: { userId: req.userId! } },
      include: {
        restaurant: { select: { id: true, name: true } },
        items: { include: { ingredient: { select: { id: true, name: true, unit: true, purchaseUnit: true, unitPrice: true, supplier: true } } } },
        photos: { orderBy: { createdAt: 'asc' as const } },
      },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ─── Create order with items ───
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { restaurantId, supplier, deliveryType, notes, items, orderDate } = req.body;
    if (!restaurantId) { res.status(400).json({ error: 'Restaurant is required' }); return; }
    const rest = await verifyRestaurant(restaurantId, req.userId!);
    if (!rest) { res.status(403).json({ error: 'Not your restaurant' }); return; }
    if (!items || items.length === 0) { res.status(400).json({ error: 'At least one item is required' }); return; }

    const order = await prisma.order.create({
      data: {
        restaurantId,
        supplier: supplier || null,
        deliveryType: deliveryType || null,
        notes: notes || null,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        items: {
          create: items.map((it: any) => ({
            ingredientId: it.ingredientId || null,
            name: it.name,
            quantity: it.quantity ? parseFloat(it.quantity) : null,
            unit: it.unit || null,
            price: it.price ? parseFloat(it.price) : null,
            notes: it.notes || null,
          })),
        },
      },
      include: { items: { include: { ingredient: { select: { id: true, name: true, unit: true, purchaseUnit: true, unitPrice: true, supplier: true } } } }, photos: true, restaurant: { select: { id: true, name: true } } },
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ─── Update order (status, details, items) ───
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findFirst({
      where: { id, restaurant: { userId: req.userId! } },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    const { status, deliveryType, totalPaid, currency, supplier, notes, items, isPaid } = req.body;

    const data: any = {};
    if (status !== undefined) {
      data.status = status;
      if (status === 'DELIVERED' && !order.deliveredAt) data.deliveredAt = new Date();
      if (status === 'RECEIVED' && !order.receivedAt) data.receivedAt = new Date();
    }
    if (isPaid !== undefined) {
      data.isPaid = !!isPaid;
      data.paidAt = isPaid ? new Date() : null;
    }
    if (deliveryType !== undefined) data.deliveryType = deliveryType || null;
    if (totalPaid !== undefined) data.totalPaid = totalPaid ? parseFloat(totalPaid) : null;
    if (currency !== undefined) data.currency = currency;
    if (supplier !== undefined) data.supplier = supplier || null;
    if (notes !== undefined) data.notes = notes || null;

    // Update items: delete all existing, recreate
    if (items) {
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      data.items = {
        create: items.map((it: any) => ({
          ingredientId: it.ingredientId || null,
          name: it.name,
          quantity: it.quantity ? parseFloat(it.quantity) : null,
          unit: it.unit || null,
          price: it.price ? parseFloat(it.price) : null,
          notes: it.notes || null,
          expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
          storageLocation: it.storageLocation || null,
        })),
      };
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data,
      include: { items: { include: { ingredient: { select: { id: true, name: true, unit: true, purchaseUnit: true, unitPrice: true, supplier: true } } } }, photos: true, restaurant: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ─── Delete order ───
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findFirst({
      where: { id, restaurant: { userId: req.userId! } },
      include: { photos: true },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    // Delete R2 photos
    for (const photo of order.photos) {
      await deleteFromR2(photo.url).catch(() => {});
    }

    await prisma.order.delete({ where: { id: order.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// ─── Upload photos to order ───
router.post('/:id/photos', upload.array('photos', 10), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findFirst({
      where: { id, restaurant: { userId: req.userId! } },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) { res.status(400).json({ error: 'No files uploaded' }); return; }

    const photoType = (req.body.type as string) || 'INGREDIENT';
    const caption = (req.body.caption as string) || null;

    const created = [];
    for (const file of files) {
      const ext = path.extname(file.originalname) || '.jpg';
      const url = await uploadToR2(file.buffer, file.mimetype, 'orders', ext, {
        entityId: order.id,
        label: photoType.toLowerCase(),
      });
      const photo = await prisma.orderPhoto.create({
        data: {
          orderId: order.id,
          url,
          type: photoType as any,
          caption,
        },
      });
      created.push(photo);
    }

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// ─── Delete a photo ───
router.delete('/photos/:photoId', async (req: AuthRequest, res) => {
  try {
    const photoId = req.params.photoId as string;
    const photo = await prisma.orderPhoto.findUnique({
      where: { id: photoId },
      include: { order: { include: { restaurant: true } } },
    });
    if (!photo) { res.status(404).json({ error: 'Photo not found' }); return; }
    if (photo.order.restaurant.userId !== req.userId) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    await deleteFromR2(photo.url).catch(() => {});
    await prisma.orderPhoto.delete({ where: { id: photo.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

export default router;
