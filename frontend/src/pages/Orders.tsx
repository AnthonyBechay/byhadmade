import { useEffect, useState, useRef } from 'react';
import {
  Package, Plus, Trash2, Truck, Check, X, Camera, Upload, ChevronDown, ChevronRight,
  Clock, CheckCircle, XCircle, AlertCircle, FileText, Image as ImageIcon
} from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Orders.css';

interface Restaurant { id: string; name: string }
interface OrderItem { id: string; name: string; quantity: number | null; unit: string | null; price: number | null; notes: string | null }
interface OrderPhoto { id: string; url: string; type: string; caption: string | null; createdAt: string }
interface Order {
  id: string; restaurantId: string; status: string; deliveryType: string | null;
  totalPaid: number | null; currency: string; supplier: string | null; notes: string | null;
  orderDate: string; deliveredAt: string | null; receivedAt: string | null;
  restaurant: { id: string; name: string };
  items: OrderItem[]; photos: OrderPhoto[];
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ORDERED: { label: 'Ordered', color: '#d4a035', icon: Clock },
  DELIVERED: { label: 'Delivered', color: '#5b9bd5', icon: Truck },
  RECEIVED: { label: 'Received', color: '#4a9e6a', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: '#e05555', icon: XCircle },
};

interface ItemRow { name: string; quantity: string; unit: string; price: string; notes: string }
const EMPTY_ITEM: ItemRow = { name: '', quantity: '', unit: 'kg', price: '', notes: '' };

