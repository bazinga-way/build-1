import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [roundTrips, setRoundTrips] = useState([]);
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
          <button onClick={() => router.push('/invoices')}>Invoices</button>
          <span>{profile?.full_name || 'Signed in'} · {profile?.role}</span>
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <main className="content">
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
