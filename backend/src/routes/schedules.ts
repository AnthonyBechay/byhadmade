import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// Get schedules for a restaurant
router.get('/', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const schedules = await prisma.schedule.findMany({
      where: restaurantId ? { restaurantId: restaurantId as string } : undefined,
      include: {
        restaurant: true,
        shifts: { include: { employee: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
      orderBy: { weekStart: 'desc' },
    });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: {
        restaurant: true,
        shifts: { include: { employee: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
    });
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Get weekly hour summary
router.get('/:id/summary', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: {
        shifts: { include: { employee: true } },
      },
    });
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    const summary: Record<string, { name: string; totalHours: number; shifts: number; breakHours: number }> = {};

    for (const shift of schedule.shifts) {
      if (!summary[shift.employeeId]) {
        summary[shift.employeeId] = { name: shift.employee.name, totalHours: 0, shifts: 0, breakHours: 0 };
      }
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);
      const hours = (endH + endM / 60) - (startH + startM / 60);

      if (shift.isBreak) {
        summary[shift.employeeId].breakHours += hours;
      } else {
        summary[shift.employeeId].totalHours += hours;
        summary[shift.employeeId].shifts += 1;
      }
    }

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { weekStart, weekEnd, restaurantId } = req.body;
    const schedule = await prisma.schedule.create({
      data: {
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        restaurantId,
      },
      include: { restaurant: true, shifts: true },
    });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { published } = req.body;
    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: { published },
      include: { restaurant: true, shifts: { include: { employee: true } } },
    });
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.schedule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Shift management
router.post('/:id/shifts', async (req, res) => {
  try {
    const { employeeId, dayOfWeek, startTime, endTime, isBreak, notes } = req.body;
    const shift = await prisma.shift.create({
      data: {
        employeeId, dayOfWeek, startTime, endTime, isBreak: isBreak || false, notes,
        scheduleId: req.params.id,
      },
      include: { employee: true },
    });
    res.status(201).json(shift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

router.put('/shifts/:shiftId', async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, isBreak, notes } = req.body;
    const shift = await prisma.shift.update({
      where: { id: req.params.shiftId },
      data: { dayOfWeek, startTime, endTime, isBreak, notes },
      include: { employee: true },
    });
    res.json(shift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

router.delete('/shifts/:shiftId', async (req, res) => {
  try {
    await prisma.shift.delete({ where: { id: req.params.shiftId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

export default router;
