import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireFeature, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireFeature('checklists'));

const ITEM_INCLUDE = { orderBy: { order: 'asc' as const } };

// ─── List all templates (with items) ───
router.get('/', async (req: AuthRequest, res) => {
  try {
    const templates = await prisma.checklistTemplate.findMany({
      where: { userId: req.userId! },
      include: { items: ITEM_INCLUDE },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(templates);
  } catch {
    res.status(500).json({ error: 'Failed to fetch checklist templates' });
  }
});

// ─── List unique themes used by this user ───
router.get('/themes', async (req: AuthRequest, res) => {
  try {
    const rows = await prisma.checklistTemplate.findMany({
      where: { userId: req.userId!, theme: { not: null } },
      select: { theme: true },
      distinct: ['theme'],
      orderBy: { theme: 'asc' },
    });
    res.json(rows.map((r) => r.theme).filter(Boolean));
  } catch {
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

// ─── Create template ───
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, type, theme, isActive, sortOrder, items } = req.body;
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

    const template = await prisma.checklistTemplate.create({
      data: {
        userId: req.userId!,
        name,
        type: type || 'CUSTOM',
        theme: theme || null,
        isActive: isActive !== false,
        sortOrder: sortOrder ?? 0,
        items: {
          create: (items || []).map((it: any, idx: number) => ({
            label: it.label || 'Task',
            notes: it.notes || null,
            order: it.order ?? idx,
            required: it.required !== false,
          })),
        },
      },
      include: { items: ITEM_INCLUDE },
    });
    res.status(201).json(template);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to create template' });
  }
});

// ─── Update template (replaces items) ───
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.checklistTemplate.findFirst({
      where: { id, userId: req.userId! },
    });
    if (!existing) { res.status(404).json({ error: 'Template not found' }); return; }

    const { name, type, theme, isActive, sortOrder, items } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (theme !== undefined) data.theme = theme || null;
    if (isActive !== undefined) data.isActive = !!isActive;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    // Replace items if provided
    if (Array.isArray(items)) {
      await prisma.checklistTemplateItem.deleteMany({ where: { templateId: id } });
      data.items = {
        create: items.map((it: any, idx: number) => ({
          label: it.label || 'Task',
          notes: it.notes || null,
          order: it.order ?? idx,
          required: it.required !== false,
        })),
      };
    }

    const updated = await prisma.checklistTemplate.update({
      where: { id },
      data,
      include: { items: ITEM_INCLUDE },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update template' });
  }
});

// ─── Delete template ───
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.checklistTemplate.findFirst({
      where: { id, userId: req.userId! },
    });
    if (!existing) { res.status(404).json({ error: 'Template not found' }); return; }
    await prisma.checklistTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
