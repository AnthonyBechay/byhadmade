import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Store, Phone, Mail, Warehouse, FolderTree, Tag, ChevronDown, ChevronRight, Truck } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Settings.css';

interface Supplier { id: string; name: string; phone: string | null; email: string | null; deliveryType: string | null; notes: string | null }
interface StorageLocation { id: string; name: string; notes: string | null }
interface IngredientSubcategory { id: string; name: string; categoryId: string }
interface IngredientCategory { id: string; name: string; subcategories: IngredientSubcategory[] }
interface IngredientTag { id: string; name: string }

export default function Settings() {
  // ─── Suppliers ───
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', deliveryType: '', notes: '' });
  const [supplierError, setSupplierError] = useState('');

  // ─── Storage Locations ───
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [editingStorage, setEditingStorage] = useState<StorageLocation | null>(null);
  const [storageForm, setStorageForm] = useState({ name: '', notes: '' });
  const [storageError, setStorageError] = useState('');

  // ─── Categories ───
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<IngredientCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: '' });
  const [catError, setCatError] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<IngredientSubcategory | null>(null);
  const [subForm, setSubForm] = useState({ name: '' });
  const [subError, setSubError] = useState('');
  const [subParentCatId, setSubParentCatId] = useState('');

  // ─── Tags ───
  const [tags, setTags] = useState<IngredientTag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<IngredientTag | null>(null);
  const [tagForm, setTagForm] = useState({ name: '' });
  const [tagError, setTagError] = useState('');

  const loadSuppliers = () => { api.get('/suppliers').then(setSuppliers).catch(() => {}); };
  const loadStorageLocations = () => { api.get('/storage-locations').then(setStorageLocations).catch(() => {}); };
  const loadCategories = () => { api.get('/ingredient-settings/categories').then(setCategories).catch(() => {}); };
  const loadTags = () => { api.get('/ingredient-settings/tags').then(setTags).catch(() => {}); };

  useEffect(() => { loadSuppliers(); loadStorageLocations(); loadCategories(); loadTags(); }, []);

  // ─── Supplier Handlers ───
  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierError('');
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, supplierForm);
      } else {
        await api.post('/suppliers', supplierForm);
      }
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupplierForm({ name: '', phone: '', email: '', deliveryType: '', notes: '' });
      loadSuppliers();
    } catch (err: any) { setSupplierError(err.message); }
  };

  const handleEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierForm({ name: s.name, phone: s.phone || '', email: s.email || '', deliveryType: s.deliveryType || '', notes: s.notes || '' });
    setShowSupplierModal(true);
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    await api.delete(`/suppliers/${id}`);
    loadSuppliers();
  };

  // ─── Storage Location Handlers ───
  const handleStorageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStorageError('');
    try {
      if (editingStorage) {
        await api.put(`/storage-locations/${editingStorage.id}`, storageForm);
      } else {
        await api.post('/storage-locations', storageForm);
      }
      setShowStorageModal(false);
      setEditingStorage(null);
      setStorageForm({ name: '', notes: '' });
      loadStorageLocations();
    } catch (err: any) { setStorageError(err.message); }
  };

  const handleEditStorage = (s: StorageLocation) => {
    setEditingStorage(s);
    setStorageForm({ name: s.name, notes: s.notes || '' });
    setShowStorageModal(true);
  };

  const handleDeleteStorage = async (id: string) => {
    if (!confirm('Delete this storage location?')) return;
    await api.delete(`/storage-locations/${id}`);
    loadStorageLocations();
  };

  // ─── Category Handlers ───
  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError('');
    try {
      if (editingCat) {
        await api.put(`/ingredient-settings/categories/${editingCat.id}`, catForm);
      } else {
        await api.post('/ingredient-settings/categories', catForm);
      }
      setShowCatModal(false);
      setEditingCat(null);
      setCatForm({ name: '' });
      loadCategories();
    } catch (err: any) { setCatError(err.message); }
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm('Delete this category and all its subcategories?')) return;
    await api.delete(`/ingredient-settings/categories/${id}`);
    loadCategories();
  };

  // ─── Subcategory Handlers ───
  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubError('');
    try {
      if (editingSub) {
        await api.put(`/ingredient-settings/subcategories/${editingSub.id}`, subForm);
      } else {
        await api.post(`/ingredient-settings/categories/${subParentCatId}/subcategories`, subForm);
      }
      setShowSubModal(false);
      setEditingSub(null);
      setSubForm({ name: '' });
      loadCategories();
    } catch (err: any) { setSubError(err.message); }
  };

  const handleDeleteSub = async (id: string) => {
    if (!confirm('Delete this subcategory?')) return;
    await api.delete(`/ingredient-settings/subcategories/${id}`);
    loadCategories();
  };

  // ─── Tag Handlers ───
  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTagError('');
    try {
      if (editingTag) {
        await api.put(`/ingredient-settings/tags/${editingTag.id}`, tagForm);
      } else {
        await api.post('/ingredient-settings/tags', tagForm);
      }
      setShowTagModal(false);
      setEditingTag(null);
      setTagForm({ name: '' });
      loadTags();
    } catch (err: any) { setTagError(err.message); }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    await api.delete(`/ingredient-settings/tags/${id}`);
    loadTags();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage lists of values</p>
        </div>
      </div>

      {/* ─── Suppliers Section ─── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div>
            <h2 className="settings-section-title"><Store size={18} /> Suppliers</h2>
            <p className="settings-section-desc">Manage your ingredient suppliers. These appear in ingredient forms and orders.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', phone: '', email: '', deliveryType: '', notes: '' }); setSupplierError(''); setShowSupplierModal(true); }}>
            <Plus size={16} /> Add Supplier
          </button>
        </div>

        {suppliers.length === 0 ? (
          <div className="settings-empty">No suppliers yet. Add your first supplier above.</div>
        ) : (
          <div className="settings-list">
            {suppliers.map(s => (
              <div key={s.id} className="settings-list-item">
                <div className="settings-item-info">
                  <strong>{s.name}</strong>
                  <div className="settings-item-meta">
                    {s.deliveryType && <span><Truck size={11} /> {s.deliveryType}</span>}
                    {s.phone && <span><Phone size={11} /> {s.phone}</span>}
                    {s.email && <span><Mail size={11} /> {s.email}</span>}
                    {s.notes && <span className="settings-item-notes">{s.notes}</span>}
                  </div>
                </div>
                <div className="settings-item-actions">
                  <button className="btn-icon" onClick={() => handleEditSupplier(s)}><Edit3 size={14} /></button>
                  <button className="btn-icon" onClick={() => handleDeleteSupplier(s.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Ingredient Categories Section ─── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div>
            <h2 className="settings-section-title"><FolderTree size={18} /> Ingredient Categories</h2>
            <p className="settings-section-desc">Categories and subcategories for organizing ingredients (Meats &gt; Poultry, Dairy &gt; Cheese, etc.)</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingCat(null); setCatForm({ name: '' }); setCatError(''); setShowCatModal(true); }}>
            <Plus size={16} /> Add Category
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="settings-empty">No categories yet. Add categories or seed ingredients to auto-create them.</div>
        ) : (
          <div className="settings-list">
            {categories.map(cat => (
              <div key={cat.id} className="settings-category-block">
                <div className="settings-list-item">
                  <div className="settings-item-info" style={{ cursor: 'pointer' }} onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {expandedCat === cat.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <strong>{cat.name}</strong>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>({cat.subcategories.length} sub)</span>
                    </div>
                  </div>
                  <div className="settings-item-actions">
                    <button className="btn-icon" onClick={() => { setSubParentCatId(cat.id); setEditingSub(null); setSubForm({ name: '' }); setSubError(''); setShowSubModal(true); }} title="Add subcategory"><Plus size={14} /></button>
                    <button className="btn-icon" onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name }); setCatError(''); setShowCatModal(true); }}><Edit3 size={14} /></button>
                    <button className="btn-icon" onClick={() => handleDeleteCat(cat.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                {expandedCat === cat.id && cat.subcategories.length > 0 && (
                  <div className="settings-subcategory-list">
                    {cat.subcategories.map(sub => (
                      <div key={sub.id} className="settings-list-item settings-sub-item">
                        <div className="settings-item-info">
                          <span style={{ fontSize: 13 }}>{sub.name}</span>
                        </div>
                        <div className="settings-item-actions">
                          <button className="btn-icon" onClick={() => { setEditingSub(sub); setSubForm({ name: sub.name }); setSubError(''); setShowSubModal(true); }}><Edit3 size={12} /></button>
                          <button className="btn-icon" onClick={() => handleDeleteSub(sub.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Tags Section ─── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div>
            <h2 className="settings-section-title"><Tag size={18} /> Ingredient Tags</h2>
            <p className="settings-section-desc">Tags to label ingredients (Premium, Organic, Seasonal, etc.). Multiple tags can be assigned per ingredient.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingTag(null); setTagForm({ name: '' }); setTagError(''); setShowTagModal(true); }}>
            <Plus size={16} /> Add Tag
          </button>
        </div>

        {tags.length === 0 ? (
          <div className="settings-empty">No tags yet. Add tags or seed ingredients to auto-create them.</div>
        ) : (
          <div className="settings-tags-grid">
            {tags.map(t => (
              <div key={t.id} className="settings-tag-chip">
                <span>{t.name}</span>
                <div className="settings-item-actions">
                  <button className="btn-icon" onClick={() => { setEditingTag(t); setTagForm({ name: t.name }); setTagError(''); setShowTagModal(true); }}><Edit3 size={11} /></button>
                  <button className="btn-icon" onClick={() => handleDeleteTag(t.id)}><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Storage Locations Section ─── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div>
            <h2 className="settings-section-title"><Warehouse size={18} /> Storage Locations</h2>
            <p className="settings-section-desc">Where ingredients are stored after receiving an order (kitchen, fridge, stock room, etc.)</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingStorage(null); setStorageForm({ name: '', notes: '' }); setStorageError(''); setShowStorageModal(true); }}>
            <Plus size={16} /> Add Location
          </button>
        </div>

        {storageLocations.length === 0 ? (
          <div className="settings-empty">No storage locations yet. Add locations where you store ingredients.</div>
        ) : (
          <div className="settings-list">
            {storageLocations.map(s => (
              <div key={s.id} className="settings-list-item">
                <div className="settings-item-info">
                  <strong>{s.name}</strong>
                  {s.notes && <div className="settings-item-meta"><span className="settings-item-notes">{s.notes}</span></div>}
                </div>
                <div className="settings-item-actions">
                  <button className="btn-icon" onClick={() => handleEditStorage(s)}><Edit3 size={14} /></button>
                  <button className="btn-icon" onClick={() => handleDeleteStorage(s.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Supplier Modal ─── */}
      <Modal isOpen={showSupplierModal} onClose={() => { setShowSupplierModal(false); setEditingSupplier(null); }} title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSupplierSubmit}>
          {supplierError && <div className="order-error">{supplierError}</div>}
          <div className="form-group">
            <label className="label">Name *</label>
            <input className="input" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} required placeholder="e.g. Fresh Foods Co." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Phone</label>
              <input className="input" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} placeholder="+1 555 0123" />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} placeholder="orders@supplier.com" />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Delivery Type</label>
            <select className="select" value={supplierForm.deliveryType} onChange={e => setSupplierForm({ ...supplierForm, deliveryType: e.target.value })}>
              <option value="">Not specified</option>
              <option value="Truck">Truck</option>
              <option value="Pickup">Pickup</option>
              <option value="Courier">Courier</option>
              <option value="Walk-in">Walk-in</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="textarea" rows={2} value={supplierForm.notes} onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })} placeholder="Delivery days, minimum orders, etc." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowSupplierModal(false); setEditingSupplier(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingSupplier ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Storage Location Modal ─── */}
      <Modal isOpen={showStorageModal} onClose={() => { setShowStorageModal(false); setEditingStorage(null); }} title={editingStorage ? 'Edit Storage Location' : 'Add Storage Location'}>
        <form onSubmit={handleStorageSubmit}>
          {storageError && <div className="order-error">{storageError}</div>}
          <div className="form-group">
            <label className="label">Name *</label>
            <input className="input" value={storageForm.name} onChange={e => setStorageForm({ ...storageForm, name: e.target.value })} required placeholder="e.g. Main Kitchen, Big Fridge, Stock Room 1" />
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="textarea" rows={2} value={storageForm.notes} onChange={e => setStorageForm({ ...storageForm, notes: e.target.value })} placeholder="Temperature requirements, capacity, etc." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowStorageModal(false); setEditingStorage(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingStorage ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Category Modal ─── */}
      <Modal isOpen={showCatModal} onClose={() => { setShowCatModal(false); setEditingCat(null); }} title={editingCat ? 'Edit Category' : 'Add Category'}>
        <form onSubmit={handleCatSubmit}>
          {catError && <div className="order-error">{catError}</div>}
          <div className="form-group">
            <label className="label">Category Name *</label>
            <input className="input" value={catForm.name} onChange={e => setCatForm({ name: e.target.value })} required placeholder="e.g. Meats, Dairy, Vegetables" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowCatModal(false); setEditingCat(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingCat ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Subcategory Modal ─── */}
      <Modal isOpen={showSubModal} onClose={() => { setShowSubModal(false); setEditingSub(null); }} title={editingSub ? 'Edit Subcategory' : 'Add Subcategory'}>
        <form onSubmit={handleSubSubmit}>
          {subError && <div className="order-error">{subError}</div>}
          <div className="form-group">
            <label className="label">Subcategory Name *</label>
            <input className="input" value={subForm.name} onChange={e => setSubForm({ name: e.target.value })} required placeholder="e.g. Poultry, Cheese, Fresh Herbs" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowSubModal(false); setEditingSub(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingSub ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Tag Modal ─── */}
      <Modal isOpen={showTagModal} onClose={() => { setShowTagModal(false); setEditingTag(null); }} title={editingTag ? 'Edit Tag' : 'Add Tag'}>
        <form onSubmit={handleTagSubmit}>
          {tagError && <div className="order-error">{tagError}</div>}
          <div className="form-group">
            <label className="label">Tag Name *</label>
            <input className="input" value={tagForm.name} onChange={e => setTagForm({ name: e.target.value })} required placeholder="e.g. Premium, Organic, Seasonal" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowTagModal(false); setEditingTag(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingTag ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
