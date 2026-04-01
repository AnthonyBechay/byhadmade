import { useEffect, useState, useRef } from 'react';
import {
  Package, Plus, Trash2, Check, X, Camera, Upload, ChevronDown, ChevronRight,
  Clock, CheckCircle, XCircle, FileText, Image as ImageIcon, DollarSign, Warehouse,
  Search, Filter
} from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import './Orders.css';

interface Restaurant { id: string; name: string }
interface Supplier { id: string; name: string; deliveryType: string | null }
interface StorageLocationItem { id: string; name: string; notes: string | null }
interface Ingredient {
  id: string; name: string; unit: string | null; purchaseUnit: string | null;
  unitPrice: number | null; supplier: string | null; category: string | null;
  subcategory: string | null;
}
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
  RECEIVED: { label: 'Received', color: '#4a9e6a', icon: CheckCircle },
  STOCKED: { label: 'Stocked', color: '#7b68a8', icon: Warehouse },
  CANCELLED: { label: 'Cancelled', color: '#e05555', icon: XCircle },
};

interface ItemRow {
  ingredientId: string; name: string; quantity: string; unit: string;
  price: string; notes: string; expiryDate: string; storageLocation: string;
}
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
  const [showPhotos, setShowPhotos] = useState<Order | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showReceived, setShowReceived] = useState(false);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterIngredient, setFilterIngredient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Create form
  const [createRestaurant, setCreateRestaurant] = useState('');
  const [createSupplier, setCreateSupplier] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createItems, setCreateItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [createError, setCreateError] = useState('');

  // Receive form — everything in one modal
  const [receiveTotalPaid, setReceiveTotalPaid] = useState('');
  const [receiveCurrency, setReceiveCurrency] = useState('USD');
  const [receiveIsPaid, setReceiveIsPaid] = useState(false);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiveItems, setReceiveItems] = useState<ItemRow[]>([]);
  const [receiveError, setReceiveError] = useState('');

  // Photo upload
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoType, setPhotoType] = useState('INGREDIENT');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiveFileRef = useRef<HTMLInputElement>(null);
  const [receiveUploadingPhotos, setReceiveUploadingPhotos] = useState(false);
  const [receivePhotoType, setReceivePhotoType] = useState('INGREDIENT');

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

  // Filtering
  const applyFilters = (list: Order[]) => {
    let result = list;
    if (filterSupplier) result = result.filter(o => o.supplier === filterSupplier);
    if (filterIngredient) result = result.filter(o => o.items.some(it => it.ingredientId === filterIngredient || it.name.toLowerCase().includes(filterIngredient.toLowerCase())));
    if (filterStatus) result = result.filter(o => o.status === filterStatus);
    return result;
  };

  const filteredOrders = applyFilters(orders);
  const expectedOrders = filteredOrders.filter(o => o.status === 'ORDERED');
  const pastOrders = filteredOrders.filter(o => o.status === 'RECEIVED' || o.status === 'STOCKED' || o.status === 'CANCELLED');

  // Get the supplier's delivery type
  const getSupplierDeliveryType = (supplierName: string) => {
    const s = suppliers.find(sup => sup.name === supplierName);
    return s?.deliveryType || null;
  };

  // ─── Create Order ───
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const validItems = createItems.filter(it => it.ingredientId);
    if (!validItems.length) { setCreateError('Add at least one ingredient'); return; }
    const deliveryType = getSupplierDeliveryType(createSupplier);
    try {
      await api.post('/orders', {
        restaurantId: createRestaurant || selectedRestaurant || restaurants[0]?.id,
        supplier: createSupplier,
        deliveryType,
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
    setCreateSupplier(''); setCreateNotes('');
    setCreateItems([{ ...EMPTY_ITEM }]); setCreateError('');
  };

  const updateCreateItem = (idx: number, field: keyof ItemRow, value: string) => {
    const copy = [...createItems];
    copy[idx] = { ...copy[idx], [field]: value };
    setCreateItems(copy);
  };

  const addCreateItem = () => setCreateItems([...createItems, { ...EMPTY_ITEM }]);
  const removeCreateItem = (idx: number) => setCreateItems(createItems.filter((_, i) => i !== idx));

  // ─── Receive Order (unified modal) ───
  const openReceive = (order: Order) => {
    setShowReceive(order);
    setReceiveTotalPaid(order.totalPaid ? String(order.totalPaid) : '');
    setReceiveCurrency(order.currency || 'USD');
    setReceiveIsPaid(order.isPaid);
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

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceive) return;
    setReceiveError('');
    const validItems = receiveItems.filter(it => it.name.trim());
    if (!validItems.length) { setReceiveError('At least one item required'); return; }
    try {
      await api.put(`/orders/${showReceive.id}`, {
        status: 'RECEIVED',
        isPaid: receiveIsPaid,
        totalPaid: receiveTotalPaid, currency: receiveCurrency,
        notes: receiveNotes,
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

  const handleSaveReceiveEdits = async () => {
    if (!showReceive) return;
    setReceiveError('');
    const validItems = receiveItems.filter(it => it.name.trim());
    try {
      await api.put(`/orders/${showReceive.id}`, {
        isPaid: receiveIsPaid,
        totalPaid: receiveTotalPaid, currency: receiveCurrency,
        notes: receiveNotes,
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

  const addReceiveItem = () => setReceiveItems([...receiveItems, { ...EMPTY_ITEM }]);
  const removeReceiveItem = (idx: number) => setReceiveItems(receiveItems.filter((_, i) => i !== idx));

  // ─── Paid toggle ───
  const togglePaid = async (order: Order) => {
    await api.put(`/orders/${order.id}`, { isPaid: !order.isPaid });
    loadOrders();
  };

  // ─── Status actions ───
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

  const handlePhotoUpload = async (files: FileList | null, orderId: string, type: string, setUploading: (v: boolean) => void, inputRef: React.RefObject<HTMLInputElement | null>) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      await api.uploadFiles(`/orders/${orderId}/photos`, Array.from(files), 'photos', { type });
      loadOrders();
      // Refresh the modal order if open
      const updated = await api.get(`/orders/${orderId}`);
      if (showPhotos?.id === orderId) setShowPhotos(updated);
      if (showReceive?.id === orderId) setShowReceive(updated);
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const deletePhoto = async (photoId: string, orderId: string) => {
    await api.delete(`/orders/photos/${photoId}`);
    const updated = await api.get(`/orders/${orderId}`);
    if (showPhotos?.id === orderId) setShowPhotos(updated);
    if (showReceive?.id === orderId) setShowReceive(updated);
    loadOrders();
  };

  // ─── Helpers ───
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDateTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const itemsTotal = (items: OrderItemData[]) => items.reduce((s, it) => s + (it.price || 0), 0);
  const computeReceiveTotal = () => receiveItems.reduce((s, it) => s + (Number(it.price) || 0), 0);

  const hasActiveFilters = filterSupplier || filterIngredient || filterStatus;

  // ─── Searchable Ingredient Picker ───
  const IngredientSearchPicker = ({ value, supplierName, onSelect, onClear }: {
    value: string; supplierName: string;
    onSelect: (ing: Ingredient) => void; onClear: () => void;
  }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const selectedIng = ingredients.find(i => i.id === value);

    // Sort: supplier match first, then alphabetical
    const filtered = ingredients
      .filter(i => {
        if (!query) return true;
        const q = query.toLowerCase();
        return i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q) || (i.subcategory || '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aMatch = a.supplier === supplierName ? 0 : 1;
        const bMatch = b.supplier === supplierName ? 0 : 1;
        return aMatch - bMatch || a.name.localeCompare(b.name);
      })
      .slice(0, 30);

    useEffect(() => {
      const handleClick = (e: MouseEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    if (selectedIng) {
      return (
        <div className="ing-search-selected">
          <span className="ing-search-selected-name">{selectedIng.name}</span>
          {selectedIng.category && <span className="ing-search-selected-meta">{selectedIng.category}</span>}
          {selectedIng.supplier && <span className="ing-search-selected-meta">{selectedIng.supplier}</span>}
          <button type="button" className="btn-icon-sm" onClick={onClear}><X size={12} /></button>
        </div>
      );
    }

    return (
      <div className="ing-search-wrapper" ref={wrapperRef}>
        <div className="ing-search-input-wrap">
          <Search size={14} />
          <input
            className="input"
            placeholder="Search ingredient..."
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        </div>
        {open && (
          <div className="ing-search-dropdown">
            {filtered.length === 0 ? (
              <div className="ing-search-empty">No ingredients found</div>
            ) : (
              filtered.map(ing => (
                <div key={ing.id} className="ing-search-option" onClick={() => { onSelect(ing); setQuery(''); setOpen(false); }}>
                  <strong>{ing.name}</strong>
                  <span className="ing-search-option-meta">
                    {ing.category && <span>{ing.category}</span>}
                    {ing.subcategory && <span> &gt; {ing.subcategory}</span>}
                    {ing.supplier && <span className="ing-search-option-supplier">{ing.supplier}</span>}
                    {ing.unitPrice != null && <span className="ing-search-option-price">${ing.unitPrice}</span>}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderItemRows = (
    items: ItemRow[],
    update: (i: number, f: keyof ItemRow, v: string) => void,
    add: () => void,
    remove: (i: number) => void,
    supplierName: string,
    showStockFields: boolean,
  ) => {
    const selectIngredient = (idx: number, ing: Ingredient) => {
      const copy = [...items];
      copy[idx] = {
        ...copy[idx],
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.purchaseUnit || ing.unit || '',
        price: ing.unitPrice ? String(ing.unitPrice) : '',
      };
      if (items === createItems) setCreateItems(copy);
      else setReceiveItems(copy);
    };

    const clearIngredient = (idx: number) => {
      const copy = [...items];
      copy[idx] = { ...EMPTY_ITEM };
      if (items === createItems) setCreateItems(copy);
      else setReceiveItems(copy);
    };

    return (
      <div className="order-items-editor">
        {items.map((it, i) => (
          <div key={i} className="item-card">
            <div className="item-card-main">
              <IngredientSearchPicker
                value={it.ingredientId}
                supplierName={supplierName}
                onSelect={ing => selectIngredient(i, ing)}
                onClear={() => clearIngredient(i)}
              />
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
                {order.deliveryType && ` · ${order.deliveryType}`}
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
                <button className="btn btn-primary btn-sm" onClick={() => openReceive(order)}><CheckCircle size={14} /> Receive Order</button>
              )}
              {(order.status === 'RECEIVED' || order.status === 'STOCKED') && (
                <button className="btn btn-secondary btn-sm" onClick={() => openReceive(order)}><CheckCircle size={14} /> Edit Details</button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => openPhotos(order)}><Camera size={14} /> Photos</button>
              {order.status === 'ORDERED' && (
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

      {/* ─── Filters ─── */}
      <div className="order-filters">
        {restaurants.length > 1 && (
          <select className="select" value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}>
            <option value="">All Restaurants</option>
            {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <select className="select" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select className="select" value={filterIngredient} onChange={e => setFilterIngredient(e.target.value)}>
          <option value="">All Ingredients</option>
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select className="select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {hasActiveFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterSupplier(''); setFilterIngredient(''); setFilterStatus(''); }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {expectedOrders.length === 0 && pastOrders.length === 0 ? (
        <div className="empty-state">
          <Package size={48} />
          <h3>No orders {hasActiveFilters ? 'matching filters' : 'yet'}</h3>
          <p>{hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first ingredient order to get started.'}</p>
        </div>
      ) : (
        <>
          {expectedOrders.length === 0 ? (
            <div className="orders-section-empty">
              <CheckCircle size={24} />
              <p>All caught up — no pending orders</p>
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
                {suppliers.map(s => (
                  <option key={s.id} value={s.name}>{s.name}{s.deliveryType ? ` (${s.deliveryType})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          {createSupplier && getSupplierDeliveryType(createSupplier) && (
            <div className="delivery-type-info">
              Delivery: <strong>{getSupplierDeliveryType(createSupplier)}</strong>
            </div>
          )}

          <label className="label" style={{ marginTop: 12 }}>Items</label>
          {renderItemRows(createItems, updateCreateItem, addCreateItem, removeCreateItem, createSupplier, false)}

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

      {/* ─── Receive / Edit Order Modal (unified) ─── */}
      <Modal isOpen={!!showReceive} onClose={() => setShowReceive(null)} title={showReceive ? `${showReceive.status === 'ORDERED' ? 'Receive' : 'Edit'} Order — ${showReceive.supplier || 'Order'}` : ''} width="650px">
        {showReceive && (
          <form onSubmit={handleReceive}>
            {receiveError && <div className="order-error">{receiveError}</div>}

            {/* Payment section */}
            <div className="receive-section">
              <h4 className="receive-section-title"><DollarSign size={14} /> Payment</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="label">Total Price</label>
                  <input className="input" type="number" step="0.01" value={receiveTotalPaid} onChange={e => setReceiveTotalPaid(e.target.value)} placeholder={String(computeReceiveTotal()) || '0.00'} />
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
                  <label className="label">Status</label>
                  <div className="receive-paid-toggle">
                    <button type="button" className={`paid-toggle-btn ${receiveIsPaid ? 'active paid' : ''}`} onClick={() => setReceiveIsPaid(true)}>
                      <Check size={12} /> Paid
                    </button>
                    <button type="button" className={`paid-toggle-btn ${!receiveIsPaid ? 'active unpaid' : ''}`} onClick={() => setReceiveIsPaid(false)}>
                      <Clock size={12} /> Pay Later
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Items section with stock fields */}
            <div className="receive-section">
              <h4 className="receive-section-title"><Package size={14} /> Items — Verify & Stock</h4>
              {renderItemRows(receiveItems, updateReceiveItem, addReceiveItem, removeReceiveItem, showReceive.supplier || '', true)}
            </div>

            {/* Photos section inline */}
            <div className="receive-section">
              <h4 className="receive-section-title"><Camera size={14} /> Photos</h4>
              <div className="photo-upload-area compact">
                <div className="photo-upload-controls">
                  <select className="select" value={receivePhotoType} onChange={e => setReceivePhotoType(e.target.value)} style={{ width: 130 }}>
                    <option value="INVOICE">Invoice</option>
                    <option value="INGREDIENT">Ingredient</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => receiveFileRef.current?.click()} disabled={receiveUploadingPhotos}>
                    <Upload size={14} /> {receiveUploadingPhotos ? 'Uploading...' : 'Upload'}
                  </button>
                  <input ref={receiveFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => handlePhotoUpload(e.target.files, showReceive!.id, receivePhotoType, setReceiveUploadingPhotos, receiveFileRef)} />
                </div>
              </div>
              {showReceive.photos.length > 0 && (
                <div className="order-photos-preview" style={{ marginTop: 8 }}>
                  {showReceive.photos.map(p => (
                    <div key={p.id} className="photo-thumb" style={{ position: 'relative' }}>
                      <img src={p.url} alt="" onClick={() => setPhotoPreview(p.url)} />
                      <span className={`photo-type-tag ${p.type.toLowerCase()}`}>{p.type === 'INVOICE' ? 'Inv' : 'Pic'}</span>
                      <button type="button" className="photo-thumb-delete" onClick={() => deletePhoto(p.id, showReceive!.id)}><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="label">Notes</label>
              <textarea className="textarea" rows={2} value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Notes..." />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowReceive(null)}>Cancel</button>
              {(showReceive.status === 'RECEIVED' || showReceive.status === 'STOCKED') ? (
                <button type="button" className="btn btn-primary" onClick={handleSaveReceiveEdits}>
                  <Check size={14} /> Save Changes
                </button>
              ) : (
                <button type="submit" className="btn btn-primary">
                  <CheckCircle size={14} /> Receive & Stock
                </button>
              )}
            </div>
          </form>
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
                <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => handlePhotoUpload(e.target.files, showPhotos!.id, photoType, setUploadingPhotos, fileInputRef)} />
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
                      <button className="btn-icon-sm" onClick={() => deletePhoto(p.id, showPhotos!.id)}><Trash2 size={12} /></button>
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
