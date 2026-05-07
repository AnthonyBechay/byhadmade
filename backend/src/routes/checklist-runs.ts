import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireFeature, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(requireFeature('checklists'));

// Parse a YYYY-MM-DD string to midnight UTC Date
function toDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

// ─── GET /api/checklist-runs?date=YYYY-MM-DD ───
// Returns (and auto-creates) runs for all active templates on that date.
router.get('/', async (req: AuthRequest, res) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const date = toDateUTC(dateStr);
    const userId = req.userId!;

    // Fetch all active templates for this user
    const templates = await prisma.checklistTemplate.findMany({
      where: { userId, isActive: true },
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // For each template, find or create a run for the date
    const runs = await Promise.all(
      templates.map(async (template) => {
        let run = await prisma.checklistRun.findUnique({
          where: { templateId_date: { templateId: template.id, date } },
          include: { items: { orderBy: { order: 'asc' } } },
        });

        if (!run) {
          // Snapshot current template items into run items
          run = await prisma.checklistRun.create({
            data: {
              templateId: template.id,
              userId,
              date,
              items: {
                create: template.items.map((it) => ({
                  templateItemId: it.id,
                  label: it.label,
                  notes: it.notes,
                  required: it.required,
                  order: it.order,
                  checked: false,
                })),
              },
            },
            include: { items: { orderBy: { order: 'asc' } } },
          });
        } else {
          // Sync run items with current template items:
          // 1. Add items that are in the template but not yet in the run
          // 2. Update labels/notes for existing items (template may have been edited)
          // 3. Remove run items whose templateItemId no longer exists in the template
          const existingTemplateIds = new Set(run.items.map((i) => i.templateItemId));
          const currentTemplateIds = new Set(template.items.map((i) => i.id));

          // Remove orphaned run items
          const orphanedIds = run.items
            .filter((i) => !currentTemplateIds.has(i.templateItemId))
            .map((i) => i.id);
          if (orphanedIds.length) {
            await prisma.checklistRunItem.deleteMany({ where: { id: { in: orphanedIds } } });
          }

          // Add missing items
          const missingItems = template.items.filter((it) => !existingTemplateIds.has(it.id));
          if (missingItems.length) {
            await prisma.checklistRunItem.createMany({
              data: missingItems.map((it) => ({
                runId: run!.id,
                templateItemId: it.id,
                label: it.label,
                notes: it.notes,
                required: it.required,
                order: it.order,
                checked: false,
              })),
            });
          }

          // Update labels/notes for existing items (template may have been renamed)
          for (const tplItem of template.items) {
            const runItem = run.items.find((i) => i.templateItemId === tplItem.id);
            if (runItem && (runItem.label !== tplItem.label || runItem.notes !== tplItem.notes)) {
              await prisma.checklistRunItem.update({
                where: { id: runItem.id },
                data: { label: tplItem.label, notes: tplItem.notes, required: tplItem.required, order: tplItem.order },
              });
            }
          }

          // Reload to get clean sorted state
          run = await prisma.checklistRun.findUnique({
            where: { templateId_date: { templateId: template.id, date } },
            include: { items: { orderBy: { order: 'asc' } } },
          }) as typeof run;
        }

        return {
          ...run,
          template: {
            id: template.id,
            name: template.name,
            type: template.type,
            theme: template.theme,
            sortOrder: template.sortOrder,
          },
        };
      }),
    );

    res.json(runs);
  } catch (error: any) {
    console.error('checklist-runs GET failed:', error);
    res.status(500).json({ error: 'Failed to fetch checklist runs' });
  }
});

// ─── PATCH /api/checklist-runs/:runId/items/:itemId ───
// Toggle (or set) a run item's checked state.
router.patch('/:runId/items/:itemId', async (req: AuthRequest, res) => {
  try {
    const { runId, itemId } = req.params as { runId: string; itemId: string };
    const { checked } = req.body as { checked: boolean };

    // Verify ownership via run → userId
    const run = await prisma.checklistRun.findFirst({
      where: { id: runId, userId: req.userId! },
    });
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }

    const item = await prisma.checklistRunItem.update({
      where: { id: itemId },
      data: {
        checked: !!checked,
        checkedAt: checked ? new Date() : null,
      },
    });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

export default router;
