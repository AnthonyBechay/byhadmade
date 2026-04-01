import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const search = req.query.search as string | undefined;
    const where: any = { userId: req.userId! };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const ingredients = await prisma.ingredient.findMany({
      where,
      include: { tags: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(ingredients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ingredients' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, unit, category, subcategory, tagIds, supplier, purchaseUnit, purchaseQty, unitPrice, currency, minStock, notes } = req.body;
    const ingredient = await prisma.ingredient.create({
      data: {
        name, unit: unit || null, category: category || null,
        subcategory: subcategory || null,
        supplier: supplier || null, purchaseUnit: purchaseUnit || null,
        purchaseQty: purchaseQty ? parseFloat(purchaseQty) : null,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        currency: currency || 'USD', minStock: minStock ? parseFloat(minStock) : null,
        notes: notes || null, userId: req.userId!,
        tags: tagIds?.length ? { connect: tagIds.map((id: string) => ({ id })) } : undefined,
      },
      include: { tags: { select: { id: true, name: true } } },
    });
    res.status(201).json(ingredient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ingredient' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, unit, category, subcategory, tagIds, supplier, purchaseUnit, purchaseQty, unitPrice, currency, minStock, notes } = req.body;
    const ingredient = await prisma.ingredient.update({
      where: { id: req.params.id as string, userId: req.userId! },
      data: {
        name, unit: unit || null, category: category || null,
        subcategory: subcategory || null,
        supplier: supplier || null, purchaseUnit: purchaseUnit || null,
        purchaseQty: purchaseQty ? parseFloat(purchaseQty) : null,
        unitPrice: unitPrice ? parseFloat(unitPrice) : null,
        currency: currency || 'USD', minStock: minStock ? parseFloat(minStock) : null,
        notes: notes || null,
        tags: { set: tagIds?.length ? tagIds.map((id: string) => ({ id })) : [] },
      },
      include: { tags: { select: { id: true, name: true } } },
    });
    res.json(ingredient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ingredient' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.ingredient.delete({ where: { id: req.params.id as string, userId: req.userId! } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ingredient' });
  }
});

// ─── Seed basic ingredients + categories + subcategories + tags ───
const SEED_DATA = {
  categories: [
    { name: 'Meats', subcategories: ['Poultry', 'Beef', 'Lamb', 'Pork', 'Processed'] },
    { name: 'Seafood', subcategories: [] },
    { name: 'Dairy', subcategories: ['Butter & Cream', 'Cheese'] },
    { name: 'Vegetables', subcategories: ['Leafy Greens'] },
    { name: 'Fruits', subcategories: [] },
    { name: 'Breads', subcategories: [] },
    { name: 'Grains & Pasta', subcategories: ['Flour'] },
    { name: 'Herbs & Spices', subcategories: ['Basics', 'Fresh Herbs'] },
    { name: 'Oils & Vinegars', subcategories: [] },
    { name: 'Sauces & Condiments', subcategories: [] },
    { name: 'Legumes & Canned', subcategories: [] },
    { name: 'Nuts & Dried', subcategories: [] },
    { name: 'Beverages', subcategories: [] },
    { name: 'Baking', subcategories: [] },
  ],
  tags: ['Premium', 'Organic', 'Seasonal', 'Imported', 'Local', 'Frozen', 'Fresh'],
  ingredients: [
    { name: 'Chicken Breast', unit: 'kg', category: 'Meats', subcategory: 'Poultry' },
    { name: 'Chicken Thigh', unit: 'kg', category: 'Meats', subcategory: 'Poultry' },
    { name: 'Whole Chicken', unit: 'pcs', category: 'Meats', subcategory: 'Poultry' },
    { name: 'Ground Beef', unit: 'kg', category: 'Meats', subcategory: 'Beef' },
    { name: 'Beef Tenderloin', unit: 'kg', category: 'Meats', subcategory: 'Beef' },
    { name: 'Beef Ribeye', unit: 'kg', category: 'Meats', subcategory: 'Beef' },
    { name: 'Lamb Leg', unit: 'kg', category: 'Meats', subcategory: 'Lamb' },
    { name: 'Lamb Chops', unit: 'kg', category: 'Meats', subcategory: 'Lamb' },
    { name: 'Ground Lamb', unit: 'kg', category: 'Meats', subcategory: 'Lamb' },
    { name: 'Pork Belly', unit: 'kg', category: 'Meats', subcategory: 'Pork' },
    { name: 'Pork Loin', unit: 'kg', category: 'Meats', subcategory: 'Pork' },
    { name: 'Sausages', unit: 'kg', category: 'Meats', subcategory: 'Processed' },
    { name: 'Bacon', unit: 'kg', category: 'Meats', subcategory: 'Processed' },
    { name: 'Salmon Fillet', unit: 'kg', category: 'Seafood' },
    { name: 'Shrimp', unit: 'kg', category: 'Seafood' },
    { name: 'Calamari', unit: 'kg', category: 'Seafood' },
    { name: 'Sea Bass', unit: 'kg', category: 'Seafood' },
    { name: 'Tuna', unit: 'kg', category: 'Seafood' },
    { name: 'Butter', unit: 'kg', category: 'Dairy', subcategory: 'Butter & Cream' },
    { name: 'Heavy Cream', unit: 'L', category: 'Dairy', subcategory: 'Butter & Cream' },
    { name: 'Milk', unit: 'L', category: 'Dairy' },
    { name: 'Eggs', unit: 'dozen', category: 'Dairy' },
    { name: 'Mozzarella', unit: 'kg', category: 'Dairy', subcategory: 'Cheese' },
    { name: 'Parmesan', unit: 'kg', category: 'Dairy', subcategory: 'Cheese' },
    { name: 'Cheddar', unit: 'kg', category: 'Dairy', subcategory: 'Cheese' },
    { name: 'Feta Cheese', unit: 'kg', category: 'Dairy', subcategory: 'Cheese' },
    { name: 'Halloumi', unit: 'kg', category: 'Dairy', subcategory: 'Cheese' },
    { name: 'Yogurt', unit: 'kg', category: 'Dairy' },
    { name: 'Labneh', unit: 'kg', category: 'Dairy' },
    { name: 'Onion', unit: 'kg', category: 'Vegetables' },
    { name: 'Garlic', unit: 'kg', category: 'Vegetables' },
    { name: 'Tomato', unit: 'kg', category: 'Vegetables' },
    { name: 'Potato', unit: 'kg', category: 'Vegetables' },
    { name: 'Carrot', unit: 'kg', category: 'Vegetables' },
    { name: 'Bell Pepper', unit: 'kg', category: 'Vegetables' },
    { name: 'Zucchini', unit: 'kg', category: 'Vegetables' },
    { name: 'Eggplant', unit: 'kg', category: 'Vegetables' },
    { name: 'Cucumber', unit: 'kg', category: 'Vegetables' },
    { name: 'Lettuce', unit: 'pcs', category: 'Vegetables', subcategory: 'Leafy Greens' },
    { name: 'Spinach', unit: 'kg', category: 'Vegetables', subcategory: 'Leafy Greens' },
    { name: 'Arugula', unit: 'kg', category: 'Vegetables', subcategory: 'Leafy Greens' },
    { name: 'Mushrooms', unit: 'kg', category: 'Vegetables' },
    { name: 'Corn', unit: 'pcs', category: 'Vegetables' },
    { name: 'Green Beans', unit: 'kg', category: 'Vegetables' },
    { name: 'Broccoli', unit: 'kg', category: 'Vegetables' },
    { name: 'Cauliflower', unit: 'pcs', category: 'Vegetables' },
    { name: 'Cabbage', unit: 'pcs', category: 'Vegetables' },
    { name: 'Lemon', unit: 'kg', category: 'Fruits' },
    { name: 'Lime', unit: 'kg', category: 'Fruits' },
    { name: 'Orange', unit: 'kg', category: 'Fruits' },
    { name: 'Avocado', unit: 'pcs', category: 'Fruits' },
    { name: 'Banana', unit: 'kg', category: 'Fruits' },
    { name: 'Strawberry', unit: 'kg', category: 'Fruits' },
    { name: 'Apple', unit: 'kg', category: 'Fruits' },
    { name: 'Pita Bread', unit: 'pcs', category: 'Breads' },
    { name: 'Arabic Bread', unit: 'bag', category: 'Breads' },
    { name: 'Baguette', unit: 'pcs', category: 'Breads' },
    { name: 'Sliced Bread', unit: 'bag', category: 'Breads' },
    { name: 'Tortilla Wraps', unit: 'bag', category: 'Breads' },
    { name: 'Burger Buns', unit: 'bag', category: 'Breads' },
    { name: 'Croissants', unit: 'pcs', category: 'Breads' },
    { name: 'Manoushe Dough', unit: 'kg', category: 'Breads' },
    { name: 'Rice', unit: 'kg', category: 'Grains & Pasta' },
    { name: 'Basmati Rice', unit: 'kg', category: 'Grains & Pasta' },
    { name: 'Spaghetti', unit: 'kg', category: 'Grains & Pasta' },
    { name: 'Penne', unit: 'kg', category: 'Grains & Pasta' },
    { name: 'Fusilli', unit: 'kg', category: 'Grains & Pasta' },
    { name: 'Couscous', unit: 'kg', category: 'Grains & Pasta' },
    { name: 'Bulgur', unit: 'kg', category: 'Grains & Pasta' },
    { name: 'Freekeh', unit: 'kg', category: 'Grains & Pasta' },
    { name: 'Quinoa', unit: 'kg', category: 'Grains & Pasta' },
    { name: 'Flour', unit: 'kg', category: 'Grains & Pasta', subcategory: 'Flour' },
    { name: 'Salt', unit: 'kg', category: 'Herbs & Spices', subcategory: 'Basics' },
    { name: 'Black Pepper', unit: 'g', category: 'Herbs & Spices', subcategory: 'Basics' },
    { name: 'Cumin', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Paprika', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Turmeric', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Cinnamon', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Oregano', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Thyme', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Rosemary', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Basil (Fresh)', unit: 'bunch', category: 'Herbs & Spices', subcategory: 'Fresh Herbs' },
    { name: 'Parsley (Fresh)', unit: 'bunch', category: 'Herbs & Spices', subcategory: 'Fresh Herbs' },
    { name: 'Mint (Fresh)', unit: 'bunch', category: 'Herbs & Spices', subcategory: 'Fresh Herbs' },
    { name: 'Cilantro (Fresh)', unit: 'bunch', category: 'Herbs & Spices', subcategory: 'Fresh Herbs' },
    { name: 'Chili Flakes', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Sumac', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Za\'atar', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Seven Spice', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Allspice', unit: 'g', category: 'Herbs & Spices' },
    { name: 'Olive Oil', unit: 'L', category: 'Oils & Vinegars' },
    { name: 'Vegetable Oil', unit: 'L', category: 'Oils & Vinegars' },
    { name: 'Sesame Oil', unit: 'bottle', category: 'Oils & Vinegars' },
    { name: 'Balsamic Vinegar', unit: 'bottle', category: 'Oils & Vinegars' },
    { name: 'Apple Cider Vinegar', unit: 'bottle', category: 'Oils & Vinegars' },
    { name: 'White Vinegar', unit: 'L', category: 'Oils & Vinegars' },
    { name: 'Tomato Paste', unit: 'can', category: 'Sauces & Condiments' },
    { name: 'Soy Sauce', unit: 'bottle', category: 'Sauces & Condiments' },
    { name: 'Hot Sauce', unit: 'bottle', category: 'Sauces & Condiments' },
    { name: 'Tahini', unit: 'kg', category: 'Sauces & Condiments' },
    { name: 'Mustard', unit: 'bottle', category: 'Sauces & Condiments' },
    { name: 'Mayonnaise', unit: 'kg', category: 'Sauces & Condiments' },
    { name: 'Ketchup', unit: 'bottle', category: 'Sauces & Condiments' },
    { name: 'Pomegranate Molasses', unit: 'bottle', category: 'Sauces & Condiments' },
    { name: 'Honey', unit: 'kg', category: 'Sauces & Condiments' },
    { name: 'Chickpeas (Canned)', unit: 'can', category: 'Legumes & Canned' },
    { name: 'Chickpeas (Dried)', unit: 'kg', category: 'Legumes & Canned' },
    { name: 'Lentils', unit: 'kg', category: 'Legumes & Canned' },
    { name: 'Canned Tomatoes', unit: 'can', category: 'Legumes & Canned' },
    { name: 'Coconut Milk', unit: 'can', category: 'Legumes & Canned' },
    { name: 'Beans (White)', unit: 'kg', category: 'Legumes & Canned' },
    { name: 'Beans (Kidney)', unit: 'can', category: 'Legumes & Canned' },
    { name: 'Fava Beans', unit: 'kg', category: 'Legumes & Canned' },
    { name: 'Pine Nuts', unit: 'kg', category: 'Nuts & Dried', tags: ['Premium'] },
    { name: 'Almonds', unit: 'kg', category: 'Nuts & Dried' },
    { name: 'Walnuts', unit: 'kg', category: 'Nuts & Dried' },
    { name: 'Cashews', unit: 'kg', category: 'Nuts & Dried' },
    { name: 'Pistachios', unit: 'kg', category: 'Nuts & Dried', tags: ['Premium'] },
    { name: 'Raisins', unit: 'kg', category: 'Nuts & Dried' },
    { name: 'Dates', unit: 'kg', category: 'Nuts & Dried' },
    { name: 'Coffee Beans', unit: 'kg', category: 'Beverages' },
    { name: 'Tea (Black)', unit: 'box', category: 'Beverages' },
    { name: 'Sparkling Water', unit: 'case', category: 'Beverages' },
    { name: 'Still Water', unit: 'case', category: 'Beverages' },
    { name: 'Orange Juice', unit: 'L', category: 'Beverages' },
    { name: 'Sugar', unit: 'kg', category: 'Baking' },
    { name: 'Brown Sugar', unit: 'kg', category: 'Baking' },
    { name: 'Powdered Sugar', unit: 'kg', category: 'Baking' },
    { name: 'Baking Powder', unit: 'g', category: 'Baking' },
    { name: 'Baking Soda', unit: 'g', category: 'Baking' },
    { name: 'Yeast', unit: 'g', category: 'Baking' },
    { name: 'Vanilla Extract', unit: 'bottle', category: 'Baking' },
    { name: 'Cocoa Powder', unit: 'kg', category: 'Baking' },
    { name: 'Chocolate (Dark)', unit: 'kg', category: 'Baking' },
    { name: 'Cornstarch', unit: 'kg', category: 'Baking' },
  ] as { name: string; unit: string; category: string; subcategory?: string; tags?: string[] }[],
};

router.post('/seed', async (req: AuthRequest, res) => {
  try {
    let catCreated = 0, subCreated = 0, tagCreated = 0, ingCreated = 0;

    // 1. Seed categories & subcategories
    for (const catDef of SEED_DATA.categories) {
      const cat = await prisma.ingredientCategory.upsert({
        where: { name_userId: { name: catDef.name, userId: req.userId! } },
        create: { name: catDef.name, userId: req.userId! },
        update: {},
      });
      if (cat.createdAt.getTime() > Date.now() - 5000) catCreated++;
      for (const subName of catDef.subcategories) {
        const sub = await prisma.ingredientSubcategory.upsert({
          where: { name_categoryId: { name: subName, categoryId: cat.id } },
          create: { name: subName, categoryId: cat.id },
          update: {},
        });
        if (sub.createdAt.getTime() > Date.now() - 5000) subCreated++;
      }
    }

    // 2. Seed tags
    const tagMap: Record<string, string> = {};
    for (const tagName of SEED_DATA.tags) {
      const tag = await prisma.ingredientTag.upsert({
        where: { name_userId: { name: tagName, userId: req.userId! } },
        create: { name: tagName, userId: req.userId! },
        update: {},
      });
      tagMap[tagName] = tag.id;
      if (tag.createdAt.getTime() > Date.now() - 5000) tagCreated++;
    }

    // 3. Seed ingredients (skip existing)
    const existing = await prisma.ingredient.findMany({
      where: { userId: req.userId! },
      select: { name: true },
    });
    const existingNames = new Set(existing.map(e => e.name.toLowerCase()));

    for (const ing of SEED_DATA.ingredients) {
      if (existingNames.has(ing.name.toLowerCase())) continue;
      await prisma.ingredient.create({
        data: {
          name: ing.name, unit: ing.unit, category: ing.category,
          subcategory: ing.subcategory || null, userId: req.userId!,
          tags: ing.tags?.length ? { connect: ing.tags.map(t => ({ id: tagMap[t] })).filter(t => t.id) } : undefined,
        },
      });
      ingCreated++;
    }

    res.json({
      created: ingCreated,
      skipped: SEED_DATA.ingredients.length - ingCreated,
      categories: catCreated,
      subcategories: subCreated,
      tags: tagCreated,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to seed ingredients' });
  }
});

export default router;
