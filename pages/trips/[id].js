import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function TripDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [roundTrip, setRoundTrip] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [agentId, setAgentId] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [weightTons, setWeightTons] = useState('');

  useEffect(() => {
    if (!id) return;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: tripData } = await supabase
        .from('round_trips')
        .select(`
          id,
          status,
          truck:trucks ( id, plate_no ),
          driver:drivers ( id, full_name ),
          trip_legs ( id, direction, status, is_empty, origin, destination, cargo_description, weight_tons, agent_id, customer_id )
        `)
        .eq('id', id)
        .single();
      setRoundTrip(tripData);

      const { data: agentData } = await supabase
        .from('agents')
        .select('id, name');
      setAgents(agentData || []);

      setLoading(false);
    }

    load();
  }, [id, router]);

  if (loading) return <p className="center-text">Loading…</p>;
  if (!roundTrip) return <p className="center-text">Round trip not found.</p>;

  const outbound = roundTrip.trip_legs.find((l) => l.direction === 'outbound');
  const returnLeg = roundTrip.trip_legs.find((l) => l.direction === 'return');

  async function handleConfirmBooking(e) {
    e.preventDefault();
    setSaving(true);

    let finalAgentId = agentId || null;

    // If they typed a brand new agent name instead of picking one, create it
    if (!finalAgentId && newAgentName.trim()) {
      const { data: newAgent, error: agentError } = await supabase
        .from('agents')
        .insert({ name: newAgentName.trim(), country: 'DRC' })
        .select()
        .single();
      if (agentError) {
        alert('Could not save agent: ' + agentError.message);
        setSaving(false);
        return;
      }
      finalAgentId = newAgent.id;
    }

    let finalCustomerId = null;
    if (customerName.trim()) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({ name: customerName.trim() })
        .select()
        .single();
      if (customerError) {
        alert('Could not save customer: ' + customerError.message);
        setSaving(false);
        return;
      }
      finalCustomerId = newCustomer.id;
    }

    const { error: updateError } = await supabase
      .from('trip_legs')
      .update({
        agent_id: finalAgentId,
        customer_id: finalCustomerId,
        cargo_description: cargoDescription || null,
        weight_tons: weightTons ? Number(weightTons) : null,
        is_empty: false,
        status: 'planned',
      })
      .eq('id', returnLeg.id);

    setSaving(false);

    if (updateError) {
      alert('Could not save booking: ' + updateError.message);
      return;
    }

    router.push('/');
  }

  async function handleDepartedEmpty() {
    setSaving(true);
    const { error } = await supabase
      .from('trip_legs')
      .update({ status: 'departed', is_empty: true })
      .eq('id', returnLeg.id);
    setSaving(false);

    if (error) {
      alert('Could not update: ' + error.message);
      return;
    }
    router.push('/');
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <h2 className="section-title">
          Round trip {roundTrip.truck?.plate_no} · {roundTrip.driver?.full_name}
        </h2>

        <div className="trip-card" style={{ marginBottom: 16 }}>
          <p className="trip-card-title">→ Outbound leg</p>
          <p className="trip-route">{outbound?.origin} → {outbound?.destination}</p>
          <span className="pill pill-accent">{outbound?.status}</span>
        </div>

        {returnLeg && returnLeg.status === 'pending' ? (
          <form className="auth-card" onSubmit={handleConfirmBooking} style={{ maxWidth: 'none' }}>
            <p className="trip-card-title">Book return cargo</p>
            <p className="trip-route" style={{ marginBottom: 16 }}>
              {returnLeg.origin} → {returnLeg.destination}
            </p>

            <label htmlFor="agent">Agent / broker</label>
            <select id="agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Select existing agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {!agentId && (
              <>
                <label htmlFor="newAgent">Or add new agent</label>
                <input
                  id="newAgent"
                  type="text"
                  placeholder="Agent name"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                />
              </>
            )}

            <label htmlFor="customer">Customer (if known)</label>
            <input
              id="customer"
              type="text"
              placeholder="Optional — may not be known yet"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />

            <label htmlFor="cargo">Cargo description</label>
            <input
              id="cargo"
              type="text"
              placeholder="e.g. copper cathodes"
              value={cargoDescription}
              onChange={(e) => setCargoDescription(e.target.value)}
            />

            <label htmlFor="weight">Weight (tonnes)</label>
            <input
              id="weight"
              type="number"
              placeholder="28"
              value={weightTons}
              onChange={(e) => setWeightTons(e.target.value)}
            />

            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Confirm booking'}
            </button>

            <button
              type="button"
              onClick={handleDepartedEmpty}
              disabled={saving}
              style={{ marginTop: 8, background: 'white', color: '#d92d20', border: '1px solid #d92d20' }}
            >
              Mark departed empty
            </button>
          </form>
        ) : (
          <div className="trip-card">
            <p className="trip-card-title">Return leg</p>
            <p className="trip-route">{returnLeg?.origin} → {returnLeg?.destination}</p>
            <span className={`pill ${returnLeg?.is_empty ? 'pill-danger' : 'pill-success'}`}>
              {returnLeg?.is_empty ? 'departed empty' : returnLeg?.status}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
