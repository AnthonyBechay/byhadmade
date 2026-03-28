import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UtensilsCrossed, Trash2, Edit3 } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';

interface Menu { id: string; name: string; description: string | null; isActive: boolean; _count: { items: number } }

export default function Menus() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = () => api.get('/menus').then(setMenus).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/menus', form);
    setShowCreate(false);
    setForm({ name: '', description: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this menu?')) return;
    await api.delete(`/menus/${id}`);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Menus</h1>
          <p className="page-subtitle">{menus.length} menus</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={18} /> New Menu</button>
      </div>

      {menus.length === 0 ? (
        <div className="empty-state">
          <UtensilsCrossed size={48} />
          <h3>No menus yet</h3>
          <p>Create menus from your recipes</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={18} /> Create First Menu</button>
        </div>
      ) : (
        <div className="recipe-grid">
          {menus.map(menu => (
            <div key={menu.id} className="recipe-card" onClick={() => navigate(`/app/menus/${menu.id}`)}>
              <div className="recipe-card-header">
                <h3>{menu.name}</h3>
                <div className="recipe-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-icon" onClick={() => navigate(`/app/menus/${menu.id}`)}><Edit3 size={16} /></button>
                  <button className="btn-icon" onClick={() => handleDelete(menu.id)}><Trash2 size={16} /></button>
                </div>
              </div>
              {menu.description && <p className="recipe-card-desc">{menu.description}</p>}
              <div className="recipe-card-meta">
                <span className="badge badge-primary">{menu._count.items} items</span>
                <span className={`badge ${menu.isActive ? 'badge-success' : ''}`}>{menu.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Menu">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Menu</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
