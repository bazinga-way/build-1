import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import DocumentUploader from '../../components/DocumentUploader';

export default function DriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data } = await supabase.from('drivers').select('*').order('full_name');
      setDrivers(data || []);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) return <p className="center-text">Loading…</p>;

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <h2 className="section-title">Drivers</h2>

        {drivers.length === 0 && (
          <p className="empty-state">No drivers yet. Add one in Supabase → Table Editor → drivers.</p>
        )}

        <div className="trip-list">
          {drivers.map((d) => (
            <div className="trip-card" key={d.id}>
              <div
                className="trip-card-header"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
              >
                <p className="trip-card-title">{d.full_name}</p>
                <span className="pill pill-accent">{d.status}</span>
              </div>

              <p className="trip-route">
                License expiry: {d.license_expiry || '—'} · Passport expiry: {d.passport_expiry || '—'}
              </p>

              {expandedId === d.id && (
                <div style={{ marginTop: 12 }}>
                  <DocumentUploader recordTable="drivers" recordId={d.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
