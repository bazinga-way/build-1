import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [roundTrips, setRoundTrips] = useState([]);
  const [alerts, setAlerts] = useState({ compliance: 0, incidents: 0, lowStock: 0, loans: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', session.user.id)
        .single();
      setProfile(profileData);

      const { data: truckData } = await supabase.from('trucks').select('id, plate_no, status');
      setTrucks(truckData || []);

      const { data: tripData } = await supabase
        .from('round_trips')
        .select(`
          id,
          status,
          truck:trucks ( id, plate_no ),
          driver:drivers ( id, full_name ),
          trip_legs ( id, direction, status, is_empty, origin, destination, sequence )
        `)
        .eq('status', 'active');
      setRoundTrips(tripData || []);

      // Alerts center: pull together everything that needs attention
      const thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

      const { data: docs } = await supabase
        .from('documents')
        .select('expiry_date')
        .not('expiry_date', 'is', null)
        .lte('expiry_date', thirtyDaysOut.toISOString().slice(0, 10));
      const complianceCount = (docs || []).length;

      const { count: incidentCount } = await supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open');

      const { data: items } = await supabase.from('inventory_items').select('current_qty, reorder_level');
      const lowStockCount = (items || []).filter((i) => i.current_qty <= i.reorder_level).length;

      let loanCount = 0;
      if (profileData?.role === 'owner') {
        const { count } = await supabase
          .from('loan_repayment_schedule')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'upcoming')
          .lte('due_date', thirtyDaysOut.toISOString().slice(0, 10));
        loanCount = count || 0;
      }

      setAlerts({ compliance: complianceCount, incidents: incidentCount || 0, lowStock: lowStockCount, loans: loanCount });

      setLoading(false);
    }

    load();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) return <p className="center-text">Loading…</p>;

  const busyTruckIds = new Set(roundTrips.map((rt) => rt.truck?.id).filter(Boolean));
  const availableCount = trucks.filter((t) => t.status === 'active' && !busyTruckIds.has(t.id)).length;
  const inTransitCount = roundTrips.filter((rt) =>
    rt.trip_legs.some((l) => ['departed', 'at_border', 'customs_cleared', 'in_transit'].includes(l.status))
  ).length;
  const loadingCount = roundTrips.filter((rt) =>
    rt.trip_legs.some((l) => l.status === 'loaded')
  ).length;
  const pendingLegsCount = roundTrips.reduce(
    (sum, rt) => sum + rt.trip_legs.filter((l) => l.status === 'pending').length,
    0
  );

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <div className="topbar-right">
          <button onClick={() => router.push('/trucks')}>Trucks</button>
          <button onClick={() => router.push('/trailers')}>Trailers</button>
          <button onClick={() => router.push('/drivers')}>Drivers</button>
          <button onClick={() => router.push('/customers')}>Customers</button>
          <button onClick={() => router.push('/compliance')}>Compliance</button>
          <button onClick={() => router.push('/inventory')}>Inventory</button>
          <button onClick={() => router.push('/incidents')}>Incidents</button>
          {profile?.role === 'owner' && (
            <>
              <button onClick={() => router.push('/invoices')}>Invoices</button>
              <button onClick={() => router.push('/reports')}>Reports</button>
              <button onClick={() => router.push('/team')}>Team</button>
            </>
          )}
          <span>{profile?.full_name || 'Signed in'} · {profile?.role}</span>
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <main className="content">
        {(alerts.compliance > 0 || alerts.incidents > 0 || alerts.lowStock > 0 || alerts.loans > 0) && (
          <div className="trip-card" style={{ marginBottom: 16, borderColor: '#f5c6c0' }}>
            <p className="trip-card-title" style={{ marginBottom: 8 }}>Needs attention</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {alerts.compliance > 0 && (
                <div className="return-row" style={{ cursor: 'pointer' }} onClick={() => router.push('/compliance')}>
                  <span className="trip-route">Documents expiring/expired</span>
                  <span className="pill pill-danger">{alerts.compliance}</span>
                </div>
              )}
              {alerts.loans > 0 && (
                <div className="return-row" style={{ cursor: 'pointer' }} onClick={() => router.push('/reports')}>
                  <span className="trip-route">Loan payments due in 30 days</span>
                  <span className="pill pill-danger">{alerts.loans}</span>
                </div>
              )}
              {alerts.lowStock > 0 && (
                <div className="return-row" style={{ cursor: 'pointer' }} onClick={() => router.push('/inventory')}>
                  <span className="trip-route">Low stock items</span>
                  <span className="pill pill-warning">{alerts.lowStock}</span>
                </div>
              )}
              {alerts.incidents > 0 && (
                <div className="return-row" style={{ cursor: 'pointer' }} onClick={() => router.push('/incidents')}>
                  <span className="trip-route">Open incidents</span>
                  <span className="pill pill-warning">{alerts.incidents}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="stat-grid">
          <div className="stat-card">
            <p className="stat-label">Fleet</p>
            <p className="stat-value">{trucks.length} trucks</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Legs pending</p>
            <p className="stat-value stat-danger">{pendingLegsCount}</p>
          </div>
        </div>

        <div className="status-pills">
          <span className="pill pill-success">{availableCount} available</span>
          <span className="pill pill-accent">{inTransitCount} in transit</span>
          <span className="pill pill-warning">{loadingCount} loading</span>
        </div>

        <h2 className="section-title">Round trips</h2>
        <button onClick={() => router.push('/trips/new')} style={{ marginBottom: 16 }}>
          + New round trip
        </button>

        {roundTrips.length === 0 && (
          <p className="empty-state">No active round trips yet.</p>
        )}

        <div className="trip-list">
          {roundTrips.map((rt) => {
            const sortedLegs = [...rt.trip_legs].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
            const pendingCount = sortedLegs.filter((l) => l.status === 'pending').length;

            return (
              <div
                className="trip-card"
                key={rt.id}
                onClick={() => router.push(`/trips/${rt.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="trip-card-header">
                  <p className="trip-card-title">
                    {rt.truck?.plate_no || 'Unassigned truck'} · {rt.driver?.full_name || 'Unassigned driver'}
                  </p>
                  {pendingCount > 0 && (
                    <span className="pill pill-danger">{pendingCount} pending</span>
                  )}
                </div>

                {sortedLegs.map((leg) => (
                  <div key={leg.id} className="return-row">
                    <span className="trip-route">{leg.direction}: {leg.origin} → {leg.destination}</span>
                    <span className={`pill ${leg.status === 'pending' ? 'pill-danger' : leg.is_empty ? 'pill-danger' : 'pill-accent'}`}>
                      {leg.status === 'pending' ? 'pending' : leg.is_empty ? 'empty' : leg.status}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
