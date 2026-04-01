import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const locations = await prisma.storageLocation.findMany({
      where: { userId: req.userId! },
      orderBy: { name: 'asc' },
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch storage locations' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, notes } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
    const location = await prisma.storageLocation.create({
      data: { name: name.trim(), notes: notes || null, userId: req.userId! },
    });
    res.status(201).json(location);
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Storage location already exists' }); return; }
    res.status(500).json({ error: 'Failed to create storage location' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, notes } = req.body;
    const location = await prisma.storageLocation.update({
      where: { id: req.params.id as string, userId: req.userId! },
      data: { name, notes: notes || null },
    });
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update storage location' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.storageLocation.delete({ where: { id: req.params.id as string, userId: req.userId! } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete storage location' });
  }
});

export default router;
