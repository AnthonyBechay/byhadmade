import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { userId: req.userId! },
      orderBy: { name: 'asc' },
    });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, phone, email, deliveryType, notes } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
    const supplier = await prisma.supplier.create({
      data: { name: name.trim(), phone: phone || null, email: email || null, deliveryType: deliveryType || null, notes: notes || null, userId: req.userId! },
    });
    res.status(201).json(supplier);
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Supplier already exists' }); return; }
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, phone, email, deliveryType, notes } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id as string, userId: req.userId! },
      data: { name, phone: phone || null, email: email || null, deliveryType: deliveryType || null, notes: notes || null },
    });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.supplier.delete({ where: { id: req.params.id as string, userId: req.userId! } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

export default router;
