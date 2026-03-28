import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const search = req.query.search as string | undefined;
    const where: any = { userId: req.userId! };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const ingredients = await prisma.ingredient.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json(ingredients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, unit, category } = req.body;
    const ingredient = await prisma.ingredient.create({ data: { name, unit, category, userId: req.userId! } });
    res.status(201).json(ingredient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ingredient' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, unit, category } = req.body;
    const ingredient = await prisma.ingredient.update({
      where: { id: req.params.id as string, userId: req.userId! },
      data: { name, unit, category },
    });
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ingredient' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.ingredient.delete({ where: { id: req.params.id as string, userId: req.userId! } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ingredient' });
  }
});

export default router;
