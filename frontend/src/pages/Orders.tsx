import { useEffect, useState, useRef } from 'react';
import {
  Package, Plus, Trash2, Truck, Check, X, Camera, Upload, ChevronDown, ChevronRight,
  Clock, CheckCircle, XCircle, FileText, Image as ImageIcon, DollarSign, Warehouse
} from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Orders.css';

interface Restaurant { id: string; name: string }
interface Supplier { id: string; name: string }
interface StorageLocationItem { id: string; name: string; notes: string | null }
interface Ingredient { id: string; name: string; unit: string | null; purchaseUnit: string | null; unitPrice: number | null; supplier: string | null }
interface OrderItemData {
  id: string; name: string; quantity: number | null; unit: string | null; price: number | null;
  notes: string | null; ingredientId: string | null; ingredient: Ingredient | null;
  expiryDate: string | null; storageLocation: string | null;
}
interface OrderPhoto { id: string; url: string; type: string; caption: string | null; createdAt: string }
interface Order {
  id: string; restaurantId: string; status: string; deliveryType: string | null;
  totalPaid: number | null; currency: string; supplier: string | null; notes: string | null;
  isPaid: boolean; paidAt: string | null;
  orderDate: string; deliveredAt: string | null; receivedAt: string | null;
  restaurant: { id: string; name: string };
  items: OrderItemData[]; photos: OrderPhoto[];
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ORDERED: { label: 'Ordered', color: '#d4a035', icon: Clock },
  DELIVERED: { label: 'Delivered', color: '#5b9bd5', icon: Truck },
  RECEIVED: { label: 'Received', color: '#4a9e6a', icon: CheckCircle },
  STOCKED: { label: 'Stocked', color: '#7b68a8', icon: Warehouse },
  CANCELLED: { label: 'Cancelled', color: '#e05555', icon: XCircle },
};

interface ItemRow { ingredientId: string; name: string; quantity: string; unit: string; price: string; notes: string; expiryDate: string; storageLocation: string }
const EMPTY_ITEM: ItemRow = { ingredientId: '', name: '', quantity: '', unit: '', price: '', notes: '', expiryDate: '', storageLocation: '' };

const UNITS = ['kg', 'g', 'lb', 'pcs', 'box', 'bag', 'case', 'L', 'mL', 'dozen', 'bunch', 'can', 'bottle'];

