import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChefHat, Clock, Users, Trash2, Edit3 } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Recipes.css';

interface Category { id: string; name: string; subcategories: { id: string; name: string }[] }
interface Recipe {
  id: string; title: string; description: string | null; prepTime: number | null; cookTime: number | null;
  servings: number | null; difficulty: string; category: { id: string; name: string } | null;
  subcategory: { id: string; name: string } | null; ingredients: any[];
}

export default function Recipes() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', instructions: '', prepTime: '', cookTime: '', servings: '', difficulty: 'MEDIUM', categoryId: '', subcategoryId: '', imageUrl: '' });
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [subForm, setSubForm] = useState({ name: '', description: '', categoryId: '' });

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterCat) params.set('categoryId', filterCat);
    api.get(`/recipes?${params}`).then(setRecipes).catch(() => {});
    api.get('/categories').then(setCategories).catch(() => {});
  };

  useEffect(() => { load(); }, [search, filterCat]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/recipes', {
      ...form,
      prepTime: form.prepTime ? parseInt(form.prepTime) : null,
      cookTime: form.cookTime ? parseInt(form.cookTime) : null,
      servings: form.servings ? parseInt(form.servings) : null,
      categoryId: form.categoryId || null,
      subcategoryId: form.subcategoryId || null,
    });
    setShowCreate(false);
    setForm({ title: '', description: '', instructions: '', prepTime: '', cookTime: '', servings: '', difficulty: 'MEDIUM', categoryId: '', subcategoryId: '', imageUrl: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recipe?')) return;
    await api.delete(`/recipes/${id}`);
    load();
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/categories', catForm);
    setCatForm({ name: '', description: '' });
    load();
  };

  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subForm.categoryId) return;
    await api.post(`/categories/${subForm.categoryId}/subcategories`, { name: subForm.name, description: subForm.description });
    setSubForm({ name: '', description: '', categoryId: '' });
    load();
  };

  const selectedCat = categories.find(c => c.id === form.categoryId);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recipes</h1>
          <p className="page-subtitle">{recipes.length} recipes</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCategoryModal(true)}>Categories</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={18} /> New Recipe</button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-field">
          <Search size={18} />
          <input className="input" placeholder="Search recipes..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 200 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {recipes.length === 0 ? (
        <div className="empty-state">
          <ChefHat size={48} />
          <h3>No recipes yet</h3>
          <p>Start building your recipe collection</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={18} /> Create First Recipe</button>
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map(recipe => (
            <div key={recipe.id} className="recipe-card" onClick={() => navigate(`/app/recipes/${recipe.id}`)}>
              <div className="recipe-card-header">
                <h3>{recipe.title}</h3>
                <div className="recipe-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-icon" onClick={() => navigate(`/app/recipes/${recipe.id}`)}><Edit3 size={16} /></button>
                  <button className="btn-icon" onClick={() => handleDelete(recipe.id)}><Trash2 size={16} /></button>
                </div>
              </div>
              {recipe.description && <p className="recipe-card-desc">{recipe.description}</p>}
              <div className="recipe-card-meta">
                {recipe.category && <span className="badge badge-primary">{recipe.category.name}</span>}
                {recipe.subcategory && <span className="badge">{recipe.subcategory.name}</span>}
                <span className="badge">{recipe.difficulty}</span>
              </div>
              <div className="recipe-card-stats">
                {recipe.prepTime && <span><Clock size={14} /> {recipe.prepTime + (recipe.cookTime || 0)}min</span>}
                {recipe.servings && <span><Users size={14} /> {recipe.servings}</span>}
                <span>{recipe.ingredients.length} ingredients</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Recipe Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Recipe" width="600px">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Category</label>
              <select className="select" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value, subcategoryId: '' })}>
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Subcategory</label>
              <select className="select" value={form.subcategoryId} onChange={e => setForm({ ...form, subcategoryId: e.target.value })} disabled={!selectedCat}>
                <option value="">None</option>
                {selectedCat?.subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Prep Time (min)</label>
              <input className="input" type="number" value={form.prepTime} onChange={e => setForm({ ...form, prepTime: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Cook Time (min)</label>
              <input className="input" type="number" value={form.cookTime} onChange={e => setForm({ ...form, cookTime: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Servings</label>
              <input className="input" type="number" value={form.servings} onChange={e => setForm({ ...form, servings: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Difficulty</label>
              <select className="select" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Instructions</label>
            <textarea className="textarea" value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={4} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Recipe</button>
          </div>
        </form>
      </Modal>

      {/* Categories Modal */}
      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Manage Categories" width="600px">
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Add Category</h3>
          <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: 10 }}>
            <input className="input" placeholder="Category name" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} required />
            <button type="submit" className="btn btn-primary btn-sm">Add</button>
          </form>
        </div>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Add Subcategory</h3>
          <form onSubmit={handleCreateSub} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select className="select" style={{ width: 180 }} value={subForm.categoryId} onChange={e => setSubForm({ ...subForm, categoryId: e.target.value })} required>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="input" style={{ flex: 1 }} placeholder="Subcategory name" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} required />
            <button type="submit" className="btn btn-primary btn-sm">Add</button>
          </form>
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Categories</h3>
          {categories.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No categories yet</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categories.map(cat => (
                <div key={cat.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{cat.name}</strong>
                    <button className="btn-icon" onClick={async () => { if (confirm('Delete category?')) { await api.delete(`/categories/${cat.id}`); load(); } }}><Trash2 size={16} /></button>
                  </div>
                  {cat.subcategories.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {cat.subcategories.map(sub => (
                        <span key={sub.id} className="badge" style={{ cursor: 'pointer' }} onClick={async () => { if (confirm('Delete subcategory?')) { await api.delete(`/categories/subcategories/${sub.id}`); load(); } }}>{sub.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
