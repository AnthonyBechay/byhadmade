import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Clock, Coffee, Check, BarChart3, Copy, Sun, Umbrella, Thermometer } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './ScheduleDetail.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SHIFT_TYPES = [
  { value: 'WORK', label: 'Work', icon: Clock },
  { value: 'BREAK', label: 'Break', icon: Coffee },
  { value: 'DAY_OFF', label: 'Day Off', icon: Sun },
  { value: 'SICK', label: 'Sick', icon: Thermometer },
  { value: 'VACATION', label: 'Vacation', icon: Umbrella },
];

interface Employee { id: string; name: string; role: string | null; color: string | null; hourlyRate: number | null }
interface Shift { id: string; dayOfWeek: number; startTime: string; endTime: string; shiftType: string; notes: string | null; employee: Employee }
interface Schedule { id: string; weekStart: string; weekEnd: string; published: boolean; notes: string | null; restaurant: { id: string; name: string }; shifts: Shift[] }
interface SummaryEntry {
  name: string; role: string | null; color: string | null; hourlyRate: number | null;
  totalWorkHours: number; totalBreakHours: number; workShifts: number; daysWorked: number;
  dailyBreakdown: Record<number, { work: number; break: number }>;
  daysOff: number; sickDays: number; vacationDays: number; estimatedPay: number | null;
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
  const [shiftForm, setShiftForm] = useState({
    employeeId: '', dayOfWeek: '0', startTime: '09:00', endTime: '17:00', shiftType: 'WORK', notes: '',
  });

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
    await api.post(`/schedules/${id}/shifts`, {
      ...shiftForm,
      dayOfWeek: parseInt(shiftForm.dayOfWeek),
    });
    setShowAddShift(false);
    setShiftForm({ employeeId: '', dayOfWeek: '0', startTime: '09:00', endTime: '17:00', shiftType: 'WORK', notes: '' });
    load();
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAddDay === null || !quickAddEmp) return;
    await api.post(`/schedules/${id}/shifts`, {
      employeeId: quickAddEmp,
      dayOfWeek: quickAddDay,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      shiftType: shiftForm.shiftType,
      notes: shiftForm.notes || null,
    });
    setQuickAddDay(null);
    setQuickAddEmp(null);
    setShiftForm({ ...shiftForm, notes: '' });
    load();
  };

  const handleDeleteShift = async (shiftId: string) => {
    await api.delete(`/schedules/shifts/${shiftId}`);
    load();
  };

  const handlePublish = async () => {
    await api.put(`/schedules/${id}`, { published: !schedule?.published });
    load();
  };

  if (!schedule) return <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Loading...</div>;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Get the date for each day of the week
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

  const getShiftTypeColor = (type: string) => {
    switch (type) {
      case 'WORK': return '';
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

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate('/app/scheduling')}>
        <ArrowLeft size={18} /> Back to Scheduling
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{schedule.restaurant.name}</h1>
          <p className="page-subtitle">{formatDate(schedule.weekStart)} - {formatDate(schedule.weekEnd)}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowSummary(true)}><BarChart3 size={18} /> Report</button>
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
          </div>

          {Object.keys(employeeShifts).length === 0 ? (
            <div className="schedule-empty">
              <Clock size={32} />
              <p>No shifts yet. Click "Add Shift" or click on a cell to add shifts.</p>
            </div>
          ) : (
            Object.values(employeeShifts).map(({ employee, shifts }) => (
              <div key={employee.id} className="schedule-row">
                <div className="schedule-cell schedule-name-cell">
                  <div className="emp-indicator" style={{ background: employee.color || '#c8956c' }} />
                  <div>
                    <strong>{employee.name}</strong>
                    {employee.role && <span className="schedule-role">{employee.role}</span>}
                  </div>
                </div>
                {DAYS.map((_, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="schedule-cell schedule-day-cell"
                    onClick={() => { setQuickAddDay(dayIdx); setQuickAddEmp(employee.id); setShiftForm({ ...shiftForm, shiftType: 'WORK', startTime: '09:00', endTime: '17:00', notes: '' }); }}
                  >
                    {(shifts[dayIdx] || []).map(shift => (
                      <div key={shift.id} className={`shift-block ${getShiftTypeColor(shift.shiftType)}`} style={shift.shiftType === 'WORK' ? { borderLeftColor: employee.color || '#c8956c' } : undefined} onClick={e => e.stopPropagation()}>
                        <div className="shift-time">
                          {getShiftTypeIcon(shift.shiftType)}
                          {shift.shiftType === 'DAY_OFF' || shift.shiftType === 'SICK' || shift.shiftType === 'VACATION'
                            ? shift.shiftType.replace('_', ' ')
                            : `${shift.startTime} - ${shift.endTime}`}
                        </div>
                        {shift.notes && <div className="shift-notes">{shift.notes}</div>}
                        <button className="shift-delete" onClick={() => handleDeleteShift(shift.id)}><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Add Popover */}
      {quickAddDay !== null && quickAddEmp && (
        <div className="quick-add-overlay" onClick={() => { setQuickAddDay(null); setQuickAddEmp(null); }}>
          <div className="quick-add-popover" onClick={e => e.stopPropagation()}>
            <h3>Add Shift - {employees.find(e => e.id === quickAddEmp)?.name} ({DAYS[quickAddDay]})</h3>
            <form onSubmit={handleQuickAdd}>
              <div className="shift-type-picker">
                {SHIFT_TYPES.map(st => (
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
              {(shiftForm.shiftType === 'WORK' || shiftForm.shiftType === 'BREAK') && (
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
              )}
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
      )}

      {/* Add Shift Modal (for adding to any employee/day) */}
      <Modal isOpen={showAddShift} onClose={() => setShowAddShift(false)} title="Add Shift">
        <form onSubmit={handleAddShift}>
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
            <div className="shift-type-picker">
              {SHIFT_TYPES.map(st => (
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
          </div>
          {(shiftForm.shiftType === 'WORK' || shiftForm.shiftType === 'BREAK') && (
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