export default function Orders() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [showReceive, setShowReceive] = useState<Order | null>(null);
  const [showPhotos, setShowPhotos] = useState<Order | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Create form
  const [createRestaurant, setCreateRestaurant] = useState('');
  const [createSupplier, setCreateSupplier] = useState('');
  const [createDeliveryType, setCreateDeliveryType] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createItems, setCreateItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [createError, setCreateError] = useState('');

  // Receive form
  const [receiveTotalPaid, setReceiveTotalPaid] = useState('');
  const [receiveCurrency, setReceiveCurrency] = useState('USD');
  const [receiveDeliveryType, setReceiveDeliveryType] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiveItems, setReceiveItems] = useState<ItemRow[]>([]);
  const [receiveError, setReceiveError] = useState('');

  // Photo upload
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoType, setPhotoType] = useState('INGREDIENT');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/restaurants').then((r: Restaurant[]) => {
      setRestaurants(r);
      if (r.length === 1) setSelectedRestaurant(r[0].id);
    });
  }, []);

  useEffect(() => { loadOrders(); }, [selectedRestaurant, statusFilter]);

  const loadOrders = () => {
    let q = '/orders?';
    if (selectedRestaurant) q += `restaurantId=${selectedRestaurant}&`;
    if (statusFilter) q += `status=${statusFilter}&`;
    api.get(q).then(setOrders);
  };

  // ─── Create Order ───
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const validItems = createItems.filter(it => it.name.trim());
    if (!validItems.length) { setCreateError('Add at least one item'); return; }
    try {
      await api.post('/orders', {
        restaurantId: createRestaurant || selectedRestaurant || restaurants[0]?.id,
        supplier: createSupplier,
        deliveryType: createDeliveryType,
        notes: createNotes,
        items: validItems,
      });
      setShowCreate(false);
      resetCreateForm();
      loadOrders();
    } catch (err: any) { setCreateError(err.message); }
  };

  const resetCreateForm = () => {
    setCreateSupplier(''); setCreateDeliveryType(''); setCreateNotes('');
    setCreateItems([{ ...EMPTY_ITEM }]); setCreateError('');
  };

  const updateCreateItem = (idx: number, field: keyof ItemRow, value: string) => {
    const copy = [...createItems];
    copy[idx] = { ...copy[idx], [field]: value };
    setCreateItems(copy);
  };

  const addCreateItem = () => setCreateItems([...createItems, { ...EMPTY_ITEM }]);
  const removeCreateItem = (idx: number) => setCreateItems(createItems.filter((_, i) => i !== idx));

  // ─── Receive / Update Order ───
  const openReceive = (order: Order) => {
    setShowReceive(order);
    setReceiveTotalPaid(order.totalPaid ? String(order.totalPaid) : '');
    setReceiveCurrency(order.currency || 'USD');
    setReceiveDeliveryType(order.deliveryType || '');
    setReceiveNotes(order.notes || '');
    setReceiveItems(order.items.map(it => ({
      name: it.name,
      quantity: it.quantity ? String(it.quantity) : '',
      unit: it.unit || 'kg',
      price: it.price ? String(it.price) : '',
      notes: it.notes || '',
    })));
    setReceiveError('');
  };

  const handleReceive = async (e: React.FormEvent, newStatus: string) => {
    e.preventDefault();
    if (!showReceive) return;
    setReceiveError('');
    const validItems = receiveItems.filter(it => it.name.trim());
    if (!validItems.length) { setReceiveError('At least one item required'); return; }
    try {
      await api.put(`/orders/${showReceive.id}`, {
        status: newStatus,
        totalPaid: receiveTotalPaid,
        currency: receiveCurrency,
        deliveryType: receiveDeliveryType,
        notes: receiveNotes,
        items: validItems,
      });
      setShowReceive(null);
      loadOrders();
    } catch (err: any) { setReceiveError(err.message); }
  };

  const updateReceiveItem = (idx: number, field: keyof ItemRow, value: string) => {
    const copy = [...receiveItems];
    copy[idx] = { ...copy[idx], [field]: value };
    setReceiveItems(copy);
  };

  const addReceiveItem = () => setReceiveItems([...receiveItems, { ...EMPTY_ITEM }]);
  const removeReceiveItem = (idx: number) => setReceiveItems(receiveItems.filter((_, i) => i !== idx));

  // ─── Status actions ───
  const markDelivered = async (order: Order) => {
    await api.put(`/orders/${order.id}`, { status: 'DELIVERED' });
    loadOrders();
  };

  const markCancelled = async (order: Order) => {
    if (!confirm('Cancel this order?')) return;
    await api.put(`/orders/${order.id}`, { status: 'CANCELLED' });
    loadOrders();
  };

  const deleteOrder = async (order: Order) => {
    if (!confirm('Delete this order permanently?')) return;
    await api.delete(`/orders/${order.id}`);
    loadOrders();
  };

  // ─── Photos ───
  const openPhotos = (order: Order) => {
    setShowPhotos(order);
    setPhotoType('INGREDIENT');
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !files.length || !showPhotos) return;
    setUploadingPhotos(true);
    try {
      await api.uploadFiles(`/orders/${showPhotos.id}/photos`, Array.from(files), 'photos', { type: photoType });
      // Refresh the order
      const updated = await api.get(`/orders/${showPhotos.id}`);
      setShowPhotos(updated);
      loadOrders();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploadingPhotos(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!showPhotos) return;
    await api.delete(`/orders/photos/${photoId}`);
    const updated = await api.get(`/orders/${showPhotos.id}`);
    setShowPhotos(updated);
    loadOrders();
  };

  // ─── Helpers ───
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDateTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const itemsTotal = (items: OrderItem[]) => items.reduce((s, it) => s + (it.price || 0), 0);

  const renderItemRows = (
    items: ItemRow[],
    update: (i: number, f: keyof ItemRow, v: string) => void,
    add: () => void,
    remove: (i: number) => void
  ) => (
    <div className="order-items-editor">
      <div className="items-header-row">
        <span style={{ flex: 2 }}>Item *</span>
        <span>Qty</span>
        <span>Unit</span>
        <span>Price</span>
        <span style={{ width: 30 }}></span>
      </div>
      {items.map((it, i) => (
        <div key={i} className="items-row">
          <input className="input" style={{ flex: 2 }} placeholder="e.g. Chicken breast" value={it.name} onChange={e => update(i, 'name', e.target.value)} />
          <input className="input" type="number" step="0.1" placeholder="0" value={it.quantity} onChange={e => update(i, 'quantity', e.target.value)} style={{ width: 70 }} />
          <select className="select" value={it.unit} onChange={e => update(i, 'unit', e.target.value)} style={{ width: 70 }}>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="lb">lb</option>
            <option value="pcs">pcs</option>
            <option value="box">box</option>
            <option value="bag">bag</option>
            <option value="L">L</option>
            <option value="mL">mL</option>
            <option value="dozen">dozen</option>
            <option value="case">case</option>
          </select>
          <input className="input" type="number" step="0.01" placeholder="$" value={it.price} onChange={e => update(i, 'price', e.target.value)} style={{ width: 80 }} />
          <button type="button" className="btn-icon-sm" onClick={() => remove(i)}><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={add} style={{ marginTop: 8 }}>
        <Plus size={14} /> Add Item
      </button>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Manage ingredient orders & deliveries</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setCreateRestaurant(selectedRestaurant || restaurants[0]?.id || ''); }}>
          <Plus size={18} /> New Order
        </button>
      </div>

      {/* Filters */}
      <div className="order-filters">
        <select className="select" value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}>
          <option value="">All Restaurants</option>
          {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div className="status-filter-group">
          {['', 'ORDERED', 'DELIVERED', 'RECEIVED', 'CANCELLED'].map(s => (
            <button
              key={s}
              className={`status-filter-btn ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s ? STATUS_CONFIG[s].label : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="empty-state">
          <Package size={48} />
          <h3>No orders yet</h3>
          <p>Create your first ingredient order to get started.</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.ORDERED;
            const isExpanded = expandedOrder === order.id;
            const StatusIcon = cfg.icon;

            return (
              <div key={order.id} className={`order-card ${order.status.toLowerCase()}`}>
                <div className="order-card-header" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                  <div className="order-card-left">
                    <div className="order-status-badge" style={{ background: cfg.color }}>
                      <StatusIcon size={14} /> {cfg.label}
                    </div>
                    <div className="order-card-info">
                      <strong>{order.supplier || 'No supplier'}</strong>
                      <span className="order-card-meta">
                        {order.restaurant.name} · {formatDate(order.orderDate)} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        {order.totalPaid != null && ` · $${order.totalPaid.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                  <div className="order-card-right">
                    {order.photos.length > 0 && (
                      <span className="order-photo-count"><Camera size={14} /> {order.photos.length}</span>
                    )}
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="order-card-body">
                    {/* Items */}
                    <div className="order-items-list">
                      <div className="order-items-header">
                        <span style={{ flex: 2 }}>Item</span>
                        <span>Qty</span>
                        <span>Unit</span>
                        <span>Price</span>
                      </div>
                      {order.items.map(item => (
                        <div key={item.id} className="order-item-row">
                          <span style={{ flex: 2 }}>{item.name}</span>
                          <span>{item.quantity ?? '-'}</span>
                          <span>{item.unit || '-'}</span>
                          <span>{item.price != null ? `$${item.price.toFixed(2)}` : '-'}</span>
                        </div>
                      ))}
                      {order.items.some(it => it.price) && (
                        <div className="order-item-row order-items-total">
                          <span style={{ flex: 2 }}><strong>Items Total</strong></span>
                          <span></span><span></span>
                          <span><strong>${itemsTotal(order.items).toFixed(2)}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="order-details-grid">
                      {order.deliveryType && <div className="order-detail"><span className="detail-label">Delivery</span><span>{order.deliveryType}</span></div>}
                      {order.totalPaid != null && <div className="order-detail"><span className="detail-label">Total Paid</span><span>${order.totalPaid.toFixed(2)} {order.currency}</span></div>}
                      {order.deliveredAt && <div className="order-detail"><span className="detail-label">Delivered</span><span>{formatDateTime(order.deliveredAt)}</span></div>}
                      {order.receivedAt && <div className="order-detail"><span className="detail-label">Received</span><span>{formatDateTime(order.receivedAt)}</span></div>}
                      {order.notes && <div className="order-detail full"><span className="detail-label">Notes</span><span>{order.notes}</span></div>}
                    </div>

                    {/* Photo thumbnails */}
                    {order.photos.length > 0 && (
                      <div className="order-photos-preview">
                        {order.photos.map(p => (
                          <div key={p.id} className="photo-thumb" onClick={() => setPhotoPreview(p.url)}>
                            <img src={p.url} alt={p.caption || 'Order photo'} />
                            <span className={`photo-type-tag ${p.type.toLowerCase()}`}>{p.type === 'INVOICE' ? 'Invoice' : p.type === 'INGREDIENT' ? 'Photo' : 'Other'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="order-actions">
                      {order.status === 'ORDERED' && (
                        <>
                          <button className="btn btn-sm" style={{ background: '#5b9bd5', color: '#fff' }} onClick={() => markDelivered(order)}><Truck size={14} /> Mark Delivered</button>
                          <button className="btn btn-primary btn-sm" onClick={() => openReceive(order)}><CheckCircle size={14} /> Receive & Complete</button>
                        </>
                      )}
                      {order.status === 'DELIVERED' && (
                        <button className="btn btn-primary btn-sm" onClick={() => openReceive(order)}><CheckCircle size={14} /> Receive & Complete</button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => openPhotos(order)}><Camera size={14} /> Photos</button>
                      {order.status !== 'RECEIVED' && order.status !== 'CANCELLED' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openReceive(order)}>Edit</button>
                      )}
                      {order.status !== 'CANCELLED' && order.status !== 'RECEIVED' && (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => markCancelled(order)}><XCircle size={14} /> Cancel</button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteOrder(order)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create Order Modal ─── */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetCreateForm(); }} title="New Order">
        <form onSubmit={handleCreate}>
          {createError && <div className="order-error">{createError}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="label">Restaurant *</label>
              <select className="select" value={createRestaurant} onChange={e => setCreateRestaurant(e.target.value)} required>
                {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Supplier</label>
              <input className="input" value={createSupplier} onChange={e => setCreateSupplier(e.target.value)} placeholder="e.g. Fresh Foods Co." />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Delivery Type</label>
            <select className="select" value={createDeliveryType} onChange={e => setCreateDeliveryType(e.target.value)}>
              <option value="">Not specified</option>
              <option value="Truck">Truck</option>
              <option value="Pickup">Pickup</option>
              <option value="Courier">Courier</option>
              <option value="Walk-in">Walk-in</option>
            </select>
          </div>

          <label className="label" style={{ marginTop: 12 }}>Items</label>
          {renderItemRows(createItems, updateCreateItem, addCreateItem, removeCreateItem)}

          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="label">Notes</label>
            <textarea className="textarea" rows={2} value={createNotes} onChange={e => setCreateNotes(e.target.value)} placeholder="Any notes about this order..." />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowCreate(false); resetCreateForm(); }}>Cancel</button>
            <button type="submit" className="btn btn-primary"><Package size={16} /> Place Order</button>
          </div>
        </form>
      </Modal>

      {/* ─── Receive / Edit Order Modal ─── */}
      <Modal isOpen={!!showReceive} onClose={() => setShowReceive(null)} title={showReceive ? `${showReceive.status === 'ORDERED' ? 'Receive' : 'Edit'} Order — ${showReceive.supplier || 'Order'}` : ''} width="600px">
        {showReceive && (
          <form onSubmit={e => e.preventDefault()}>
            {receiveError && <div className="order-error">{receiveError}</div>}
            <div className="form-row">
              <div className="form-group">
                <label className="label">Total Paid</label>
                <input className="input" type="number" step="0.01" value={receiveTotalPaid} onChange={e => setReceiveTotalPaid(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="label">Currency</label>
                <select className="select" value={receiveCurrency} onChange={e => setReceiveCurrency(e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="LBP">LBP</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Delivery Type</label>
                <select className="select" value={receiveDeliveryType} onChange={e => setReceiveDeliveryType(e.target.value)}>
                  <option value="">Not specified</option>
                  <option value="Truck">Truck</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Courier">Courier</option>
                  <option value="Walk-in">Walk-in</option>
                </select>
              </div>
            </div>

            <label className="label" style={{ marginTop: 12 }}>Items (update quantities/prices on receipt)</label>
            {renderItemRows(receiveItems, updateReceiveItem, addReceiveItem, removeReceiveItem)}

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="label">Notes</label>
              <textarea className="textarea" rows={2} value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Delivery notes..." />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowReceive(null)}>Cancel</button>
              {showReceive.status !== 'RECEIVED' && showReceive.status !== 'CANCELLED' && (
                <button type="button" className="btn btn-sm" style={{ background: '#5b9bd5', color: '#fff' }}
                  onClick={e => handleReceive(e as any, 'DELIVERED')}>
                  <Truck size={14} /> Save as Delivered
                </button>
              )}
              <button type="button" className="btn btn-primary"
                onClick={e => handleReceive(e as any, showReceive.status === 'RECEIVED' ? 'RECEIVED' : 'RECEIVED')}>
                <CheckCircle size={14} /> {showReceive.status === 'RECEIVED' ? 'Save Changes' : 'Mark Received'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Photos Modal ─── */}
      <Modal isOpen={!!showPhotos} onClose={() => setShowPhotos(null)} title={showPhotos ? `Photos — ${showPhotos.supplier || 'Order'}` : ''} width="700px">
        {showPhotos && (
          <div>
            {/* Upload area */}
            <div className="photo-upload-area">
              <div className="photo-upload-controls">
                <select className="select" value={photoType} onChange={e => setPhotoType(e.target.value)} style={{ width: 140 }}>
                  <option value="INVOICE">Invoice</option>
                  <option value="INGREDIENT">Ingredient</option>
                  <option value="OTHER">Other</option>
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhotos}
                >
                  <Upload size={14} /> {uploadingPhotos ? 'Uploading...' : 'Upload Photos'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => handlePhotoUpload(e.target.files)}
                />
              </div>
              <p className="photo-upload-hint">Select type, then upload. Multiple files OK.</p>
            </div>

            {/* Photo grid */}
            {showPhotos.photos.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <Camera size={36} />
                <p>No photos yet. Upload invoice or ingredient photos.</p>
              </div>
            ) : (
              <div className="photo-grid">
                {showPhotos.photos.map(p => (
                  <div key={p.id} className="photo-card">
                    <div className="photo-card-img" onClick={() => setPhotoPreview(p.url)}>
                      <img src={p.url} alt={p.caption || 'Photo'} />
                    </div>
                    <div className="photo-card-footer">
                      <span className={`photo-type-tag ${p.type.toLowerCase()}`}>
                        {p.type === 'INVOICE' ? <FileText size={10} /> : <ImageIcon size={10} />}
                        {p.type === 'INVOICE' ? 'Invoice' : p.type === 'INGREDIENT' ? 'Photo' : 'Other'}
                      </span>
                      <button className="btn-icon-sm" onClick={() => deletePhoto(p.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ─── Photo Preview Lightbox ─── */}
      {photoPreview && (
        <div className="photo-lightbox" onClick={() => setPhotoPreview(null)}>
          <img src={photoPreview} alt="Preview" onClick={e => e.stopPropagation()} />
          <button className="lightbox-close" onClick={() => setPhotoPreview(null)}><X size={24} /></button>
        </div>
      )}
    </div>
  );
}
