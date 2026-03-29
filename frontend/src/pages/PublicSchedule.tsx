import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Coffee, Sun, Thermometer, Umbrella, Printer, CalendarDays, ChevronRight } from 'lucide-react';
import './PublicSchedule.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Employee { id: string; name: string; role: string | null; color: string | null }
interface Shift { id: string; dayOfWeek: number; startTime: string; endTime: string; shiftType: string; breakMinutes?: number; notes: string | null; employee: Employee }
interface ScheduleData { schedule: { id: string; shifts: Shift[]; employeeOrders?: { employeeId: string; displayOrder: number }[] }; weekStart: string }

export default function PublicSchedule() {
  const { shareToken } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeWeek, setActiveWeek] = useState<'this' | 'next'>('this');

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    fetch(`${apiBase}/schedules/public/${shareToken}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        // Auto-select: if only next week exists, show it
        if (!d.thisWeek && d.nextWeek) setActiveWeek('next');
        else setActiveWeek('this');
      })
      .catch(() => setError('Failed to load schedule'));
  }, [shareToken]);

  if (error) return <div className="public-schedule-error">{error}</div>;
  if (!data) return <div className="public-schedule-loading">Loading schedule...</div>;

  const { restaurant, thisWeek, nextWeek } = data;
  const hasBothWeeks = !!thisWeek && !!nextWeek;
  const currentData: ScheduleData | null = activeWeek === 'this' ? thisWeek : nextWeek;
  const noSchedules = !thisWeek && !nextWeek;

  // Date helpers — compute weekEnd from weekStart + 6 days to avoid timezone issues
  const getWeekDates = (weekStart: string) => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  };

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDateShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const getDateForDay = (weekStart: string, dayIdx: number) => {
    const start = new Date(weekStart);
    const d = new Date(start);
    d.setDate(d.getDate() + dayIdx);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getWeekLabel = (weekStart: string) => {
    const { start, end } = getWeekDates(weekStart);
    return `${formatDateShort(start)} - ${formatDateShort(end)}`;
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

  // Group shifts by employee with ordering
  const getOrderedEmployees = (schedData: ScheduleData) => {
    const employeeShifts: Record<string, { employee: Employee; shifts: Record<number, Shift[]> }> = {};
    for (const shift of schedData.schedule.shifts) {
      if (!employeeShifts[shift.employee.id]) {
        employeeShifts[shift.employee.id] = { employee: shift.employee, shifts: {} };
      }
      if (!employeeShifts[shift.employee.id].shifts[shift.dayOfWeek]) {
        employeeShifts[shift.employee.id].shifts[shift.dayOfWeek] = [];
      }
      employeeShifts[shift.employee.id].shifts[shift.dayOfWeek].push(shift);
    }

    const orderMap: Record<string, number> = {};
    if (schedData.schedule.employeeOrders) {
      for (const o of schedData.schedule.employeeOrders) {
        orderMap[o.employeeId] = o.displayOrder;
      }
    }

    return Object.values(employeeShifts).sort((a, b) => {
      const orderA = orderMap[a.employee.id] ?? 999;
      const orderB = orderMap[b.employee.id] ?? 999;
      return orderA - orderB;
    });
  };

  // Header dates
  const headerDates = currentData
    ? (() => { const { start, end } = getWeekDates(currentData.weekStart); return `${formatDate(start)} - ${formatDate(end)}`; })()
    : '';

  return (
    <div className="public-schedule">
      <div className="public-schedule-header">
        <img src={restaurant.logoUrl || '/logo.png'} alt={restaurant.name} className="public-logo" />
        <div style={{ flex: 1 }}>
          <h1>{restaurant.name}</h1>
          <p>Weekly Schedule {headerDates && <>&middot; {headerDates}</>}</p>
        </div>
        {currentData && (
          <button className="btn-print" onClick={() => window.print()} title="Print Schedule">
            <Printer size={18} />
            <span>Print</span>
          </button>
        )}
      </div>

      {/* Week switcher — only shown if both weeks have published schedules */}
      {hasBothWeeks && (
        <div className="pub-week-switcher">
          <button
            className={`pub-week-btn ${activeWeek === 'this' ? 'active' : ''}`}
            onClick={() => setActiveWeek('this')}
          >
            <CalendarDays size={14} />
            This Week
            <span className="pub-week-dates">{getWeekLabel(thisWeek.weekStart)}</span>
          </button>
          <button
            className={`pub-week-btn ${activeWeek === 'next' ? 'active' : ''}`}
            onClick={() => setActiveWeek('next')}
          >
            <ChevronRight size={14} />
            Next Week
            <span className="pub-week-dates">{getWeekLabel(nextWeek.weekStart)}</span>
          </button>
        </div>
      )}

      {noSchedules ? (
        <div className="public-schedule-empty">
          <Clock size={40} />
          <h3>No schedule published</h3>
          <p>Check back later for the updated schedule.</p>
        </div>
      ) : !currentData ? (
        <div className="public-schedule-empty">
          <Clock size={40} />
          <h3>No schedule published for {activeWeek === 'this' ? 'this' : 'next'} week</h3>
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
                  <span className="pub-day-date">{getDateForDay(currentData.weekStart, i)}</span>
                </div>
              ))}
            </div>

            {getOrderedEmployees(currentData).length === 0 ? (
              <div className="public-schedule-empty" style={{ padding: '40px 20px' }}>
                <p>No shifts scheduled yet.</p>
              </div>
            ) : (
              getOrderedEmployees(currentData).map(({ employee, shifts }) => (
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
                          {shift.shiftType === 'WORK' && shift.breakMinutes && shift.breakMinutes > 0 && (
                            <div className="pub-shift-break">{shift.breakMinutes}m break</div>
                          )}
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
