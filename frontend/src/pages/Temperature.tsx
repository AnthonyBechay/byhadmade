import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Thermometer, ChevronLeft, ChevronRight, Settings2, Download,
  Plus, Trash2, Edit3, Check, AlertTriangle, AlertCircle,
  Loader2, Wind, Flame, Wine, Refrigerator, Snowflake,
} from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Temperature.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type TempUnit = 'CELSIUS' | 'FAHRENHEIT';
type DeviceType = 'FRIDGE' | 'FREEZER' | 'COLD_ROOM' | 'WINE_CELLAR' | 'OVEN' | 'WARMER' | 'OTHER';
type TempStatus = 'ok' | 'warning' | 'danger' | 'chronic' | 'no-data';

interface Device {
  id: string; name: string; location: string | null;
  deviceType: DeviceType; minTemp: number; maxTemp: number;
  targetTemp: number | null; unit: TempUnit; notes: string | null; isActive: boolean;
  createdAt: string;
}

interface TempLog {
  id: string; deviceId: string; date: string; temp: number;
  isAutoFilled: boolean; notes: string | null; loggedAt: string;
}

interface DailyEntry {
  device: Device;
  log: TempLog | null;
  status: TempStatus;
  consecutiveDaysOutOfRange: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEVICE_TYPES: { key: DeviceType; label: string }[] = [
  { key: 'FRIDGE', label: 'Fridge' }, { key: 'FREEZER', label: 'Freezer' },
  { key: 'COLD_ROOM', label: 'Cold Room' }, { key: 'WINE_CELLAR', label: 'Wine Cellar' },
  { key: 'OVEN', label: 'Oven' }, { key: 'WARMER', label: 'Food Warmer' },
  { key: 'OTHER', label: 'Other' },
];

const DEVICE_ICONS: Record<DeviceType, any> = {
  FRIDGE: Refrigerator, FREEZER: Snowflake, COLD_ROOM: Wind,
  WINE_CELLAR: Wine, OVEN: Flame, WARMER: Flame, OTHER: Thermometer,
};

const DEVICE_TYPE_COLORS: Record<DeviceType, string> = {
  FRIDGE: 'tp-type-FRIDGE', FREEZER: 'tp-type-FREEZER', COLD_ROOM: 'tp-type-COLD_ROOM',
  WINE_CELLAR: 'tp-type-WINE_CELLAR', OVEN: 'tp-type-OVEN', WARMER: 'tp-type-WARMER',
  OTHER: 'tp-type-OTHER',
};

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}
function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function unitSymbol(u: TempUnit) { return u === 'CELSIUS' ? '°C' : '°F'; }

function statusConfig(status: TempStatus, days: number): {
  dotClass: string; stripClass: string; textClass: string; message: string;
} {
  const effectiveStatus = status === 'warning' && days >= 7 ? 'chronic' : status;
  switch (effectiveStatus) {
    case 'ok': return { dotClass: 'dot-ok', stripClass: 'tp-status-ok', textClass: 'tp-status-ok-text', message: 'Within range ✓' };
    case 'warning': return { dotClass: 'dot-warning', stripClass: 'tp-status-warning', textClass: 'tp-status-warning-text', message: `Close to limit — ${days > 1 ? `${days} days` : 'today'}` };
    case 'danger': return { dotClass: 'dot-danger', stripClass: 'tp-status-danger', textClass: 'tp-status-danger-text', message: `⚠ Out of safe range${days > 1 ? ` for ${days} days` : ''}` };
    case 'chronic': return { dotClass: 'dot-chronic', stripClass: 'tp-status-chronic', textClass: 'tp-status-chronic-text', message: `Chronic issue — ${days}+ days out of range` };
    default: return { dotClass: 'dot-ok', stripClass: '', textClass: '', message: '' };
  }
}

// ─── Daily View ───────────────────────────────────────────────────────────────

