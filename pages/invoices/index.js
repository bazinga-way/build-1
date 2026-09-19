import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('invoices')
        .select(`
          id, invoice_no, currency, status, issue_date, due_date,
          customer:customers ( name ),
          invoice_lines ( amount )
        `)
        .order('issue_date', { ascending: false });

      setInvoices(data || []);
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
        <div className="trip-card-header" style={{ marginBottom: 16 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Invoices</h2>
          <button onClick={() => router.push('/invoices/new')}>+ New invoice</button>
        </div>

        {invoices.length === 0 && (
          <p className="empty-state">No invoices yet.</p>
        )}

        <div className="trip-list">
          {invoices.map((inv) => {
            const total = inv.invoice_lines.reduce((sum, l) => sum + Number(l.amount), 0);
            return (
              <div
                className="trip-card"
                key={inv.id}
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(`/invoices/${inv.id}`)}
              >
                <div className="trip-card-header">
                  <p className="trip-card-title">{inv.invoice_no} · {inv.customer?.name || 'No customer'}</p>
                  <span className={`pill ${inv.status === 'paid' ? 'pill-success' : inv.status === 'overdue' ? 'pill-danger' : 'pill-accent'}`}>
                    {inv.status}
                  </span>
                </div>
                <p className="trip-route">{inv.currency} {total.toFixed(2)} · due {inv.due_date || '—'}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
