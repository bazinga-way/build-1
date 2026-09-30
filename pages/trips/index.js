import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

const PAGE_SIZE = 20;

export default function TripHistoryPage() {
  const router = useRouter();
  const [roundTrips, setRoundTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function fetchPage(offset) {
    let query = supabase
      .from('round_trips')
      .select(`
        id, status, started_at, completed_at,
        truck:trucks ( plate_no ),
        driver:drivers ( full_name ),
        trip_legs ( id, direction, status, origin, destination )
      `)
      .order('started_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data } = await query;
    return data || [];
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const data = await fetchPage(0);
      setRoundTrips(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, statusFilter]);

  async function loadMore() {
    setLoadingMore(true);
    const data = await fetchPage(roundTrips.length);
    setRoundTrips([...roundTrips, ...data]);
    setHasMore(data.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  if (loading) return <p className="center-text">Loading…</p>;

  const filtered = roundTrips.filter((rt) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      rt.truck?.plate_no?.toLowerCase().includes(term) ||
      rt.driver?.full_name?.toLowerCase().includes(term) ||
      rt.trip_legs.some((l) => l.origin?.toLowerCase().includes(term) || l.destination?.toLowerCase().includes(term))
    );
  });

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <h2 className="section-title">Trip history</h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search truck, driver, route…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {filtered.length === 0 && <p className="empty-state">No round trips match.</p>}

        <div className="trip-list">
          {filtered.map((rt) => (
            <div
              className="trip-card"
              key={rt.id}
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/trips/${rt.id}`)}
            >
              <div className="trip-card-header">
                <p className="trip-card-title">{rt.truck?.plate_no} · {rt.driver?.full_name}</p>
                <span className={`pill ${rt.status === 'active' ? 'pill-accent' : 'pill-success'}`}>{rt.status}</span>
              </div>
              {rt.trip_legs.map((leg) => (
                <p key={leg.id} className="trip-route">{leg.direction}: {leg.origin} → {leg.destination} · {leg.status}</p>
              ))}
            </div>
          ))}
        </div>

        {hasMore && !search && (
          <button onClick={loadMore} disabled={loadingMore} style={{ marginTop: 16 }}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </main>
    </div>
  );
}
