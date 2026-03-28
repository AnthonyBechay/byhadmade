import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (_req, res) => {
  try {
    const menus = await prisma.menu.findMany({
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

router.get('/:id', async (req, res) => {
  try {
    const menu = await prisma.menu.findUnique({
      where: { id: req.params.id },
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

router.post('/', async (req, res) => {
  try {
    const { name, description, items } = req.body;
    const menu = await prisma.menu.create({
      data: {
        name, description,
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

router.put('/:id', async (req, res) => {
  try {
    const { name, description, isActive, items } = req.body;

    if (items) {
      await prisma.menuItem.deleteMany({ where: { menuId: req.params.id } });
    }

    const menu = await prisma.menu.update({
      where: { id: req.params.id },
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

router.delete('/:id', async (req, res) => {
  try {
    await prisma.menu.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu' });
  }
});

export default router;
