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

      const { data: truckData } = await supabase
        .from('trucks')
        .select('id, plate_no, status');
      setTrucks(truckData || []);

      const { data: tripData } = await supabase
        .from('round_trips')
        .select(`
          id,
          status,
          truck:trucks ( id, plate_no ),
          driver:drivers ( id, full_name ),
          trip_legs ( id, direction, status, is_empty, origin, destination )
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

  // Work out which trucks are busy vs available
  const busyTruckIds = new Set(roundTrips.map((rt) => rt.truck?.id).filter(Boolean));
  const availableCount = trucks.filter((t) => t.status === 'active' && !busyTruckIds.has(t.id)).length;
  const inTransitCount = roundTrips.filter((rt) =>
    rt.trip_legs.some((l) => ['departed', 'at_border', 'customs_cleared', 'in_transit'].includes(l.status))
  ).length;
  const loadingCount = roundTrips.filter((rt) =>
    rt.trip_legs.some((l) => l.status === 'loaded')
  ).length;
  const unbookedReturns = roundTrips.filter((rt) =>
    rt.trip_legs.some((l) => l.direction === 'return' && l.status === 'pending')
  ).length;

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <div className="topbar-right">
          <button onClick={() => router.push('/trucks')}>Trucks</button>
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
            <p className="stat-label">Returns unbooked</p>
            <p className="stat-value stat-danger">{unbookedReturns}</p>
          </div>
        </div>

        <div className="status-pills">
          <span className="pill pill-success">{availableCount} available</span>
          <span className="pill pill-accent">{inTransitCount} in transit</span>
          <span className="pill pill-warning">{loadingCount} loading</span>
        </div>

        <h2 className="section-title">Round trips</h2>

        {roundTrips.length === 0 && (
          <p className="empty-state">No active round trips yet. Add one in Supabase → Table Editor → round_trips to see it here.</p>
        )}

        <div className="trip-list">
          {roundTrips.map((rt) => {
            const outbound = rt.trip_legs.find((l) => l.direction === 'outbound');
            const ret = rt.trip_legs.find((l) => l.direction === 'return');

            return (
              <div className="trip-card" key={rt.id} onClick={() => router.push(`/trips/${rt.id}`)} style={{ cursor: 'pointer' }}>
                <div className="trip-card-header">
                  <p className="trip-card-title">
                    {rt.truck?.plate_no || 'Unassigned truck'} · {rt.driver?.full_name || 'Unassigned driver'}
                  </p>
                  <span className="pill pill-accent">{outbound?.status || 'planned'}</span>
                </div>

                {outbound && (
                  <p className="trip-route">→ {outbound.origin} → {outbound.destination}</p>
                )}

                {ret && (
                  <div className="return-row">
                    <span className="trip-route">← Return</span>
                    {ret.status === 'pending' ? (
                      <button className="pill pill-danger pill-button" onClick={() => router.push(`/trips/${rt.id}`)}>
                        pending — book now
                      </button>
                    ) : (
                      <span className={`pill ${ret.is_empty ? 'pill-danger' : 'pill-success'}`}>
                        {ret.is_empty ? 'departed empty' : ret.status}
                      </span>
                    )}
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
