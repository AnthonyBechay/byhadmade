import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Clock, Users } from 'lucide-react';
import { api } from '../lib/api';

interface Ingredient { id: string; name: string; unit: string | null }
interface RecipeIngredient { id: string; quantity: number; unit: string | null; notes: string | null; ingredient: Ingredient }
interface Recipe {
  id: string; title: string; description: string | null; instructions: string | null;
  prepTime: number | null; cookTime: number | null; servings: number | null; difficulty: string;
  categoryId: string | null; subcategoryId: string | null;
  category: { id: string; name: string } | null; subcategory: { id: string; name: string } | null;
  ingredients: RecipeIngredient[];
}

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [newIng, setNewIng] = useState({ ingredientId: '', quantity: '', unit: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/recipes/${id}`).then((r: Recipe) => {
      setRecipe(r);
      setForm({ title: r.title, description: r.description || '', instructions: r.instructions || '', prepTime: r.prepTime?.toString() || '', cookTime: r.cookTime?.toString() || '', servings: r.servings?.toString() || '', difficulty: r.difficulty, categoryId: r.categoryId || '', subcategoryId: r.subcategoryId || '' });
      setIngredients(r.ingredients.map(i => ({ ingredientId: i.ingredient.id, quantity: i.quantity, unit: i.unit || '', notes: i.notes || '', name: i.ingredient.name })));
    });
    api.get('/ingredients').then(setAllIngredients);
    api.get('/categories').then(setCategories);
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/recipes/${id}`, {
        ...form,
        prepTime: form.prepTime ? parseInt(form.prepTime) : null,
        cookTime: form.cookTime ? parseInt(form.cookTime) : null,
        servings: form.servings ? parseInt(form.servings) : null,
        categoryId: form.categoryId || null,
        subcategoryId: form.subcategoryId || null,
        ingredients: ingredients.map(i => ({ ingredientId: i.ingredientId, quantity: parseFloat(i.quantity), unit: i.unit || null, notes: i.notes || null })),
      });
      navigate('/app/recipes');
    } finally {
      setSaving(false);
    }
  };

  const addIngredient = () => {
    if (!newIng.ingredientId || !newIng.quantity) return;
    const ing = allIngredients.find(i => i.id === newIng.ingredientId);
    setIngredients([...ingredients, { ...newIng, name: ing?.name }]);
    setNewIng({ ingredientId: '', quantity: '', unit: '', notes: '' });
  };

  if (!recipe) return <div style={{ padding: 40, color: 'var(--color-text-muted)' }}>Loading...</div>;

  const selectedCat = categories.find((c: any) => c.id === form.categoryId);

  return (
    <div style={{ maxWidth: 800 }}>
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate('/app/recipes')}>
        <ArrowLeft size={18} /> Back to Recipes
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 className="page-title">Edit Recipe</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}><Save size={18} /> {saving ? 'Saving...' : 'Save'}</button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group">
          <label className="label">Title</label>
          <input className="input" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="label">Description</label>
          <textarea className="textarea" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label">Category</label>
            <select className="select" value={form.categoryId || ''} onChange={e => setForm({ ...form, categoryId: e.target.value, subcategoryId: '' })}>
              <option value="">None</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Subcategory</label>
            <select className="select" value={form.subcategoryId || ''} onChange={e => setForm({ ...form, subcategoryId: e.target.value })} disabled={!selectedCat}>
              <option value="">None</option>
              {selectedCat?.subcategories.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label"><Clock size={14} /> Prep Time (min)</label>
            <input className="input" type="number" value={form.prepTime || ''} onChange={e => setForm({ ...form, prepTime: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label"><Clock size={14} /> Cook Time (min)</label>
            <input className="input" type="number" value={form.cookTime || ''} onChange={e => setForm({ ...form, cookTime: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label"><Users size={14} /> Servings</label>
            <input className="input" type="number" value={form.servings || ''} onChange={e => setForm({ ...form, servings: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Difficulty</label>
            <select className="select" value={form.difficulty || 'MEDIUM'} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="label">Instructions</label>
          <textarea className="textarea" value={form.instructions || ''} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={6} />
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Ingredients</h2>
        {ingredients.length > 0 && (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ingredients.map((ing, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--color-surface-elevated)', borderRadius: 'var(--radius)' }}>
                <span style={{ flex: 1 }}>{ing.quantity} {ing.unit} <strong>{ing.name}</strong> {ing.notes && <span style={{ color: 'var(--color-text-muted)' }}>({ing.notes})</span>}</span>
                <button className="btn-icon" onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 150 }}>
            <label className="label">Ingredient</label>
            <select className="select" value={newIng.ingredientId} onChange={e => setNewIng({ ...newIng, ingredientId: e.target.value })}>
              <option value="">Select...</option>
              {allIngredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <label className="label">Qty</label>
            <input className="input" type="number" step="0.1" value={newIng.quantity} onChange={e => setNewIng({ ...newIng, quantity: e.target.value })} />
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <label className="label">Unit</label>
            <input className="input" value={newIng.unit} onChange={e => setNewIng({ ...newIng, unit: e.target.value })} placeholder="g, ml, pcs" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={addIngredient} style={{ marginBottom: 18 }}><Plus size={16} /> Add</button>
        </div>
      </div>
    </div>
  );
}
