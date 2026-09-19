import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function CompliancePage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .not('expiry_date', 'is', null);

      const relevant = (docs || []).filter((d) => daysUntil(d.expiry_date) <= 30);

      // Look up display names for each record this document belongs to
      const truckIds = relevant.filter((d) => d.record_table === 'trucks').map((d) => d.record_id);
      const driverIds = relevant.filter((d) => d.record_table === 'drivers').map((d) => d.record_id);
      const trailerIds = relevant.filter((d) => d.record_table === 'trailers').map((d) => d.record_id);

      const [trucksRes, driversRes, trailersRes] = await Promise.all([
        truckIds.length ? supabase.from('trucks').select('id, plate_no').in('id', truckIds) : { data: [] },
        driverIds.length ? supabase.from('drivers').select('id, full_name').in('id', driverIds) : { data: [] },
        trailerIds.length ? supabase.from('trailers').select('id, plate_no').in('id', trailerIds) : { data: [] },
      ]);

      const nameMap = {};
      (trucksRes.data || []).forEach((t) => { nameMap[`trucks-${t.id}`] = t.plate_no; });
      (driversRes.data || []).forEach((d) => { nameMap[`drivers-${d.id}`] = d.full_name; });
      (trailersRes.data || []).forEach((t) => { nameMap[`trailers-${t.id}`] = t.plate_no; });

      const enriched = relevant
        .map((d) => ({
          ...d,
          days: daysUntil(d.expiry_date),
          ownerName: nameMap[`${d.record_table}-${d.record_id}`] || 'Unknown',
        }))
        .sort((a, b) => a.days - b.days);

      setItems(enriched);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) return <p className="center-text">Loading…</p>;

  const expiredCount = items.filter((i) => i.days < 0).length;
  const expiringCount = items.filter((i) => i.days >= 0).length;

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <h2 className="section-title">Compliance</h2>

        <div className="stat-grid">
          <div className="stat-card">
            <p className="stat-label">Expired</p>
            <p className="stat-value stat-danger">{expiredCount}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Expiring in 30 days</p>
            <p className="stat-value" style={{ color: '#b25e00' }}>{expiringCount}</p>
          </div>
        </div>

        {items.length === 0 && (
          <p className="empty-state">Nothing expiring in the next 30 days. Nice.</p>
        )}

        <div className="trip-list">
          {items.map((item) => (
            <div className="trip-card" key={item.id}>
              <div className="trip-card-header">
                <p className="trip-card-title">{item.ownerName} · {item.doc_type}</p>
                <span className={`pill ${item.days < 0 ? 'pill-danger' : 'pill-warning'}`}>
                  {item.days < 0 ? 'expired' : `${item.days} days`}
                </span>
              </div>
              <p className="trip-route" style={{ textTransform: 'capitalize' }}>
                {item.record_table.slice(0, -1)} document
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
