import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Clock, Coffee, Check, BarChart3 } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './ScheduleDetail.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Employee { id: string; name: string; role: string | null }
interface Shift { id: string; dayOfWeek: number; startTime: string; endTime: string; isBreak: boolean; notes: string | null; employee: Employee }
interface Schedule { id: string; weekStart: string; weekEnd: string; published: boolean; restaurant: { id: string; name: string }; shifts: Shift[] }
interface Summary { [empId: string]: { name: string; totalHours: number; shifts: number; breakHours: number } }

export default function ScheduleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [showAddShift, setShowAddShift] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [shiftForm, setShiftForm] = useState({ employeeId: '', dayOfWeek: '0', startTime: '09:00', endTime: '17:00', isBreak: false, notes: '' });

  const load = () => {
    api.get(`/schedules/${id}`).then((s: Schedule) => {
      setSchedule(s);
      api.get(`/employees?restaurantId=${s.restaurant.id}`).then(setEmployees);
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
    setShiftForm({ employeeId: '', dayOfWeek: '0', startTime: '09:00', endTime: '17:00', isBreak: false, notes: '' });
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

  // Group shifts by employee for the grid
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
          <button className="btn btn-secondary" onClick={() => setShowSummary(true)}><BarChart3 size={18} /> Summary</button>
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
              <div key={i} className="schedule-cell schedule-day-header">{day}</div>
            ))}
          </div>

          {Object.keys(employeeShifts).length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <Clock size={48} />
              <h3>No shifts yet</h3>
              <p>Add shifts to build the weekly schedule</p>
            </div>
          ) : (
            Object.values(employeeShifts).map(({ employee, shifts }) => (
              <div key={employee.id} className="schedule-row">
                <div className="schedule-cell schedule-name-cell">
                  <strong>{employee.name}</strong>
                  {employee.role && <span className="schedule-role">{employee.role}</span>}
                </div>
                {DAYS.map((_, dayIdx) => (
                  <div key={dayIdx} className="schedule-cell schedule-day-cell">
                    {(shifts[dayIdx] || []).map(shift => (
                      <div key={shift.id} className={`shift-block ${shift.isBreak ? 'shift-break' : ''}`}>
                        <div className="shift-time">
                          {shift.isBreak ? <Coffee size={12} /> : <Clock size={12} />}
                          {shift.startTime} - {shift.endTime}
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

      {/* Add Shift Modal */}
      <Modal isOpen={showAddShift} onClose={() => setShowAddShift(false)} title="Add Shift">
        <form onSubmit={handleAddShift}>
          <div className="form-group">
            <label className="label">Employee *</label>
            <select className="select" value={shiftForm.employeeId} onChange={e => setShiftForm({ ...shiftForm, employeeId: e.target.value })} required>
              <option value="">Select employee...</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} {emp.role ? `(${emp.role})` : ''}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Day *</label>
            <select className="select" value={shiftForm.dayOfWeek} onChange={e => setShiftForm({ ...shiftForm, dayOfWeek: e.target.value })}>
              {DAYS.map((day, i) => <option key={i} value={i}>{day}</option>)}
            </select>
          </div>
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
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={shiftForm.isBreak} onChange={e => setShiftForm({ ...shiftForm, isBreak: e.target.checked })} />
              <Coffee size={16} /> This is a break
            </label>
          </div>
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

      {/* Summary Modal */}
      <Modal isOpen={showSummary} onClose={() => setShowSummary(false)} title="Weekly Hours Summary" width="600px">
        {Object.keys(summary).length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 20 }}>No shifts to summarize</p>
        ) : (
          <div className="summary-table">
            <div className="summary-header">
              <span>Employee</span>
              <span>Shifts</span>
              <span>Work Hours</span>
              <span>Break Hours</span>
              <span>Total</span>
            </div>
            {Object.values(summary).map((emp) => (
              <div key={emp.name} className="summary-row">
                <span><strong>{emp.name}</strong></span>
                <span>{emp.shifts}</span>
                <span>{emp.totalHours.toFixed(1)}h</span>
                <span>{emp.breakHours.toFixed(1)}h</span>
                <span className="summary-total">{(emp.totalHours + emp.breakHours).toFixed(1)}h</span>
              </div>
            ))}
            <div className="summary-row summary-footer">
              <span><strong>Total</strong></span>
              <span>{Object.values(summary).reduce((s, e) => s + e.shifts, 0)}</span>
              <span>{Object.values(summary).reduce((s, e) => s + e.totalHours, 0).toFixed(1)}h</span>
              <span>{Object.values(summary).reduce((s, e) => s + e.breakHours, 0).toFixed(1)}h</span>
              <span className="summary-total">{Object.values(summary).reduce((s, e) => s + e.totalHours + e.breakHours, 0).toFixed(1)}h</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
