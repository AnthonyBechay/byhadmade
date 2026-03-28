import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.userId! },
      include: { subcategories: true, _count: { select: { recipes: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.create({ data: { name, description, userId: req.userId! } });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id as string, userId: req.userId! },
      data: { name, description },
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id as string, userId: req.userId! } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Subcategories
router.post('/:id/subcategories', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    // Verify category belongs to user
    const cat = await prisma.category.findFirst({ where: { id: req.params.id as string, userId: req.userId! } });
    if (!cat) { res.status(404).json({ error: 'Category not found' }); return; }
    const sub = await prisma.subcategory.create({
      data: { name, description, categoryId: req.params.id as string },
    });
    res.status(201).json(sub);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

router.put('/subcategories/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    // Verify subcategory belongs to user via category
    const sub = await prisma.subcategory.findFirst({
      where: { id: req.params.id as string, category: { userId: req.userId! } },
    });
    if (!sub) { res.status(404).json({ error: 'Subcategory not found' }); return; }
    const updated = await prisma.subcategory.update({
      where: { id: req.params.id as string },
      data: { name, description },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subcategory' });
  }
});

router.delete('/subcategories/:id', async (req: AuthRequest, res) => {
  try {
    const sub = await prisma.subcategory.findFirst({
      where: { id: req.params.id as string, category: { userId: req.userId! } },
    });
    if (!sub) { res.status(404).json({ error: 'Subcategory not found' }); return; }
    await prisma.subcategory.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
});

export default router;
