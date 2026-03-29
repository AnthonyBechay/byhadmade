import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Clock, Coffee, Check, BarChart3, Sun, Umbrella, Thermometer, Edit3, Share2, Copy, Scissors, Printer, ChevronUp, ChevronDown, ClipboardCopy } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './ScheduleDetail.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SHIFT_TYPES = [
  { value: 'WORK', label: 'Work', icon: Clock },
  { value: 'BREAK', label: 'Break', icon: Coffee },
  { value: 'SPLIT', label: 'Split', icon: Scissors },
  { value: 'DAY_OFF', label: 'Day Off', icon: Sun },
  { value: 'SICK', label: 'Sick', icon: Thermometer },
  { value: 'VACATION', label: 'Vacation', icon: Umbrella },
];

interface Employee { id: string; name: string; role: string | null; color: string | null; hourlyRate: number | null }
interface Shift { id: string; dayOfWeek: number; startTime: string; endTime: string; shiftType: string; breakMinutes: number; notes: string | null; employee: Employee }
interface Restaurant { id: string; name: string; shareToken?: string }
interface EmployeeOrder { id: string; scheduleId: string; employeeId: string; displayOrder: number }
interface Schedule { id: string; weekStart: string; weekEnd: string; published: boolean; notes: string | null; restaurant: Restaurant; shifts: Shift[]; employeeOrders?: EmployeeOrder[] }
interface SummaryEntry {
  name: string; role: string | null; color: string | null; hourlyRate: number | null;
  totalWorkHours: number; totalBreakHours: number; workShifts: number; daysWorked: number;
  dailyBreakdown: Record<number, { work: number; break: number }>;
  daysOff: number; sickDays: number; vacationDays: number; estimatedPay: number | null;
}

// Calculate work hours for a shift (subtract break)
function calcWorkHours(shift: Shift): number {
  if (shift.shiftType !== 'WORK') return 0;
  const [startH, startM] = shift.startTime.split(':').map(Number);
  const [endH, endM] = shift.endTime.split(':').map(Number);
  const total = (endH + endM / 60) - (startH + startM / 60);
  return total - (shift.breakMinutes || 0) / 60;
}

function calcShiftHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH + endM / 60) - (startH + startM / 60);
}

