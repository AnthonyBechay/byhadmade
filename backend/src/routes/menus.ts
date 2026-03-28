import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const menus = await prisma.menu.findMany({
      where: { userId: req.userId! },
      include: {
        items: { include: { recipe: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(menus);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menus' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const menu = await prisma.menu.findFirst({
      where: { id: req.params.id as string, userId: req.userId! },
      include: {
        items: {
          include: { recipe: { include: { ingredients: { include: { ingredient: true } } } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!menu) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }
    res.json(menu);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, items } = req.body;
    const menu = await prisma.menu.create({
      data: {
        name, description,
        userId: req.userId!,
        items: items ? {
          create: items.map((item: any, idx: number) => ({
            recipeId: item.recipeId,
            price: item.price,
            notes: item.notes,
            section: item.section,
            sortOrder: item.sortOrder ?? idx,
          })),
        } : undefined,
      },
      include: { items: { include: { recipe: true } } },
    });
    res.status(201).json(menu);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create menu' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description, isActive, items } = req.body;

    const existing = await prisma.menu.findFirst({ where: { id: req.params.id as string, userId: req.userId! } });
    if (!existing) { res.status(404).json({ error: 'Menu not found' }); return; }

    if (items) {
      await prisma.menuItem.deleteMany({ where: { menuId: req.params.id as string } });
    }

    const menu = await prisma.menu.update({
      where: { id: req.params.id as string },
      data: {
        name, description, isActive,
        items: items ? {
          create: items.map((item: any, idx: number) => ({
            recipeId: item.recipeId,
            price: item.price,
            notes: item.notes,
            section: item.section,
            sortOrder: item.sortOrder ?? idx,
          })),
        } : undefined,
      },
      include: { items: { include: { recipe: true } } },
    });
    res.json(menu);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update menu' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.menu.delete({ where: { id: req.params.id as string, userId: req.userId! } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu' });
  }
});

export default router;
