import { useEffect, useState } from 'react';
import { Plus, Search, Salad, Trash2, Edit3 } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';

interface Ingredient { id: string; name: string; unit: string | null; category: string | null }

export default function Ingredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({ name: '', unit: '', category: '' });

  const load = () => {
    const params = search ? `?search=${search}` : '';
    api.get(`/ingredients${params}`).then(setIngredients).catch(() => {});
  };

  useEffect(() => { load(); }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await api.put(`/ingredients/${editing.id}`, form);
    } else {
      await api.post('/ingredients', form);
    }
    setShowModal(false);
    setEditing(null);
    setForm({ name: '', unit: '', category: '' });
    load();
  };

  const handleEdit = (ing: Ingredient) => {
    setEditing(ing);
    setForm({ name: ing.name, unit: ing.unit || '', category: ing.category || '' });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ingredient?')) return;
    await api.delete(`/ingredients/${id}`);
    load();
  };

  const grouped = ingredients.reduce<Record<string, Ingredient[]>>((acc, ing) => {
    const cat = ing.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ing);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ingredients</h1>
          <p className="page-subtitle">{ingredients.length} ingredients</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: '', unit: '', category: '' }); setShowModal(true); }}>
          <Plus size={18} /> Add Ingredient
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-field">
          <Search size={18} />
          <input className="input" placeholder="Search ingredients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {ingredients.length === 0 ? (
        <div className="empty-state">
          <Salad size={48} />
          <h3>No ingredients yet</h3>
          <p>Add ingredients to use in your recipes</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Add First Ingredient</button>
        </div>
      ) : (
        <div>
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-secondary)' }}>{cat}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {items.map(ing => (
                  <div key={ing.id} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'default' }}>
                    <span style={{ fontSize: 14 }}>{ing.name}</span>
                    {ing.unit && <span className="badge" style={{ fontSize: 11 }}>{ing.unit}</span>}
                    <button className="btn-icon" onClick={() => handleEdit(ing)}><Edit3 size={14} /></button>
                    <button className="btn-icon" onClick={() => handleDelete(ing.id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Edit Ingredient' : 'Add Ingredient'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Default Unit</label>
              <input className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="g, ml, pcs, etc." />
            </div>
            <div className="form-group">
              <label className="label">Category</label>
              <input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Dairy, Vegetables, etc." />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
