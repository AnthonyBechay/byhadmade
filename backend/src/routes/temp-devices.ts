import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireFeature, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireFeature('temperatures'));

// ─── List ───
router.get('/', async (req: AuthRequest, res) => {
  try {
    const devices = await prisma.tempDevice.findMany({
      where: { userId: req.userId! },
      orderBy: [{ location: 'asc' }, { name: 'asc' }],
    });
    res.json(devices);
  } catch {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// ─── Create ───
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, location, deviceType, minTemp, maxTemp, targetTemp, unit, notes, isActive } = req.body;
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }
    if (minTemp == null || maxTemp == null) { res.status(400).json({ error: 'Min and max temperature are required' }); return; }
    if (minTemp >= maxTemp) { res.status(400).json({ error: 'Min must be less than max temperature' }); return; }

    const device = await prisma.tempDevice.create({
      data: {
        userId: req.userId!,
        name,
        location: location || null,
        deviceType: deviceType || 'FRIDGE',
        minTemp: parseFloat(minTemp),
        maxTemp: parseFloat(maxTemp),
        targetTemp: targetTemp != null ? parseFloat(targetTemp) : null,
        unit: unit || 'CELSIUS',
        notes: notes || null,
        isActive: isActive !== false,
      },
    });
    res.status(201).json(device);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to create device' });
  }
});

// ─── Update ───
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.tempDevice.findFirst({ where: { id, userId: req.userId! } });
    if (!existing) { res.status(404).json({ error: 'Device not found' }); return; }

    const { name, location, deviceType, minTemp, maxTemp, targetTemp, unit, notes, isActive } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (location !== undefined) data.location = location || null;
    if (deviceType !== undefined) data.deviceType = deviceType;
    if (minTemp != null) data.minTemp = parseFloat(minTemp);
    if (maxTemp != null) data.maxTemp = parseFloat(maxTemp);
    if (targetTemp !== undefined) data.targetTemp = targetTemp != null ? parseFloat(targetTemp) : null;
    if (unit !== undefined) data.unit = unit;
    if (notes !== undefined) data.notes = notes || null;
    if (isActive !== undefined) data.isActive = !!isActive;

    const updated = await prisma.tempDevice.update({ where: { id }, data });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update device' });
  }
});

// ─── Delete ───
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.tempDevice.findFirst({ where: { id, userId: req.userId! } });
    if (!existing) { res.status(404).json({ error: 'Device not found' }); return; }
    await prisma.tempDevice.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

export default router;
