import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CalendarDays, Users, Building2, Trash2, Edit3 } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Scheduling.css';

interface Restaurant { id: string; name: string; _count: { employees: number } }
interface Employee { id: string; name: string; role: string | null; phone: string | null; email: string | null; restaurant: { name: string } }
interface Schedule { id: string; weekStart: string; weekEnd: string; published: boolean; restaurant: { id: string; name: string }; shifts: any[] }

export default function Scheduling() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'schedules' | 'employees' | 'restaurants'>('schedules');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');

  // Modals
  const [showRestModal, setShowRestModal] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showSchedModal, setShowSchedModal] = useState(false);
  const [restForm, setRestForm] = useState({ name: '' });
  const [empForm, setEmpForm] = useState({ name: '', role: '', phone: '', email: '', restaurantId: '' });
  const [schedForm, setSchedForm] = useState({ weekStart: '', restaurantId: '' });

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
    await api.post('/restaurants', restForm);
    setShowRestModal(false);
    setRestForm({ name: '' });
    load();
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/employees', empForm);
    setShowEmpModal(false);
    setEmpForm({ name: '', role: '', phone: '', email: '', restaurantId: '' });
    load();
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(schedForm.weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const schedule = await api.post('/schedules', {
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      restaurantId: schedForm.restaurantId,
    });
    setShowSchedModal(false);
    setSchedForm({ weekStart: '', restaurantId: '' });
    navigate(`/app/scheduling/${schedule.id}`);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Scheduling</h1>
          <p className="page-subtitle">Manage employees and weekly schedules</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'restaurants' && <button className="btn btn-primary" onClick={() => setShowRestModal(true)}><Plus size={18} /> Add Restaurant</button>}
          {tab === 'employees' && <button className="btn btn-primary" onClick={() => { setEmpForm({ ...empForm, restaurantId: selectedRestaurant || (restaurants[0]?.id || '') }); setShowEmpModal(true); }}><Plus size={18} /> Add Employee</button>}
          {tab === 'schedules' && <button className="btn btn-primary" onClick={() => { setSchedForm({ ...schedForm, restaurantId: selectedRestaurant || (restaurants[0]?.id || '') }); setShowSchedModal(true); }}><Plus size={18} /> New Schedule</button>}
        </div>
      </div>

      <div className="scheduling-tabs">
        <button className={`sched-tab ${tab === 'schedules' ? 'active' : ''}`} onClick={() => setTab('schedules')}>
          <CalendarDays size={16} /> Schedules
        </button>
        <button className={`sched-tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>
          <Users size={16} /> Employees
        </button>
        <button className={`sched-tab ${tab === 'restaurants' ? 'active' : ''}`} onClick={() => setTab('restaurants')}>
          <Building2 size={16} /> Restaurants
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
          <div className="recipe-grid">
            {schedules.map(sched => (
              <div key={sched.id} className="recipe-card" onClick={() => navigate(`/app/scheduling/${sched.id}`)}>
                <div className="recipe-card-header">
                  <h3>{formatDate(sched.weekStart)} - {formatDate(sched.weekEnd)}</h3>
                  <div className="recipe-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-icon" onClick={async () => { if (confirm('Delete schedule?')) { await api.delete(`/schedules/${sched.id}`); load(); } }}><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="recipe-card-meta">
                  <span className="badge">{sched.restaurant.name}</span>
                  <span className={`badge ${sched.published ? 'badge-success' : 'badge-warning'}`}>{sched.published ? 'Published' : 'Draft'}</span>
                  <span className="badge">{sched.shifts.length} shifts</span>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {employees.map(emp => (
              <div key={emp.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{emp.name}</strong>
                    {emp.role && <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>{emp.role}</span>}
                  </div>
                  <button className="btn-icon" onClick={async () => { if (confirm('Delete employee?')) { await api.delete(`/employees/${emp.id}`); load(); } }}><Trash2 size={14} /></button>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  <div>{emp.restaurant.name}</div>
                  {emp.phone && <div>{emp.phone}</div>}
                  {emp.email && <div>{emp.email}</div>}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {restaurants.map(rest => (
              <div key={rest.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 16 }}>{rest.name}</strong>
                  <button className="btn-icon" onClick={async () => { if (confirm('Delete restaurant and all its employees?')) { await api.delete(`/restaurants/${rest.id}`); load(); } }}><Trash2 size={14} /></button>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>{rest._count.employees} employees</div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Restaurant Modal */}
      <Modal isOpen={showRestModal} onClose={() => setShowRestModal(false)} title="Add Restaurant">
        <form onSubmit={handleCreateRestaurant}>
          <div className="form-group">
            <label className="label">Restaurant Name *</label>
            <input className="input" value={restForm.name} onChange={e => setRestForm({ name: e.target.value })} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowRestModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add</button>
          </div>
        </form>
      </Modal>

      {/* Employee Modal */}
      <Modal isOpen={showEmpModal} onClose={() => setShowEmpModal(false)} title="Add Employee">
        <form onSubmit={handleCreateEmployee}>
          <div className="form-group">
            <label className="label">Restaurant *</label>
            <select className="select" value={empForm.restaurantId} onChange={e => setEmpForm({ ...empForm, restaurantId: e.target.value })} required>
              <option value="">Select...</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
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
              <label className="label">Phone</label>
              <input className="input" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowEmpModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Employee</button>
          </div>
        </form>
      </Modal>

      {/* Schedule Modal */}
      <Modal isOpen={showSchedModal} onClose={() => setShowSchedModal(false)} title="New Schedule">
        <form onSubmit={handleCreateSchedule}>
          <div className="form-group">
            <label className="label">Restaurant *</label>
            <select className="select" value={schedForm.restaurantId} onChange={e => setSchedForm({ ...schedForm, restaurantId: e.target.value })} required>
              <option value="">Select...</option>
              {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Week Starting (Monday) *</label>
            <input className="input" type="date" value={schedForm.weekStart} onChange={e => setSchedForm({ ...schedForm, weekStart: e.target.value })} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowSchedModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Schedule</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
