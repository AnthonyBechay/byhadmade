import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireFeature, canAccessRestaurant, restaurantScope, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ─── Public route: shared schedule (no auth) ───
router.get('/public/:shareToken', async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { shareToken: req.params.shareToken as string },
    });
    if (!restaurant) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    // This week (Mon-Sun)
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diffToMonday);
    thisMonday.setHours(0, 0, 0, 0);
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);
    thisSunday.setHours(23, 59, 59, 999);

    // Next week (Mon-Sun)
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);

    const shiftInclude = {
      shifts: {
        include: { employee: { select: { id: true, name: true, role: true, color: true } } },
        orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }],
      },
      employeeOrders: true,
    };

    const thisWeekSchedule = await prisma.schedule.findFirst({
      where: { restaurantId: restaurant.id, published: true, weekStart: { gte: thisMonday, lte: thisSunday } },
      include: shiftInclude,
    });

    const nextWeekSchedule = await prisma.schedule.findFirst({
      where: { restaurantId: restaurant.id, published: true, weekStart: { gte: nextMonday, lte: nextSunday } },
      include: shiftInclude,
    });

    res.json({
      restaurant: { name: restaurant.name, address: restaurant.address, logoUrl: restaurant.logoUrl },
      thisWeek: thisWeekSchedule ? {
        schedule: thisWeekSchedule,
        weekStart: thisMonday.toISOString(),
      } : null,
      nextWeek: nextWeekSchedule ? {
        schedule: nextWeekSchedule,
        weekStart: nextMonday.toISOString(),
      } : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public schedule' });
  }
});

// ─── All other routes require auth ───
router.use(authenticate);
router.use(requireFeature('schedules'));

