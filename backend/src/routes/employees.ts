import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { restaurantId, active } = req.query;
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId as string;
    if (active !== undefined) where.isActive = active === 'true';

    const employees = await prisma.employee.findMany({
      where,
      include: { restaurant: true },
      orderBy: { name: 'asc' },
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { restaurant: true, shifts: { include: { schedule: true }, orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, role, phone, email, color, hourlyRate, restaurantId } = req.body;
    const employee = await prisma.employee.create({
      data: { name, role, phone, email, color, hourlyRate, restaurantId },
      include: { restaurant: true },
    });
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, role, phone, email, color, hourlyRate, isActive } = req.body;
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { name, role, phone, email, color, hourlyRate, isActive },
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
