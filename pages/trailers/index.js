import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import DocumentUploader from '../../components/DocumentUploader';
import AssetMaintenanceFinance from '../../components/AssetMaintenanceFinance';

export default function TrailersPage() {
  const router = useRouter();
  const [trailers, setTrailers] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data } = await supabase.from('trailers').select('*').order('plate_no');
      setTrailers(data || []);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) return <p className="center-text">Loading…</p>;

  const filtered = trailers.filter((t) => {
    if (!search.trim()) return true;
    return t.plate_no.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <h2 className="section-title">Trailers</h2>

        <input
          type="text"
          placeholder="Search plate number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', marginBottom: 16 }}
        />

        {filtered.length === 0 && (
          <p className="empty-state">No trailers match.</p>
        )}

        <div className="trip-list">
          {filtered.map((t) => (
            <div className="trip-card" key={t.id}>
              <div
                className="trip-card-header"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              >
                <p className="trip-card-title">{t.plate_no} · {t.trailer_type}</p>
                <span className="pill pill-accent">{t.status}</span>
              </div>

              <p className="trip-route">{t.suspension} · {t.capacity_tons ? `${t.capacity_tons}t capacity` : ''}</p>

              {expandedId === t.id && (
                <div style={{ marginTop: 12 }}>
                  <DocumentUploader recordTable="trailers" recordId={t.id} />
                  <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
                    <AssetMaintenanceFinance assetType="trailer" assetId={t.id} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
