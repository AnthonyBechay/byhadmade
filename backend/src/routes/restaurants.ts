import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { authenticate, requireOwner, restaurantScope, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `restaurant-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { userId: req.userId!, ...restaurantScope(req, 'id') },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

router.post('/', requireOwner, async (req: AuthRequest, res) => {
  try {
    const { name, address, phone, logoUrl, details } = req.body;
    const restaurant = await prisma.restaurant.create({ data: { name, address, phone, logoUrl, details, userId: req.userId! } });
    res.status(201).json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

router.put('/:id', requireOwner, async (req: AuthRequest, res) => {
  try {
    const { name, address, phone, logoUrl, details } = req.body;
    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id as string, userId: req.userId! },
      data: { name, address, phone, logoUrl, details },
    });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

router.post('/:id/upload-logo', requireOwner, upload.single('logo'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const id = req.params.id as string;
    const logoUrl = `/uploads/${req.file.filename}`;
    const restaurant = await prisma.restaurant.update({
      where: { id, userId: req.userId! },
      data: { logoUrl },
    });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

router.delete('/:id', requireOwner, async (req: AuthRequest, res) => {
  try {
    await prisma.restaurant.delete({ where: { id: req.params.id as string, userId: req.userId! } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

export default router;
