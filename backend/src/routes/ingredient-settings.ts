import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

// ─── Categories ───
router.get('/categories', async (req: AuthRequest, res) => {
  try {
    const categories = await prisma.ingredientCategory.findMany({
      where: { userId: req.userId! },
      include: { subcategories: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/categories', async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
    const cat = await prisma.ingredientCategory.create({
      data: { name: name.trim(), userId: req.userId! },
      include: { subcategories: true },
    });
    res.status(201).json(cat);
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Category already exists' }); return; }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    // Update category name and also update all ingredients using the old name
    const old = await prisma.ingredientCategory.findFirst({ where: { id: req.params.id as string, userId: req.userId! } });
    if (!old) { res.status(404).json({ error: 'Not found' }); return; }
    const cat = await prisma.ingredientCategory.update({
      where: { id: req.params.id as string },
      data: { name },
      include: { subcategories: true },
    });
    // Update ingredient category strings
    if (old.name !== name) {
      await prisma.ingredient.updateMany({ where: { category: old.name, userId: req.userId! }, data: { category: name } });
    }
    res.json(cat);
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Category already exists' }); return; }
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', async (req: AuthRequest, res) => {
  try {
    const cat = await prisma.ingredientCategory.findFirst({ where: { id: req.params.id as string, userId: req.userId! } });
    if (!cat) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.ingredientCategory.delete({ where: { id: cat.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ─── Subcategories ───
router.post('/categories/:categoryId/subcategories', async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
    const cat = await prisma.ingredientCategory.findFirst({ where: { id: req.params.categoryId as string, userId: req.userId! } });
    if (!cat) { res.status(404).json({ error: 'Category not found' }); return; }
    const sub = await prisma.ingredientSubcategory.create({
      data: { name: name.trim(), categoryId: cat.id },
    });
    res.status(201).json(sub);
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Subcategory already exists in this category' }); return; }
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});

router.put('/subcategories/:id', async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    const old = await prisma.ingredientSubcategory.findUnique({
      where: { id: req.params.id as string },
      include: { category: true },
    });
    if (!old || old.category.userId !== req.userId) { res.status(404).json({ error: 'Not found' }); return; }
    const sub = await prisma.ingredientSubcategory.update({
      where: { id: req.params.id as string },
      data: { name },
    });
    if (old.name !== name) {
      await prisma.ingredient.updateMany({ where: { subcategory: old.name, userId: req.userId! }, data: { subcategory: name } });
    }
    res.json(sub);
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Subcategory already exists' }); return; }
    res.status(500).json({ error: 'Failed to update subcategory' });
  }
});

router.delete('/subcategories/:id', async (req: AuthRequest, res) => {
  try {
    const sub = await prisma.ingredientSubcategory.findUnique({
      where: { id: req.params.id as string },
      include: { category: true },
    });
    if (!sub || sub.category.userId !== req.userId) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.ingredientSubcategory.delete({ where: { id: sub.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
});

// ─── Tags ───
router.get('/tags', async (req: AuthRequest, res) => {
  try {
    const tags = await prisma.ingredientTag.findMany({
      where: { userId: req.userId! },
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

router.post('/tags', async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
    const tag = await prisma.ingredientTag.create({
      data: { name: name.trim(), userId: req.userId! },
    });
    res.status(201).json(tag);
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Tag already exists' }); return; }
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

router.put('/tags/:id', async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    const tag = await prisma.ingredientTag.update({
      where: { id: req.params.id as string, userId: req.userId! },
      data: { name },
    });
    res.json(tag);
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Tag already exists' }); return; }
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

router.delete('/tags/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.ingredientTag.delete({ where: { id: req.params.id as string, userId: req.userId! } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;
