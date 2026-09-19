import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function NewRoundTrip() {
  const router = useRouter();
  const [trucks, setTrucks] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [truckId, setTruckId] = useState('');
  const [trailerId, setTrailerId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [origin, setOrigin] = useState('Dar es Salaam Port');
  const [destination, setDestination] = useState('Somika Sarl, DRC');
  const [cargoDescription, setCargoDescription] = useState('');
  const [weightTons, setWeightTons] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [plannedDeparture, setPlannedDeparture] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Trucks/drivers already tied up in another active round trip shouldn't be offered again
      const { data: activeTrips } = await supabase
        .from('round_trips')
        .select('truck_id, driver_id')
        .eq('status', 'active');
      const busyTruckIds = new Set((activeTrips || []).map((t) => t.truck_id));
      const busyDriverIds = new Set((activeTrips || []).map((t) => t.driver_id));

      const [truckRes, trailerRes, driverRes, customerRes] = await Promise.all([
        supabase.from('trucks').select('id, plate_no, status').eq('status', 'active'),
        supabase.from('trailers').select('id, plate_no, status').eq('status', 'active'),
        supabase.from('drivers').select('id, full_name, status').eq('status', 'active'),
        supabase.from('customers').select('id, name').order('name'),
      ]);

      setTrucks((truckRes.data || []).filter((t) => !busyTruckIds.has(t.id)));
      setTrailers(trailerRes.data || []);
      setDrivers((driverRes.data || []).filter((d) => !busyDriverIds.has(d.id)));
      setCustomers(customerRes.data || []);
      setLoading(false);
    }

    load();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!truckId || !driverId) {
      alert('Please select a truck and a driver.');
      return;
    }
    if (!customerId && !newCustomerName.trim()) {
      alert('Please select a customer or add a new one.');
      return;
    }

    setSaving(true);

    let finalCustomerId = customerId;
    if (!finalCustomerId && newCustomerName.trim()) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({ name: newCustomerName.trim() })
        .select()
        .single();
      if (customerError) {
        alert('Could not save customer: ' + customerError.message);
        setSaving(false);
        return;
      }
      finalCustomerId = newCustomer.id;
    }

    // Create the round trip — the database trigger auto-creates the pending return leg
    const { data: roundTrip, error: tripError } = await supabase
      .from('round_trips')
      .insert({
        truck_id: truckId,
        trailer_id: trailerId || null,
        driver_id: driverId,
        status: 'active',
      })
      .select()
      .single();

    if (tripError) {
      alert('Could not create round trip: ' + tripError.message);
      setSaving(false);
      return;
    }

    // Now add the outbound leg
    const { error: legError } = await supabase.from('trip_legs').insert({
      round_trip_id: roundTrip.id,
      direction: 'outbound',
      customer_id: finalCustomerId,
      origin,
      destination,
      cargo_description: cargoDescription || null,
      weight_tons: weightTons ? Number(weightTons) : null,
      bl_number: blNumber || null,
      status: 'planned',
      planned_departure: plannedDeparture || null,
    });

    setSaving(false);

    if (legError) {
      alert('Round trip created, but the outbound leg failed to save: ' + legError.message);
      return;
    }

    router.push('/');
  }

  if (loading) return <p className="center-text">Loading…</p>;

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <form className="auth-card" onSubmit={handleSubmit} style={{ maxWidth: 'none' }}>
          <p className="trip-card-title" style={{ marginBottom: 16 }}>New round trip</p>

          <label htmlFor="truck">Truck</label>
          <select id="truck" value={truckId} onChange={(e) => setTruckId(e.target.value)}>
            <option value="">Select available truck…</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>{t.plate_no}</option>
            ))}
          </select>
          {trucks.length === 0 && (
            <p style={{ fontSize: 12, color: '#b25e00', marginTop: 4 }}>No available trucks — all active trucks are on a trip, or none exist yet.</p>
          )}

          <label htmlFor="trailer">Trailer (optional)</label>
          <select id="trailer" value={trailerId} onChange={(e) => setTrailerId(e.target.value)}>
            <option value="">None selected</option>
            {trailers.map((t) => (
              <option key={t.id} value={t.id}>{t.plate_no}</option>
            ))}
          </select>

          <label htmlFor="driver">Driver</label>
          <select id="driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Select available driver…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
          {drivers.length === 0 && (
            <p style={{ fontSize: 12, color: '#b25e00', marginTop: 4 }}>No available drivers — all active drivers are on a trip, or none exist yet.</p>
          )}

          <label htmlFor="customer">Customer</label>
          <select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {!customerId && (
            <>
              <label htmlFor="newCustomer">Or add new customer</label>
              <input
                id="newCustomer"
                type="text"
                placeholder="Customer name"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label htmlFor="origin">Origin</label>
              <input id="origin" type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </div>
            <div>
              <label htmlFor="destination">Destination</label>
              <input id="destination" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>
          </div>

          <label htmlFor="cargo">Cargo description</label>
          <input
            id="cargo"
            type="text"
            placeholder="e.g. general cargo, 30 tonnes"
            value={cargoDescription}
            onChange={(e) => setCargoDescription(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label htmlFor="weight">Weight (tonnes)</label>
              <input id="weight" type="number" value={weightTons} onChange={(e) => setWeightTons(e.target.value)} />
            </div>
            <div>
              <label htmlFor="bl">BL / reference no.</label>
              <input id="bl" type="text" value={blNumber} onChange={(e) => setBlNumber(e.target.value)} />
            </div>
          </div>

          <label htmlFor="departure">Planned departure</label>
          <input
            id="departure"
            type="datetime-local"
            value={plannedDeparture}
            onChange={(e) => setPlannedDeparture(e.target.value)}
          />

          <button type="submit" disabled={saving} style={{ marginTop: 16 }}>
            {saving ? 'Creating…' : 'Create round trip'}
          </button>
        </form>
      </main>
    </div>
  );
}
