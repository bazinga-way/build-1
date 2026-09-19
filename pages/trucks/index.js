import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import DocumentUploader from '../../components/DocumentUploader';

export default function TrucksPage() {
  const router = useRouter();
  const [trucks, setTrucks] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data } = await supabase.from('trucks').select('*').order('plate_no');
      setTrucks(data || []);
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
        <h2 className="section-title">Trucks</h2>

        {trucks.length === 0 && (
          <p className="empty-state">No trucks yet. Add one in Supabase → Table Editor → trucks.</p>
        )}

        <div className="trip-list">
          {trucks.map((t) => (
            <div className="trip-card" key={t.id}>
              <div
                className="trip-card-header"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              >
                <p className="trip-card-title">{t.plate_no} · {t.make} {t.model}</p>
                <span className="pill pill-accent">{t.status}</span>
              </div>

              {expandedId === t.id && (
                <div style={{ marginTop: 12 }}>
                  <DocumentUploader recordTable="trucks" recordId={t.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
