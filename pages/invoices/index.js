import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { exportToCsv } from '../../lib/csvExport';

const PAGE_SIZE = 20;

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function fetchPage(offset) {
    let query = supabase
      .from('invoices')
      .select(`
        id, invoice_no, currency, status, issue_date, due_date,
        customer:customers ( name ),
        invoice_lines ( amount )
      `)
      .order('issue_date', { ascending: false })
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

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      setMyRole(profile?.role);

      if (profile?.role !== 'owner') {
        setLoading(false);
        return;
      }

      const data = await fetchPage(0);
      setInvoices(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, statusFilter]);

  async function loadMore() {
    setLoadingMore(true);
    const data = await fetchPage(invoices.length);
    setInvoices([...invoices, ...data]);
    setHasMore(data.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  const filtered = invoices.filter((inv) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return inv.invoice_no.toLowerCase().includes(term) || inv.customer?.name?.toLowerCase().includes(term);
  });

  function handleExport() {
    exportToCsv('invoices.csv', filtered.map((inv) => ({
      invoice_no: inv.invoice_no,
      customer: inv.customer?.name || '',
      status: inv.status,
      currency: inv.currency,
      total: inv.invoice_lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(2),
      issue_date: inv.issue_date,
      due_date: inv.due_date || '',
    })));
  }

  if (loading) return <p className="center-text">Loading…</p>;

  if (myRole !== 'owner') {
    return (
      <div className="page">
        <header className="topbar">
          <h1>TransitOps</h1>
          <button onClick={() => router.push('/')}>← Back</button>
        </header>
        <main className="content">
          <p className="empty-state">Invoices are only visible to the owner.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <div className="trip-card-header" style={{ marginBottom: 16 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Invoices</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleExport} style={{ fontSize: 12, padding: '4px 10px' }}>Export CSV</button>
            <button onClick={() => router.push('/invoices/new')}>+ New invoice</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search invoice # or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {filtered.length === 0 && (
          <p className="empty-state">No invoices match.</p>
        )}

        <div className="trip-list">
          {filtered.map((inv) => {
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

        {hasMore && !search && (
          <button onClick={loadMore} disabled={loadingMore} style={{ marginTop: 16 }}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </main>
    </div>
  );
}
