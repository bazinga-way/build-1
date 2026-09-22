import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function TripDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [roundTrip, setRoundTrip] = useState(null);
  const [legs, setLegs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddLeg, setShowAddLeg] = useState(false);
  const [bookingLegId, setBookingLegId] = useState(null);

  // Add-leg form state
  const [newLegType, setNewLegType] = useState('Return');
  const [newOrigin, setNewOrigin] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [addAsPending, setAddAsPending] = useState(true);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCargo, setNewCargo] = useState('');
  const [newWeight, setNewWeight] = useState('');

  // Booking form state (for completing a pending leg)
  const [bookAgentId, setBookAgentId] = useState('');
  const [bookNewAgentName, setBookNewAgentName] = useState('');
  const [bookCustomerId, setBookCustomerId] = useState('');
  const [bookCargo, setBookCargo] = useState('');
  const [bookWeight, setBookWeight] = useState('');

  const [expenses, setExpenses] = useState({}); // { legId: [expense, ...] }
  const [expandedExpenseLegId, setExpandedExpenseLegId] = useState(null);
  const [expenseCategory, setExpenseCategory] = useState('fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: tripData } = await supabase
      .from('round_trips')
      .select('id, status, truck:trucks ( id, plate_no ), driver:drivers ( id, full_name )')
      .eq('id', id)
      .single();
    setRoundTrip(tripData);

    const { data: legData } = await supabase
      .from('trip_legs')
      .select('*, customer:customers(name), agent:agents(name)')
      .eq('round_trip_id', id)
      .order('sequence', { ascending: true });
    setLegs(legData || []);

    if (legData && legData.length > 0) {
      const { data: expenseData } = await supabase
        .from('trip_leg_expenses')
        .select('*')
        .in('trip_leg_id', legData.map((l) => l.id))
        .order('created_at', { ascending: false });
      const grouped = {};
      (expenseData || []).forEach((exp) => {
        if (!grouped[exp.trip_leg_id]) grouped[exp.trip_leg_id] = [];
        grouped[exp.trip_leg_id].push(exp);
      });
      setExpenses(grouped);
    }

    const { data: agentData } = await supabase.from('agents').select('id, name');
    setAgents(agentData || []);

    const { data: customerData } = await supabase.from('customers').select('id, name').order('name');
    setCustomers(customerData || []);

    setLoading(false);
  }

  if (loading) return <p className="center-text">Loading…</p>;
  if (!roundTrip) return <p className="center-text">Round trip not found.</p>;

  async function handleAddExpense(legId) {
    if (!expenseAmount) {
      alert('Please enter an amount.');
      return;
    }
    const { error } = await supabase.from('trip_leg_expenses').insert({
      trip_leg_id: legId,
      category: expenseCategory,
      amount: Number(expenseAmount),
      notes: expenseNotes || null,
    });
    if (error) {
      alert('Could not save expense: ' + error.message);
      return;
    }
    setExpenseAmount('');
    setExpenseNotes('');
    setExpandedExpenseLegId(null);
    load();
  }

  async function handleAddLeg(e) {
    e.preventDefault();
    setSaving(true);

    let finalCustomerId = newCustomerId || null;
    if (!addAsPending && !finalCustomerId && newCustomerName.trim()) {
      const { data: newCustomer, error } = await supabase
        .from('customers').insert({ name: newCustomerName.trim() }).select().single();
      if (error) { alert('Could not save customer: ' + error.message); setSaving(false); return; }
      finalCustomerId = newCustomer.id;
    }

    const nextSequence = legs.length + 1;

    const { error } = await supabase.from('trip_legs').insert({
      round_trip_id: id,
      direction: newLegType,
      sequence: nextSequence,
      origin: newOrigin || null,
      destination: newDestination || null,
      customer_id: addAsPending ? null : finalCustomerId,
      cargo_description: addAsPending ? null : (newCargo || null),
      weight_tons: addAsPending ? null : (newWeight ? Number(newWeight) : null),
      status: addAsPending ? 'pending' : 'planned',
      is_empty: addAsPending,
    });

    setSaving(false);

    if (error) {
      alert('Could not add leg: ' + error.message);
      return;
    }

    setShowAddLeg(false);
    setNewOrigin('');
    setNewDestination('');
    setNewCustomerId('');
    setNewCustomerName('');
    setNewCargo('');
    setNewWeight('');
    load();
  }

  async function handleCompleteBooking(leg) {
    let finalAgentId = bookAgentId || null;
    if (!finalAgentId && bookNewAgentName.trim()) {
      const { data: newAgent, error } = await supabase
        .from('agents').insert({ name: bookNewAgentName.trim(), country: 'DRC' }).select().single();
      if (error) { alert('Could not save agent: ' + error.message); return; }
      finalAgentId = newAgent.id;
    }

    const { error } = await supabase
      .from('trip_legs')
      .update({
        agent_id: finalAgentId,
        customer_id: bookCustomerId || null,
        cargo_description: bookCargo || null,
        weight_tons: bookWeight ? Number(bookWeight) : null,
        status: 'planned',
        is_empty: false,
      })
      .eq('id', leg.id);

    if (error) {
      alert('Could not save booking: ' + error.message);
      return;
    }

    setBookingLegId(null);
    load();
  }

  async function handleMarkEmpty(leg) {
    const { error } = await supabase
      .from('trip_legs')
      .update({ status: 'departed', is_empty: true })
      .eq('id', leg.id);
    if (error) { alert('Could not update: ' + error.message); return; }
    load();
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <h2 className="section-title">
          {roundTrip.truck?.plate_no} · {roundTrip.driver?.full_name}
        </h2>

        <div className="trip-list" style={{ marginBottom: 16 }}>
          {legs.map((leg) => (
            <div className="trip-card" key={leg.id}>
              <div className="trip-card-header">
                <p className="trip-card-title">{leg.direction}</p>
                <span className={`pill ${leg.status === 'pending' ? 'pill-danger' : leg.is_empty ? 'pill-danger' : 'pill-accent'}`}>
                  {leg.status === 'pending' ? 'pending' : leg.is_empty ? 'departed empty' : leg.status}
                </span>
              </div>

              {(leg.origin || leg.destination) && (
                <p className="trip-route">{leg.origin} → {leg.destination}</p>
              )}
              {leg.customer?.name && <p className="trip-route">Customer: {leg.customer.name}</p>}
              {leg.agent?.name && <p className="trip-route">Agent: {leg.agent.name}</p>}
              {leg.cargo_description && <p className="trip-route">Cargo: {leg.cargo_description}</p>}

              <div style={{ marginTop: 8, borderTop: '1px solid #f2f2f2', paddingTop: 8 }}>
                {(expenses[leg.id] || []).length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    {expenses[leg.id].map((exp) => (
                      <div key={exp.id} style={{ fontSize: 12, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ textTransform: 'capitalize' }}>{exp.category}{exp.notes ? ` — ${exp.notes}` : ''}</span>
                        <span>{exp.currency} {Number(exp.amount).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total expenses</span>
                      <span>{(expenses[leg.id].reduce((s, e) => s + Number(e.amount), 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {expandedExpenseLegId !== leg.id ? (
                  <button onClick={() => setExpandedExpenseLegId(leg.id)} style={{ fontSize: 12, padding: '4px 10px' }}>
                    + Log expense
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
                      <option value="fuel">Fuel</option>
                      <option value="toll">Toll</option>
                      <option value="border_fee">Border fee</option>
                      <option value="allowance">Allowance</option>
                      <option value="other">Other</option>
                    </select>
                    <input type="number" placeholder="Amount" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={{ width: 90 }} />
                    <input type="text" placeholder="Note (optional)" value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} style={{ width: 120 }} />
                    <button onClick={() => handleAddExpense(leg.id)} style={{ fontSize: 12, padding: '4px 10px' }}>Save</button>
                    <button onClick={() => setExpandedExpenseLegId(null)} style={{ fontSize: 12, padding: '4px 10px', background: 'white' }}>Cancel</button>
                  </div>
                )}
              </div>

              {leg.status === 'pending' && bookingLegId !== leg.id && (
                <button style={{ marginTop: 8 }} onClick={() => setBookingLegId(leg.id)}>
                  Book this leg
                </button>
              )}

              {leg.status === 'pending' && bookingLegId === leg.id && (
                <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12 }}>
                  <label htmlFor={`agent-${leg.id}`}>Agent / broker (optional)</label>
                  <select id={`agent-${leg.id}`} value={bookAgentId} onChange={(e) => setBookAgentId(e.target.value)}>
                    <option value="">None</option>
                    {agents.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                  </select>
                  {!bookAgentId && (
                    <input
                      type="text"
                      placeholder="Or new agent name"
                      value={bookNewAgentName}
                      onChange={(e) => setBookNewAgentName(e.target.value)}
                      style={{ marginTop: 6 }}
                    />
                  )}

                  <label htmlFor={`cust-${leg.id}`} style={{ marginTop: 8 }}>Customer (optional)</label>
                  <select id={`cust-${leg.id}`} value={bookCustomerId} onChange={(e) => setBookCustomerId(e.target.value)}>
                    <option value="">Not yet known</option>
                    {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>

                  <label htmlFor={`cargo-${leg.id}`} style={{ marginTop: 8 }}>Cargo description</label>
                  <input id={`cargo-${leg.id}`} type="text" value={bookCargo} onChange={(e) => setBookCargo(e.target.value)} />

                  <label htmlFor={`weight-${leg.id}`} style={{ marginTop: 8 }}>Weight (tonnes)</label>
                  <input id={`weight-${leg.id}`} type="number" value={bookWeight} onChange={(e) => setBookWeight(e.target.value)} />

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => handleCompleteBooking(leg)} style={{ flex: 1 }}>Confirm</button>
                    <button
                      onClick={() => handleMarkEmpty(leg)}
                      style={{ flex: 1, background: 'white', color: '#d92d20', border: '1px solid #d92d20' }}
                    >
                      Mark departed empty
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {!showAddLeg && (
          <button onClick={() => setShowAddLeg(true)}>+ Add another leg</button>
        )}

        {showAddLeg && (
          <form className="auth-card" onSubmit={handleAddLeg} style={{ maxWidth: 'none' }}>
            <p className="trip-card-title" style={{ marginBottom: 16 }}>Add a leg</p>

            <label htmlFor="legType">Leg type / label</label>
            <select id="legType" value={newLegType} onChange={(e) => setNewLegType(e.target.value)}>
              <option value="Return">Return</option>
              <option value="Outbound">Outbound</option>
              <option value="Repositioning">Repositioning</option>
              <option value="Other">Other</option>
            </select>
            {newLegType === 'Other' && (
              <input type="text" placeholder="Describe this leg" onChange={(e) => setNewLegType(e.target.value)} style={{ marginTop: 6 }} />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <div>
                <label htmlFor="newOrigin">Origin</label>
                <input id="newOrigin" type="text" value={newOrigin} onChange={(e) => setNewOrigin(e.target.value)} />
              </div>
              <div>
                <label htmlFor="newDestination">Destination</label>
                <input id="newDestination" type="text" value={newDestination} onChange={(e) => setNewDestination(e.target.value)} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: '#555' }}>
              <input type="checkbox" checked={addAsPending} onChange={(e) => setAddAsPending(e.target.checked)} />
              Cargo not confirmed yet — add as pending, book it later
            </label>

            {!addAsPending && (
              <>
                <label htmlFor="newCustomer" style={{ marginTop: 8 }}>Customer</label>
                <select id="newCustomer" value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)}>
                  <option value="">Select customer…</option>
                  {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                {!newCustomerId && (
                  <input
                    type="text"
                    placeholder="Or new customer name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                )}

                <label htmlFor="newCargo" style={{ marginTop: 8 }}>Cargo description</label>
                <input id="newCargo" type="text" value={newCargo} onChange={(e) => setNewCargo(e.target.value)} />

                <label htmlFor="newWeight" style={{ marginTop: 8 }}>Weight (tonnes)</label>
                <input id="newWeight" type="number" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Saving…' : 'Add leg'}
              </button>
              <button type="button" onClick={() => setShowAddLeg(false)} style={{ flex: 1, background: 'white' }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