export default function ScheduleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<Record<string, SummaryEntry>>({});
  const [showAddShift, setShowAddShift] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [quickAddDay, setQuickAddDay] = useState<number | null>(null);
  const [quickAddEmp, setQuickAddEmp] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [shiftError, setShiftError] = useState('');
  const [shiftForm, setShiftForm] = useState({
    employeeId: '', dayOfWeek: '0', startTime: '09:00', endTime: '17:00', shiftType: 'WORK', notes: '',
    breakMinutes: '30',
    splitStart1: '09:00', splitEnd1: '14:00', splitStart2: '15:00', splitEnd2: '22:00',
    splitBreak1: '30', splitBreak2: '0',
  });

  const DEFAULT_FORM = {
    employeeId: '', dayOfWeek: '0', startTime: '09:00', endTime: '17:00', shiftType: 'WORK', notes: '',
    breakMinutes: '30',
    splitStart1: '09:00', splitEnd1: '14:00', splitStart2: '15:00', splitEnd2: '22:00',
    splitBreak1: '30', splitBreak2: '0',
  };

  const load = () => {
    api.get(`/schedules/${id}`).then((s: Schedule) => {
      setSchedule(s);
      api.get(`/employees?restaurantId=${s.restaurant.id}&active=true`).then(setEmployees);
    });
    api.get(`/schedules/${id}/summary`).then(setSummary).catch(() => {});
  };

  useEffect(() => { load(); }, [id]);

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError('');
    try {
      if (shiftForm.shiftType === 'SPLIT') {
        await api.post(`/schedules/${id}/shifts/bulk`, {
          shifts: [
            { employeeId: shiftForm.employeeId, dayOfWeek: parseInt(shiftForm.dayOfWeek), startTime: shiftForm.splitStart1, endTime: shiftForm.splitEnd1, shiftType: 'WORK', breakMinutes: parseInt(shiftForm.splitBreak1) || 0, notes: shiftForm.notes || null },
            { employeeId: shiftForm.employeeId, dayOfWeek: parseInt(shiftForm.dayOfWeek), startTime: shiftForm.splitEnd1, endTime: shiftForm.splitStart2, shiftType: 'BREAK', breakMinutes: 0, notes: null },
            { employeeId: shiftForm.employeeId, dayOfWeek: parseInt(shiftForm.dayOfWeek), startTime: shiftForm.splitStart2, endTime: shiftForm.splitEnd2, shiftType: 'WORK', breakMinutes: parseInt(shiftForm.splitBreak2) || 0, notes: null },
          ],
        });
      } else {
        await api.post(`/schedules/${id}/shifts`, {
          employeeId: shiftForm.employeeId,
          dayOfWeek: parseInt(shiftForm.dayOfWeek),
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          shiftType: shiftForm.shiftType,
          breakMinutes: shiftForm.shiftType === 'WORK' ? (parseInt(shiftForm.breakMinutes) || 0) : 0,
          notes: shiftForm.notes || null,
        });
      }
      setShowAddShift(false);
      resetForm();
      load();
    } catch (err: any) {
      setShiftError(err.message || 'Failed to add shift');
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError('');
    if (quickAddDay === null || !quickAddEmp) return;
    try {
      if (shiftForm.shiftType === 'SPLIT') {
        await api.post(`/schedules/${id}/shifts/bulk`, {
          shifts: [
            { employeeId: quickAddEmp, dayOfWeek: quickAddDay, startTime: shiftForm.splitStart1, endTime: shiftForm.splitEnd1, shiftType: 'WORK', breakMinutes: parseInt(shiftForm.splitBreak1) || 0, notes: shiftForm.notes || null },
            { employeeId: quickAddEmp, dayOfWeek: quickAddDay, startTime: shiftForm.splitEnd1, endTime: shiftForm.splitStart2, shiftType: 'BREAK', breakMinutes: 0, notes: null },
            { employeeId: quickAddEmp, dayOfWeek: quickAddDay, startTime: shiftForm.splitStart2, endTime: shiftForm.splitEnd2, shiftType: 'WORK', breakMinutes: parseInt(shiftForm.splitBreak2) || 0, notes: null },
          ],
        });
      } else {
        await api.post(`/schedules/${id}/shifts`, {
          employeeId: quickAddEmp,
          dayOfWeek: quickAddDay,
          startTime: shiftForm.startTime,
          endTime: shiftForm.endTime,
          shiftType: shiftForm.shiftType,
          breakMinutes: shiftForm.shiftType === 'WORK' ? (parseInt(shiftForm.breakMinutes) || 0) : 0,
          notes: shiftForm.notes || null,
        });
      }
      setQuickAddDay(null);
      setQuickAddEmp(null);
      resetForm();
      load();
    } catch (err: any) {
      setShiftError(err.message || 'Failed to add shift');
    }
  };

  const handleEditShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError('');
    if (!editingShift) return;
    try {
      await api.put(`/schedules/shifts/${editingShift.id}`, {
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        shiftType: shiftForm.shiftType === 'SPLIT' ? 'WORK' : shiftForm.shiftType,
        breakMinutes: shiftForm.shiftType === 'WORK' ? (parseInt(shiftForm.breakMinutes) || 0) : 0,
        notes: shiftForm.notes || null,
      });
      setEditingShift(null);
      resetForm();
      load();
    } catch (err: any) {
      setShiftError(err.message || 'Failed to update shift');
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    await api.delete(`/schedules/shifts/${shiftId}`);
    load();
  };

  const handleDeleteEmployeeShifts = async (employeeId: string) => {
    if (!confirm('Delete all shifts for this employee in this schedule?')) return;
    await api.delete(`/schedules/${id}/employee/${employeeId}/shifts`);
    load();
  };

  const handlePublish = async () => {
    await api.put(`/schedules/${id}`, { published: !schedule?.published });
    load();
  };

  const resetForm = () => {
    setShiftForm({ ...DEFAULT_FORM });
    setShiftError('');
  };

  const openEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftError('');
    setShiftForm({
      ...DEFAULT_FORM,
      startTime: shift.startTime,
      endTime: shift.endTime,
      shiftType: shift.shiftType,
      breakMinutes: String(shift.breakMinutes || 0),
      notes: shift.notes || '',
    });
  };

  const getShareUrl = () => {
    if (!schedule?.restaurant?.shareToken) return '';
    return `${window.location.origin}/schedule/${schedule.restaurant.shareToken}`;
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  // ─── Employee ordering ───
  const getOrderedEmployees = () => {
    if (!schedule) return [];
    const orderMap: Record<string, number> = {};
    if (schedule.employeeOrders) {
      for (const o of schedule.employeeOrders) {
        orderMap[o.employeeId] = o.displayOrder;
      }
    }
    return Object.values(employeeShifts).sort((a, b) => {
      const orderA = orderMap[a.employee.id] ?? 999;
      const orderB = orderMap[b.employee.id] ?? 999;
      return orderA - orderB;
    });
  };

  const moveEmployee = async (employeeId: string, direction: 'up' | 'down') => {
    const ordered = getOrderedEmployees();
    const idx = ordered.findIndex(e => e.employee.id === employeeId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === ordered.length - 1) return;

    const newOrdered = [...ordered];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newOrdered[idx], newOrdered[swapIdx]] = [newOrdered[swapIdx], newOrdered[idx]];

    const orders = newOrdered.map((e, i) => ({ employeeId: e.employee.id, displayOrder: i }));
    await api.put(`/schedules/${id}/employee-order`, { orders });
    load();
  };

  if (!schedule) return <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Loading...</div>;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const getWeekEndDisplay = () => {
    const start = new Date(schedule.weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return formatDate(end.toISOString());
  };

  const getDateForDay = (dayIdx: number) => {
    const start = new Date(schedule.weekStart);
    const d = new Date(start);
    d.setDate(d.getDate() + dayIdx);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group shifts by employee
  const employeeShifts: Record<string, { employee: Employee; shifts: Record<number, Shift[]> }> = {};
  for (const shift of schedule.shifts) {
    if (!employeeShifts[shift.employee.id]) {
      employeeShifts[shift.employee.id] = { employee: shift.employee, shifts: {} };
    }
    if (!employeeShifts[shift.employee.id].shifts[shift.dayOfWeek]) {
      employeeShifts[shift.employee.id].shifts[shift.dayOfWeek] = [];
    }
    employeeShifts[shift.employee.id].shifts[shift.dayOfWeek].push(shift);
  }

  const orderedEmployees = getOrderedEmployees();

  // ─── Totals calculation ───
  const getEmployeeWeekTotal = (shifts: Record<number, Shift[]>): number => {
    let total = 0;
    for (const dayShifts of Object.values(shifts)) {
      for (const s of dayShifts) {
        total += calcWorkHours(s);
      }
    }
    return total;
  };

  const getDayTotal = (dayIdx: number): number => {
    let total = 0;
    for (const { shifts } of Object.values(employeeShifts)) {
      for (const s of (shifts[dayIdx] || [])) {
        total += calcWorkHours(s);
      }
    }
    return total;
  };

  const getGrandTotal = (): number => {
    let total = 0;
    for (let d = 0; d < 7; d++) total += getDayTotal(d);
    return total;
  };

  const getShiftTypeColor = (type: string) => {
    switch (type) {
      case 'BREAK': return 'shift-break';
      case 'DAY_OFF': return 'shift-dayoff';
      case 'SICK': return 'shift-sick';
      case 'VACATION': return 'shift-vacation';
      default: return '';
    }
  };

  const getShiftTypeIcon = (type: string) => {
    switch (type) {
      case 'WORK': return <Clock size={12} />;
      case 'BREAK': return <Coffee size={12} />;
      case 'DAY_OFF': return <Sun size={12} />;
      case 'SICK': return <Thermometer size={12} />;
      case 'VACATION': return <Umbrella size={12} />;
      default: return <Clock size={12} />;
    }
  };

  // Shift type picker used in forms (excludes SPLIT for edit)
  const renderShiftTypePicker = (includeSplit: boolean) => (
    <div className="shift-type-picker">
      {SHIFT_TYPES.filter(st => includeSplit || st.value !== 'SPLIT').map(st => (
        <button
          key={st.value}
          type="button"
          className={`shift-type-btn ${shiftForm.shiftType === st.value ? 'active' : ''}`}
          onClick={() => setShiftForm({ ...shiftForm, shiftType: st.value })}
        >
          <st.icon size={14} /> {st.label}
        </button>
      ))}
    </div>
  );

  // Break field for WORK shifts
  const renderBreakField = () => (
    <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
      <label className="label">Lunch Break (minutes)</label>
      <input className="input" type="number" min="0" step="5" value={shiftForm.breakMinutes} onChange={e => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })} style={{ width: 120 }} />
      {parseInt(shiftForm.breakMinutes) > 0 && (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
          ({(parseInt(shiftForm.breakMinutes) / 60).toFixed(1)}h not counted in salary)
        </span>
      )}
    </div>
  );

  // Time fields for WORK/BREAK
  const renderTimeFields = () => (
    <>
      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">Start</label>
          <input className="input" type="time" value={shiftForm.startTime} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })} required />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">End</label>
          <input className="input" type="time" value={shiftForm.endTime} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })} required />
        </div>
      </div>
      {shiftForm.shiftType === 'WORK' && renderBreakField()}
    </>
  );

  // Time fields for SPLIT shift
  const renderSplitFields = () => (
    <div style={{ marginTop: 12 }}>
      <div className="split-label">Morning Shift</div>
      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">Start</label>
          <input className="input" type="time" value={shiftForm.splitStart1} onChange={e => setShiftForm({ ...shiftForm, splitStart1: e.target.value })} required />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">End</label>
          <input className="input" type="time" value={shiftForm.splitEnd1} onChange={e => setShiftForm({ ...shiftForm, splitEnd1: e.target.value })} required />
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
        <label className="label">Lunch Break (min)</label>
        <input className="input" type="number" min="0" step="5" value={shiftForm.splitBreak1} onChange={e => setShiftForm({ ...shiftForm, splitBreak1: e.target.value })} style={{ width: 120 }} />
      </div>
      <div className="split-break-label">Break: {shiftForm.splitEnd1} - {shiftForm.splitStart2}</div>
      <div className="split-label">Afternoon Shift</div>
      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">Start</label>
          <input className="input" type="time" value={shiftForm.splitStart2} onChange={e => setShiftForm({ ...shiftForm, splitStart2: e.target.value })} required />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">End</label>
          <input className="input" type="time" value={shiftForm.splitEnd2} onChange={e => setShiftForm({ ...shiftForm, splitEnd2: e.target.value })} required />
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
        <label className="label">Lunch Break (min)</label>
        <input className="input" type="number" min="0" step="5" value={shiftForm.splitBreak2} onChange={e => setShiftForm({ ...shiftForm, splitBreak2: e.target.value })} style={{ width: 120 }} />
      </div>
    </div>
  );

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate('/app/scheduling')}>
        <ArrowLeft size={18} /> Back to Scheduling
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{schedule.restaurant.name}</h1>
          <p className="page-subtitle">{formatDate(schedule.weekStart)} - {getWeekEndDisplay()}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => window.print()}><Printer size={18} /> Print</button>
          <button className="btn btn-secondary" onClick={() => setShowSummary(true)}><BarChart3 size={18} /> Report</button>
          <button className="btn btn-secondary" onClick={() => setShowSharePopup(true)}><Share2 size={18} /> Share</button>
          <button className={`btn ${schedule.published ? 'btn-secondary' : 'btn-primary'}`} onClick={handlePublish}>
            <Check size={18} /> {schedule.published ? 'Unpublish' : 'Publish'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddShift(true)}><Plus size={18} /> Add Shift</button>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="schedule-grid-wrapper">
        <div className="schedule-grid">
          <div className="schedule-header">
            <div className="schedule-cell schedule-name-cell">Employee</div>
            {DAYS.map((day, i) => (
              <div key={i} className="schedule-cell schedule-day-header">
                <span className="day-name">{DAYS_SHORT[i]}</span>
                <span className="day-date">{getDateForDay(i)}</span>
              </div>
            ))}
            <div className="schedule-cell schedule-total-header">Total</div>
          </div>

          {orderedEmployees.length === 0 ? (
            <div className="schedule-empty">
              <Clock size={32} />
              <p>No shifts yet. Click "Add Shift" or click on a cell to add shifts.</p>
            </div>
          ) : (
            <>
              {orderedEmployees.map(({ employee, shifts }, rowIdx) => (
                <div key={employee.id} className="schedule-row">
                  <div className="schedule-cell schedule-name-cell">
                    <div className="emp-indicator" style={{ background: employee.color || '#c8956c' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{employee.name}</strong>
                      {employee.role && <span className="schedule-role">{employee.role}</span>}
                    </div>
                    <div className="emp-row-actions">
                      <button className="emp-order-btn" title="Move up" onClick={(e) => { e.stopPropagation(); moveEmployee(employee.id, 'up'); }} disabled={rowIdx === 0}><ChevronUp size={12} /></button>
                      <button className="emp-order-btn" title="Move down" onClick={(e) => { e.stopPropagation(); moveEmployee(employee.id, 'down'); }} disabled={rowIdx === orderedEmployees.length - 1}><ChevronDown size={12} /></button>
                      <button className="emp-delete-btn" title="Delete row" onClick={(e) => { e.stopPropagation(); handleDeleteEmployeeShifts(employee.id); }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {DAYS.map((_, dayIdx) => (
                    <div
                      key={dayIdx}
                      className="schedule-cell schedule-day-cell"
                      onClick={() => { setQuickAddDay(dayIdx); setQuickAddEmp(employee.id); resetForm(); }}
                    >
                      {(shifts[dayIdx] || []).map(shift => (
                        <div
                          key={shift.id}
                          className={`shift-block ${getShiftTypeColor(shift.shiftType)}`}
                          style={shift.shiftType === 'WORK' ? { borderLeftColor: employee.color || '#c8956c' } : undefined}
                          onClick={e => { e.stopPropagation(); openEditShift(shift); }}
                        >
                          <div className="shift-time">
                            {getShiftTypeIcon(shift.shiftType)}
                            {shift.shiftType === 'DAY_OFF' || shift.shiftType === 'SICK' || shift.shiftType === 'VACATION'
                              ? shift.shiftType.replace('_', ' ')
                              : `${shift.startTime} - ${shift.endTime}`}
                          </div>
                          {shift.shiftType === 'WORK' && shift.breakMinutes > 0 && (
                            <div className="shift-break-tag">{shift.breakMinutes}m break</div>
                          )}
                          {shift.notes && <div className="shift-notes">{shift.notes}</div>}
                          <button className="shift-delete" onClick={e => { e.stopPropagation(); handleDeleteShift(shift.id); }}><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="schedule-cell schedule-total-cell">
                    {getEmployeeWeekTotal(shifts).toFixed(1)}h
                  </div>
                </div>
              ))}

              {/* Totals row */}
              <div className="schedule-row schedule-totals-row">
                <div className="schedule-cell schedule-name-cell schedule-totals-label">
                  <strong>Daily Total</strong>
                </div>
                {DAYS.map((_, dayIdx) => (
                  <div key={dayIdx} className="schedule-cell schedule-total-cell">
                    {getDayTotal(dayIdx).toFixed(1)}h
                  </div>
                ))}
                <div className="schedule-cell schedule-total-cell schedule-grand-total">
                  {getGrandTotal().toFixed(1)}h
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Shift Modal */}
      {editingShift && (
        <div className="quick-add-overlay" onClick={() => setEditingShift(null)}>
          <div className="quick-add-popover" onClick={e => e.stopPropagation()}>
            <h3>Edit Shift - {editingShift.employee.name}</h3>
            <form onSubmit={handleEditShift}>
              {shiftError && <div className="shift-error">{shiftError}</div>}
              {renderShiftTypePicker(false)}
              {(shiftForm.shiftType === 'WORK' || shiftForm.shiftType === 'BREAK') && renderTimeFields()}
              <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                <input className="input" value={shiftForm.notes} onChange={e => setShiftForm({ ...shiftForm, notes: e.target.value })} placeholder="Notes (optional)" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => { handleDeleteShift(editingShift.id); setEditingShift(null); }}>
                  <Trash2 size={14} /> Delete
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingShift(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Popover */}
      {quickAddDay !== null && quickAddEmp && !editingShift && (() => {
        // Find days that have shifts for this employee (to offer copy-from)
        const empData = employeeShifts[quickAddEmp];
        const daysWithShifts = empData
          ? DAYS.map((day, i) => ({ dayIdx: i, day, shifts: empData.shifts[i] || [] })).filter(d => d.shifts.length > 0 && d.dayIdx !== quickAddDay)
          : [];

        const handleCopyFromDay = async (sourceDayIdx: number) => {
          if (!empData) return;
          const sourceShifts = empData.shifts[sourceDayIdx] || [];
          if (sourceShifts.length === 0) return;
          try {
            const shiftsToCreate = sourceShifts.map(s => ({
              employeeId: quickAddEmp!,
              dayOfWeek: quickAddDay!,
              startTime: s.startTime,
              endTime: s.endTime,
              shiftType: s.shiftType,
              breakMinutes: s.breakMinutes || 0,
              notes: s.notes || null,
            }));
            await api.post(`/schedules/${id}/shifts/bulk`, { shifts: shiftsToCreate });
            setQuickAddDay(null);
            setQuickAddEmp(null);
            resetForm();
            load();
          } catch (err: any) {
            setShiftError(err.message || 'Failed to copy shifts');
          }
        };

        return (
          <div className="quick-add-overlay" onClick={() => { setQuickAddDay(null); setQuickAddEmp(null); }}>
            <div className="quick-add-popover" onClick={e => e.stopPropagation()}>
              <h3>Add Shift - {employees.find(e => e.id === quickAddEmp)?.name} ({DAYS[quickAddDay]})</h3>

              {/* Copy from another day */}
              {daysWithShifts.length > 0 && (
                <div className="copy-from-day">
                  <label className="label" style={{ fontSize: 11, marginBottom: 4 }}>
                    <ClipboardCopy size={12} /> Copy from another day
                  </label>
                  <div className="copy-day-buttons">
                    {daysWithShifts.map(d => (
                      <button
                        key={d.dayIdx}
                        type="button"
                        className="copy-day-btn"
                        onClick={() => handleCopyFromDay(d.dayIdx)}
                        title={d.shifts.map(s => s.shiftType === 'WORK' || s.shiftType === 'BREAK' ? `${s.startTime}-${s.endTime}` : s.shiftType.replace('_', ' ')).join(', ')}
                      >
                        {DAYS_SHORT[d.dayIdx]}
                        <span className="copy-day-count">{d.shifts.length}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="copy-from-divider"><span>or create new</span></div>

              <form onSubmit={handleQuickAdd}>
                {shiftError && <div className="shift-error">{shiftError}</div>}
                {renderShiftTypePicker(true)}
                {shiftForm.shiftType === 'SPLIT' && renderSplitFields()}
                {(shiftForm.shiftType === 'WORK' || shiftForm.shiftType === 'BREAK') && renderTimeFields()}
                <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
                  <input className="input" value={shiftForm.notes} onChange={e => setShiftForm({ ...shiftForm, notes: e.target.value })} placeholder="Notes (optional)" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQuickAddDay(null); setQuickAddEmp(null); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Add</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Add Shift Modal (for adding to any employee/day) */}
      <Modal isOpen={showAddShift} onClose={() => { setShowAddShift(false); resetForm(); }} title="Add Shift">
        <form onSubmit={handleAddShift}>
          {shiftError && <div className="shift-error">{shiftError}</div>}
          <div className="form-group">
            <label className="label">Employee *</label>
            <select className="select" value={shiftForm.employeeId} onChange={e => setShiftForm({ ...shiftForm, employeeId: e.target.value })} required>
              <option value="">Select employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} {emp.role ? `(${emp.role})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Day *</label>
            <select className="select" value={shiftForm.dayOfWeek} onChange={e => setShiftForm({ ...shiftForm, dayOfWeek: e.target.value })}>
              {DAYS.map((day, i) => <option key={i} value={i}>{day} - {getDateForDay(i)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Type</label>
            {renderShiftTypePicker(true)}
          </div>
          {shiftForm.shiftType === 'SPLIT' && renderSplitFields()}
          {(shiftForm.shiftType === 'WORK' || shiftForm.shiftType === 'BREAK') && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="label">Start Time *</label>
                  <input className="input" type="time" value={shiftForm.startTime} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="label">End Time *</label>
                  <input className="input" type="time" value={shiftForm.endTime} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })} required />
                </div>
              </div>
              {shiftForm.shiftType === 'WORK' && (
                <div className="form-group">
                  <label className="label">Lunch Break (minutes)</label>
                  <input className="input" type="number" min="0" step="5" value={shiftForm.breakMinutes} onChange={e => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })} style={{ width: 120 }} />
                  {parseInt(shiftForm.breakMinutes) > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                      ({(parseInt(shiftForm.breakMinutes) / 60).toFixed(1)}h not counted in salary)
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          <div className="form-group">
            <label className="label">Notes</label>
            <input className="input" value={shiftForm.notes} onChange={e => setShiftForm({ ...shiftForm, notes: e.target.value })} placeholder="Optional notes" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddShift(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Shift</button>
          </div>
        </form>
      </Modal>

      {/* Share Schedule Popup */}
      {showSharePopup && (
        <div className="quick-add-overlay" onClick={() => setShowSharePopup(false)}>
          <div className="quick-add-popover" onClick={e => e.stopPropagation()}>
            <h3>Share Schedule</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              Share this link with your team. It shows the current week's published schedule (view only, no login required). The link stays the same for this restaurant.
            </p>
            {schedule.published ? (
              <>
                <div className="share-link-box">
                  <input className="input" readOnly value={getShareUrl()} style={{ fontSize: 12 }} />
                  <button className="btn btn-primary btn-sm" onClick={copyShareLink}>
                    <Copy size={14} /> {copiedShare ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <p style={{ marginBottom: 8 }}>Publish the schedule first to make it visible via the share link.</p>
                <button className="btn btn-primary btn-sm" onClick={() => { handlePublish(); }}>
                  <Check size={14} /> Publish Now
                </button>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSharePopup(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary / Report Modal */}
      <Modal isOpen={showSummary} onClose={() => setShowSummary(false)} title="Weekly Hours Report" width="800px">
        {Object.keys(summary).length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 20 }}>No shifts to report on</p>
        ) : (
          <div>
            <div className="summary-table">
              <div className="summary-header">
                <span style={{ flex: 2 }}>Employee</span>
                <span>Days</span>
                <span>Shifts</span>
                <span>Work Hrs</span>
                <span>Break Hrs</span>
                <span>Off/Sick/Vac</span>
                <span>Est. Pay</span>
              </div>
              {Object.entries(summary).map(([empId, emp]) => (
                <div key={empId} className="summary-row">
                  <span style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="emp-indicator" style={{ background: emp.color || '#c8956c' }} />
                    <div>
                      <strong>{emp.name}</strong>
                      {emp.role && <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)' }}>{emp.role}</span>}
                    </div>
                  </span>
                  <span>{emp.daysWorked}</span>
                  <span>{emp.workShifts}</span>
                  <span className="summary-hours">{emp.totalWorkHours.toFixed(1)}h</span>
                  <span>{emp.totalBreakHours.toFixed(1)}h</span>
                  <span>{emp.daysOff}/{emp.sickDays}/{emp.vacationDays}</span>
                  <span className="summary-pay">{emp.estimatedPay != null ? `$${emp.estimatedPay.toFixed(0)}` : '-'}</span>
                </div>
              ))}
              <div className="summary-row summary-footer">
                <span style={{ flex: 2 }}><strong>Total</strong></span>
                <span>{Object.values(summary).reduce((s, e) => s + e.daysWorked, 0)}</span>
                <span>{Object.values(summary).reduce((s, e) => s + e.workShifts, 0)}</span>
                <span className="summary-hours">{Object.values(summary).reduce((s, e) => s + e.totalWorkHours, 0).toFixed(1)}h</span>
                <span>{Object.values(summary).reduce((s, e) => s + e.totalBreakHours, 0).toFixed(1)}h</span>
                <span>-</span>
                <span className="summary-pay">
                  ${Object.values(summary).reduce((s, e) => s + (e.estimatedPay || 0), 0).toFixed(0)}
                </span>
              </div>
            </div>

            {/* Daily breakdown */}
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, margin: '24px 0 12px' }}>Daily Breakdown</h3>
            <div className="daily-breakdown">
              <div className="daily-header">
                <span style={{ flex: 2 }}>Employee</span>
                {DAYS_SHORT.map(d => <span key={d}>{d}</span>)}
                <span>Total</span>
              </div>
              {Object.entries(summary).map(([empId, emp]) => (
                <div key={empId} className="daily-row">
                  <span style={{ flex: 2, fontSize: 13 }}>{emp.name}</span>
                  {[0, 1, 2, 3, 4, 5, 6].map(day => {
                    const bd = emp.dailyBreakdown[day];
                    return (
                      <span key={day} className="daily-cell">
                        {bd ? `${bd.work.toFixed(1)}h` : '-'}
                      </span>
                    );
                  })}
                  <span className="daily-cell daily-total">{emp.totalWorkHours.toFixed(1)}h</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
