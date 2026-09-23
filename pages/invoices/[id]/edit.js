import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';

export default function EditInvoice() {
  const router = useRouter();
  const { id } = router.query;

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState([{ id: null, description: '', amount: '' }]);

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

      const { data: customerData } = await supabase.from('customers').select('id, name').order('name');
      setCustomers(customerData || []);

      const { data: invoice } = await supabase
        .from('invoices')
        .select('id, invoice_no, customer_id, currency, due_date, invoice_lines ( id, description, amount )')
        .eq('id', id)
        .single();

      if (!invoice) {
        setLoading(false);
        return;
      }

      setInvoiceNo(invoice.invoice_no);
      setCustomerId(invoice.customer_id || '');
      setCurrency(invoice.currency);
      setDueDate(invoice.due_date || '');
      setLines(
        invoice.invoice_lines.length
          ? invoice.invoice_lines.map((l) => ({ id: l.id, description: l.description, amount: String(l.amount) }))
          : [{ id: null, description: '', amount: '' }]
      );

      setLoading(false);
    }

    load();
  }, [id, router]);

  function updateLine(index, field, value) {
    const next = [...lines];
    next[index][field] = value;
    setLines(next);
  }

  function addLine() {
    setLines([...lines, { id: null, description: '', amount: '' }]);
  }

  function removeLine(index) {
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!customerId && !newCustomerName.trim()) {
      alert('Please select a customer or add a new one.');
      return;
    }
    const validLines = lines.filter((l) => l.description.trim() && l.amount);
    if (validLines.length === 0) {
      alert('Please keep at least one line item with a description and amount.');
      return;
    }

    setSaving(true);

    let finalCustomerId = customerId;
    if (!finalCustomerId && newCustomerName.trim()) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({ name: newCustomerName.trim() })
        .select()
        .single();
      if (customerError) {
        alert('Could not save customer: ' + customerError.message);
        setSaving(false);
        return;
      }
      finalCustomerId = newCustomer.id;
    }

    const { error: invoiceError } = await supabase
      .from('invoices')
      .update({
        invoice_no: invoiceNo,
        customer_id: finalCustomerId,
        currency,
        due_date: dueDate || null,
      })
      .eq('id', id);

    if (invoiceError) {
      alert('Could not update invoice: ' + invoiceError.message);
      setSaving(false);
      return;
    }

    // Simplest reliable approach: replace all line items with the current set
    const { error: deleteError } = await supabase.from('invoice_lines').delete().eq('invoice_id', id);
    if (deleteError) {
      alert('Could not update line items: ' + deleteError.message);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from('invoice_lines').insert(
      validLines.map((l) => ({
        invoice_id: id,
        description: l.description.trim(),
        amount: Number(l.amount),
      }))
    );

    setSaving(false);

    if (insertError) {
      alert('Could not save line items: ' + insertError.message);
      return;
    }

    router.push(`/invoices/${id}`);
  }

  if (loading) return <p className="center-text">Loading…</p>;

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push(`/invoices/${id}`)}>← Back</button>
      </header>

      <main className="content">
        <form className="auth-card" onSubmit={handleSubmit} style={{ maxWidth: 'none' }}>
          <p className="trip-card-title" style={{ marginBottom: 16 }}>Edit invoice</p>

          <label htmlFor="invoiceNo">Invoice number</label>
          <input id="invoiceNo" type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />

          <label htmlFor="customer">Customer</label>
          <select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {!customerId && (
            <>
              <label htmlFor="newCustomer">Or add new customer</label>
              <input
                id="newCustomer"
                type="text"
                placeholder="Customer name"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label htmlFor="currency">Currency</label>
              <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="TZS">TZS</option>
                <option value="CDF">CDF</option>
              </select>
            </div>
            <div>
              <label htmlFor="dueDate">Due date</label>
              <input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#555', margin: '16px 0 8px' }}>Line items</p>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Description"
                value={line.description}
                onChange={(e) => updateLine(i, 'description', e.target.value)}
                style={{ flex: 2 }}
              />
              <input
                type="number"
                placeholder="Amount"
                value={line.amount}
                onChange={(e) => updateLine(i, 'amount', e.target.value)}
                style={{ flex: 1 }}
              />
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(i)} style={{ padding: '0 10px' }}>×</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addLine} style={{ marginBottom: 16 }}>+ Add line</button>

          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </main>
    </div>
  );
}
