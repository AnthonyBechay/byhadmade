import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, address } = req.body;
    const restaurant = await prisma.restaurant.create({ data: { name, address } });
    res.status(201).json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, address } = req.body;
    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data: { name, address },
    });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.restaurant.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

export default router;
