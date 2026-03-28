import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Coffee, Sun, Thermometer, Umbrella, Printer } from 'lucide-react';
import './PublicSchedule.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Employee { id: string; name: string; role: string | null; color: string | null }
interface Shift { id: string; dayOfWeek: number; startTime: string; endTime: string; shiftType: string; notes: string | null; employee: Employee }

export default function PublicSchedule() {
  const { shareToken } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    fetch(`${apiBase}/schedules/public/${shareToken}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setError('Failed to load schedule'));
  }, [shareToken]);

  if (error) return <div className="public-schedule-error">{error}</div>;
  if (!data) return <div className="public-schedule-loading">Loading schedule...</div>;

  const { restaurant, schedule, weekStart, weekEnd } = data;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const getDateForDay = (dayIdx: number) => {
    const start = new Date(weekStart);
    const d = new Date(start);
    d.setDate(d.getDate() + dayIdx);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getShiftTypeColor = (type: string) => {
    switch (type) {
      case 'BREAK': return 'pub-shift-break';
      case 'DAY_OFF': return 'pub-shift-dayoff';
      case 'SICK': return 'pub-shift-sick';
      case 'VACATION': return 'pub-shift-vacation';
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

  // Group shifts by employee
  const employeeShifts: Record<string, { employee: Employee; shifts: Record<number, Shift[]> }> = {};
  if (schedule) {
    for (const shift of schedule.shifts) {
      if (!employeeShifts[shift.employee.id]) {
        employeeShifts[shift.employee.id] = { employee: shift.employee, shifts: {} };
      }
      if (!employeeShifts[shift.employee.id].shifts[shift.dayOfWeek]) {
        employeeShifts[shift.employee.id].shifts[shift.dayOfWeek] = [];
      }
      employeeShifts[shift.employee.id].shifts[shift.dayOfWeek].push(shift);
    }
  }

  return (
    <div className="public-schedule">
      <div className="public-schedule-header">
        <img src={restaurant.logoUrl || '/logo.png'} alt={restaurant.name} className="public-logo" />
        <div style={{ flex: 1 }}>
          <h1>{restaurant.name}</h1>
          <p>Weekly Schedule &middot; {formatDate(weekStart)} - {formatDate(weekEnd)}</p>
        </div>
        <button className="btn-print" onClick={() => window.print()} title="Print Schedule">
          <Printer size={18} />
          <span>Print</span>
        </button>
      </div>

      {!schedule ? (
        <div className="public-schedule-empty">
          <Clock size={40} />
          <h3>No schedule published for this week</h3>
          <p>Check back later for the updated schedule.</p>
        </div>
      ) : (
        <div className="public-grid-wrapper">
          <div className="public-grid">
            <div className="public-grid-header">
              <div className="public-cell public-name-cell">Employee</div>
              {DAYS.map((_, i) => (
                <div key={i} className="public-cell public-day-header">
                  <span className="pub-day-name">{DAYS_SHORT[i]}</span>
                  <span className="pub-day-date">{getDateForDay(i)}</span>
                </div>
              ))}
            </div>

            {Object.keys(employeeShifts).length === 0 ? (
              <div className="public-schedule-empty" style={{ padding: '40px 20px' }}>
                <p>No shifts scheduled yet.</p>
              </div>
            ) : (
              Object.values(employeeShifts).map(({ employee, shifts }) => (
                <div key={employee.id} className="public-grid-row">
                  <div className="public-cell public-name-cell">
                    <div className="pub-emp-indicator" style={{ background: employee.color || '#c8956c' }} />
                    <div>
                      <strong>{employee.name}</strong>
                      {employee.role && <span className="pub-role">{employee.role}</span>}
                    </div>
                  </div>
                  {DAYS.map((_, dayIdx) => (
                    <div key={dayIdx} className="public-cell public-day-cell">
                      {(shifts[dayIdx] || []).map(shift => (
                        <div key={shift.id} className={`pub-shift ${getShiftTypeColor(shift.shiftType)}`} style={shift.shiftType === 'WORK' ? { borderLeftColor: employee.color || '#c8956c' } : undefined}>
                          <div className="pub-shift-time">
                            {getShiftTypeIcon(shift.shiftType)}
                            {shift.shiftType === 'DAY_OFF' || shift.shiftType === 'SICK' || shift.shiftType === 'VACATION'
                              ? shift.shiftType.replace('_', ' ')
                              : `${shift.startTime} - ${shift.endTime}`}
                          </div>
                          {shift.notes && <div className="pub-shift-notes">{shift.notes}</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="public-footer">
        <span>ByHadMade</span>
      </div>
    </div>
  );
}
