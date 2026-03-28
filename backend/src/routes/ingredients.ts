import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const ingredients = await prisma.ingredient.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
    res.json(ingredients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, unit, category } = req.body;
    const ingredient = await prisma.ingredient.create({ data: { name, unit, category } });
    res.status(201).json(ingredient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ingredient' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, unit, category } = req.body;
    const ingredient = await prisma.ingredient.update({
      where: { id: req.params.id },
      data: { name, unit, category },
    });
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ingredient' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.ingredient.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ingredient' });
  }
});

export default router;
