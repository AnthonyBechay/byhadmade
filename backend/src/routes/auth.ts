import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'byhadmade-jwt-secret-change-me';

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashed, name } });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // 1) Try owner user first
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const valid = await bcrypt.compare(password, user.password);
      if (valid) {
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
          token,
          user: { id: user.id, email: user.email, name: user.name, role: 'owner' },
        });
        return;
      }
    }

    // 2) Fall back to sub-account (scoped by the owner it belongs to).
    // If the same email exists under multiple owners, try each and accept the first match.
    const subCandidates = await prisma.subAccount.findMany({
      where: { email, isActive: true },
    });
    for (const sub of subCandidates) {
      const valid = await bcrypt.compare(password, sub.password);
      if (valid) {
        const token = jwt.sign(
          {
            userId: sub.ownerId,
            subAccountId: sub.id,
            allowedRestaurantIds: sub.allowedRestaurantIds,
            allowedMenuIds: sub.allowedMenuIds,
            allowedFeatures: sub.allowedFeatures,
          },
          JWT_SECRET,
          { expiresIn: '7d' },
        );
        res.json({
          token,
          user: { id: sub.id, email: sub.email, name: sub.name, role: 'sub-account' },
        });
        return;
      }
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.subAccountId) {
      const sub = await prisma.subAccount.findUnique({
        where: { id: req.subAccountId },
        select: {
          id: true, email: true, name: true, isActive: true,
          allowedRestaurantIds: true, allowedMenuIds: true, allowedFeatures: true,
        },
      });
      if (!sub || !sub.isActive) {
        res.status(404).json({ error: 'Account not found or disabled' });
        return;
      }
      res.json({ ...sub, role: 'sub-account' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ ...user, role: 'owner' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
