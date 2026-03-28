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
  const [restaurant, setRestaurant] = useState<{ name: string; logoUrl?: string | null; address?: string | null; phone?: string | null; details?: string | null } | null>(null);
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
      if (r) setRestaurant({ name: r.name, logoUrl: r.logoUrl, address: r.address, phone: r.phone, details: r.details });
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

  const exportEmployeeSalary = (_empId: string, emp: SalaryEmployee) => {
    if (!report) return;
    const weeks = Object.keys(emp.weeklyBreakdown).sort();
    const logoUrl = restaurant?.logoUrl ? `${window.location.origin}${restaurant.logoUrl}` : '';
    const monthYear = `${MONTHS[month - 1]} ${year}`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Salary - ${emp.name} - ${monthYear}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a17; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; padding-bottom: 16px; border-bottom: 2px solid #c8956c; }
  .header img { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; }
  .header-placeholder { width: 56px; height: 56px; border-radius: 12px; background: #c8956c; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 24px; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header-details { font-size: 12px; color: #706a60; margin-top: 2px; }
  .meta { display: flex; justify-content: space-between; margin: 20px 0; padding: 16px; background: #f8f6f3; border-radius: 10px; }
  .meta-item { text-align: center; }
  .meta-label { font-size: 11px; color: #706a60; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .meta-value { font-size: 18px; font-weight: 700; }
  .meta-value.accent { color: #c8956c; }
  .meta-value.green { color: #4a9e6a; }
  .section-title { font-size: 14px; font-weight: 600; color: #706a60; text-transform: uppercase; letter-spacing: 0.05em; margin: 28px 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 12px; background: #f8f6f3; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #706a60; letter-spacing: 0.05em; border-bottom: 1px solid #e0dcd6; }
  td { padding: 10px 12px; border-bottom: 1px solid #f0ece6; }
  tr:last-child td { border-bottom: none; }
  .total-row td { font-weight: 700; background: #f8f6f3; border-top: 2px solid #c8956c; }
  .amount { text-align: right; }
  .hours { color: #c8956c; font-weight: 600; }
  .pay { color: #4a9e6a; font-weight: 600; }
  .summary-box { margin-top: 24px; padding: 20px; background: linear-gradient(135deg, #faf7f4, #f4f0eb); border: 1px solid #e8e2da; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
  .summary-label { font-size: 14px; color: #706a60; }
  .summary-total { font-size: 32px; font-weight: 700; color: #4a9e6a; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0dcd6; font-size: 11px; color: #a09a90; text-align: center; }
  @media print { body { padding: 20px; } @page { margin: 1cm; } }
</style></head><body>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" alt="">` : `<div class="header-placeholder">${(restaurant?.name || 'R').charAt(0)}</div>`}
    <div>
      <h1>${restaurant?.name || 'Restaurant'}</h1>
      <div class="header-details">
        ${[restaurant?.address, restaurant?.phone].filter(Boolean).join(' &bull; ')}
        ${restaurant?.details ? `<br>${restaurant.details}` : ''}
      </div>
    </div>
  </div>

  <h2 style="margin-top: 20px; font-size: 16px; font-weight: 600;">Salary Report - ${emp.name}</h2>
  ${emp.role ? `<div style="font-size: 13px; color: #706a60; margin-top: 2px;">${emp.role}</div>` : ''}

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Period</div>
      <div class="meta-value">${monthYear}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Hourly Rate</div>
      <div class="meta-value accent">${emp.hourlyRate != null ? `$${emp.hourlyRate}/hr` : 'N/A'}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Total Hours</div>
      <div class="meta-value accent">${emp.totalWorkHours.toFixed(1)}h</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Total Shifts</div>
      <div class="meta-value">${emp.totalShifts}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Net Salary</div>
      <div class="meta-value green">${emp.salary != null ? `$${emp.salary.toFixed(2)}` : 'N/A'}</div>
    </div>
  </div>

  <div class="section-title">Weekly Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>Week</th>
        <th>Work Hours</th>
        <th>Break Hours</th>
        <th>Shifts</th>
        <th class="amount">Pay</th>
      </tr>
    </thead>
    <tbody>
      ${weeks.map(week => {
        const w = emp.weeklyBreakdown[week];
        const weekDate = new Date(week);
        const pay = emp.hourlyRate ? (w.workHours * emp.hourlyRate) : null;
        return `<tr>
          <td>Week of ${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
          <td class="hours">${w.workHours.toFixed(1)}h</td>
          <td>${w.breakHours.toFixed(1)}h</td>
          <td>${w.shifts}</td>
          <td class="amount pay">${pay != null ? `$${pay.toFixed(2)}` : 'N/A'}</td>
        </tr>`;
      }).join('')}
      <tr class="total-row">
        <td>Total</td>
        <td class="hours">${emp.totalWorkHours.toFixed(1)}h</td>
        <td>${emp.totalBreakHours.toFixed(1)}h</td>
        <td>${emp.totalShifts}</td>
        <td class="amount pay">${emp.salary != null ? `$${emp.salary.toFixed(2)}` : 'N/A'}</td>
      </tr>
    </tbody>
  </table>

  <div class="summary-box">
    <div class="summary-label">Total Salary for ${monthYear}</div>
    <div class="summary-total">${emp.salary != null ? `$${emp.salary.toFixed(2)}` : 'N/A'}</div>
  </div>

  <div class="footer">
    Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} &bull; ${restaurant?.name || ''} &bull; ByHadMade
  </div>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
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
                <span><button className="btn-icon" title="Export employee report" onClick={() => exportEmployeeSalary(empId, emp)}><Download size={14} /></button></span>
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