// Helper to verify restaurant ownership
async function verifyRestaurant(restaurantId: string, userId: string) {
  return prisma.restaurant.findFirst({ where: { id: restaurantId, userId } });
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { restaurantId } = req.query;
    const where: any = { restaurant: { userId: req.userId! } };
    if (restaurantId) {
      if (!canAccessRestaurant(req, restaurantId as string)) { res.json([]); return; }
      where.restaurantId = restaurantId as string;
    } else {
      Object.assign(where, restaurantScope(req, 'restaurantId'));
    }

    const schedules = await prisma.schedule.findMany({
      where,
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

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: req.params.id as string, restaurant: { userId: req.userId! } },
      include: {
        restaurant: true,
        shifts: { include: { employee: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        employeeOrders: true,
      },
    });
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    if (!canAccessRestaurant(req, schedule.restaurantId)) { res.status(404).json({ error: 'Schedule not found' }); return; }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Weekly hour summary
router.get('/:id/summary', async (req: AuthRequest, res) => {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { id: req.params.id as string, restaurant: { userId: req.userId! } },
      include: { shifts: { include: { employee: true } } },
    });
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    if (!canAccessRestaurant(req, schedule.restaurantId)) { res.status(404).json({ error: 'Schedule not found' }); return; }

    const summary: Record<string, {
      name: string; role: string | null; color: string | null; hourlyRate: number | null;
      totalWorkHours: number; totalBreakHours: number; workShifts: number;
      daysWorked: Set<number>; dailyBreakdown: Record<number, { work: number; break: number }>;
      daysOff: number; sickDays: number; vacationDays: number;
    }> = {};

    for (const shift of schedule.shifts) {
      if (!summary[shift.employeeId]) {
        summary[shift.employeeId] = {
          name: shift.employee.name, role: shift.employee.role, color: shift.employee.color,
          hourlyRate: shift.employee.hourlyRate, totalWorkHours: 0, totalBreakHours: 0,
          workShifts: 0, daysWorked: new Set(), dailyBreakdown: {},
          daysOff: 0, sickDays: 0, vacationDays: 0,
        };
      }
      const emp = summary[shift.employeeId];
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);
      const hours = (endH + endM / 60) - (startH + startM / 60);

      if (!emp.dailyBreakdown[shift.dayOfWeek]) emp.dailyBreakdown[shift.dayOfWeek] = { work: 0, break: 0 };

      switch (shift.shiftType) {
        case 'WORK': {
          const breakHrs = (shift.breakMinutes || 0) / 60;
          const netWork = hours - breakHrs;
          emp.totalWorkHours += netWork;
          emp.totalBreakHours += breakHrs;
          emp.workShifts += 1;
          emp.daysWorked.add(shift.dayOfWeek);
          emp.dailyBreakdown[shift.dayOfWeek].work += netWork;
          emp.dailyBreakdown[shift.dayOfWeek].break += breakHrs;
          break;
        }
        case 'BREAK': emp.totalBreakHours += hours; emp.dailyBreakdown[shift.dayOfWeek].break += hours; break;
        case 'DAY_OFF': emp.daysOff += 1; break;
        case 'SICK': emp.sickDays += 1; break;
        case 'VACATION': emp.vacationDays += 1; break;
      }
    }

    const result: Record<string, any> = {};
    for (const [id, emp] of Object.entries(summary)) {
      result[id] = { ...emp, daysWorked: emp.daysWorked.size, estimatedPay: emp.hourlyRate ? emp.totalWorkHours * emp.hourlyRate : null };
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Monthly salary report
router.get('/salary-report/:restaurantId', async (req: AuthRequest, res) => {
  try {
    if (!canAccessRestaurant(req, req.params.restaurantId as string)) { res.status(404).json({ error: 'Restaurant not found' }); return; }
    const rest = await verifyRestaurant(req.params.restaurantId as string, req.userId!);
    if (!rest) { res.status(404).json({ error: 'Restaurant not found' }); return; }

    const { month, year } = req.query;
    const m = parseInt(month as string) || (new Date().getMonth() + 1);
    const y = parseInt(year as string) || new Date().getFullYear();
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

    const schedules = await prisma.schedule.findMany({
      where: { restaurantId: req.params.restaurantId as string, weekStart: { lte: monthEnd }, weekEnd: { gte: monthStart } },
      include: { shifts: { include: { employee: true } } },
      orderBy: { weekStart: 'asc' },
    });

    const employees: Record<string, any> = {};
    for (const schedule of schedules) {
      const weekKey = schedule.weekStart.toISOString().split('T')[0];
      for (const shift of schedule.shifts) {
        if (!employees[shift.employeeId]) {
          employees[shift.employeeId] = {
            name: shift.employee.name, role: shift.employee.role, color: shift.employee.color,
            hourlyRate: shift.employee.hourlyRate, totalWorkHours: 0, totalBreakHours: 0,
            totalShifts: 0, daysWorked: 0, weeklyBreakdown: {},
          };
        }
        const emp = employees[shift.employeeId];
        if (!emp.weeklyBreakdown[weekKey]) emp.weeklyBreakdown[weekKey] = { workHours: 0, breakHours: 0, shifts: 0 };
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);
        const hours = (endH + endM / 60) - (startH + startM / 60);
        if (shift.shiftType === 'WORK') {
          const breakHrs = (shift.breakMinutes || 0) / 60;
          const netWork = hours - breakHrs;
          emp.weeklyBreakdown[weekKey].workHours += netWork;
          emp.weeklyBreakdown[weekKey].breakHours += breakHrs;
          emp.weeklyBreakdown[weekKey].shifts += 1;
          emp.totalWorkHours += netWork;
          emp.totalBreakHours += breakHrs;
          emp.totalShifts += 1;
        } else if (shift.shiftType === 'BREAK') {
          emp.weeklyBreakdown[weekKey].breakHours += hours;
          emp.totalBreakHours += hours;
        }
      }
    }

    const result: Record<string, any> = {};
    for (const [id, emp] of Object.entries(employees)) {
      result[id] = { ...emp, salary: (emp as any).hourlyRate ? (emp as any).totalWorkHours * (emp as any).hourlyRate : null };
    }
    const totalSalary = Object.values(result).reduce((sum: number, emp: any) => sum + (emp.salary || 0), 0);

    res.json({ month: m, year: y, scheduleCount: schedules.length, employees: result, totalSalary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate salary report' });
  }
});

// Multi-week report
router.get('/report/:restaurantId', async (req: AuthRequest, res) => {
  try {
    if (!canAccessRestaurant(req, req.params.restaurantId as string)) { res.status(404).json({ error: 'Restaurant not found' }); return; }
    const rest = await verifyRestaurant(req.params.restaurantId as string, req.userId!);
    if (!rest) { res.status(404).json({ error: 'Restaurant not found' }); return; }

    const { from, to } = req.query;
    const where: any = { restaurantId: req.params.restaurantId as string };
    if (from) where.weekStart = { ...where.weekStart, gte: new Date(from as string) };
    if (to) where.weekEnd = { ...where.weekEnd, lte: new Date(to as string) };

    const schedules = await prisma.schedule.findMany({ where, include: { shifts: { include: { employee: true } } }, orderBy: { weekStart: 'asc' } });

    const report: Record<string, any> = {};
    for (const schedule of schedules) {
      const weekKey = schedule.weekStart.toISOString().split('T')[0];
      for (const shift of schedule.shifts) {
        if (!report[shift.employeeId]) {
          report[shift.employeeId] = { name: shift.employee.name, role: shift.employee.role, hourlyRate: shift.employee.hourlyRate, weeklyData: {}, totalWorkHours: 0, totalBreakHours: 0, totalShifts: 0 };
        }
        const emp = report[shift.employeeId];
        if (!emp.weeklyData[weekKey]) emp.weeklyData[weekKey] = { workHours: 0, breakHours: 0, shifts: 0 };
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);
        const hours = (endH + endM / 60) - (startH + startM / 60);
        if (shift.shiftType === 'WORK') {
          const breakHrs = (shift.breakMinutes || 0) / 60;
          const netWork = hours - breakHrs;
          emp.weeklyData[weekKey].workHours += netWork;
          emp.weeklyData[weekKey].shifts += 1;
          emp.totalWorkHours += netWork;
          emp.totalShifts += 1;
        } else if (shift.shiftType === 'BREAK') {
          emp.weeklyData[weekKey].breakHours += hours;
          emp.totalBreakHours += hours;
        }
      }
    }

    const result: Record<string, any> = {};
    for (const [id, emp] of Object.entries(report)) { result[id] = { ...emp, estimatedPay: (emp as any).hourlyRate ? (emp as any).totalWorkHours * (emp as any).hourlyRate : null }; }
    res.json({ scheduleCount: schedules.length, employees: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { weekStart, restaurantId, notes } = req.body;
    if (!canAccessRestaurant(req, restaurantId)) { res.status(404).json({ error: 'Restaurant not found' }); return; }
    const rest = await verifyRestaurant(restaurantId, req.userId!);
    if (!rest) { res.status(404).json({ error: 'Restaurant not found' }); return; }

    const date = new Date(weekStart);
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diffToMonday);
    date.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setDate(date.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const existing = await prisma.schedule.findFirst({ where: { restaurantId, weekStart: date } });
    if (existing) {
      res.status(409).json({ error: 'A schedule already exists for this week and restaurant', existingId: existing.id });
      return;
    }

    const schedule = await prisma.schedule.create({
      data: { weekStart: date, weekEnd: end, restaurantId, notes },
      include: { restaurant: true, shifts: true, employeeOrders: true },
    });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

router.post('/:id/duplicate', async (req: AuthRequest, res) => {
  try {
    const { weekStart } = req.body;
    const source = await prisma.schedule.findFirst({
      where: { id: req.params.id as string, restaurant: { userId: req.userId! } },
      include: { shifts: true, employeeOrders: true },
    });
    if (!source) { res.status(404).json({ error: 'Schedule not found' }); return; }
    if (!canAccessRestaurant(req, source.restaurantId)) { res.status(404).json({ error: 'Schedule not found' }); return; }

    const date = new Date(weekStart);
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diffToMonday);
    date.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setDate(date.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const existing = await prisma.schedule.findFirst({ where: { restaurantId: source.restaurantId, weekStart: date } });
    if (existing) {
      res.status(409).json({ error: 'A schedule already exists for this week and restaurant', existingId: existing.id });
      return;
    }

    const newSchedule = await prisma.schedule.create({
      data: {
        weekStart: date, weekEnd: end, restaurantId: source.restaurantId,
        shifts: { create: source.shifts.map(s => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, shiftType: s.shiftType, breakMinutes: s.breakMinutes, notes: s.notes, employeeId: s.employeeId })) },
        employeeOrders: { create: source.employeeOrders.map(o => ({ employeeId: o.employeeId, displayOrder: o.displayOrder })) },
      },
      include: { restaurant: true, shifts: { include: { employee: true } }, employeeOrders: true },
    });
    res.status(201).json(newSchedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to duplicate schedule' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { published, notes } = req.body;
    const existing = await prisma.schedule.findFirst({ where: { id: req.params.id as string, restaurant: { userId: req.userId! } } });
    if (!existing) { res.status(404).json({ error: 'Schedule not found' }); return; }
    if (!canAccessRestaurant(req, existing.restaurantId)) { res.status(404).json({ error: 'Schedule not found' }); return; }

    const schedule = await prisma.schedule.update({
      where: { id: req.params.id as string },
      data: { published, notes },
      include: { restaurant: true, shifts: { include: { employee: true } }, employeeOrders: true },
    });
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.schedule.findFirst({ where: { id: req.params.id as string, restaurant: { userId: req.userId! } } });
    if (!existing) { res.status(404).json({ error: 'Schedule not found' }); return; }
    if (!canAccessRestaurant(req, existing.restaurantId)) { res.status(404).json({ error: 'Schedule not found' }); return; }
    await prisma.schedule.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// ─── Employee order management ───
router.put('/:id/employee-order', async (req: AuthRequest, res) => {
  try {
    const sched = await prisma.schedule.findFirst({ where: { id: req.params.id as string, restaurant: { userId: req.userId! } } });
    if (!sched) { res.status(404).json({ error: 'Schedule not found' }); return; }
    if (!canAccessRestaurant(req, sched.restaurantId)) { res.status(404).json({ error: 'Schedule not found' }); return; }

    const { orders } = req.body; // Array of { employeeId, displayOrder }
    for (const o of orders) {
      await prisma.scheduleEmployeeOrder.upsert({
        where: { scheduleId_employeeId: { scheduleId: req.params.id as string, employeeId: o.employeeId } },
        update: { displayOrder: o.displayOrder },
        create: { scheduleId: req.params.id as string, employeeId: o.employeeId, displayOrder: o.displayOrder },
      });
    }

    const updated = await prisma.scheduleEmployeeOrder.findMany({ where: { scheduleId: req.params.id as string } });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee order' });
  }
});

// Delete all shifts for an employee in a schedule
router.delete('/:id/employee/:employeeId/shifts', async (req: AuthRequest, res) => {
  try {
    const sched = await prisma.schedule.findFirst({ where: { id: req.params.id as string, restaurant: { userId: req.userId! } } });
    if (!sched) { res.status(404).json({ error: 'Schedule not found' }); return; }
    if (!canAccessRestaurant(req, sched.restaurantId)) { res.status(404).json({ error: 'Schedule not found' }); return; }

    await prisma.shift.deleteMany({ where: { scheduleId: req.params.id as string, employeeId: req.params.employeeId as string } });
    // Also remove the order entry
    await prisma.scheduleEmployeeOrder.deleteMany({ where: { scheduleId: req.params.id as string, employeeId: req.params.employeeId as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete employee shifts' });
  }
});

// Helper: check if two time ranges overlap
function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const s1 = toMin(start1), e1 = toMin(end1), s2 = toMin(start2), e2 = toMin(end2);
  return s1 < e2 && s2 < e1;
}

// Shift management - verify via schedule -> restaurant -> user
router.post('/:id/shifts', async (req: AuthRequest, res) => {
  try {
    const sched = await prisma.schedule.findFirst({ where: { id: req.params.id as string, restaurant: { userId: req.userId! } } });
    if (!sched) { res.status(404).json({ error: 'Schedule not found' }); return; }
    if (!canAccessRestaurant(req, sched.restaurantId)) { res.status(404).json({ error: 'Schedule not found' }); return; }

    const { employeeId, dayOfWeek, startTime, endTime, shiftType, notes, breakMinutes } = req.body;
    if (shiftType === 'WORK' || shiftType === 'BREAK') {
      const existing = await prisma.shift.findMany({ where: { scheduleId: req.params.id as string, employeeId, dayOfWeek } });
      const overlap = existing.find(s => (s.shiftType === 'WORK' || s.shiftType === 'BREAK') && timesOverlap(startTime, endTime, s.startTime, s.endTime));
      if (overlap) { res.status(409).json({ error: `Overlaps with existing shift (${overlap.startTime} - ${overlap.endTime})` }); return; }
    }

    const shift = await prisma.shift.create({
      data: { employeeId, dayOfWeek, startTime, endTime, shiftType: shiftType || 'WORK', breakMinutes: breakMinutes || 0, notes, scheduleId: req.params.id as string },
      include: { employee: true },
    });
    res.status(201).json(shift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

router.post('/:id/shifts/bulk', async (req: AuthRequest, res) => {
  try {
    const sched = await prisma.schedule.findFirst({ where: { id: req.params.id as string, restaurant: { userId: req.userId! } } });
    if (!sched) { res.status(404).json({ error: 'Schedule not found' }); return; }
    if (!canAccessRestaurant(req, sched.restaurantId)) { res.status(404).json({ error: 'Schedule not found' }); return; }

    const { shifts } = req.body;
    for (const s of shifts) {
      if (s.shiftType === 'WORK' || s.shiftType === 'BREAK') {
        const existing = await prisma.shift.findMany({ where: { scheduleId: req.params.id as string, employeeId: s.employeeId, dayOfWeek: s.dayOfWeek } });
        const overlap = existing.find(ex => (ex.shiftType === 'WORK' || ex.shiftType === 'BREAK') && timesOverlap(s.startTime, s.endTime, ex.startTime, ex.endTime));
        if (overlap) { res.status(409).json({ error: `Shift ${s.startTime}-${s.endTime} overlaps with existing (${overlap.startTime}-${overlap.endTime})` }); return; }
      }
    }

    const created = await Promise.all(
      shifts.map((s: any) => prisma.shift.create({
        data: { employeeId: s.employeeId, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, shiftType: s.shiftType || 'WORK', breakMinutes: s.breakMinutes || 0, notes: s.notes, scheduleId: req.params.id as string },
        include: { employee: true },
      }))
    );
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create shifts' });
  }
});

router.put('/shifts/:shiftId', async (req: AuthRequest, res) => {
  try {
    const { dayOfWeek, startTime, endTime, shiftType, notes, breakMinutes } = req.body;
    const current = await prisma.shift.findFirst({
      where: { id: req.params.shiftId as string, schedule: { restaurant: { userId: req.userId! } } },
      include: { schedule: { select: { restaurantId: true } } },
    });
    if (!current) { res.status(404).json({ error: 'Shift not found' }); return; }
    if (!canAccessRestaurant(req, current.schedule.restaurantId)) { res.status(404).json({ error: 'Shift not found' }); return; }

    if ((shiftType === 'WORK' || shiftType === 'BREAK') && startTime && endTime) {
      const existing = await prisma.shift.findMany({
        where: { scheduleId: current.scheduleId, employeeId: current.employeeId, dayOfWeek: dayOfWeek ?? current.dayOfWeek, id: { not: req.params.shiftId as string } },
      });
      const overlap = existing.find(s => (s.shiftType === 'WORK' || s.shiftType === 'BREAK') && timesOverlap(startTime, endTime, s.startTime, s.endTime));
      if (overlap) { res.status(409).json({ error: `Overlaps with existing shift (${overlap.startTime} - ${overlap.endTime})` }); return; }
    }

    const data: any = { dayOfWeek, startTime, endTime, shiftType, notes };
    if (breakMinutes !== undefined) data.breakMinutes = breakMinutes;

    const shift = await prisma.shift.update({
      where: { id: req.params.shiftId as string },
      data,
      include: { employee: true },
    });
    res.json(shift);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

router.delete('/shifts/:shiftId', async (req: AuthRequest, res) => {
  try {
    const shift = await prisma.shift.findFirst({
      where: { id: req.params.shiftId as string, schedule: { restaurant: { userId: req.userId! } } },
      include: { schedule: { select: { restaurantId: true } } },
    });
    if (!shift) { res.status(404).json({ error: 'Shift not found' }); return; }
    if (!canAccessRestaurant(req, shift.schedule.restaurantId)) { res.status(404).json({ error: 'Shift not found' }); return; }
    await prisma.shift.delete({ where: { id: req.params.shiftId as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

export default router;
