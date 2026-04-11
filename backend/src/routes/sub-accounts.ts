import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticate, requireOwner, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const MAX_SUB_ACCOUNTS = 5;

router.use(authenticate);
router.use(requireOwner); // only the owner can manage sub-accounts

const SAFE_FIELDS = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  allowedMenuIds: true,
  allowedRestaurantIds: true,
  allowedFeatures: true,
  createdAt: true,
  updatedAt: true,
};

// ─── List ───
router.get('/', async (req: AuthRequest, res) => {
  try {
    const subs = await prisma.subAccount.findMany({
      where: { ownerId: req.userId! },
      select: SAFE_FIELDS,
      orderBy: { createdAt: 'asc' },
    });
    res.json(subs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch sub-accounts' });
  }
});

// ─── Create ───
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { email, password, name, isActive, allowedMenuIds, allowedRestaurantIds, allowedFeatures } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const count = await prisma.subAccount.count({ where: { ownerId: req.userId! } });
    if (count >= MAX_SUB_ACCOUNTS) {
      res.status(400).json({ error: `You can only create up to ${MAX_SUB_ACCOUNTS} sub-accounts` });
      return;
    }

    const existing = await prisma.subAccount.findUnique({
      where: { ownerId_email: { ownerId: req.userId!, email } },
    });
    if (existing) {
      res.status(409).json({ error: 'A sub-account with this email already exists' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const sub = await prisma.subAccount.create({
      data: {
        ownerId: req.userId!,
        email,
        name,
        password: hashed,
        isActive: isActive !== false,
        allowedMenuIds: Array.isArray(allowedMenuIds) ? allowedMenuIds : [],
        allowedRestaurantIds: Array.isArray(allowedRestaurantIds) ? allowedRestaurantIds : [],
        allowedFeatures: Array.isArray(allowedFeatures) ? allowedFeatures : [],
      },
      select: SAFE_FIELDS,
    });
    res.status(201).json(sub);
  } catch (error: any) {
    console.error('Create sub-account failed:', error);
    res.status(500).json({ error: error?.message || 'Failed to create sub-account' });
  }
});

// ─── Update ───
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.subAccount.findFirst({
      where: { id, ownerId: req.userId! },
    });
    if (!existing) { res.status(404).json({ error: 'Sub-account not found' }); return; }

    const { email, password, name, isActive, allowedMenuIds, allowedRestaurantIds, allowedFeatures } = req.body;
    const data: any = {};
    if (email !== undefined) data.email = email;
    if (name !== undefined) data.name = name;
    if (isActive !== undefined) data.isActive = !!isActive;
    if (Array.isArray(allowedMenuIds)) data.allowedMenuIds = allowedMenuIds;
    if (Array.isArray(allowedRestaurantIds)) data.allowedRestaurantIds = allowedRestaurantIds;
    if (Array.isArray(allowedFeatures)) data.allowedFeatures = allowedFeatures;
    if (password) {
      if (typeof password !== 'string' || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }
      data.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.subAccount.update({
      where: { id: existing.id },
      data,
      select: SAFE_FIELDS,
    });
    res.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'A sub-account with this email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to update sub-account' });
  }
});

// ─── Delete ───
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.subAccount.findFirst({
      where: { id, ownerId: req.userId! },
    });
    if (!existing) { res.status(404).json({ error: 'Sub-account not found' }); return; }
    await prisma.subAccount.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete sub-account' });
  }
});

export default router;
