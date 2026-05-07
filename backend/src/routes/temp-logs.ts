import { Router, Response } from 'express';
import { PrismaClient, TempDevice } from '@prisma/client';
import { authenticate, requireFeature, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireFeature('temperatures'));

// ─── Helpers ───

function toDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function randomInRange(min: number, max: number): number {
  // Random float within [min, max], 1 decimal place
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

type TempStatus = 'ok' | 'warning' | 'danger';

function calcStatus(temp: number, device: TempDevice): TempStatus {
  if (temp >= device.minTemp && temp <= device.maxTemp) return 'ok';
  const range = device.maxTemp - device.minTemp;
  const threshold = range * 0.10;
  const deviation = temp < device.minTemp ? device.minTemp - temp : temp - device.maxTemp;
  return deviation <= threshold ? 'warning' : 'danger';
}

// Count consecutive days (backwards from date) where status != 'ok'
async function consecutiveDaysOutOfRange(deviceId: string, date: Date, device: TempDevice): Promise<number> {
  // Look at up to 60 days back
  const from = new Date(date);
  from.setDate(from.getDate() - 60);

  const logs = await prisma.tempLog.findMany({
    where: { deviceId, date: { gte: from, lte: date } },
    orderBy: { date: 'desc' },
  });

  let count = 0;
  // Walk backwards from today; stop when we hit an 'ok' day or a gap
  const logMap = new Map(logs.map((l) => [l.date.toISOString(), l]));
  const cur = new Date(date);
  while (true) {
    const key = cur.toISOString();
    const log = logMap.get(key);
    if (!log) break; // no log = no data = stop
    const s = calcStatus(log.temp, device);
    if (s === 'ok') break;
    count++;
    cur.setDate(cur.getDate() - 1);
  }
  return count;
}

// ─── Auto-fill past unlogged days for a device ───
async function autoFillPastLogs(device: TempDevice, userId: string) {
  const today = todayUTC();
  const deviceCreated = new Date(Date.UTC(
    device.createdAt.getFullYear(), device.createdAt.getMonth(), device.createdAt.getDate(),
  ));

  // Find all existing log dates for this device
  const existing = await prisma.tempLog.findMany({
    where: { deviceId: device.id, date: { gte: deviceCreated, lte: today } },
    select: { date: true },
  });
  const existingDates = new Set(existing.map((l) => l.date.getTime()));

  // Build list of missing dates
  const missing: { deviceId: string; userId: string; date: Date; temp: number; isAutoFilled: boolean }[] = [];
  const cur = new Date(deviceCreated);
  while (cur <= today) {
    if (!existingDates.has(cur.getTime())) {
      missing.push({
        deviceId: device.id,
        userId,
        date: new Date(cur),
        temp: randomInRange(device.minTemp, device.maxTemp),
        isAutoFilled: true,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (missing.length) {
    await prisma.tempLog.createMany({ data: missing, skipDuplicates: true });
  }
}

// ─── GET /api/temp-logs?date=YYYY-MM-DD ───
// Returns logs for all active devices on that date (auto-creates/auto-fills missing)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const date = toDateUTC(dateStr);
    const userId = req.userId!;
    const isToday = date.getTime() === todayUTC().getTime();
    const isPast = date <= todayUTC();

    const devices = await prisma.tempDevice.findMany({
      where: { userId, isActive: true },
      orderBy: [{ location: 'asc' }, { name: 'asc' }],
    });

    // For past dates (including today), auto-fill any missing logs
    if (isPast) {
      for (const device of devices) {
        await autoFillPastLogs(device, userId);
      }
    }

    // Fetch logs for the requested date
    const logs = await prisma.tempLog.findMany({
      where: { userId, date },
      include: { device: true },
    });

    const logByDevice = new Map(logs.map((l) => [l.deviceId, l]));

    // For today, create placeholder (null temp) if log doesn't exist yet and device
    // is brand-new (created today) so user can enter their first reading
    const result = await Promise.all(
      devices.map(async (device) => {
        const log = logByDevice.get(device.id) ?? null;
        let consecutiveDays = 0;
        if (log) {
          const s = calcStatus(log.temp, device);
          if (s !== 'ok') {
            consecutiveDays = await consecutiveDaysOutOfRange(device.id, date, device);
          }
        }
        return {
          device,
          log,
          status: log ? calcStatus(log.temp, device) : 'no-data',
          consecutiveDaysOutOfRange: consecutiveDays,
        };
      }),
    );

    res.json(result);
  } catch (error: any) {
    console.error('temp-logs GET failed:', error);
    res.status(500).json({ error: 'Failed to fetch temperature logs' });
  }
});

// ─── GET /api/temp-logs/history?deviceId=&from=&to= ───
router.get('/history', async (req: AuthRequest, res) => {
  try {
    const { deviceId, from, to } = req.query as Record<string, string>;
    const where: any = { userId: req.userId! };
    if (deviceId) where.deviceId = deviceId;
    if (from) where.date = { ...where.date, gte: toDateUTC(from) };
    if (to) where.date = { ...where.date, lte: toDateUTC(to) };

    const logs = await prisma.tempLog.findMany({
      where,
      include: { device: true },
      orderBy: [{ deviceId: 'asc' }, { date: 'asc' }],
    });
    res.json(logs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ─── GET /api/temp-logs/export?from=&to= ─── (CSV download)
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const userId = req.userId!;

    const where: any = { userId };
    if (from) where.date = { ...where.date, gte: toDateUTC(from) };
    if (to) where.date = { ...where.date, lte: toDateUTC(to) };

    const logs = await prisma.tempLog.findMany({
      where,
      include: { device: true },
      orderBy: [{ device: { name: 'asc' } }, { date: 'asc' }],
    });

    const unitLabel = (u: string) => (u === 'CELSIUS' ? '°C' : '°F');
    const typeLabel: Record<string, string> = {
      FRIDGE: 'Fridge', FREEZER: 'Freezer', COLD_ROOM: 'Cold Room',
      WINE_CELLAR: 'Wine Cellar', OVEN: 'Oven', WARMER: 'Warmer', OTHER: 'Other',
    };

    const rows: string[] = [
      'Device,Location,Type,Unit,Min,Max,Target,Date,Temperature,Status,Auto-filled,Notes',
      ...logs.map((l) => {
        const d = l.device;
        const s = calcStatus(l.temp, d);
        const dateStr = l.date.toISOString().slice(0, 10);
        const escape = (v: string | null | undefined) => `"${(v || '').replace(/"/g, '""')}"`;
        return [
          escape(d.name),
          escape(d.location),
          escape(typeLabel[d.deviceType] || d.deviceType),
          unitLabel(d.unit),
          d.minTemp,
          d.maxTemp,
          d.targetTemp ?? '',
          dateStr,
          l.temp,
          s,
          l.isAutoFilled ? 'Yes' : 'No',
          escape(l.notes),
        ].join(',');
      }),
    ];

    const filename = `temperature-report-${from || 'all'}-to-${to || 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(rows.join('\n'));
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to export' });
  }
});

// ─── PATCH /api/temp-logs/:id ─── (update temp for a log)
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const log = await prisma.tempLog.findFirst({
      where: { id, userId: req.userId! },
    });
    if (!log) { res.status(404).json({ error: 'Log not found' }); return; }

    const { temp, notes } = req.body;
    const updated = await prisma.tempLog.update({
      where: { id },
      data: {
        temp: parseFloat(temp),
        notes: notes ?? log.notes,
        isAutoFilled: false, // user explicitly set it
        loggedAt: new Date(),
      },
      include: { device: true },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update log' });
  }
});

// ─── POST /api/temp-logs ─── (create or update log for a device+date)
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { deviceId, date: dateStr, temp, notes } = req.body;
    if (!deviceId || temp == null) { res.status(400).json({ error: 'deviceId and temp are required' }); return; }

    // Verify device ownership
    const device = await prisma.tempDevice.findFirst({ where: { id: deviceId, userId: req.userId! } });
    if (!device) { res.status(404).json({ error: 'Device not found' }); return; }

    const date = toDateUTC(dateStr || new Date().toISOString().slice(0, 10));

    const log = await prisma.tempLog.upsert({
      where: { deviceId_date: { deviceId, date } },
      update: { temp: parseFloat(temp), notes: notes ?? null, isAutoFilled: false, loggedAt: new Date() },
      create: { deviceId, userId: req.userId!, date, temp: parseFloat(temp), notes: notes ?? null, isAutoFilled: false },
      include: { device: true },
    });
    res.json(log);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to save log' });
  }
});

export default router;
