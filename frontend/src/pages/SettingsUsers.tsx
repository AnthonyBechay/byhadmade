import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, UserCheck, UserX, KeyRound, Shield, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';

interface Restaurant { id: string; name: string }
interface Menu { id: string; name: string }
interface SubAccount {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  allowedMenuIds: string[];
  allowedRestaurantIds: string[];
  allowedFeatures: string[];
  createdAt: string;
}

const MAX_SUB_ACCOUNTS = 5;

const FEATURES: { key: string; label: string; desc: string }[] = [
  { key: 'ingredients', label: 'Ingredients', desc: 'Ingredients, suppliers, storage, categories, tags' },
  { key: 'menus', label: 'Menus', desc: 'Menu builder' },
  { key: 'recipes', label: 'Recipes', desc: 'Recipe management' },
  { key: 'schedules', label: 'Schedules', desc: 'Employees and weekly schedules' },
  { key: 'orders', label: 'Orders', desc: 'Supplier order management' },
  { key: 'traceability', label: 'Traceability', desc: 'Daily receipts and receipt capture' },
  { key: 'checklists', label: 'Checklists', desc: 'Daily opening/closing checklists' },
  { key: 'temperatures', label: 'Temperature', desc: 'Device temperature monitoring' },
];

export default function SettingsUsers() {
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SubAccount | null>(null);
  const [form, setForm] = useState({
    email: '', name: '', password: '', isActive: true,
    allowedRestaurantIds: [] as string[],
    allowedMenuIds: [] as string[],
    allowedFeatures: [] as string[],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sa, r, m] = await Promise.all([
        api.get('/sub-accounts'),
        api.get('/restaurants'),
        api.get('/menus'),
      ]);
      setSubAccounts(sa);
      setRestaurants(r);
      setMenus(m);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      email: '', name: '', password: '', isActive: true,
      allowedRestaurantIds: [], allowedMenuIds: [], allowedFeatures: [],
    });
    setError('');
    setShowModal(true);
  };

  const openEdit = (sa: SubAccount) => {
    setEditing(sa);
    setForm({
      email: sa.email,
      name: sa.name,
      password: '',
      isActive: sa.isActive,
      allowedRestaurantIds: sa.allowedRestaurantIds,
      allowedMenuIds: sa.allowedMenuIds,
      allowedFeatures: sa.allowedFeatures || [],
    });
    setError('');
    setShowModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editing) {
        const payload: any = {
          email: form.email,
          name: form.name,
          isActive: form.isActive,
          allowedRestaurantIds: form.allowedRestaurantIds,
          allowedMenuIds: form.allowedMenuIds,
          allowedFeatures: form.allowedFeatures,
        };
        if (form.password) payload.password = form.password;
        await api.put(`/sub-accounts/${editing.id}`, payload);
      } else {
        await api.post('/sub-accounts', form);
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this sub-account?')) return;
    try {
      await api.delete(`/sub-accounts/${id}`);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleRestaurant = (id: string) => {
    setForm((f) => ({
      ...f,
      allowedRestaurantIds: f.allowedRestaurantIds.includes(id)
        ? f.allowedRestaurantIds.filter((x) => x !== id)
        : [...f.allowedRestaurantIds, id],
    }));
  };

  const toggleMenu = (id: string) => {
    setForm((f) => ({
      ...f,
      allowedMenuIds: f.allowedMenuIds.includes(id)
        ? f.allowedMenuIds.filter((x) => x !== id)
        : [...f.allowedMenuIds, id],
    }));
  };

  const toggleFeature = (key: string) => {
    setForm((f) => ({
      ...f,
      allowedFeatures: f.allowedFeatures.includes(key)
        ? f.allowedFeatures.filter((x) => x !== key)
        : [...f.allowedFeatures, key],
    }));
  };

  const atCap = subAccounts.length >= MAX_SUB_ACCOUNTS;

  return (
    <div>
      <div className="settings-section">
        <div className="settings-section-header">
          <div>
            <h2 className="settings-section-title"><Shield size={18} /> Employee accounts</h2>
            <p className="settings-section-desc">
              Create up to {MAX_SUB_ACCOUNTS} accounts for your employees. Each account can be scoped
              to specific restaurants and menus. {subAccounts.length}/{MAX_SUB_ACCOUNTS} used.
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={openCreate}
            disabled={atCap}
            title={atCap ? 'You have reached the maximum of 5 sub-accounts' : 'Add a new sub-account'}
          >
            <Plus size={16} /> Add account
          </button>
        </div>

        {loading ? (
          <div className="settings-empty">Loading…</div>
        ) : subAccounts.length === 0 ? (
          <div className="settings-empty">No employee accounts yet. Click "Add account" to create one.</div>
        ) : (
          <div className="settings-list">
            {subAccounts.map((sa) => (
              <div key={sa.id} className="settings-list-item">
                <div className="settings-item-info">
                  <strong>{sa.name}</strong>
                  <div className="settings-item-meta">
                    <span><KeyRound size={11} /> {sa.email}</span>
                    <span>
                      {sa.isActive
                        ? <><UserCheck size={11} /> Active</>
                        : <><UserX size={11} /> Disabled</>}
                    </span>
                    <span>{sa.allowedRestaurantIds.length || 'All'} restaurants</span>
                    <span>{sa.allowedMenuIds.length || 'All'} menus</span>
                    <span>
                      {(sa.allowedFeatures && sa.allowedFeatures.length > 0)
                        ? `${sa.allowedFeatures.length} features`
                        : 'All features'}
                    </span>
                  </div>
                </div>
                <div className="settings-item-actions">
                  <button className="btn-icon" onClick={() => openEdit(sa)}><Edit3 size={14} /></button>
                  <button className="btn-icon" onClick={() => remove(sa.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowModal(false)}
          title={editing ? 'Edit employee account' : 'New employee account'}
          width="560px"
        >
          <form onSubmit={submit} className="form-stack">
            <div className="form-field">
              <label>Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Employee name"
              />
            </div>
            <div className="form-field">
              <label>Email (used as username)</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="employee@example.com"
              />
            </div>
            <div className="form-field">
              <label>{editing ? 'New password (leave blank to keep current)' : 'Password'}</label>
              <input
                type="password"
                required={!editing}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 6 characters"
                minLength={editing ? 0 : 6}
              />
            </div>

            <div className="form-field">
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span>Account is active</span>
              </label>
            </div>

            <div className="form-field">
              <label>Allowed features</label>
              <p className="form-hint">
                Which modules this account can open. Leave empty to grant access to all features.
              </p>
              <div className="chip-list">
                {FEATURES.map((f) => {
                  const on = form.allowedFeatures.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      className={`chip ${on ? 'chip-on' : ''}`}
                      onClick={() => toggleFeature(f.key)}
                      title={f.desc}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {restaurants.length > 0 && (
            <div className="form-field">
              <label>Allowed restaurants</label>
              <p className="form-hint">Leave empty to grant access to all restaurants.</p>
              <div className="chip-list">
                {restaurants.map((r) => {
                  const on = form.allowedRestaurantIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`chip ${on ? 'chip-on' : ''}`}
                      onClick={() => toggleRestaurant(r.id)}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {menus.length > 0 && (
            <div className="form-field">
              <label>Allowed menus</label>
              <p className="form-hint">Leave empty to grant access to all menus.</p>
              <div className="chip-list">
                {menus.map((m) => {
                  const on = form.allowedMenuIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`chip ${on ? 'chip-on' : ''}`}
                      onClick={() => toggleMenu(m.id)}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {error && <div className="form-error">{error}</div>}

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><Loader2 size={16} className="spin" /> Saving…</> : editing ? 'Save changes' : 'Create account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
