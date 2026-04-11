import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireFeature, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireFeature('recipes'));

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { categoryId, subcategoryId, search } = req.query;
    const where: any = { userId: req.userId! };
    if (categoryId) where.categoryId = categoryId;
    if (subcategoryId) where.subcategoryId = subcategoryId;
    if (search) where.title = { contains: search as string, mode: 'insensitive' };

    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        category: true,
        subcategory: true,
        ingredients: { include: { ingredient: true } },
        _count: { select: { menuItems: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const recipe = await prisma.recipe.findFirst({
      where: { id: req.params.id as string, userId: req.userId! },
      include: {
        category: true,
        subcategory: true,
        ingredients: { include: { ingredient: true } },
      },
    });
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, description, instructions, prepTime, cookTime, servings, difficulty, imageUrl, categoryId, subcategoryId, ingredients } = req.body;
    const recipe = await prisma.recipe.create({
      data: {
        title, description, instructions, prepTime, cookTime, servings, difficulty, imageUrl, categoryId, subcategoryId,
        userId: req.userId!,
        ingredients: ingredients ? {
          create: ingredients.map((ing: any) => ({
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes,
            ingredientId: ing.ingredientId,
          })),
        } : undefined,
      },
      include: { category: true, subcategory: true, ingredients: { include: { ingredient: true } } },
    });
    res.status(201).json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { title, description, instructions, prepTime, cookTime, servings, difficulty, imageUrl, categoryId, subcategoryId, ingredients } = req.body;

    // Verify ownership
    const existing = await prisma.recipe.findFirst({ where: { id: req.params.id as string, userId: req.userId! } });
    if (!existing) { res.status(404).json({ error: 'Recipe not found' }); return; }

    if (ingredients) {
      await prisma.recipeIngredient.deleteMany({ where: { recipeId: req.params.id as string } });
    }

    const recipe = await prisma.recipe.update({
      where: { id: req.params.id as string },
      data: {
        title, description, instructions, prepTime, cookTime, servings, difficulty, imageUrl, categoryId, subcategoryId,
        ingredients: ingredients ? {
          create: ingredients.map((ing: any) => ({
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes,
            ingredientId: ing.ingredientId,
          })),
        } : undefined,
      },
      include: { category: true, subcategory: true, ingredients: { include: { ingredient: true } } },
    });
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.recipe.delete({ where: { id: req.params.id as string, userId: req.userId! } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

export default router;
