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

// Get weekly hour summary with detailed breakdown
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

    const summary: Record<string, {
      name: string;
      role: string | null;
      color: string | null;
      hourlyRate: number | null;
      totalWorkHours: number;
      totalBreakHours: number;
      workShifts: number;
      daysWorked: Set<number>;
      dailyBreakdown: Record<number, { work: number; break: number }>;
      daysOff: number;
      sickDays: number;
      vacationDays: number;
    }> = {};

    for (const shift of schedule.shifts) {
      if (!summary[shift.employeeId]) {
        summary[shift.employeeId] = {
          name: shift.employee.name,
          role: shift.employee.role,
          color: shift.employee.color,
          hourlyRate: shift.employee.hourlyRate,
          totalWorkHours: 0,
          totalBreakHours: 0,
          workShifts: 0,
          daysWorked: new Set(),
          dailyBreakdown: {},
          daysOff: 0,
          sickDays: 0,
          vacationDays: 0,
        };
      }

      const emp = summary[shift.employeeId];
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);
      const hours = (endH + endM / 60) - (startH + startM / 60);

      if (!emp.dailyBreakdown[shift.dayOfWeek]) {
        emp.dailyBreakdown[shift.dayOfWeek] = { work: 0, break: 0 };
      }

      switch (shift.shiftType) {
        case 'WORK':
          emp.totalWorkHours += hours;
          emp.workShifts += 1;
          emp.daysWorked.add(shift.dayOfWeek);
          emp.dailyBreakdown[shift.dayOfWeek].work += hours;
          break;
        case 'BREAK':
          emp.totalBreakHours += hours;
          emp.dailyBreakdown[shift.dayOfWeek].break += hours;
          break;
        case 'DAY_OFF':
          emp.daysOff += 1;
          break;
        case 'SICK':
          emp.sickDays += 1;
          break;
        case 'VACATION':
          emp.vacationDays += 1;
          break;
      }
    }

    // Convert Sets to counts for JSON serialization
    const result: Record<string, any> = {};
    for (const [id, emp] of Object.entries(summary)) {
      result[id] = {
        ...emp,
        daysWorked: emp.daysWorked.size,
        estimatedPay: emp.hourlyRate ? emp.totalWorkHours * emp.hourlyRate : null,
      };
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Report: get summary across multiple weeks for a restaurant
router.get('/report/:restaurantId', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where: any = { restaurantId: req.params.restaurantId };
    if (from) where.weekStart = { ...where.weekStart, gte: new Date(from as string) };
    if (to) where.weekEnd = { ...where.weekEnd, lte: new Date(to as string) };

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        shifts: { include: { employee: true } },
      },
      orderBy: { weekStart: 'asc' },
    });

    // Aggregate by employee across all weeks
    const report: Record<string, {
      name: string;
      role: string | null;
      hourlyRate: number | null;
      weeklyData: Record<string, { workHours: number; breakHours: number; shifts: number }>;
      totalWorkHours: number;
      totalBreakHours: number;
      totalShifts: number;
    }> = {};

    for (const schedule of schedules) {
      const weekKey = schedule.weekStart.toISOString().split('T')[0];

      for (const shift of schedule.shifts) {
        if (!report[shift.employeeId]) {
          report[shift.employeeId] = {
            name: shift.employee.name,
            role: shift.employee.role,
            hourlyRate: shift.employee.hourlyRate,
            weeklyData: {},
            totalWorkHours: 0,
            totalBreakHours: 0,
            totalShifts: 0,
          };
        }

        const emp = report[shift.employeeId];
        if (!emp.weeklyData[weekKey]) {
          emp.weeklyData[weekKey] = { workHours: 0, breakHours: 0, shifts: 0 };
        }

        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);
        const hours = (endH + endM / 60) - (startH + startM / 60);

        if (shift.shiftType === 'WORK') {
          emp.weeklyData[weekKey].workHours += hours;
          emp.weeklyData[weekKey].shifts += 1;
          emp.totalWorkHours += hours;
          emp.totalShifts += 1;
        } else if (shift.shiftType === 'BREAK') {
          emp.weeklyData[weekKey].breakHours += hours;
          emp.totalBreakHours += hours;
        }
      }
    }

    // Add estimated pay
    const result: Record<string, any> = {};
    for (const [id, emp] of Object.entries(report)) {
      result[id] = {
        ...emp,
        estimatedPay: emp.hourlyRate ? emp.totalWorkHours * emp.hourlyRate : null,
      };
    }

    res.json({
      scheduleCount: schedules.length,
      employees: result,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { weekStart, weekEnd, restaurantId, notes } = req.body;
    const schedule = await prisma.schedule.create({
      data: {
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        restaurantId,
        notes,
      },
      include: { restaurant: true, shifts: true },
    });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Duplicate a schedule to a new week
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { weekStart } = req.body;
    const source = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: { shifts: true },
    });
    if (!source) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const newSchedule = await prisma.schedule.create({
      data: {
        weekStart: start,
        weekEnd: end,
        restaurantId: source.restaurantId,
        shifts: {
          create: source.shifts.map(s => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            shiftType: s.shiftType,
            notes: s.notes,
            employeeId: s.employeeId,
          })),
        },
      },
      include: { restaurant: true, shifts: { include: { employee: true } } },
    });
    res.status(201).json(newSchedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to duplicate schedule' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { published, notes } = req.body;
    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: { published, notes },
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
    const { employeeId, dayOfWeek, startTime, endTime, shiftType, notes } = req.body;
    const shift = await prisma.shift.create({
      data: {
        employeeId, dayOfWeek, startTime, endTime,
        shiftType: shiftType || 'WORK',
        notes,
        scheduleId: req.params.id,
      },
      include: { employee: true },
    });
    res.status(201).json(shift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

// Bulk add shifts for an employee across multiple days
router.post('/:id/shifts/bulk', async (req, res) => {
  try {
    const { shifts } = req.body;
    const created = await Promise.all(
      shifts.map((s: any) =>
        prisma.shift.create({
          data: {
            employeeId: s.employeeId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            shiftType: s.shiftType || 'WORK',
            notes: s.notes,
            scheduleId: req.params.id,
          },
          include: { employee: true },
        })
      )
    );
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shifts' });
  }
});

router.put('/shifts/:shiftId', async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, shiftType, notes } = req.body;
    const shift = await prisma.shift.update({
      where: { id: req.params.shiftId },
      data: { dayOfWeek, startTime, endTime, shiftType, notes },
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
