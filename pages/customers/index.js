import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [legsByCustomer, setLegsByCustomer] = useState({});
  const [invoicesByCustomer, setInvoicesByCustomer] = useState({});

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data } = await supabase.from('customers').select('*').order('name');
      setCustomers(data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function toggleExpand(customer) {
    if (expandedId === customer.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(customer.id);

    if (!legsByCustomer[customer.id]) {
      const { data: legData } = await supabase
        .from('trip_legs')
        .select('id, direction, status, origin, destination, round_trip:round_trips(truck:trucks(plate_no))')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      setLegsByCustomer((prev) => ({ ...prev, [customer.id]: legData || [] }));
    }

    if (!invoicesByCustomer[customer.id]) {
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('id, invoice_no, status, currency, invoice_lines(amount)')
        .eq('customer_id', customer.id)
        .order('issue_date', { ascending: false });
      setInvoicesByCustomer((prev) => ({ ...prev, [customer.id]: invoiceData || [] }));
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) {
      alert('Please enter a customer name.');
      return;
    }
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: newName.trim(),
        country: newCountry || null,
        contact_name: newContactName || null,
        contact_phone: newContactPhone || null,
      })
      .select()
      .single();
    if (error) {
      alert('Could not save customer: ' + error.message);
      return;
    }
    setCustomers([...customers, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName(''); setNewCountry(''); setNewContactName(''); setNewContactPhone('');
    setShowAdd(false);
  }

  function startEdit(customer) {
    setEditingId(customer.id);
    setEditName(customer.name);
    setEditCountry(customer.country || '');
    setEditContactName(customer.contact_name || '');
    setEditContactPhone(customer.contact_phone || '');
  }

  async function handleSaveEdit(customerId) {
    const { error } = await supabase
      .from('customers')
      .update({
        name: editName.trim(),
        country: editCountry || null,
        contact_name: editContactName || null,
        contact_phone: editContactPhone || null,
      })
      .eq('id', customerId);
    if (error) {
      alert('Could not update: ' + error.message);
      return;
    }
    setCustomers(customers.map((c) => (c.id === customerId ? { ...c, name: editName, country: editCountry, contact_name: editContactName, contact_phone: editContactPhone } : c)));
    setEditingId(null);
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
          <h2 className="section-title" style={{ margin: 0 }}>Customers</h2>
          <button onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ New customer'}</button>
        </div>

        {showAdd && (
          <form className="auth-card" onSubmit={handleAdd} style={{ maxWidth: 'none', marginBottom: 16 }}>
            <label htmlFor="newName">Name</label>
            <input id="newName" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <label htmlFor="newCountry">Country</label>
            <input id="newCountry" type="text" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} />
            <label htmlFor="newContactName">Contact name</label>
            <input id="newContactName" type="text" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
            <label htmlFor="newContactPhone">Contact phone</label>
            <input id="newContactPhone" type="text" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} />
            <button type="submit" style={{ marginTop: 16 }}>Save customer</button>
          </form>
        )}

        {customers.length === 0 && <p className="empty-state">No customers yet.</p>}

        <div className="trip-list">
          {customers.map((c) => (
            <div className="trip-card" key={c.id}>
              {editingId === c.id ? (
                <div>
                  <label>Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <label style={{ marginTop: 6 }}>Country</label>
                  <input type="text" value={editCountry} onChange={(e) => setEditCountry(e.target.value)} />
                  <label style={{ marginTop: 6 }}>Contact name</label>
                  <input type="text" value={editContactName} onChange={(e) => setEditContactName(e.target.value)} />
                  <label style={{ marginTop: 6 }}>Contact phone</label>
                  <input type="text" value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => handleSaveEdit(c.id)} style={{ flex: 1 }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ flex: 1, background: 'white' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="trip-card-header" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(c)}>
                    <p className="trip-card-title">{c.name}</p>
                    <span className="pill pill-accent">{c.country || '—'}</span>
                  </div>
                  <p className="trip-route">{c.contact_name || 'No contact set'} {c.contact_phone ? `· ${c.contact_phone}` : ''}</p>

                  {expandedId === c.id && (
                    <div style={{ marginTop: 10, borderTop: '1px solid #eee', paddingTop: 10 }}>
                      <button onClick={() => startEdit(c)} style={{ fontSize: 12, padding: '4px 10px', marginBottom: 10 }}>Edit details</button>

                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Trip history</p>
                      {(legsByCustomer[c.id] || []).length === 0 && <p style={{ fontSize: 13, color: '#999' }}>No trips yet.</p>}
                      {(legsByCustomer[c.id] || []).map((leg) => (
                        <div key={leg.id} style={{ fontSize: 13, marginBottom: 4 }}>
                          {leg.round_trip?.truck?.plate_no} · {leg.direction} · {leg.origin} → {leg.destination} · <span style={{ color: '#666' }}>{leg.status}</span>
                        </div>
                      ))}

                      <p style={{ fontSize: 13, fontWeight: 600, margin: '10px 0 6px' }}>Invoices</p>
                      {(invoicesByCustomer[c.id] || []).length === 0 && <p style={{ fontSize: 13, color: '#999' }}>No invoices yet.</p>}
                      {(invoicesByCustomer[c.id] || []).map((inv) => {
                        const total = inv.invoice_lines.reduce((s, l) => s + Number(l.amount), 0);
                        return (
                          <div
                            key={inv.id}
                            style={{ fontSize: 13, marginBottom: 4, cursor: 'pointer' }}
                            onClick={() => router.push(`/invoices/${inv.id}`)}
                          >
                            {inv.invoice_no} · {inv.currency} {total.toFixed(2)} · <span style={{ color: '#666' }}>{inv.status}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
