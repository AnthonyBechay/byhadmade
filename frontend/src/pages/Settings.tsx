import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Store, Phone, Mail, Warehouse } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Settings.css';

interface Supplier { id: string; name: string; phone: string | null; email: string | null; notes: string | null }
interface StorageLocation { id: string; name: string; notes: string | null }

export default function Settings() {
  // ─── Suppliers ───
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [supplierError, setSupplierError] = useState('');

  // ─── Storage Locations ───
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [editingStorage, setEditingStorage] = useState<StorageLocation | null>(null);
  const [storageForm, setStorageForm] = useState({ name: '', notes: '' });
  const [storageError, setStorageError] = useState('');

  const loadSuppliers = () => { api.get('/suppliers').then(setSuppliers).catch(() => {}); };
  const loadStorageLocations = () => { api.get('/storage-locations').then(setStorageLocations).catch(() => {}); };

  useEffect(() => { loadSuppliers(); loadStorageLocations(); }, []);

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
      setSupplierForm({ name: '', phone: '', email: '', notes: '' });
      loadSuppliers();
    } catch (err: any) { setSupplierError(err.message); }
  };

  const handleEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierForm({ name: s.name, phone: s.phone || '', email: s.email || '', notes: s.notes || '' });
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
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', phone: '', email: '', notes: '' }); setSupplierError(''); setShowSupplierModal(true); }}>
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
    </div>
  );
}
