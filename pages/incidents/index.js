import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('open');

  const [incidentType, setIncidentType] = useState('near_miss');
  const [severity, setSeverity] = useState('low');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [truckId, setTruckId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const [incidentRes, truckRes, driverRes] = await Promise.all([
        supabase.from('incidents').select('*, truck:trucks(plate_no), driver:drivers(full_name)').order('incident_date', { ascending: false }),
        supabase.from('trucks').select('id, plate_no'),
        supabase.from('drivers').select('id, full_name'),
      ]);

      setIncidents(incidentRes.data || []);
      setTrucks(truckRes.data || []);
      setDrivers(driverRes.data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleAdd(e) {
    e.preventDefault();
    const { data, error } = await supabase
      .from('incidents')
      .insert({
        incident_type: incidentType,
        severity,
        incident_date: incidentDate,
        truck_id: truckId || null,
        driver_id: driverId || null,
        description: description || null,
        status: 'open',
      })
      .select('*, truck:trucks(plate_no), driver:drivers(full_name)')
      .single();

    if (error) {
      alert('Could not save incident: ' + error.message);
      return;
    }

    setIncidents([data, ...incidents]);
    setDescription(''); setTruckId(''); setDriverId('');
    setShowAdd(false);
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from('incidents').update({ status }).eq('id', id);
    if (error) { alert('Could not update: ' + error.message); return; }
    setIncidents(incidents.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  async function updateCorrectiveAction(id, text) {
    await supabase.from('incidents').update({ corrective_action: text }).eq('id', id);
    setIncidents(incidents.map((i) => (i.id === id ? { ...i, corrective_action: text } : i)));
  }

  if (loading) return <p className="center-text">Loading…</p>;

  const visible = incidents.filter((i) => filter === 'all' || i.status === filter);

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <div className="trip-card-header" style={{ marginBottom: 16 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Incidents</h2>
          <button onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Log incident'}</button>
        </div>

        {showAdd && (
          <form className="auth-card" onSubmit={handleAdd} style={{ maxWidth: 'none', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label htmlFor="type">Type</label>
                <select id="type" value={incidentType} onChange={(e) => setIncidentType(e.target.value)}>
                  <option value="near_miss">Near miss</option>
                  <option value="accident">Accident</option>
                  <option value="breakdown">Breakdown</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="severity">Severity</label>
                <select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <label htmlFor="date">Date</label>
            <input id="date" type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />

            <label htmlFor="truck">Truck (optional)</label>
            <select id="truck" value={truckId} onChange={(e) => setTruckId(e.target.value)}>
              <option value="">None</option>
              {trucks.map((t) => (<option key={t.id} value={t.id}>{t.plate_no}</option>))}
            </select>

            <label htmlFor="driver">Driver (optional)</label>
            <select id="driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">None</option>
              {drivers.map((d) => (<option key={d.id} value={d.id}>{d.full_name}</option>))}
            </select>

            <label htmlFor="desc">Description</label>
            <input id="desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />

            <button type="submit" style={{ marginTop: 16 }}>Save incident</button>
          </form>
        )}

        <div className="status-pills" style={{ marginBottom: 16 }}>
          {['open', 'closed', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pill pill-button ${filter === f ? 'pill-accent' : ''}`}
              style={{ border: filter === f ? 'none' : '1px solid #ddd', background: filter === f ? undefined : 'white' }}
            >
              {f}
            </button>
          ))}
        </div>

        {visible.length === 0 && <p className="empty-state">No {filter !== 'all' ? filter : ''} incidents.</p>}

        <div className="trip-list">
          {visible.map((i) => (
            <div className="trip-card" key={i.id}>
              <div className="trip-card-header">
                <p className="trip-card-title" style={{ textTransform: 'capitalize' }}>{i.incident_type.replace('_', ' ')} · {i.incident_date}</p>
                <span className={`pill ${i.severity === 'high' ? 'pill-danger' : i.severity === 'medium' ? 'pill-warning' : 'pill-accent'}`}>
                  {i.severity}
                </span>
              </div>
              <p className="trip-route">
                {i.truck?.plate_no || ''} {i.driver?.full_name ? `· ${i.driver.full_name}` : ''}
              </p>
              {i.description && <p className="trip-route">{i.description}</p>}

              <label style={{ fontSize: 12, color: '#555', display: 'block', marginTop: 8 }}>Corrective action</label>
              <input
                type="text"
                defaultValue={i.corrective_action || ''}
                onBlur={(e) => updateCorrectiveAction(i.id, e.target.value)}
                placeholder="What was done about it…"
                style={{ width: '100%' }}
              />

              <div style={{ marginTop: 8 }}>
                {i.status === 'open' ? (
                  <button onClick={() => updateStatus(i.id, 'closed')} style={{ fontSize: 12, padding: '4px 10px' }}>Mark closed</button>
                ) : (
                  <button onClick={() => updateStatus(i.id, 'open')} style={{ fontSize: 12, padding: '4px 10px' }}>Reopen</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
