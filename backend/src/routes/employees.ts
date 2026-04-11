import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, canAccessRestaurant, restaurantScope, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { restaurantId, active } = req.query;
    const where: any = { restaurant: { userId: req.userId! } };
    if (restaurantId) {
      if (!canAccessRestaurant(req, restaurantId as string)) { res.json([]); return; }
      where.restaurantId = restaurantId as string;
    } else {
      Object.assign(where, restaurantScope(req, 'restaurantId'));
    }
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

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id as string, restaurant: { userId: req.userId! } },
      include: { restaurant: true, shifts: { include: { schedule: true }, orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    if (!canAccessRestaurant(req, employee.restaurantId)) { res.status(404).json({ error: 'Employee not found' }); return; }
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, role, phone, email, color, hourlyRate, restaurantId } = req.body;
    if (!canAccessRestaurant(req, restaurantId)) { res.status(404).json({ error: 'Restaurant not found' }); return; }
    // Verify restaurant belongs to user
    const rest = await prisma.restaurant.findFirst({ where: { id: restaurantId, userId: req.userId! } });
    if (!rest) { res.status(404).json({ error: 'Restaurant not found' }); return; }

    const employee = await prisma.employee.create({
      data: { name, role, phone, email, color, hourlyRate, restaurantId },
      include: { restaurant: true },
    });
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, role, phone, email, color, hourlyRate, isActive } = req.body;
    // Verify ownership
    const emp = await prisma.employee.findFirst({ where: { id: req.params.id as string, restaurant: { userId: req.userId! } } });
    if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }
    if (!canAccessRestaurant(req, emp.restaurantId)) { res.status(404).json({ error: 'Employee not found' }); return; }

    const employee = await prisma.employee.update({
      where: { id: req.params.id as string },
      data: { name, role, phone, email, color, hourlyRate, isActive },
      include: { restaurant: true },
    });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const emp = await prisma.employee.findFirst({ where: { id: req.params.id as string, restaurant: { userId: req.userId! } } });
    if (!emp) { res.status(404).json({ error: 'Employee not found' }); return; }
    if (!canAccessRestaurant(req, emp.restaurantId)) { res.status(404).json({ error: 'Employee not found' }); return; }
    await prisma.employee.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

export default router;
