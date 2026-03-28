import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { subcategories: true, _count: { select: { recipes: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.create({ data: { name, description } });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name, description },
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Subcategories
router.post('/:id/subcategories', async (req, res) => {
  try {
    const { name, description } = req.body;
    const sub = await prisma.subcategory.create({
      data: { name, description, categoryId: req.params.id },
    });
    res.status(201).json(sub);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

router.put('/subcategories/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const sub = await prisma.subcategory.update({
      where: { id: req.params.id },
      data: { name, description },
    });
    res.json(sub);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subcategory' });
  }
});

router.delete('/subcategories/:id', async (req, res) => {
  try {
    await prisma.subcategory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
});

export default router;
