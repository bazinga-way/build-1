import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const [showAddItem, setShowAddItem] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('spare_part');
  const [newUnit, setNewUnit] = useState('');
  const [newReorderLevel, setNewReorderLevel] = useState('');

  const [movementType, setMovementType] = useState('in');
  const [movementQty, setMovementQty] = useState('');
  const [movementReference, setMovementReference] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data } = await supabase.from('inventory_items').select('*').order('name');
      setItems(data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function toggleExpand(item) {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    if (!movements[item.id]) {
      const { data } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setMovements((prev) => ({ ...prev, [item.id]: data || [] }));
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!newName.trim()) {
      alert('Please enter an item name.');
      return;
    }
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        name: newName.trim(),
        category: newCategory,
        unit: newUnit || null,
        reorder_level: newReorderLevel ? Number(newReorderLevel) : 0,
        current_qty: 0,
      })
      .select()
      .single();
    if (error) {
      alert('Could not save item: ' + error.message);
      return;
    }
    setItems([...items, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName(''); setNewUnit(''); setNewReorderLevel('');
    setShowAddItem(false);
  }

  async function handleLogMovement(item) {
    if (!movementQty || Number(movementQty) <= 0) {
      alert('Please enter a quantity greater than zero.');
      return;
    }
    const qty = Number(movementQty);
    const newQty = movementType === 'in' ? item.current_qty + qty : item.current_qty - qty;

    const { error: moveError } = await supabase.from('stock_movements').insert({
      item_id: item.id,
      movement_type: movementType,
      qty,
      reference: movementReference || null,
    });
    if (moveError) { alert('Could not log movement: ' + moveError.message); return; }

    const { error: updateError } = await supabase.from('inventory_items').update({ current_qty: newQty }).eq('id', item.id);
    if (updateError) { alert('Could not update quantity: ' + updateError.message); return; }

    setItems(items.map((i) => (i.id === item.id ? { ...i, current_qty: newQty } : i)));
    setMovementQty(''); setMovementReference('');

    const { data: freshMovements } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('item_id', item.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setMovements((prev) => ({ ...prev, [item.id]: freshMovements || [] }));
  }

  if (loading) return <p className="center-text">Loading…</p>;

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <div className="trip-card-header" style={{ marginBottom: 16 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Inventory</h2>
          <button onClick={() => setShowAddItem(!showAddItem)}>{showAddItem ? 'Cancel' : '+ New item'}</button>
        </div>

        {showAddItem && (
          <form className="auth-card" onSubmit={handleAddItem} style={{ maxWidth: 'none', marginBottom: 16 }}>
            <label htmlFor="name">Name</label>
            <input id="name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <label htmlFor="category">Category</label>
            <select id="category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              <option value="spare_part">Spare part</option>
              <option value="tyre">Tyre</option>
              <option value="consumable">Consumable</option>
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label htmlFor="unit">Unit</label>
                <input id="unit" type="text" placeholder="e.g. pcs, litres" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
              </div>
              <div>
                <label htmlFor="reorder">Reorder level</label>
                <input id="reorder" type="number" value={newReorderLevel} onChange={(e) => setNewReorderLevel(e.target.value)} />
              </div>
            </div>
            <button type="submit" style={{ marginTop: 16 }}>Save item</button>
          </form>
        )}

        {items.length === 0 && <p className="empty-state">No inventory items yet.</p>}

        <div className="trip-list">
          {items.map((item) => {
            const lowStock = item.current_qty <= item.reorder_level;
            return (
              <div className="trip-card" key={item.id}>
                <div className="trip-card-header" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(item)}>
                  <p className="trip-card-title">{item.name}</p>
                  <span className={`pill ${lowStock ? 'pill-danger' : 'pill-success'}`}>
                    {item.current_qty} {item.unit || ''}
                  </span>
                </div>
                <p className="trip-route" style={{ textTransform: 'capitalize' }}>
                  {item.category.replace('_', ' ')} · reorder at {item.reorder_level}
                </p>

                {expandedId === item.id && (
                  <div style={{ marginTop: 10, borderTop: '1px solid #eee', paddingTop: 10 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      <select value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                        <option value="in">Stock in</option>
                        <option value="out">Stock out</option>
                      </select>
                      <input type="number" placeholder="Qty" value={movementQty} onChange={(e) => setMovementQty(e.target.value)} style={{ width: 80 }} />
                      <input type="text" placeholder="Reference (optional)" value={movementReference} onChange={(e) => setMovementReference(e.target.value)} style={{ width: 140 }} />
                      <button onClick={() => handleLogMovement(item)} style={{ fontSize: 12, padding: '4px 10px' }}>Log</button>
                    </div>

                    <p style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Recent movements</p>
                    {(movements[item.id] || []).length === 0 && <p style={{ fontSize: 12, color: '#999' }}>None yet.</p>}
                    {(movements[item.id] || []).map((m) => (
                      <div key={m.id} style={{ fontSize: 12, color: '#666' }}>
                        {m.movement_type === 'in' ? '+' : '-'}{m.qty} {m.reference ? `· ${m.reference}` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
