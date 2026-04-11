import { useEffect, useRef, useState } from 'react';
import {
  ScanLine, Camera, Trash2, Plus, X, FileText, Edit3,
  ChevronDown, ChevronRight, Calendar, Loader2, Image as ImageIcon,
  CheckCircle, Save,
} from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Traceability.css';

interface ReceiptItem {
  id?: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
  notes: string | null;
}

interface Receipt {
  id: string;
  receiptDate: string;
  supplier: string | null;
  total: number | null;
  currency: string;
  photoUrl: string;
  rawText: string | null;
  notes: string | null;
  status: string;
  items: ReceiptItem[];
  createdAt: string;
}

interface DraftItem {
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  total: string;
  notes: string;
}

const EMPTY_ITEM: DraftItem = {
  name: '', quantity: '', unit: '', unitPrice: '', total: '', notes: '',
};

const UNITS = ['kg', 'g', 'lb', 'pcs', 'box', 'bag', 'case', 'L', 'mL', 'dozen', 'bunch', 'can', 'bottle'];

const toDraft = (i: ReceiptItem): DraftItem => ({
  name: i.name || '',
  quantity: i.quantity != null ? String(i.quantity) : '',
  unit: i.unit || '',
  unitPrice: i.unitPrice != null ? String(i.unitPrice) : '',
  total: i.total != null ? String(i.total) : '',
  notes: i.notes || '',
});

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yest)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function dateKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function Traceability() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState('');
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Edit form state
  const [editSupplier, setEditSupplier] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editTotal, setEditTotal] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/traceability');
      setReceipts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Capture flow: single shot, creates immediately ───
  const handleFile = async (file: File) => {
    setCapturing(true);
    setCaptureError('');
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const token = localStorage.getItem('token');
      const res = await fetch((import.meta.env.VITE_API_URL || '/api') + '/traceability', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Capture failed');
      }
      const created: Receipt = await res.json();
      setReceipts((prev) => [created, ...prev]);
      setJustCreatedId(created.id);
      // auto-expand today's group so the new one is visible
      setExpanded((p) => ({ ...p, [dateKey(created.receiptDate)]: true }));
      // clear the highlight after a moment
      setTimeout(() => setJustCreatedId((id) => (id === created.id ? null : id)), 2500);
    } catch (err: any) {
      setCaptureError(err.message || 'Could not capture receipt');
    } finally {
      setCapturing(false);
    }
  };

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  // ─── Edit flow ───
  const openEdit = (r: Receipt) => {
    setEditReceipt(r);
    setEditSupplier(r.supplier || '');
    setEditDate(r.receiptDate.slice(0, 10));
    setEditCurrency(r.currency || 'USD');
    setEditTotal(r.total != null ? String(r.total) : '');
    setEditNotes(r.notes || '');
    setEditItems(r.items.length ? r.items.map(toDraft) : [{ ...EMPTY_ITEM }]);
    setEditError('');
  };

  const closeEdit = () => {
    setEditReceipt(null);
    setEditError('');
  };

  const updateEditItem = (idx: number, patch: Partial<DraftItem>) => {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addEditItem = () => setEditItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeEditItem = (idx: number) => setEditItems((prev) => prev.filter((_, i) => i !== idx));

  const saveEdit = async () => {
    if (!editReceipt) return;
    setSaving(true);
    setEditError('');
    try {
      const payload = {
        supplier: editSupplier || null,
        receiptDate: editDate,
        currency: editCurrency,
        total: editTotal || null,
        notes: editNotes || null,
        items: editItems
          .filter((it) => it.name.trim())
          .map((it) => ({
            name: it.name.trim(),
            quantity: it.quantity || null,
            unit: it.unit || null,
            unitPrice: it.unitPrice || null,
            total: it.total || null,
            notes: it.notes || null,
          })),
      };
      const updated: Receipt = await api.put(`/traceability/${editReceipt.id}`, payload);
      setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      closeEdit();
    } catch (err: any) {
      setEditError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteReceipt = async (id: string) => {
    if (!confirm('Delete this receipt permanently?')) return;
    try {
      await api.delete(`/traceability/${id}`);
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      if (editReceipt?.id === id) closeEdit();
    } catch (err) {
      console.error(err);
    }
  };

  // Group receipts by date
  const grouped: Record<string, Receipt[]> = {};
  for (const r of receipts) {
    const key = dateKey(r.receiptDate);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  const groupKeys = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="traceability-page">
      <div className="tr-header">
        <div>
          <h1 className="tr-title"><ScanLine size={28} /> Traceability</h1>
          <p className="tr-subtitle">Snap a receipt — we'll file it for you.</p>
        </div>
      </div>

      {/* ── Big capture card ── */}
      <div className={`tr-capture-card ${capturing ? 'is-busy' : ''}`}>
        {!capturing ? (
          <>
            <div className="tr-capture-icon"><ScanLine size={36} /></div>
            <div className="tr-capture-text">
              <h2>Capture a receipt</h2>
              <p>Point your phone at the receipt and it's done.</p>
            </div>
            <div className="tr-capture-actions">
              <button className="btn btn-primary btn-lg" onClick={() => cameraInputRef.current?.click()}>
                <Camera size={18} /> Take photo
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => uploadInputRef.current?.click()}>
                <ImageIcon size={18} /> Upload
              </button>
            </div>
          </>
        ) : (
          <div className="tr-capture-busy">
            <Loader2 size={40} className="spin" />
            <h2>Reading receipt…</h2>
            <p>Extracting items, this only takes a moment.</p>
          </div>
        )}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={onCameraChange}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onCameraChange}
        />
      </div>

      {captureError && <div className="tr-error tr-error-banner">{captureError}</div>}

      {/* ── History grouped by date ── */}
      <div className="tr-history">
        <h2 className="tr-history-title"><Calendar size={20} /> History</h2>

        {loading && <div className="tr-loading">Loading receipts…</div>}
        {!loading && receipts.length === 0 && (
          <div className="tr-empty">No receipts yet. Capture your first one above.</div>
        )}

        {!loading && groupKeys.map((key, groupIdx) => {
          const day = grouped[key];
          const isOpen = expanded[key] ?? groupIdx === 0;
          const dayTotal = day.reduce((s, r) => s + (r.total || 0), 0);
          const dayCurrency = day[0]?.currency || 'USD';
          return (
            <div key={key} className="tr-day">
              <button
                className="tr-day-header"
                onClick={() => setExpanded((p) => ({ ...p, [key]: !isOpen }))}
              >
                <div className="tr-day-chevron">
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                <div className="tr-day-label-wrap">
                  <span className="tr-day-label">{formatDateLabel(day[0].receiptDate)}</span>
                  <span className="tr-day-count">
                    {day.length} receipt{day.length > 1 ? 's' : ''}
                  </span>
                </div>
                {dayTotal > 0 && (
                  <span className="tr-day-total">
                    {dayTotal.toFixed(2)} <small>{dayCurrency}</small>
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="tr-day-body">
                  {day.map((r) => {
                    const itemCount = r.items.length;
                    const highlight = r.id === justCreatedId;
                    return (
                      <div
                        key={r.id}
                        className={`tr-receipt-card ${highlight ? 'is-new' : ''}`}
                        onClick={() => openEdit(r)}
                      >
                        <div className="tr-receipt-thumb-wrap">
                          <img
                            src={r.photoUrl}
                            alt=""
                            className="tr-receipt-thumb"
                            onClick={(e) => { e.stopPropagation(); setPhotoPreview(r.photoUrl); }}
                          />
                          {highlight && (
                            <div className="tr-new-badge"><CheckCircle size={14} /> New</div>
                          )}
                        </div>
                        <div className="tr-receipt-info">
                          <div className="tr-receipt-supplier">
                            <FileText size={14} />
                            <span>{r.supplier || 'Unknown supplier'}</span>
                          </div>
                          <div className="tr-receipt-meta">
                            <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                            {r.total != null && (
                              <>
                                <span className="tr-dot">•</span>
                                <span>{r.total.toFixed(2)} {r.currency}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="tr-receipt-actions">
                          <button
                            className="btn-icon"
                            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                            title="Edit"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            className="btn-icon tr-receipt-delete"
                            onClick={(e) => { e.stopPropagation(); deleteReceipt(r.id); }}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Edit modal ── */}
      {editReceipt && (
        <Modal isOpen={true} onClose={closeEdit} title="Edit receipt" width="780px">
          <div className="tr-edit">
            <img
              src={editReceipt.photoUrl}
              alt="Receipt"
              className="tr-edit-photo"
              onClick={() => setPhotoPreview(editReceipt.photoUrl)}
            />

            <div className="tr-form-row">
              <div className="form-field">
                <label>Supplier</label>
                <input
                  type="text"
                  value={editSupplier}
                  onChange={(e) => setEditSupplier(e.target.value)}
                  placeholder="Supplier name"
                />
              </div>
              <div className="form-field">
                <label>Date received</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
            </div>

            <div className="tr-form-row">
              <div className="form-field">
                <label>Total</label>
                <input
                  type="number"
                  step="0.01"
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="form-field">
                <label>Currency</label>
                <input
                  type="text"
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  placeholder="USD"
                />
              </div>
            </div>

            <div className="form-field">
              <label>Notes</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>

            <div className="tr-items-header">
              <h3>Items ({editItems.length})</h3>
              <button className="btn btn-sm btn-secondary" onClick={addEditItem}>
                <Plus size={14} /> Add item
              </button>
            </div>

            <div className="tr-items-list">
              {editItems.length === 0 && (
                <div className="tr-empty-items">No items — click "Add item".</div>
              )}
              {editItems.map((it, idx) => (
                <div key={idx} className="tr-item-row">
                  <input
                    className="tr-item-name"
                    type="text"
                    placeholder="Item name"
                    value={it.name}
                    onChange={(e) => updateEditItem(idx, { name: e.target.value })}
                  />
                  <input
                    className="tr-item-qty"
                    type="number"
                    step="0.01"
                    placeholder="Qty"
                    value={it.quantity}
                    onChange={(e) => updateEditItem(idx, { quantity: e.target.value })}
                  />
                  <select
                    className="tr-item-unit"
                    value={it.unit}
                    onChange={(e) => updateEditItem(idx, { unit: e.target.value })}
                  >
                    <option value="">unit</option>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input
                    className="tr-item-price"
                    type="number"
                    step="0.01"
                    placeholder="Unit price"
                    value={it.unitPrice}
                    onChange={(e) => updateEditItem(idx, { unitPrice: e.target.value })}
                  />
                  <input
                    className="tr-item-total"
                    type="number"
                    step="0.01"
                    placeholder="Total"
                    value={it.total}
                    onChange={(e) => updateEditItem(idx, { total: e.target.value })}
                  />
                  <button
                    className="btn-icon tr-item-delete"
                    onClick={() => removeEditItem(idx)}
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {editError && <div className="tr-error">{editError}</div>}

            <div className="tr-edit-actions">
              <button
                className="btn btn-danger"
                onClick={() => deleteReceipt(editReceipt.id)}
                disabled={saving}
              >
                <Trash2 size={16} /> Delete
              </button>
              <div className="tr-edit-actions-right">
                <button className="btn btn-secondary" onClick={closeEdit} disabled={saving}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                  {saving ? <><Loader2 size={16} className="spin" /> Saving…</> : <><Save size={16} /> Save</>}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Full-size photo preview ── */}
      {photoPreview && (
        <div className="tr-photo-overlay" onClick={() => setPhotoPreview(null)}>
          <button className="tr-photo-close" onClick={() => setPhotoPreview(null)}><X size={24} /></button>
          <img src={photoPreview} alt="" />
        </div>
      )}
    </div>
  );
}
