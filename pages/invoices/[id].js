import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function InvoiceDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role !== 'owner') {
        alert('Invoices are only available to the owner.');
        router.push('/');
        return;
      }

      const { data } = await supabase
        .from('invoices')
        .select(`
          id, invoice_no, currency, status, issue_date, due_date,
          customer:customers ( name, country ),
          invoice_lines ( id, description, amount )
        `)
        .eq('id', id)
        .single();

      setInvoice(data);
      setLoading(false);
    }

    load();
  }, [id, router]);

  async function updateStatus(status) {
    await supabase.from('invoices').update({ status }).eq('id', id);
    setInvoice({ ...invoice, status });
  }

  async function handleDelete() {
    if (!confirm(`Delete invoice ${invoice.invoice_no}? This can't be undone.`)) return;
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) {
      alert('Could not delete invoice: ' + error.message);
      return;
    }
    router.push('/invoices');
  }

  if (loading) return <p className="center-text">Loading…</p>;
  if (!invoice) return <p className="center-text">Invoice not found.</p>;

  const total = invoice.invoice_lines.reduce((sum, l) => sum + Number(l.amount), 0);

  return (
    <div className="page">
      <header className="topbar no-print">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/invoices')}>← Back</button>
      </header>

      <main className="content">
        <div className="trip-card" id="invoice-printable">
          <div className="trip-card-header">
            <p className="trip-card-title">{invoice.invoice_no}</p>
            <span className={`pill ${invoice.status === 'paid' ? 'pill-success' : invoice.status === 'overdue' ? 'pill-danger' : 'pill-accent'}`}>
              {invoice.status}
            </span>
          </div>

          <p className="trip-route">{invoice.customer?.name} {invoice.customer?.country ? `· ${invoice.customer.country}` : ''}</p>
          <p className="trip-route">Issued {invoice.issue_date} · Due {invoice.due_date || '—'}</p>

          <table style={{ width: '100%', fontSize: 13, marginTop: 16, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '6px 0' }}>Description</th>
                <th style={{ padding: '6px 0', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.invoice_lines.map((line) => (
                <tr key={line.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
                  <td style={{ padding: '8px 0' }}>{line.description}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>{Number(line.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 8, borderTop: '1px solid #ddd' }}>
            <p style={{ fontWeight: 600, margin: 0 }}>Total</p>
            <p style={{ fontWeight: 600, margin: 0 }}>{invoice.currency} {total.toFixed(2)}</p>
          </div>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => window.print()}>Export / Print PDF</button>
          <button onClick={() => router.push(`/invoices/${id}/edit`)}>Edit</button>

          <label htmlFor="statusSelect" style={{ fontSize: 13, color: '#555' }}>Status:</label>
          <select id="statusSelect" value={invoice.status} onChange={(e) => updateStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>

          <button onClick={handleDelete} style={{ marginLeft: 'auto', color: '#d92d20', border: '1px solid #d92d20', background: 'white' }}>
            Delete
          </button>
        </div>
      </main>
    </div>
  );
}
