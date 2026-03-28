import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const employees = await prisma.employee.findMany({
      where: restaurantId ? { restaurantId: restaurantId as string } : undefined,
      include: { restaurant: true },
      orderBy: { name: 'asc' },
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, role, phone, email, restaurantId } = req.body;
    const employee = await prisma.employee.create({
      data: { name, role, phone, email, restaurantId },
      include: { restaurant: true },
    });
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, role, phone, email } = req.body;
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { name, role, phone, email },
      include: { restaurant: true },
    });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

export default router;
