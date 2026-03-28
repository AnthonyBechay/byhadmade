import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CalendarDays, Users, Building2, Trash2, Edit3, Copy, X, Check, Upload, DollarSign, ClipboardCopy } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Scheduling.css';

interface Restaurant { id: string; name: string; address: string | null; phone: string | null; logoUrl: string | null; details: string | null; shareToken: string; _count: { employees: number } }
interface Employee { id: string; name: string; role: string | null; phone: string | null; email: string | null; color: string | null; hourlyRate: number | null; isActive: boolean; restaurant: { name: string } }
interface Schedule { id: string; weekStart: string; weekEnd: string; published: boolean; notes: string | null; restaurant: { id: string; name: string }; shifts: any[] }

const COLORS = ['#c8956c', '#6a9fd4', '#4a9e6a', '#d4a035', '#9b6cc8', '#d46a6a', '#6ac8b0', '#c86a9b'];

export default function Scheduling() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'schedules' | 'employees' | 'restaurants'>('schedules');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');

  const [showRestModal, setShowRestModal] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showSchedModal, setShowSchedModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editingRest, setEditingRest] = useState<Restaurant | null>(null);
  const [restForm, setRestForm] = useState({ name: '', address: '', phone: '', logoUrl: '', details: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState({ name: '', role: '', phone: '', email: '', color: COLORS[0], hourlyRate: '', restaurantId: '' });
  const [schedForm, setSchedForm] = useState({ weekStart: '', restaurantId: '', copyFromId: '' });
  const [schedError, setSchedError] = useState('');

  const load = () => {
    api.get('/restaurants').then(setRestaurants).catch(() => {});
    const empQ = selectedRestaurant ? `?restaurantId=${selectedRestaurant}` : '';
    api.get(`/employees${empQ}`).then(setEmployees).catch(() => {});
    const schedQ = selectedRestaurant ? `?restaurantId=${selectedRestaurant}` : '';
    api.get(`/schedules${schedQ}`).then(setSchedules).catch(() => {});
  };

  useEffect(() => { load(); }, [selectedRestaurant]);

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    let rest;
    if (editingRest) {
      rest = await api.put(`/restaurants/${editingRest.id}`, restForm);
    } else {
      rest = await api.post('/restaurants', restForm);
    }
    if (logoFile && rest?.id) {
      await api.upload(`/restaurants/${rest.id}/upload-logo`, logoFile);
    }
    setShowRestModal(false);
    setEditingRest(null);
    setRestForm({ name: '', address: '', phone: '', logoUrl: '', details: '' });
    setLogoFile(null);
    setLogoPreview(null);
    load();
  };

  const openEditRest = (rest: Restaurant) => {
    setEditingRest(rest);
    setRestForm({
      name: rest.name,
      address: rest.address || '',
      phone: rest.phone || '',
      logoUrl: rest.logoUrl || '',
      details: rest.details || '',
    });
    setLogoFile(null);
    setLogoPreview(rest.logoUrl || null);
    setShowRestModal(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...empForm,
      hourlyRate: empForm.hourlyRate ? parseFloat(empForm.hourlyRate) : null,
    };
    if (editingEmp) {
      await api.put(`/employees/${editingEmp.id}`, data);
    } else {
      await api.post('/employees', data);
    }
    setShowEmpModal(false);
    setEditingEmp(null);
    setEmpForm({ name: '', role: '', phone: '', email: '', color: COLORS[0], hourlyRate: '', restaurantId: '' });
    load();
  };

  const openEditEmp = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpForm({
      name: emp.name,
      role: emp.role || '',
      phone: emp.phone || '',
      email: emp.email || '',
      color: emp.color || COLORS[0],
      hourlyRate: emp.hourlyRate?.toString() || '',
      restaurantId: '',
    });
    setShowEmpModal(true);
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let schedule;
      if (schedForm.copyFromId) {
        // Duplicate from existing schedule
        schedule = await api.post(`/schedules/${schedForm.copyFromId}/duplicate`, {
          weekStart: new Date(schedForm.weekStart).toISOString(),
        });
      } else {
        // Create blank schedule
        schedule = await api.post('/schedules', {
          weekStart: new Date(schedForm.weekStart).toISOString(),
          restaurantId: schedForm.restaurantId,
        });
      }
      setShowSchedModal(false);
      setSchedForm({ weekStart: '', restaurantId: '', copyFromId: '' });
      setSchedError('');
      navigate(`/app/scheduling/${schedule.id}`);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        setSchedError('A schedule already exists for this week and restaurant.');
      } else {
        setSchedError(err.message || 'Failed to create schedule');
      }
    }
  };

  // Snap date input to Monday of the selected week
  const handleWeekDateChange = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0=Sun, 1=Mon...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diffToMonday);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setSchedForm({ ...schedForm, weekStart: `${yyyy}-${mm}-${dd}` });
  };

  const getWeekEndDisplay = () => {
    if (!schedForm.weekStart) return '';
    const start = new Date(schedForm.weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const handleDuplicate = (sched: Schedule) => {
    setSchedForm({ weekStart: '', restaurantId: sched.restaurant.id, copyFromId: sched.id });
    setSchedError('');
    setShowSchedModal(true);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatDateFull = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getUniqueEmployees = (shifts: any[]) => {
    const ids = new Set(shifts.map(s => s.employee?.id));
    return ids.size;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Scheduling</h1>
          <p className="page-subtitle">Manage employees and weekly schedules</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'restaurants' && <button className="btn btn-primary" onClick={() => setShowRestModal(true)}><Plus size={18} /> Add Restaurant</button>}
          {tab === 'employees' && <button className="btn btn-primary" onClick={() => { setEditingEmp(null); setEmpForm({ name: '', role: '', phone: '', email: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], hourlyRate: '', restaurantId: selectedRestaurant || (restaurants[0]?.id || '') }); setShowEmpModal(true); }}><Plus size={18} /> Add Employee</button>}
          {tab === 'schedules' && <button className="btn btn-primary" onClick={() => { setSchedForm({ ...schedForm, restaurantId: selectedRestaurant || (restaurants[0]?.id || '') }); setShowSchedModal(true); }}><Plus size={18} /> New Schedule</button>}
        </div>
      </div>

      <div className="scheduling-tabs">
        <button className={`sched-tab ${tab === 'schedules' ? 'active' : ''}`} onClick={() => setTab('schedules')}>
          <CalendarDays size={16} /> Schedules
        </button>
        <button className={`sched-tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>
          <Users size={16} /> Employees ({employees.length})
        </button>
        <button className={`sched-tab ${tab === 'restaurants' ? 'active' : ''}`} onClick={() => setTab('restaurants')}>
          <Building2 size={16} /> Restaurants ({restaurants.length})
        </button>
        <div style={{ flex: 1 }} />
        <select className="select" style={{ width: 200 }} value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}>
          <option value="">All Restaurants</option>
          {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Schedules Tab */}
      {tab === 'schedules' && (
        schedules.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={48} />
            <h3>No schedules yet</h3>
            <p>Create a weekly schedule for your team</p>
            <button className="btn btn-primary" onClick={() => setShowSchedModal(true)}><Plus size={18} /> Create Schedule</button>
          </div>
        ) : (
          <div className="schedule-list">
            {schedules.map(sched => (
              <div key={sched.id} className="schedule-list-item" onClick={() => navigate(`/app/scheduling/${sched.id}`)}>
                <div className="schedule-list-dates">
                  <span className="schedule-list-range">{formatDate(sched.weekStart)} - {formatDate(sched.weekEnd)}</span>
                  <span className="schedule-list-year">{new Date(sched.weekStart).getFullYear()}</span>
                </div>
                <div className="schedule-list-info">
                  <span className="badge">{sched.restaurant.name}</span>
                  <span className={`badge ${sched.published ? 'badge-success' : 'badge-warning'}`}>{sched.published ? 'Published' : 'Draft'}</span>
                  <span className="schedule-list-meta">{getUniqueEmployees(sched.shifts)} employees</span>
                  <span className="schedule-list-meta">{sched.shifts.filter((s: any) => s.shiftType === 'WORK').length} work shifts</span>
                </div>
                <div className="schedule-list-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-icon" title="Duplicate" onClick={() => handleDuplicate(sched)}><Copy size={16} /></button>
                  <button className="btn-icon" title="Delete" onClick={async () => { if (confirm('Delete schedule and all its shifts?')) { await api.delete(`/schedules/${sched.id}`); load(); } }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Employees Tab */}
      {tab === 'employees' && (
        employees.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <h3>No employees yet</h3>
            <p>Add employees to start building schedules</p>
            <button className="btn btn-primary" onClick={() => setShowEmpModal(true)}><Plus size={18} /> Add Employee</button>
          </div>
        ) : (
          <div className="employee-grid">
            {employees.map(emp => (
              <div key={emp.id} className={`employee-card ${!emp.isActive ? 'employee-inactive' : ''}`}>
                <div className="employee-card-header">
                  <div className="employee-avatar" style={{ background: emp.color || '#c8956c' }}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="employee-card-info">
                    <strong>{emp.name}</strong>
                    {emp.role && <span className="employee-role">{emp.role}</span>}
                  </div>
                  <div className="employee-card-actions">
                    <button className="btn-icon" onClick={() => openEditEmp(emp)}><Edit3 size={14} /></button>
                    <button className="btn-icon" onClick={async () => { if (confirm('Delete employee?')) { await api.delete(`/employees/${emp.id}`); load(); } }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="employee-card-details">
                  <span>{emp.restaurant.name}</span>
                  {emp.phone && <span>{emp.phone}</span>}
                  {emp.hourlyRate && <span>${emp.hourlyRate}/hr</span>}
                  {!emp.isActive && <span className="badge" style={{ fontSize: 11 }}>Inactive</span>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Restaurants Tab */}
      {tab === 'restaurants' && (
        restaurants.length === 0 ? (
          <div className="empty-state">
            <Building2 size={48} />
            <h3>No restaurants yet</h3>
            <p>Add a restaurant to get started</p>
            <button className="btn btn-primary" onClick={() => setShowRestModal(true)}><Plus size={18} /> Add Restaurant</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {restaurants.map(rest => (
              <div key={rest.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {rest.logoUrl ? (
                      <img src={rest.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>{rest.name.charAt(0)}</div>
                    )}
                    <strong style={{ fontSize: 16 }}>{rest.name}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" title="Edit" onClick={() => openEditRest(rest)}><Edit3 size={14} /></button>
                    <button className="btn-icon" title="Delete" onClick={async () => { if (confirm('Delete restaurant and all its employees?')) { await api.delete(`/restaurants/${rest.id}`); load(); } }}><Trash2 size={14} /></button>
                  </div>
                </div>
                {rest.address && <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>{rest.address}</div>}
                {rest.phone && <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>{rest.phone}</div>}
                {rest.details && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, fontStyle: 'italic' }}>{rest.details}</div>}
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{rest._count.employees} employees</div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={() => navigate(`/app/scheduling/salaries/${rest.id}`)}>
                  <DollarSign size={14} /> Salaries
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Restaurant Modal */}
      <Modal isOpen={showRestModal} onClose={() => { setShowRestModal(false); setEditingRest(null); }} title={editingRest ? 'Edit Restaurant' : 'Add Restaurant'}>
        <form onSubmit={handleCreateRestaurant}>
          <div className="form-group">
            <label className="label">Restaurant Name *</label>
            <input className="input" value={restForm.name} onChange={e => setRestForm({ ...restForm, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="label">Address</label>
            <input className="input" value={restForm.address} onChange={e => setRestForm({ ...restForm, address: e.target.value })} placeholder="123 Main St" />
          </div>
          <div className="form-group">
            <label className="label">Phone</label>
            <input className="input" value={restForm.phone} onChange={e => setRestForm({ ...restForm, phone: e.target.value })} placeholder="+1 555 123 4567" />
          </div>
          <div className="form-group">
            <label className="label">Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {(logoPreview || restForm.logoUrl) && (
                <img src={logoFile ? logoPreview! : restForm.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--color-border)' }} />
              )}
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                <Upload size={14} /> {logoPreview || restForm.logoUrl ? 'Change' : 'Upload'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }
                }} />
              </label>
              {(logoPreview || restForm.logoUrl) && (
                <button type="button" className="btn-icon" onClick={() => { setLogoFile(null); setLogoPreview(null); setRestForm({ ...restForm, logoUrl: '' }); }} title="Remove logo">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="label">Details / Notes</label>
            <textarea className="input" rows={3} value={restForm.details} onChange={e => setRestForm({ ...restForm, details: e.target.value })} placeholder="Additional info (shown in salary reports, etc.)" style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowRestModal(false); setEditingRest(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingRest ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* Employee Modal */}
      <Modal isOpen={showEmpModal} onClose={() => { setShowEmpModal(false); setEditingEmp(null); }} title={editingEmp ? 'Edit Employee' : 'Add Employee'}>
        <form onSubmit={handleCreateEmployee}>
          {!editingEmp && (
            <div className="form-group">
              <label className="label">Restaurant *</label>
              <select className="select" value={empForm.restaurantId} onChange={e => setEmpForm({ ...empForm, restaurantId: e.target.value })} required>
                <option value="">Select...</option>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="label">Name *</label>
            <input className="input" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Role</label>
              <input className="input" value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })} placeholder="Chef, Waiter, etc." />
            </div>
            <div className="form-group">
              <label className="label">Hourly Rate ($)</label>
              <input className="input" type="number" step="0.01" value={empForm.hourlyRate} onChange={e => setEmpForm({ ...empForm, hourlyRate: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Phone</label>
              <input className="input" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Color</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${empForm.color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setEmpForm({ ...empForm, color: c })}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowEmpModal(false); setEditingEmp(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingEmp ? 'Update' : 'Add'} Employee</button>
          </div>
        </form>
      </Modal>

      {/* Schedule Modal */}
      <Modal isOpen={showSchedModal} onClose={() => { setShowSchedModal(false); setSchedError(''); setSchedForm({ weekStart: '', restaurantId: '', copyFromId: '' }); }} title="New Schedule">
        <form onSubmit={handleCreateSchedule}>
          <div className="form-group">
            <label className="label">Restaurant *</label>
            <select className="select" value={schedForm.restaurantId} onChange={e => setSchedForm({ ...schedForm, restaurantId: e.target.value, copyFromId: '' })} required>
              <option value="">Select...</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Select any day in the week *</label>
            <input className="input" type="date" value={schedForm.weekStart} onChange={e => handleWeekDateChange(e.target.value)} required />
            {schedForm.weekStart && (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Week: {getWeekEndDisplay()}
              </div>
            )}
          </div>
          {/* Copy from previous schedule */}
          {schedForm.restaurantId && schedules.filter(s => s.restaurant.id === schedForm.restaurantId).length > 0 && (
            <div className="form-group">
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClipboardCopy size={14} /> Copy shifts from previous schedule
              </label>
              <select
                className="select"
                value={schedForm.copyFromId}
                onChange={e => setSchedForm({ ...schedForm, copyFromId: e.target.value })}
              >
                <option value="">Start blank (no shifts)</option>
                {schedules
                  .filter(s => s.restaurant.id === schedForm.restaurantId)
                  .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {formatDate(s.weekStart)} - {formatDate(s.weekEnd)} ({s.shifts.filter((sh: any) => sh.shiftType === 'WORK').length} work shifts, {s.published ? 'Published' : 'Draft'})
                    </option>
                  ))}
              </select>
              {schedForm.copyFromId && (
                <div style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Copy size={12} /> All shifts will be copied to the new week. You can then edit them.
                </div>
              )}
            </div>
          )}
          {schedError && (
            <div style={{ fontSize: 13, color: '#e05555', marginBottom: 12, padding: '8px 12px', background: 'rgba(224, 85, 85, 0.08)', borderRadius: 6 }}>
              {schedError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowSchedModal(false); setSchedError(''); setSchedForm({ weekStart: '', restaurantId: '', copyFromId: '' }); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{schedForm.copyFromId ? 'Copy & Create' : 'Create Schedule'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