function DailyView() {
  const [date, setDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async (d: Date) => {
    setLoading(true);
    try {
      const data: DailyEntry[] = await api.get(`/temp-logs?date=${toDateStr(d)}`);
      setEntries(data);
      // Seed input values from current logs
      const vals: Record<string, string> = {};
      for (const e of data) {
        if (e.log) vals[e.device.id] = String(e.log.temp);
      }
      setInputValues(vals);
      setSaved(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const saveTemp = async (entry: DailyEntry, value: string) => {
    const temp = parseFloat(value);
    if (isNaN(temp)) return;
    const deviceId = entry.device.id;
    setSaving((p) => new Set(p).add(deviceId));
    try {
      const log = await api.post('/temp-logs', {
        deviceId,
        date: toDateStr(date),
        temp,
        notes: entry.log?.notes ?? null,
      });
      // Update entry in state
      setEntries((prev) =>
        prev.map((e) => {
          if (e.device.id !== deviceId) return e;
          // Recompute status client-side for instant feedback
          const d = e.device;
          let status: TempStatus = 'ok';
          if (temp < d.minTemp || temp > d.maxTemp) {
            const range = d.maxTemp - d.minTemp;
            const dev = temp < d.minTemp ? d.minTemp - temp : temp - d.maxTemp;
            status = dev <= range * 0.1 ? (e.consecutiveDaysOutOfRange >= 7 ? 'chronic' : 'warning') : 'danger';
          }
          return { ...e, log, status };
        }),
      );
      setSaved((p) => new Set(p).add(deviceId));
      setTimeout(() => setSaved((p) => { const n = new Set(p); n.delete(deviceId); return n; }), 2000);
    } catch { /* silent */ } finally {
      setSaving((p) => { const n = new Set(p); n.delete(deviceId); return n; });
    }
  };

  const handleInput = (entry: DailyEntry, value: string) => {
    setInputValues((p) => ({ ...p, [entry.device.id]: value }));
    // Debounce auto-save: 800ms after user stops typing
    clearTimeout(saveTimers.current[entry.device.id]);
    if (value !== '') {
      saveTimers.current[entry.device.id] = setTimeout(() => saveTemp(entry, value), 800);
    }
  };

  // Group by location
  const groups: Record<string, DailyEntry[]> = {};
  for (const e of entries) {
    const loc = e.device.location || 'General';
    if (!groups[loc]) groups[loc] = [];
    groups[loc].push(e);
  }

  const counts = { ok: 0, warning: 0, danger: 0, chronic: 0 };
  for (const e of entries) {
    const eff = e.status === 'warning' && e.consecutiveDaysOutOfRange >= 7 ? 'chronic' : e.status;
    if (eff === 'ok') counts.ok++;
    else if (eff === 'warning') counts.warning++;
    else if (eff === 'danger') counts.danger++;
    else if (eff === 'chronic') counts.chronic++;
  }

  return (
    <div>
      <div className="tp-date-nav">
        <button onClick={() => setDate((d) => addDays(d, -1))}><ChevronLeft size={16} /></button>
        <span
          className={`tp-date-label${isToday(date) ? ' today' : ''}`}
          onClick={() => setDate(new Date())} title="Go to today"
        >
          {isToday(date) ? 'Today' : formatDate(date)}
        </span>
        <button onClick={() => setDate((d) => addDays(d, 1))}><ChevronRight size={16} /></button>
      </div>

      {!loading && entries.length > 0 && (
        <div className="tp-summary">
          {counts.ok > 0 && <span className="tp-summary-chip ok"><Check size={12} /> {counts.ok} OK</span>}
          {counts.warning > 0 && <span className="tp-summary-chip warn"><AlertCircle size={12} /> {counts.warning} warning</span>}
          {counts.danger > 0 && <span className="tp-summary-chip danger"><AlertTriangle size={12} /> {counts.danger} danger</span>}
          {counts.chronic > 0 && <span className="tp-summary-chip chronic"><AlertTriangle size={12} /> {counts.chronic} chronic</span>}
        </div>
      )}

      {loading ? (
        <div className="tp-empty"><Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : entries.length === 0 ? (
        <div className="tp-empty">
          <Thermometer size={40} className="tp-empty-icon" />
          <strong>No devices configured</strong>
          Go to Configure to add your first temperature device.
        </div>
      ) : (
        Object.entries(groups).map(([loc, list]) => (
          <div key={loc} className="tp-group">
            <div className="tp-group-title">{loc}</div>
            {list.map((entry) => {
              const { device, log, status, consecutiveDaysOutOfRange: days } = entry;
              const eff: TempStatus = status === 'warning' && days >= 7 ? 'chronic' : status;
              const sc = statusConfig(eff, days);
              const DevIcon = DEVICE_ICONS[device.deviceType] || Thermometer;
              const inputVal = inputValues[device.id] ?? '';
              const isSaving = saving.has(device.id);
              const isSaved = saved.has(device.id);

              return (
                <div key={device.id} className={`tp-card status-${eff}`}>
                  <div className="tp-card-body">
                    <div className={`tp-device-icon tp-badge ${DEVICE_TYPE_COLORS[device.deviceType]}`}>
                      <DevIcon size={22} />
                    </div>

                    <div className="tp-device-info">
                      <div className="tp-device-name">{device.name}</div>
                      <div className="tp-device-meta">
                        <span className={`tp-badge ${DEVICE_TYPE_COLORS[device.deviceType]}`}>
                          {DEVICE_TYPES.find((t) => t.key === device.deviceType)?.label}
                        </span>
                        {device.location && <span className="tp-badge">{device.location}</span>}
                        <span className="tp-range">
                          {device.minTemp}{unitSymbol(device.unit)} – {device.maxTemp}{unitSymbol(device.unit)}
                          {device.targetTemp != null && (
                            <> · target: {device.targetTemp}{unitSymbol(device.unit)}</>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="tp-input-area">
                      <div className="tp-temp-input-wrap">
                        <input
                          type="number"
                          step="0.1"
                          className={`tp-temp-input ${eff === 'ok' ? 'ok-input' : eff === 'warning' ? 'warn-input' : eff === 'danger' || eff === 'chronic' ? 'danger-input' : ''}`}
                          value={inputVal}
                          onChange={(e) => handleInput(entry, e.target.value)}
                          placeholder="—"
                        />
                        <span className="tp-unit">{unitSymbol(device.unit)}</span>
                      </div>
                      <button
                        className="tp-save-btn"
                        disabled={isSaving || inputVal === '' || isNaN(parseFloat(inputVal))}
                        onClick={() => saveTemp(entry, inputVal)}
                      >
                        {isSaving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : isSaved ? <><Check size={13} /> Saved</> : 'Log'}
                      </button>
                    </div>
                  </div>

                  {log && (
                    <div className={`tp-status-strip ${sc.stripClass}`}>
                      <div className={`tp-status-dot ${sc.dotClass}`} />
                      <span className={`tp-status-text ${sc.textClass}`}>{sc.message}</span>
                      {log.isAutoFilled && (
                        <span className="tp-autofill-label">auto-filled</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Configure View ───────────────────────────────────────────────────────────

const EMPTY_DEVICE = () => ({
  name: '', location: '', deviceType: 'FRIDGE' as DeviceType,
  minTemp: '', maxTemp: '', targetTemp: '',
  unit: 'CELSIUS' as TempUnit, notes: '', isActive: true,
});

function ConfigureView() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(EMPTY_DEVICE());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setDevices(await api.get('/temp-devices')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null); setForm(EMPTY_DEVICE()); setError(''); setShowModal(true);
  };
  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({
      name: d.name, location: d.location || '', deviceType: d.deviceType,
      minTemp: String(d.minTemp), maxTemp: String(d.maxTemp),
      targetTemp: d.targetTemp != null ? String(d.targetTemp) : '',
      unit: d.unit, notes: d.notes || '', isActive: d.isActive,
    });
    setError(''); setShowModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const min = parseFloat(form.minTemp as string);
    const max = parseFloat(form.maxTemp as string);
    if (isNaN(min) || isNaN(max)) { setError('Min and max temperature are required'); return; }
    if (min >= max) { setError('Min must be less than max'); return; }
    setError(''); setSaving(true);
    const payload = {
      ...form,
      minTemp: min, maxTemp: max,
      targetTemp: form.targetTemp !== '' ? parseFloat(form.targetTemp as string) : null,
    };
    try {
      if (editing) await api.put(`/temp-devices/${editing.id}`, payload);
      else await api.post('/temp-devices', payload);
      setShowModal(false); load();
    } catch (err: any) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this device? All temperature history will be lost.')) return;
    try { await api.delete(`/temp-devices/${id}`); load(); } catch { /* ignore */ }
  };

  // Group by location for display
  const groups: Record<string, Device[]> = {};
  for (const d of devices) {
    const loc = d.location || 'General';
    if (!groups[loc]) groups[loc] = [];
    groups[loc].push(d);
  }

  return (
    <div>
      <div className="tp-cfg-toolbar">
        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Temperature Devices</span>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          <Plus size={15} /> Add device
        </button>
      </div>

      {loading ? <div className="tp-empty" style={{ padding: '2rem' }}>Loading…</div>
        : devices.length === 0 ? (
          <div className="tp-empty">
            <Thermometer size={40} className="tp-empty-icon" />
            <strong>No devices yet</strong>
            Add your fridges, freezers, and other temperature-controlled devices.
          </div>
        ) : (
          <div className="tp-cfg-list">
            {Object.entries(groups).map(([loc, list]) => (
              <div key={loc} className="tp-group">
                <div className="tp-group-title">{loc}</div>
                {list.map((d) => {
                  const DevIcon = DEVICE_ICONS[d.deviceType] || Thermometer;
                  return (
                    <div key={d.id} className={`tp-cfg-card ${!d.isActive ? 'inactive' : ''}`}>
                      <div className={`tp-device-icon tp-badge ${DEVICE_TYPE_COLORS[d.deviceType]}`}>
                        <DevIcon size={20} />
                      </div>
                      <div className="tp-cfg-info">
                        <div className="tp-cfg-name">{d.name}</div>
                        <div className="tp-cfg-meta">
                          <span className={`tp-badge ${DEVICE_TYPE_COLORS[d.deviceType]}`}>
                            {DEVICE_TYPES.find((t) => t.key === d.deviceType)?.label}
                          </span>
                          <span className="tp-badge">
                            {d.minTemp} – {d.maxTemp} {d.unit === 'CELSIUS' ? '°C' : '°F'}
                          </span>
                          {d.targetTemp != null && <span className="tp-badge">target {d.targetTemp}°</span>}
                          {!d.isActive && <span className="tp-badge">Inactive</span>}
                        </div>
                      </div>
                      <div className="tp-cfg-actions">
                        <button className="btn-icon" title="Edit" onClick={() => openEdit(d)}><Edit3 size={14} /></button>
                        <button className="btn-icon" title="Delete" onClick={() => remove(d.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

      {showModal && (
        <Modal isOpen onClose={() => setShowModal(false)} title={editing ? 'Edit device' : 'New device'} width="540px">
          <form onSubmit={save} className="form-stack">
            <div className="form-field">
              <label>Device name</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fridge A, Walk-in Freezer" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-field">
                <label>Type</label>
                <select value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value as DeviceType })}>
                  {DEVICE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Kitchen, Bar" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div className="form-field">
                <label>Min temp</label>
                <input type="number" step="0.1" required value={form.minTemp} onChange={(e) => setForm({ ...form, minTemp: e.target.value })} placeholder="2" />
              </div>
              <div className="form-field">
                <label>Max temp</label>
                <input type="number" step="0.1" required value={form.maxTemp} onChange={(e) => setForm({ ...form, maxTemp: e.target.value })} placeholder="8" />
              </div>
              <div className="form-field">
                <label>Target (opt.)</label>
                <input type="number" step="0.1" value={form.targetTemp} onChange={(e) => setForm({ ...form, targetTemp: e.target.value })} placeholder="5" />
              </div>
            </div>
            <div className="form-field">
              <label>Unit</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['CELSIUS', 'FAHRENHEIT'] as TempUnit[]).map((u) => (
                  <button key={u} type="button"
                    className={`chip ${form.unit === u ? 'chip-on' : ''}`}
                    onClick={() => setForm({ ...form, unit: u })}
                  >
                    {u === 'CELSIUS' ? '°C Celsius' : '°F Fahrenheit'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field">
              <label>Notes <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span></label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any special instructions…" />
            </div>
            <div className="form-field">
              <label className="checkbox-line">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span>Active — appears in daily monitoring</span>
              </label>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><Loader2 size={15} className="spin" /> Saving…</> : editing ? 'Save changes' : 'Add device'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Export View ──────────────────────────────────────────────────────────────

function ExportView() {
  const today = new Date();
  const thirtyDaysAgo = addDays(today, -30);
  const [from, setFrom] = useState(toDateStr(thirtyDaysAgo));
  const [to, setTo] = useState(toDateStr(today));
  const [exporting, setExporting] = useState(false);

  const downloadCSV = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const apiBase = (import.meta as any).env.VITE_API_URL || '/api';
      const url = `${apiBase}/temp-logs/export?from=${from}&to=${to}`;
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `temperature-report-${from}-to-${to}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="tp-export-card">
        <h3>Export Temperature Report</h3>
        <div className="form-stack">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-field">
              <label>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="form-field">
              <label>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} max={toDateStr(today)} />
            </div>
          </div>
          <p className="form-hint">
            Exports all temperature readings per device for the selected period. Auto-filled readings are marked. Status (ok / warning / danger) is included.
          </p>
          <button className="btn btn-primary" onClick={downloadCSV} disabled={exporting} style={{ alignSelf: 'flex-start' }}>
            {exporting ? <><Loader2 size={15} className="spin" /> Generating…</> : <><Download size={15} /> Download CSV</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'daily' | 'configure' | 'export';

export default function Temperature() {
  const [tab, setTab] = useState<Tab>('daily');
  return (
    <div className="tp-page">
      <div className="tp-header">
        <h1 className="tp-title">Temperature</h1>
        <div className="tp-tabs">
          <button className={`tp-tab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>
            <Thermometer size={14} /> Daily
          </button>
          <button className={`tp-tab ${tab === 'configure' ? 'active' : ''}`} onClick={() => setTab('configure')}>
            <Settings2 size={14} /> Devices
          </button>
          <button className={`tp-tab ${tab === 'export' ? 'active' : ''}`} onClick={() => setTab('export')}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>
      {tab === 'daily' ? <DailyView /> : tab === 'configure' ? <ConfigureView /> : <ExportView />}
    </div>
  );
}
