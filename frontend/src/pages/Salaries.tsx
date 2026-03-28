import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, DollarSign, Settings, Clock } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Salaries.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface Employee {
  id: string;
  name: string;
  role: string | null;
  color: string | null;
  hourlyRate: number | null;
}

interface SalaryEmployee {
  name: string;
  role: string | null;
  color: string | null;
  hourlyRate: number | null;
  totalWorkHours: number;
  totalBreakHours: number;
  totalShifts: number;
  salary: number | null;
  weeklyBreakdown: Record<string, { workHours: number; breakHours: number; shifts: number }>;
}

interface SalaryReport {
  month: number;
  year: number;
  scheduleCount: number;
  employees: Record<string, SalaryEmployee>;
  totalSalary: number;
}

export default function Salaries() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<SalaryReport | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [restaurant, setRestaurant] = useState<{ name: string } | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showConfig, setShowConfig] = useState(false);
  const [editingRate, setEditingRate] = useState<{ id: string; rate: string } | null>(null);

  const loadReport = () => {
    api.get(`/schedules/salary-report/${restaurantId}?month=${month}&year=${year}`)
      .then(setReport)
      .catch(() => setReport(null));
  };

  const loadEmployees = () => {
    api.get(`/employees?restaurantId=${restaurantId}`).then(setEmployees).catch(() => {});
  };

  useEffect(() => {
    api.get('/restaurants').then((rests: any[]) => {
      const r = rests.find((r: any) => r.id === restaurantId);
      if (r) setRestaurant({ name: r.name });
    });
    loadEmployees();
  }, [restaurantId]);

  useEffect(() => { loadReport(); }, [month, year, restaurantId]);

  const handleUpdateRate = async () => {
    if (!editingRate) return;
    await api.put(`/employees/${editingRate.id}`, { hourlyRate: parseFloat(editingRate.rate) || null });
    setEditingRate(null);
    loadEmployees();
    loadReport();
  };

  const exportCSV = () => {
    if (!report) return;
    const rows = [
      ['Employee', 'Role', 'Hourly Rate', 'Total Hours', 'Total Shifts', 'Salary'],
      ...Object.values(report.employees).map(emp => [
        emp.name,
        emp.role || '',
        emp.hourlyRate?.toString() || 'N/A',
        emp.totalWorkHours.toFixed(1),
        emp.totalShifts.toString(),
        emp.salary != null ? emp.salary.toFixed(2) : 'N/A',
      ]),
      ['', '', '', '', 'TOTAL', report.totalSalary.toFixed(2)],
    ];

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    downloadCSV(csv, `salaries_${restaurant?.name || 'report'}_${MONTHS[month - 1]}_${year}.csv`);
  };

  const exportEmployeeCSV = (empId: string, emp: SalaryEmployee) => {
    if (!report) return;
    const weeks = Object.keys(emp.weeklyBreakdown).sort();
    const rows = [
      ['Employee', emp.name],
      ['Role', emp.role || ''],
      ['Hourly Rate', emp.hourlyRate?.toString() || 'N/A'],
      ['Month', `${MONTHS[month - 1]} ${year}`],
      ['Restaurant', restaurant?.name || ''],
      [],
      ['Week', 'Work Hours', 'Break Hours', 'Shifts', 'Pay'],
      ...weeks.map(week => {
        const w = emp.weeklyBreakdown[week];
        const weekDate = new Date(week);
        return [
          `Week of ${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          w.workHours.toFixed(1),
          w.breakHours.toFixed(1),
          w.shifts.toString(),
          emp.hourlyRate ? (w.workHours * emp.hourlyRate).toFixed(2) : 'N/A',
        ];
      }),
      [],
      ['TOTAL', emp.totalWorkHours.toFixed(1), emp.totalBreakHours.toFixed(1), emp.totalShifts.toString(), emp.salary != null ? emp.salary.toFixed(2) : 'N/A'],
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    downloadCSV(csv, `salary_${emp.name.replace(/\s+/g, '_')}_${MONTHS[month - 1]}_${year}.csv`);
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Back
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">Salaries {restaurant ? `- ${restaurant.name}` : ''}</h1>
          <p className="page-subtitle">Monthly salary report based on scheduled hours</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowConfig(true)}><Settings size={18} /> Configure Rates</button>
          <button className="btn btn-primary" onClick={exportCSV} disabled={!report}><Download size={18} /> Export CSV</button>
        </div>
      </div>

      {/* Month/Year Selector */}
      <div className="salary-controls">
        <select className="select" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className="select" value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {!report || Object.keys(report.employees).length === 0 ? (
        <div className="empty-state">
          <DollarSign size={48} />
          <h3>No data for {MONTHS[month - 1]} {year}</h3>
          <p>Create and populate schedules to see salary reports</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="salary-summary-cards">
            <div className="salary-card">
              <div className="salary-card-label">Total Payroll</div>
              <div className="salary-card-value salary-total">${report.totalSalary.toFixed(2)}</div>
            </div>
            <div className="salary-card">
              <div className="salary-card-label">Employees</div>
              <div className="salary-card-value">{Object.keys(report.employees).length}</div>
            </div>
            <div className="salary-card">
              <div className="salary-card-label">Schedules</div>
              <div className="salary-card-value">{report.scheduleCount}</div>
            </div>
            <div className="salary-card">
              <div className="salary-card-label">Total Hours</div>
              <div className="salary-card-value">{Object.values(report.employees).reduce((s, e) => s + e.totalWorkHours, 0).toFixed(1)}h</div>
            </div>
          </div>

          {/* Salary Table */}
          <div className="salary-table">
            <div className="salary-table-header">
              <span style={{ flex: 2 }}>Employee</span>
              <span>Rate</span>
              <span>Hours</span>
              <span>Shifts</span>
              <span>Break Hrs</span>
              <span>Salary</span>
              <span></span>
            </div>
            {Object.entries(report.employees).map(([empId, emp]) => (
              <div key={empId} className="salary-table-row">
                <span style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="sal-emp-indicator" style={{ background: emp.color || '#c8956c' }} />
                  <div>
                    <strong>{emp.name}</strong>
                    {emp.role && <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)' }}>{emp.role}</span>}
                  </div>
                </span>
                <span>{emp.hourlyRate != null ? `$${emp.hourlyRate}/hr` : <span style={{ color: 'var(--color-text-muted)' }}>Not set</span>}</span>
                <span className="sal-hours">{emp.totalWorkHours.toFixed(1)}h</span>
                <span>{emp.totalShifts}</span>
                <span>{emp.totalBreakHours.toFixed(1)}h</span>
                <span className="sal-salary">{emp.salary != null ? `$${emp.salary.toFixed(2)}` : '-'}</span>
                <span><button className="btn-icon" title="Export employee report" onClick={() => exportEmployeeCSV(empId, emp)}><Download size={14} /></button></span>
              </div>
            ))}
            <div className="salary-table-row salary-table-footer">
              <span style={{ flex: 2 }}><strong>Total</strong></span>
              <span></span>
              <span className="sal-hours">{Object.values(report.employees).reduce((s, e) => s + e.totalWorkHours, 0).toFixed(1)}h</span>
              <span>{Object.values(report.employees).reduce((s, e) => s + e.totalShifts, 0)}</span>
              <span>{Object.values(report.employees).reduce((s, e) => s + e.totalBreakHours, 0).toFixed(1)}h</span>
              <span className="sal-salary">${report.totalSalary.toFixed(2)}</span>
              <span></span>
            </div>
          </div>

          {/* Weekly Breakdown */}
          {Object.entries(report.employees).map(([empId, emp]) => {
            const weeks = Object.keys(emp.weeklyBreakdown).sort();
            if (weeks.length <= 1) return null;
            return (
              <div key={empId} className="salary-weekly">
                <h4>{emp.name} - Weekly Breakdown</h4>
                <div className="salary-weekly-grid">
                  {weeks.map(week => {
                    const w = emp.weeklyBreakdown[week];
                    const weekDate = new Date(week);
                    return (
                      <div key={week} className="salary-weekly-card">
                        <div className="salary-weekly-date">
                          Week of {weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="salary-weekly-hours">
                          <Clock size={12} /> {w.workHours.toFixed(1)}h
                        </div>
                        <div className="salary-weekly-pay">
                          {emp.hourlyRate ? `$${(w.workHours * emp.hourlyRate).toFixed(0)}` : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Configure Rates Modal */}
      <Modal isOpen={showConfig} onClose={() => { setShowConfig(false); setEditingRate(null); }} title="Configure Hourly Rates">
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          Set the hourly rate for each employee. This is the same rate shown in the Employees tab. Salary = hours worked x hourly rate.
        </p>
        <div className="rate-config-list">
          {employees.map(emp => (
            <div key={emp.id} className="rate-config-row">
              <div className="rate-config-name">
                <div className="sal-emp-indicator" style={{ background: emp.color || '#c8956c' }} />
                <div>
                  <strong>{emp.name}</strong>
                  {emp.role && <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)' }}>{emp.role}</span>}
                </div>
              </div>
              {editingRate?.id === emp.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={editingRate.rate}
                    onChange={e => setEditingRate({ ...editingRate, rate: e.target.value })}
                    style={{ width: 100 }}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleUpdateRate}>Save</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingRate(null)}>Cancel</button>
                </div>
              ) : (
                <button
                  className="rate-config-value"
                  onClick={() => setEditingRate({ id: emp.id, rate: emp.hourlyRate?.toString() || '' })}
                >
                  {emp.hourlyRate != null ? `$${emp.hourlyRate}/hr` : 'Set rate...'}
                </button>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
