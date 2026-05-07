import { useEffect, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, CheckSquare, Settings2,
  Plus, Trash2, Edit3, Check, Sun, Moon, Tag,
  ClipboardList, AlertCircle, Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Checklist.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChecklistType = 'OPENING' | 'CLOSING' | 'CUSTOM';

interface TemplateItem {
  id?: string;
  label: string;
  notes: string;
  required: boolean;
  order: number;
}

interface Template {
  id: string;
  name: string;
  type: ChecklistType;
  theme: string | null;
  isActive: boolean;
  sortOrder: number;
  items: (TemplateItem & { id: string })[];
}

interface RunItem {
  id: string;
  templateItemId: string;
  label: string;
  notes: string | null;
  required: boolean;
  order: number;
  checked: boolean;
  checkedAt: string | null;
}

interface Run {
  id: string;
  date: string;
  template: { id: string; name: string; type: ChecklistType; theme: string | null; sortOrder: number };
  items: RunItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

type RunStatus = 'not-started' | 'in-progress' | 'mostly-done' | 'done';

function runStatus(run: Run): RunStatus {
  const total = run.items.length;
  if (total === 0) return 'done';
  const checked = run.items.filter((i) => i.checked).length;
  if (checked === 0) return 'not-started';
  if (checked === total) return 'done';
  return checked / total >= 0.5 ? 'mostly-done' : 'in-progress';
}

function statusLabel(s: RunStatus, run: Run) {
  const remaining = run.items.filter((i) => !i.checked).length;
  switch (s) {
    case 'done': return 'Done ✓';
    case 'mostly-done': return `${remaining} left`;
    case 'in-progress': return `${remaining} remaining`;
    case 'not-started': return 'Not started';
  }
}

const TYPE_ORDER: ChecklistType[] = ['OPENING', 'CUSTOM', 'CLOSING'];
const TYPE_LABELS: Record<ChecklistType, string> = { OPENING: 'Opening', CUSTOM: 'Custom', CLOSING: 'Closing' };
const TYPE_ICONS: Record<ChecklistType, any> = { OPENING: Sun, CUSTOM: Tag, CLOSING: Moon };

// ─── Daily View ──────────────────────────────────────────────────────────────

function DailyView() {
  const [date, setDate] = useState<Date>(new Date());
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const load = useCallback(async (d: Date) => {
    setLoading(true);
    try {
      const data = await api.get(`/checklist-runs?date=${toDateStr(d)}`);
      setRuns(data);
      // Auto-expand incomplete runs
      const ids = new Set<string>(data.filter((r: Run) => runStatus(r) !== 'done').map((r: Run) => r.id));
      setExpanded(ids);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleItem = async (run: Run, item: RunItem) => {
    const key = item.id;
    if (toggling.has(key)) return;
    setToggling((p) => new Set(p).add(key));
    // Optimistic update
    setRuns((prev) =>
      prev.map((r) =>
        r.id !== run.id ? r : {
          ...r,
          items: r.items.map((it) =>
            it.id !== item.id ? it : { ...it, checked: !it.checked, checkedAt: !it.checked ? new Date().toISOString() : null },
          ),
        },
      ),
    );
    try {
      await api.patch(`/checklist-runs/${run.id}/items/${item.id}`, { checked: !item.checked });
    } catch {
      // revert on failure
      setRuns((prev) =>
        prev.map((r) =>
          r.id !== run.id ? r : {
            ...r,
            items: r.items.map((it) =>
              it.id !== item.id ? it : { ...it, checked: item.checked, checkedAt: item.checkedAt },
            ),
          },
        ),
      );
    } finally {
      setToggling((p) => { const n = new Set(p); n.delete(key); return n; });
    }
  };

  // Group runs by type
  const grouped = TYPE_ORDER.reduce<Record<ChecklistType, Run[]>>(
    (acc, t) => ({ ...acc, [t]: runs.filter((r) => r.template.type === t) }),
    {} as any,
  );

  const total = runs.length;
  const done = runs.filter((r) => runStatus(r) === 'done').length;
  const inProg = total - done;

  return (
    <div>
      {/* Date navigator */}
      <div className="cl-header" style={{ marginBottom: '1rem' }}>
        <div className="cl-date-nav">
          <button onClick={() => setDate((d) => addDays(d, -1))}><ChevronLeft size={16} /></button>
          <span
            className={`cl-date-label${isToday(date) ? ' today' : ''}`}
            onClick={() => setDate(new Date())}
            title="Click to go to today"
          >
            {isToday(date) ? 'Today' : formatDate(date)}
          </span>
          <button onClick={() => setDate((d) => addDays(d, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Summary */}
      {!loading && total > 0 && (
        <div className="cl-summary">
          <span className={`cl-summary-chip ${done === total ? 'done' : ''}`}>
            <Check size={12} /> {done}/{total} complete
          </span>
          {inProg > 0 && (
            <span className="cl-summary-chip progress">
              <AlertCircle size={12} /> {inProg} remaining
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="cl-empty"><Loader2 size={28} className="cl-empty-icon" style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : total === 0 ? (
        <div className="cl-empty">
          <CheckSquare size={40} className="cl-empty-icon" />
          <strong>No checklists for this day</strong>
          Go to Configure to create your first checklist template.
        </div>
      ) : (
        TYPE_ORDER.map((type) => {
          const list = grouped[type];
          if (!list.length) return null;
          const Icon = TYPE_ICONS[type];
          return (
            <div key={type} className="cl-section">
              <div className="cl-section-title"><Icon size={13} /> {TYPE_LABELS[type]}</div>
              {list.map((run) => {
                const status = runStatus(run);
                const isOpen = expanded.has(run.id);
                const checked = run.items.filter((i) => i.checked).length;
                const pct = run.items.length ? (checked / run.items.length) * 100 : 100;
                return (
                  <div key={run.id} className={`cl-card ${status === 'done' ? 'done-card' : ''}`}>
                    <div className="cl-card-header" onClick={() => toggleExpand(run.id)}>
                      <div className="cl-card-name">{run.template.name}</div>
                      <div className="cl-card-badges">
                        {run.template.theme && (
                          <span className="cl-theme-badge">{run.template.theme}</span>
                        )}
                        <span className={`cl-status ${status}`}>{statusLabel(status, run)}</span>
                      </div>
                      <ChevronLeft
                        size={16}
                        style={{ transform: isOpen ? 'rotate(-90deg)' : 'rotate(180deg)', transition: 'transform 0.2s', color: 'var(--color-text-muted)' }}
                      />
                    </div>

                    <div className="cl-progress-wrap">
                      <div className="cl-progress-bar">
                        <div
                          className={`cl-progress-fill ${status === 'done' ? 'done-fill' : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="cl-progress-label">{checked}/{run.items.length}</span>
                    </div>

                    {isOpen && (
                      <div className="cl-items">
                        {run.items.map((item) => (
                          <div
                            key={item.id}
                            className={`cl-item ${item.checked ? 'checked' : ''}`}
                            onClick={() => toggleItem(run, item)}
                          >
                            <div className="cl-item-check">
                              {item.checked && <Check size={11} color="#fff" />}
                            </div>
                            <div className="cl-item-text">
                              <div className="cl-item-label">{item.label}</div>
                              {item.notes && <div className="cl-item-notes">{item.notes}</div>}
                            </div>
                            {item.required && !item.checked && (
                              <span className="cl-item-required">required</span>
                            )}
                            {item.checked && item.checkedAt && (
                              <span className="cl-item-time">
                                {new Date(item.checkedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Configure View ───────────────────────────────────────────────────────────

const EMPTY_ITEM = (): TemplateItem => ({ label: '', notes: '', required: true, order: 0 });
const EMPTY_FORM = () => ({
  name: '', type: 'OPENING' as ChecklistType, theme: '',
  isActive: true, sortOrder: 0,
  items: [EMPTY_ITEM()],
});

function ConfigureView() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState(EMPTY_FORM());
  const [themeInput, setThemeInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, th] = await Promise.all([api.get('/checklist-templates'), api.get('/checklist-templates/themes')]);
      setTemplates(t);
      setThemes(th);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    const f = EMPTY_FORM();
    setForm(f);
    setThemeInput('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({
      name: t.name, type: t.type, theme: t.theme || '',
      isActive: t.isActive, sortOrder: t.sortOrder,
      items: t.items.map((it) => ({ ...it })),
    });
    setThemeInput(t.theme || '');
    setError('');
    setShowModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      ...form,
      theme: themeInput.trim() || null,
      items: form.items
        .filter((it) => it.label.trim())
        .map((it, idx) => ({ ...it, order: idx })),
    };
    try {
      if (editing) {
        await api.put(`/checklist-templates/${editing.id}`, payload);
      } else {
        await api.post('/checklist-templates', payload);
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this checklist template? Daily runs for it will also be removed.')) return;
    try {
      await api.delete(`/checklist-templates/${id}`);
      load();
    } catch { /* ignore */ }
  };

  const toggleActive = async (t: Template) => {
    try {
      await api.put(`/checklist-templates/${t.id}`, { isActive: !t.isActive });
      load();
    } catch { /* ignore */ }
  };

  // Item editing helpers
  const setItems = (items: TemplateItem[]) => setForm((f) => ({ ...f, items }));
  const addItem = () => setItems([...form.items, EMPTY_ITEM()]);
  const updateItem = (idx: number, patch: Partial<TemplateItem>) =>
    setItems(form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) => setItems(form.items.filter((_, i) => i !== idx));

  // Group by type for display
  const grouped = TYPE_ORDER.reduce<Record<ChecklistType, Template[]>>(
    (acc, t) => ({ ...acc, [t]: templates.filter((tp) => tp.type === t) }),
    {} as any,
  );

  return (
    <div>
      <div className="cl-cfg-toolbar">
        <h2>Checklist Templates</h2>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={15} /> New checklist
        </button>
      </div>

      {loading ? (
        <div className="cl-empty" style={{ padding: '2rem' }}>Loading…</div>
      ) : templates.length === 0 ? (
        <div className="cl-empty">
          <ClipboardList size={40} className="cl-empty-icon" />
          <strong>No templates yet</strong>
          Create a template and it will appear every day automatically.
        </div>
      ) : (
        <div className="cl-cfg-list">
          {TYPE_ORDER.map((type) => {
            const list = grouped[type];
            if (!list.length) return null;
            const Icon = TYPE_ICONS[type];
            return (
              <div key={type} className="cl-section">
                <div className="cl-section-title"><Icon size={13} />{TYPE_LABELS[type]}</div>
                {list.map((t) => (
                  <div key={t.id} className={`cl-cfg-card ${!t.isActive ? 'cl-cfg-inactive' : ''}`}>
                    <div className="cl-cfg-card-header">
                      <div className="cl-cfg-card-name">{t.name}</div>
                      <div className="cl-cfg-card-meta">
                        {t.theme && <span className="cl-theme-badge">{t.theme}</span>}
                        <span className="cl-item-count">{t.items.length} tasks</span>
                        <span className={`cl-type-badge ${t.type}`}>{TYPE_LABELS[t.type]}</span>
                      </div>
                      <div className="cl-cfg-card-actions">
                        <button
                          className="btn-icon"
                          title={t.isActive ? 'Deactivate' : 'Activate'}
                          onClick={() => toggleActive(t)}
                          style={{ color: t.isActive ? '#4caf7d' : 'var(--color-text-muted)' }}
                        >
                          <Check size={15} />
                        </button>
                        <button className="btn-icon" title="Edit" onClick={() => openEdit(t)}>
                          <Edit3 size={14} />
                        </button>
                        <button className="btn-icon" title="Delete" onClick={() => remove(t.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal
          isOpen
          onClose={() => setShowModal(false)}
          title={editing ? 'Edit checklist' : 'New checklist'}
          width="600px"
        >
          <form onSubmit={save} className="cl-editor">
            {/* Name */}
            <div className="form-field">
              <label>Checklist name</label>
              <input
                type="text" required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Kitchen Opening"
              />
            </div>

            {/* Type */}
            <div className="form-field">
              <label>Type</label>
              <div className="cl-tabs" style={{ width: 'fit-content' }}>
                {(['OPENING', 'CLOSING', 'CUSTOM'] as ChecklistType[]).map((t) => (
                  <button
                    key={t} type="button"
                    className={`cl-tab ${form.type === t ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, type: t })}
                  >
                    {t === 'OPENING' ? <Sun size={13} /> : t === 'CLOSING' ? <Moon size={13} /> : <Tag size={13} />}
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="form-field">
              <label>Location / Theme <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span></label>
              <input
                type="text"
                list="theme-list"
                value={themeInput}
                onChange={(e) => setThemeInput(e.target.value)}
                placeholder="e.g. Kitchen, Floor, Second Floor…"
              />
              <datalist id="theme-list">
                {themes.map((th) => <option key={th} value={th} />)}
              </datalist>
              <p className="form-hint">Used to group checklists by area in the daily view.</p>
            </div>

            {/* Active */}
            <div className="form-field">
              <label className="checkbox-line">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span>Active — appears in daily checklist</span>
              </label>
            </div>

            {/* Items */}
            <div>
              <div className="cl-editor-items-header">
                <span className="cl-editor-items-label">Tasks ({form.items.filter((it) => it.label.trim()).length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
                {form.items.map((item, idx) => (
                  <div key={idx} className="cl-editor-item">
                    <input
                      type="text"
                      placeholder={`Task ${idx + 1}`}
                      value={item.label}
                      onChange={(e) => updateItem(idx, { label: e.target.value })}
                    />
                    <input
                      type="text"
                      className="cl-editor-item-notes"
                      placeholder="Hint / notes…"
                      value={item.notes}
                      onChange={(e) => updateItem(idx, { notes: e.target.value })}
                    />
                    <button
                      type="button"
                      className={`cl-req-toggle ${item.required ? 'req' : ''}`}
                      onClick={() => updateItem(idx, { required: !item.required })}
                      title="Toggle required"
                    >
                      {item.required ? 'req' : 'opt'}
                    </button>
                    <button type="button" className="cl-remove-item" onClick={() => removeItem(idx)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="cl-add-item-btn" onClick={addItem}>
                <Plus size={14} /> Add task
              </button>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><Loader2 size={15} className="spin" /> Saving…</> : editing ? 'Save changes' : 'Create checklist'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'daily' | 'configure';

export default function Checklist() {
  const [tab, setTab] = useState<Tab>('daily');

  return (
    <div className="cl-page">
      <div className="cl-header">
        <h1 className="cl-title">Checklists</h1>
        <div className="cl-tabs">
          <button className={`cl-tab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>
            <CheckSquare size={14} /> Daily
          </button>
          <button className={`cl-tab ${tab === 'configure' ? 'active' : ''}`} onClick={() => setTab('configure')}>
            <Settings2 size={14} /> Configure
          </button>
        </div>
      </div>
      {tab === 'daily' ? <DailyView /> : <ConfigureView />}
    </div>
  );
}
