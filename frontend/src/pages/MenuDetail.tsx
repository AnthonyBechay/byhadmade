import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { api } from '../lib/api';

interface Recipe { id: string; title: string }
interface MenuItem { id: string; recipe: Recipe; price: number | null; notes: string | null; section: string | null; sortOrder: number }
interface Menu { id: string; name: string; description: string | null; isActive: boolean; items: MenuItem[] }

export default function MenuDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [form, setForm] = useState({ name: '', description: '', isActive: true });
  const [items, setItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ recipeId: '', price: '', section: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/menus/${id}`).then((m: Menu) => {
      setMenu(m);
      setForm({ name: m.name, description: m.description || '', isActive: m.isActive });
      setItems(m.items.map(i => ({ recipeId: i.recipe.id, recipeName: i.recipe.title, price: i.price?.toString() || '', section: i.section || '', notes: i.notes || '', sortOrder: i.sortOrder })));
    });
    api.get('/recipes').then(setRecipes);
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/menus/${id}`, {
        ...form,
        items: items.map((item, idx) => ({
          recipeId: item.recipeId,
          price: item.price ? parseFloat(item.price) : null,
          section: item.section || null,
          notes: item.notes || null,
          sortOrder: idx,
        })),
      });
      navigate('/app/menus');
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    if (!newItem.recipeId) return;
    const recipe = recipes.find(r => r.id === newItem.recipeId);
    setItems([...items, { ...newItem, recipeName: recipe?.title }]);
    setNewItem({ recipeId: '', price: '', section: '', notes: '' });
  };

  if (!menu) return <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Loading...</div>;

  const sections = [...new Set(items.map(i => i.section).filter(Boolean))];

  return (
    <div style={{ maxWidth: 800 }}>
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate('/app/menus')}>
        <ArrowLeft size={18} /> Back to Menus
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 className="page-title">Edit Menu</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={18} /> {saving ? 'Saving...' : 'Save'}</button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group">
          <label className="label">Menu Name</label>
          <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="label">Description</label>
          <textarea className="textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            Active Menu
          </label>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Menu Items</h2>

        {items.length > 0 && (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--color-surface-elevated)', borderRadius: 'var(--radius)' }}>
                <GripVertical size={16} style={{ color: 'var(--color-text-muted)' }} />
                <div style={{ flex: 1 }}>
                  <strong>{item.recipeName}</strong>
                  {item.section && <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>{item.section}</span>}
                  {item.price && <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)', fontSize: 13 }}>${item.price}</span>}
                </div>
                <button className="btn-icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label className="label">Recipe</label>
            <select className="select" value={newItem.recipeId} onChange={e => setNewItem({ ...newItem, recipeId: e.target.value })}>
              <option value="">Select recipe...</option>
              {recipes.map((r: any) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <label className="label">Section</label>
            <input className="input" value={newItem.section} onChange={e => setNewItem({ ...newItem, section: e.target.value })} placeholder="Appetizers" list="sections" />
            <datalist id="sections">{sections.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <label className="label">Price</label>
            <input className="input" type="number" step="0.01" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={addItem} style={{ marginBottom: 18 }}><Plus size={16} /> Add</button>
        </div>
      </div>
    </div>
  );
}