export default function Orders() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocationItem[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [showReceive, setShowReceive] = useState<Order | null>(null);
  const [showStock, setShowStock] = useState<Order | null>(null);
  const [showPhotos, setShowPhotos] = useState<Order | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showReceived, setShowReceived] = useState(false);

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

  // Stock form
  const [stockItems, setStockItems] = useState<{ name: string; ingredientId: string; quantity: string; unit: string; expiryDate: string; storageLocation: string; price: string; notes: string }[]>([]);
  const [stockError, setStockError] = useState('');

  // Photo upload
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoType, setPhotoType] = useState('INGREDIENT');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/restaurants').then((r: Restaurant[]) => {
      setRestaurants(r);
      if (r.length === 1) setSelectedRestaurant(r[0].id);
    });
    api.get('/ingredients').then(setIngredients).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/storage-locations').then(setStorageLocations).catch(() => {});
  }, []);

  useEffect(() => { loadOrders(); }, [selectedRestaurant]);

  const loadOrders = () => {
    let q = '/orders?';
    if (selectedRestaurant) q += `restaurantId=${selectedRestaurant}&`;
    api.get(q).then(setOrders);
  };

  const expectedOrders = orders.filter(o => o.status === 'ORDERED' || o.status === 'DELIVERED');
  const pastOrders = orders.filter(o => o.status === 'RECEIVED' || o.status === 'STOCKED' || o.status === 'CANCELLED');

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
        items: validItems.map(it => ({
          ingredientId: it.ingredientId || null,
          name: it.name, quantity: it.quantity, unit: it.unit, price: it.price, notes: it.notes,
        })),
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

  const selectIngredientForCreate = (idx: number, ingredientId: string) => {
    const ing = ingredients.find(i => i.id === ingredientId);
    if (!ing) return;
    const copy = [...createItems];
    copy[idx] = { ...copy[idx], ingredientId: ing.id, name: ing.name, unit: ing.purchaseUnit || ing.unit || '', price: ing.unitPrice ? String(ing.unitPrice) : '' };
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
      ingredientId: it.ingredientId || '', name: it.name,
      quantity: it.quantity ? String(it.quantity) : '', unit: it.unit || '',
      price: it.price ? String(it.price) : '', notes: it.notes || '',
      expiryDate: it.expiryDate ? it.expiryDate.slice(0, 10) : '',
      storageLocation: it.storageLocation || '',
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
        totalPaid: receiveTotalPaid, currency: receiveCurrency,
        deliveryType: receiveDeliveryType, notes: receiveNotes,
        items: validItems.map(it => ({
          ingredientId: it.ingredientId || null, name: it.name,
          quantity: it.quantity, unit: it.unit, price: it.price, notes: it.notes,
          expiryDate: it.expiryDate || null, storageLocation: it.storageLocation || null,
        })),
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

  const selectIngredientForReceive = (idx: number, ingredientId: string) => {
    const ing = ingredients.find(i => i.id === ingredientId);
    if (!ing) return;
    const copy = [...receiveItems];
    copy[idx] = { ...copy[idx], ingredientId: ing.id, name: ing.name, unit: ing.purchaseUnit || ing.unit || '', price: ing.unitPrice ? String(ing.unitPrice) : '' };
    setReceiveItems(copy);
  };

  const addReceiveItem = () => setReceiveItems([...receiveItems, { ...EMPTY_ITEM }]);
  const removeReceiveItem = (idx: number) => setReceiveItems(receiveItems.filter((_, i) => i !== idx));

  // ─── Add to Stock ───
  const openStock = (order: Order) => {
    setShowStock(order);
    setStockItems(order.items.map(it => ({
      name: it.name,
      ingredientId: it.ingredientId || '',
      quantity: it.quantity ? String(it.quantity) : '',
      unit: it.unit || '',
      expiryDate: it.expiryDate ? it.expiryDate.slice(0, 10) : '',
      storageLocation: it.storageLocation || '',
      price: it.price ? String(it.price) : '',
      notes: it.notes || '',
    })));
    setStockError('');
  };

  const handleStock = async () => {
    if (!showStock) return;
    setStockError('');
    try {
      await api.put(`/orders/${showStock.id}`, {
        status: 'STOCKED',
        items: stockItems.map(it => ({
          ingredientId: it.ingredientId || null, name: it.name,
          quantity: it.quantity, unit: it.unit, price: it.price, notes: it.notes,
          expiryDate: it.expiryDate || null, storageLocation: it.storageLocation || null,
        })),
      });
      setShowStock(null);
      loadOrders();
    } catch (err: any) { setStockError(err.message); }
  };

  // ─── Paid toggle ───
  const togglePaid = async (order: Order) => {
    await api.put(`/orders/${order.id}`, { isPaid: !order.isPaid });
    loadOrders();
  };

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
  const itemsTotal = (items: OrderItemData[]) => items.reduce((s, it) => s + (it.price || 0), 0);

  const filteredIngredients = (supplierName: string) => {
    if (!supplierName) return ingredients;
    return [...ingredients].sort((a, b) => {
      const aMatch = a.supplier === supplierName ? 0 : 1;
      const bMatch = b.supplier === supplierName ? 0 : 1;
      return aMatch - bMatch || a.name.localeCompare(b.name);
    });
  };

  const renderItemRows = (
    items: ItemRow[],
    update: (i: number, f: keyof ItemRow, v: string) => void,
    selectIngredient: (i: number, ingredientId: string) => void,
    add: () => void,
    remove: (i: number) => void,
    supplierName: string,
    showStockFields: boolean,
  ) => {
    const sortedIngredients = filteredIngredients(supplierName);
    return (
      <div className="order-items-editor">
        {items.map((it, i) => (
          <div key={i} className="item-card">
            <div className="item-card-main">
              <div className="item-card-select">
                <select className="select" value={it.ingredientId}
                  onChange={e => { if (e.target.value) selectIngredient(i, e.target.value); else { update(i, 'ingredientId', ''); update(i, 'name', ''); } }}>
                  <option value="">Select ingredient...</option>
                  {sortedIngredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name}{ing.supplier ? ` (${ing.supplier})` : ''}</option>
                  ))}
                </select>
                {!it.ingredientId && (
                  <input className="input" placeholder="Or type name..." value={it.name} onChange={e => update(i, 'name', e.target.value)} />
                )}
              </div>
              <div className="item-card-fields">
                <div className="item-field">
                  <label>Qty</label>
                  <input className="input" type="number" step="0.1" placeholder="0" value={it.quantity} onChange={e => update(i, 'quantity', e.target.value)} />
                </div>
                <div className="item-field">
                  <label>Unit</label>
                  <select className="select" value={it.unit} onChange={e => update(i, 'unit', e.target.value)}>
                    <option value="">-</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="item-field">
                  <label>Price</label>
                  <input className="input" type="number" step="0.01" placeholder="$" value={it.price} onChange={e => update(i, 'price', e.target.value)} />
                </div>
              </div>
              {showStockFields && (
                <div className="item-card-fields">
                  <div className="item-field" style={{ flex: 2 }}>
                    <label>Storage</label>
                    <select className="select" value={it.storageLocation} onChange={e => update(i, 'storageLocation', e.target.value)}>
                      <option value="">Select location...</option>
                      {storageLocations.map(sl => <option key={sl.id} value={sl.name}>{sl.name}</option>)}
                    </select>
                  </div>
                  <div className="item-field">
                    <label>Expiry</label>
                    <input className="input" type="date" value={it.expiryDate} onChange={e => update(i, 'expiryDate', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="btn-icon-sm item-remove" onClick={() => remove(i)}><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={add} style={{ marginTop: 8 }}>
          <Plus size={14} /> Add Item
        </button>
      </div>
    );
  };

  const renderOrderCard = (order: Order) => {
    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.ORDERED;
    const isExpanded = expandedOrder === order.id;
    const StatusIcon = cfg.icon;
    const showStockInfo = order.status === 'RECEIVED' || order.status === 'STOCKED';

    return (
      <div key={order.id} className={`order-card ${order.status.toLowerCase()}`}>
        <div className="order-card-header" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
          <div className="order-card-left">
            <div className="order-card-badges">
              <div className="order-status-badge" style={{ background: cfg.color }}>
                <StatusIcon size={14} /> {cfg.label}
              </div>
              {(order.status === 'RECEIVED' || order.status === 'STOCKED') && (
                <div
                  className={`paid-badge ${order.isPaid ? 'paid' : 'unpaid'}`}
                  onClick={e => { e.stopPropagation(); togglePaid(order); }}
                >
                  <DollarSign size={12} /> {order.isPaid ? 'Paid' : 'Unpaid'}
                </div>
              )}
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
            <div className="order-items-list">
              <div className="order-items-header">
                <span style={{ flex: 2 }}>Item</span>
                <span>Qty</span>
                <span>Unit</span>
                <span>Price</span>
                {showStockInfo && <span>Storage</span>}
                {showStockInfo && <span>Expiry</span>}
              </div>
              {order.items.map(item => (
                <div key={item.id} className="order-item-row">
                  <span style={{ flex: 2 }}>{item.name}</span>
                  <span>{item.quantity ?? '-'}</span>
                  <span>{item.unit || '-'}</span>
                  <span>{item.price != null ? `$${item.price.toFixed(2)}` : '-'}</span>
                  {showStockInfo && <span>{item.storageLocation || '-'}</span>}
                  {showStockInfo && <span>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</span>}
                </div>
              ))}
              {order.items.some(it => it.price) && (
                <div className="order-item-row order-items-total">
                  <span style={{ flex: 2 }}><strong>Items Total</strong></span>
                  <span></span><span></span>
                  <span><strong>${itemsTotal(order.items).toFixed(2)}</strong></span>
                  {showStockInfo && <><span></span><span></span></>}
                </div>
              )}
            </div>

            <div className="order-details-grid">
              {order.deliveryType && <div className="order-detail"><span className="detail-label">Delivery</span><span>{order.deliveryType}</span></div>}
              {order.totalPaid != null && <div className="order-detail"><span className="detail-label">Total Paid</span><span>${order.totalPaid.toFixed(2)} {order.currency}</span></div>}
              {order.deliveredAt && <div className="order-detail"><span className="detail-label">Delivered</span><span>{formatDateTime(order.deliveredAt)}</span></div>}
              {order.receivedAt && <div className="order-detail"><span className="detail-label">Received</span><span>{formatDateTime(order.receivedAt)}</span></div>}
              {order.isPaid && order.paidAt && <div className="order-detail"><span className="detail-label">Paid</span><span>{formatDateTime(order.paidAt)}</span></div>}
              {order.notes && <div className="order-detail full"><span className="detail-label">Notes</span><span>{order.notes}</span></div>}
            </div>

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

            <div className="order-actions">
              {order.status === 'ORDERED' && (
                <>
                  <button className="btn btn-sm" style={{ background: '#5b9bd5', color: '#fff' }} onClick={() => markDelivered(order)}><Truck size={14} /> Mark Delivered</button>
                  <button className="btn btn-primary btn-sm" onClick={() => openReceive(order)}><CheckCircle size={14} /> Receive</button>
                </>
              )}
              {order.status === 'DELIVERED' && (
                <button className="btn btn-primary btn-sm" onClick={() => openReceive(order)}><CheckCircle size={14} /> Receive</button>
              )}
              {order.status === 'RECEIVED' && (
                <button className="btn btn-sm" style={{ background: '#7b68a8', color: '#fff' }} onClick={() => openStock(order)}><Warehouse size={14} /> Add to Stock</button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => openPhotos(order)}><Camera size={14} /> Photos</button>
              {(order.status === 'ORDERED' || order.status === 'DELIVERED') && (
                <button className="btn btn-secondary btn-sm" onClick={() => openReceive(order)}>Edit</button>
              )}
              {(order.status === 'ORDERED' || order.status === 'DELIVERED') && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => markCancelled(order)}><XCircle size={14} /> Cancel</button>
              )}
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteOrder(order)}><Trash2 size={14} /></button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">{expectedOrders.length} expected · {pastOrders.length} past</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setCreateRestaurant(selectedRestaurant || restaurants[0]?.id || ''); }}>
          <Plus size={18} /> New Order
        </button>
      </div>

      <div className="order-filters">
        {restaurants.length > 1 && (
          <select className="select" value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}>
            <option value="">All Restaurants</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
      </div>

      {expectedOrders.length === 0 && pastOrders.length === 0 ? (
        <div className="empty-state">
          <Package size={48} />
          <h3>No orders yet</h3>
          <p>Create your first ingredient order to get started.</p>
        </div>
      ) : (
        <>
          {expectedOrders.length === 0 ? (
            <div className="orders-section-empty">
              <CheckCircle size={24} />
              <p>All caught up — no pending deliveries</p>
            </div>
          ) : (
            <div className="orders-list">
              {expectedOrders.map(renderOrderCard)}
            </div>
          )}

          {pastOrders.length > 0 && (
            <div className="past-orders-section">
              <button className="past-orders-toggle" onClick={() => setShowReceived(!showReceived)}>
                {showReceived ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Past Orders ({pastOrders.length})
              </button>
              {showReceived && (
                <div className="orders-list" style={{ marginTop: 12 }}>
                  {pastOrders.map(renderOrderCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── Create Order Modal ─── */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetCreateForm(); }} title="New Order" width="600px">
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
              <select className="select" value={createSupplier} onChange={e => setCreateSupplier(e.target.value)}>
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
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
          {renderItemRows(createItems, updateCreateItem, selectIngredientForCreate, addCreateItem, removeCreateItem, createSupplier, false)}

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
      <Modal isOpen={!!showReceive} onClose={() => setShowReceive(null)} title={showReceive ? `${showReceive.status === 'ORDERED' || showReceive.status === 'DELIVERED' ? 'Receive' : 'Edit'} Order — ${showReceive.supplier || 'Order'}` : ''} width="600px">
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

            <label className="label" style={{ marginTop: 12 }}>Items</label>
            {renderItemRows(receiveItems, updateReceiveItem, selectIngredientForReceive, addReceiveItem, removeReceiveItem, showReceive.supplier || '', true)}

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="label">Notes</label>
              <textarea className="textarea" rows={2} value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Delivery notes..." />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowReceive(null)}>Cancel</button>
              {(showReceive.status === 'ORDERED' || showReceive.status === 'DELIVERED') && (
                <button type="button" className="btn btn-sm" style={{ background: '#5b9bd5', color: '#fff' }}
                  onClick={e => handleReceive(e as any, 'DELIVERED')}>
                  <Truck size={14} /> Save as Delivered
                </button>
              )}
              <button type="button" className="btn btn-primary"
                onClick={e => handleReceive(e as any, 'RECEIVED')}>
                <CheckCircle size={14} /> {showReceive.status === 'RECEIVED' || showReceive.status === 'STOCKED' ? 'Save Changes' : 'Mark Received'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Add to Stock Modal ─── */}
      <Modal isOpen={!!showStock} onClose={() => setShowStock(null)} title={showStock ? `Add to Stock — ${showStock.supplier || 'Order'}` : ''} width="600px">
        {showStock && (
          <div>
            {stockError && <div className="order-error">{stockError}</div>}
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Assign storage locations and expiry dates for each item, then mark as stocked.
            </p>
            <div className="stock-items">
              {stockItems.map((it, i) => (
                <div key={i} className="stock-item-row">
                  <div className="stock-item-name">
                    <strong>{it.name}</strong>
                    <span>{it.quantity} {it.unit}</span>
                  </div>
                  <div className="stock-item-fields">
                    <div className="item-field" style={{ flex: 2 }}>
                      <label>Storage Location</label>
                      <select className="select" value={it.storageLocation}
                        onChange={e => { const copy = [...stockItems]; copy[i] = { ...copy[i], storageLocation: e.target.value }; setStockItems(copy); }}>
                        <option value="">Select...</option>
                        {storageLocations.map(sl => <option key={sl.id} value={sl.name}>{sl.name}</option>)}
                      </select>
                    </div>
                    <div className="item-field">
                      <label>Expiry Date</label>
                      <input className="input" type="date" value={it.expiryDate}
                        onChange={e => { const copy = [...stockItems]; copy[i] = { ...copy[i], expiryDate: e.target.value }; setStockItems(copy); }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowStock(null)}>Cancel</button>
              <button type="button" className="btn btn-sm" style={{ background: '#7b68a8', color: '#fff' }} onClick={handleStock}>
                <Warehouse size={14} /> Mark as Stocked
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Photos Modal ─── */}
      <Modal isOpen={!!showPhotos} onClose={() => setShowPhotos(null)} title={showPhotos ? `Photos — ${showPhotos.supplier || 'Order'}` : ''} width="700px">
        {showPhotos && (
          <div>
            <div className="photo-upload-area">
              <div className="photo-upload-controls">
                <select className="select" value={photoType} onChange={e => setPhotoType(e.target.value)} style={{ width: 140 }}>
                  <option value="INVOICE">Invoice</option>
                  <option value="INGREDIENT">Ingredient</option>
                  <option value="OTHER">Other</option>
                </select>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhotos}>
                  <Upload size={14} /> {uploadingPhotos ? 'Uploading...' : 'Upload Photos'}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handlePhotoUpload(e.target.files)} />
              </div>
              <p className="photo-upload-hint">Select type, then upload. Multiple files OK.</p>
            </div>
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
