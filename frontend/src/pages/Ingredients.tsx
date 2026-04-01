import { useEffect, useState } from 'react';
import { Plus, Search, Salad, Trash2, Edit3, DollarSign, Store, Sprout, Tag } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Ingredients.css';

interface Ingredient {
  id: string; name: string; unit: string | null; category: string | null;
  subcategory: string | null; tag: string | null;
  supplier: string | null; purchaseUnit: string | null; purchaseQty: number | null;
  unitPrice: number | null; currency: string | null; minStock: number | null; notes: string | null;
}
interface Supplier { id: string; name: string }

const UNITS = ['kg', 'g', 'lb', 'pcs', 'box', 'bag', 'case', 'L', 'mL', 'dozen', 'bunch', 'can', 'bottle'];

export default function Ingredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', unit: '', category: '', subcategory: '', tag: '', supplier: '', purchaseUnit: '',
    purchaseQty: '', unitPrice: '', currency: 'USD', minStock: '', notes: '',
  });

  const DEFAULT_FORM = {
    name: '', unit: '', category: '', subcategory: '', tag: '', supplier: '', purchaseUnit: '',
    purchaseQty: '', unitPrice: '', currency: 'USD', minStock: '', notes: '',
  };

  const load = () => {
    const params = search ? `?search=${search}` : '';
    api.get(`/ingredients${params}`).then(setIngredients).catch(() => {});
  };

  useEffect(() => { load(); }, [search]);
  useEffect(() => { api.get('/suppliers').then(setSuppliers).catch(() => {}); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await api.put(`/ingredients/${editing.id}`, form);
    } else {
      await api.post('/ingredients', form);
    }
    setShowModal(false);
    setEditing(null);
    setForm({ ...DEFAULT_FORM });
    load();
  };

  const handleEdit = (ing: Ingredient) => {
    setEditing(ing);
    setForm({
      name: ing.name, unit: ing.unit || '', category: ing.category || '',
      subcategory: ing.subcategory || '', tag: ing.tag || '',
      supplier: ing.supplier || '', purchaseUnit: ing.purchaseUnit || '',
      purchaseQty: ing.purchaseQty ? String(ing.purchaseQty) : '',
      unitPrice: ing.unitPrice ? String(ing.unitPrice) : '',
      currency: ing.currency || 'USD',
      minStock: ing.minStock ? String(ing.minStock) : '',
      notes: ing.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ingredient?')) return;
    await api.delete(`/ingredients/${id}`);
    load();
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await api.post('/ingredients/seed', {});
      setSeedResult(`Added ${result.created} ingredients (${result.skipped} already existed)`);
      load();
    } catch {
      setSeedResult('Failed to seed ingredients');
    } finally {
      setSeeding(false);
    }
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleSeed} disabled={seeding}>
            <Sprout size={16} /> {seeding ? 'Seeding...' : 'Seed Basic Ingredients'}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ ...DEFAULT_FORM }); setShowModal(true); }}>
            <Plus size={18} /> Add Ingredient
          </button>
        </div>
      </div>

      {seedResult && (
        <div className="seed-result">
          {seedResult}
          <button className="btn-icon" onClick={() => setSeedResult(null)} style={{ marginLeft: 8 }}>&times;</button>
        </div>
      )}

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
          <p>Add ingredients to use in your recipes and orders, or seed basic ingredients to get started.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={handleSeed} disabled={seeding}>
              <Sprout size={16} /> Seed Basic Ingredients
            </button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Add First Ingredient</button>
          </div>
        </div>
      ) : (
        <div>
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
            <div key={cat} className="ing-category-group">
              <h3 className="ing-category-title">{cat}</h3>
              <div className="ing-cards">
                {items.map(ing => (
                  <div key={ing.id} className="ing-card" onClick={() => handleEdit(ing)}>
                    <div className="ing-card-top">
                      <strong>{ing.name}</strong>
                      <div className="ing-card-actions" onClick={e => e.stopPropagation()}>
                        <button className="btn-icon" onClick={() => handleEdit(ing)}><Edit3 size={14} /></button>
                        <button className="btn-icon" onClick={() => handleDelete(ing.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="ing-card-tags">
                      {ing.unit && <span className="badge">{ing.unit}</span>}
                      {ing.subcategory && <span className="ing-tag subcategory">{ing.subcategory}</span>}
                      {ing.tag && <span className="ing-tag tag"><Tag size={10} /> {ing.tag}</span>}
                      {ing.supplier && <span className="ing-tag supplier"><Store size={10} /> {ing.supplier}</span>}
                      {ing.unitPrice != null && (
                        <span className="ing-tag price">
                          <DollarSign size={10} /> {ing.unitPrice} {ing.currency}/{ing.purchaseUnit || ing.unit || '?'}
                        </span>
                      )}
                    </div>
                    {ing.notes && <div className="ing-card-notes">{ing.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }} title={editing ? 'Edit Ingredient' : 'Add Ingredient'} width="550px">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Default Unit</label>
              <select className="select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                <option value="">Select...</option>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Category</label>
              <input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Dairy, Meat, Vegetables..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Subcategory</label>
              <input className="input" value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })} placeholder="Poultry, Cheese, Fresh Herbs..." />
            </div>
            <div className="form-group">
              <label className="label">Tag</label>
              <input className="input" value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} placeholder="Premium, Organic, Seasonal..." />
            </div>
          </div>

          <div className="form-divider">Purchasing Details</div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Supplier</label>
              <select className="select" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}>
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Purchase Unit</label>
              <select className="select" value={form.purchaseUnit} onChange={e => setForm({ ...form, purchaseUnit: e.target.value })}>
                <option value="">Same as unit</option>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Qty per Purchase</label>
              <input className="input" type="number" step="0.1" value={form.purchaseQty} onChange={e => setForm({ ...form, purchaseQty: e.target.value })} placeholder="e.g. 10" />
            </div>
            <div className="form-group">
              <label className="label">Unit Price</label>
              <input className="input" type="number" step="0.01" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="label">Currency</label>
              <select className="select" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="LBP">LBP</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Min Stock Level</label>
            <input className="input" type="number" step="0.1" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} placeholder="Optional — for low stock warnings" style={{ maxWidth: 250 }} />
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="textarea" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Storage instructions, quality notes..." />
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
