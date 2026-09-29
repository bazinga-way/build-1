import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function AccountingPage() {
  const router = useRouter();
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ledger');

  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [bills, setBills] = useState([]);

  // New journal entry form
  const [jeDescription, setJeDescription] = useState('');
  const [jeLines, setJeLines] = useState([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);

  // New vendor / bill forms
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState('');

  const [showAddBill, setShowAddBill] = useState(false);
  const [billVendorId, setBillVendorId] = useState('');
  const [billNo, setBillNo] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billCurrency, setBillCurrency] = useState('USD');
  const [billDueDate, setBillDueDate] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      setMyRole(profile?.role);
      if (profile?.role !== 'owner') { setLoading(false); return; }

      const [accRes, jeRes, vendorRes, billRes] = await Promise.all([
        supabase.from('chart_of_accounts').select('*').order('code'),
        supabase.from('journal_entries').select('*, journal_lines(*, account:chart_of_accounts(code,name))').order('entry_date', { ascending: false }).limit(30),
        supabase.from('vendors').select('*').order('name'),
        supabase.from('bills').select('*, vendor:vendors(name)').order('due_date', { ascending: true }),
      ]);

      setAccounts(accRes.data || []);
      setEntries(jeRes.data || []);
      setVendors(vendorRes.data || []);
      setBills(billRes.data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  function updateJeLine(i, field, value) {
    const next = [...jeLines];
    next[i][field] = value;
    setJeLines(next);
  }
  function addJeLine() { setJeLines([...jeLines, { accountId: '', debit: '', credit: '' }]); }
  function removeJeLine(i) { setJeLines(jeLines.filter((_, idx) => idx !== i)); }

  const totalDebit = jeLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = jeLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  async function handleSaveJournalEntry(e) {
    e.preventDefault();
    if (!balanced) {
      alert('Debits and credits must be equal and greater than zero before saving.');
      return;
    }
    const validLines = jeLines.filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) {
      alert('Please fill in at least two lines with an account selected.');
      return;
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({ description: jeDescription || null })
      .select()
      .single();
    if (entryError) { alert('Could not save entry: ' + entryError.message); return; }

    const lineRows = validLines.map((l) => ({
      journal_entry_id: entry.id,
      account_id: l.accountId,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
    }));
    const { error: linesError } = await supabase.from('journal_lines').insert(lineRows);
    if (linesError) { alert('Entry saved, but lines failed: ' + linesError.message); return; }

    setJeDescription('');
    setJeLines([{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }]);

    const { data: refreshed } = await supabase
      .from('journal_entries')
      .select('*, journal_lines(*, account:chart_of_accounts(code,name))')
      .order('entry_date', { ascending: false })
      .limit(30);
    setEntries(refreshed || []);
  }

  async function handleAddVendor(e) {
    e.preventDefault();
    if (!vendorName.trim()) { alert('Please enter a vendor name.'); return; }
    const { data, error } = await supabase.from('vendors').insert({ name: vendorName.trim(), category: vendorCategory || null }).select().single();
    if (error) { alert('Could not save vendor: ' + error.message); return; }
    setVendors([...vendors, data].sort((a, b) => a.name.localeCompare(b.name)));
    setVendorName(''); setVendorCategory(''); setShowAddVendor(false);
  }

  async function handleAddBill(e) {
    e.preventDefault();
    if (!billVendorId || !billAmount) { alert('Please select a vendor and enter an amount.'); return; }
    const { data, error } = await supabase
      .from('bills')
      .insert({ vendor_id: billVendorId, bill_no: billNo || null, amount: Number(billAmount), currency: billCurrency, due_date: billDueDate || null })
      .select('*, vendor:vendors(name)')
      .single();
    if (error) { alert('Could not save bill: ' + error.message); return; }
    setBills([...bills, data]);
    setBillVendorId(''); setBillNo(''); setBillAmount(''); setBillDueDate('');
    setShowAddBill(false);
  }

  async function markBillPaid(bill) {
    await supabase.from('bill_payments').insert({ bill_id: bill.id, amount: bill.amount });
    await supabase.from('bills').update({ status: 'paid' }).eq('id', bill.id);
    setBills(bills.map((b) => (b.id === bill.id ? { ...b, status: 'paid' } : b)));
  }

  if (loading) return <p className="center-text">Loading…</p>;

  if (myRole !== 'owner') {
    return (
      <div className="page">
        <header className="topbar"><h1>TransitOps</h1><button onClick={() => router.push('/')}>← Back</button></header>
        <main className="content"><p className="empty-state">Accounting is only visible to the owner.</p></main>
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
        <h2 className="section-title">Accounting</h2>

        <div className="status-pills" style={{ marginBottom: 16 }}>
          {['ledger', 'accounts', 'ap'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="pill pill-button"
              style={{ border: tab === t ? 'none' : '1px solid #ddd', background: tab === t ? '#1a56db' : 'white', color: tab === t ? 'white' : '#333' }}
            >
              {t === 'ledger' ? 'Journal' : t === 'accounts' ? 'Chart of accounts' : 'Bills (AP)'}
            </button>
          ))}
        </div>

        {tab === 'accounts' && (
          <div className="trip-list">
            {accounts.map((a) => (
              <div className="trip-card" key={a.id}>
                <div className="trip-card-header">
                  <p className="trip-card-title">{a.code} · {a.name}</p>
                  <span className="pill pill-accent" style={{ textTransform: 'capitalize' }}>{a.account_type}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'ledger' && (
          <>
            <form className="auth-card" onSubmit={handleSaveJournalEntry} style={{ maxWidth: 'none', marginBottom: 20 }}>
              <p className="trip-card-title" style={{ marginBottom: 12 }}>New journal entry</p>
              <label htmlFor="jeDesc">Description</label>
              <input id="jeDesc" type="text" value={jeDescription} onChange={(e) => setJeDescription(e.target.value)} />

              <p style={{ fontSize: 13, color: '#555', margin: '12px 0 6px' }}>Lines</p>
              {jeLines.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <select value={l.accountId} onChange={(e) => updateJeLine(i, 'accountId', e.target.value)} style={{ flex: 2, minWidth: 140 }}>
                    <option value="">Account…</option>
                    {accounts.map((a) => (<option key={a.id} value={a.id}>{a.code} {a.name}</option>))}
                  </select>
                  <input type="number" placeholder="Debit" value={l.debit} onChange={(e) => updateJeLine(i, 'debit', e.target.value)} style={{ width: 90 }} />
                  <input type="number" placeholder="Credit" value={l.credit} onChange={(e) => updateJeLine(i, 'credit', e.target.value)} style={{ width: 90 }} />
                  {jeLines.length > 2 && <button type="button" onClick={() => removeJeLine(i)}>×</button>}
                </div>
              ))}
              <button type="button" onClick={addJeLine} style={{ marginBottom: 10 }}>+ Add line</button>

              <p style={{ fontSize: 13, color: balanced ? '#1a7f37' : '#d92d20' }}>
                Debit {totalDebit.toFixed(2)} · Credit {totalCredit.toFixed(2)} {balanced ? '✓ balanced' : '— must match'}
              </p>

              <button type="submit" disabled={!balanced} style={{ marginTop: 8 }}>Save entry</button>
            </form>

            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recent entries</p>
            <div className="trip-list">
              {entries.map((e) => (
                <div className="trip-card" key={e.id}>
                  <p className="trip-card-title" style={{ fontSize: 13 }}>{e.entry_date} · {e.description || 'No description'}</p>
                  {e.journal_lines.map((l) => (
                    <div key={l.id} style={{ fontSize: 12, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{l.account?.code} {l.account?.name}</span>
                      <span>{l.debit > 0 ? `Dr ${l.debit}` : `Cr ${l.credit}`}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'ap' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => setShowAddVendor(!showAddVendor)}>{showAddVendor ? 'Cancel' : '+ Vendor'}</button>
              <button onClick={() => setShowAddBill(!showAddBill)}>{showAddBill ? 'Cancel' : '+ Bill'}</button>
            </div>

            {showAddVendor && (
              <form className="auth-card" onSubmit={handleAddVendor} style={{ maxWidth: 'none', marginBottom: 16 }}>
                <label>Vendor name</label>
                <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
                <label style={{ marginTop: 6 }}>Category</label>
                <input type="text" value={vendorCategory} onChange={(e) => setVendorCategory(e.target.value)} placeholder="e.g. parts, fuel, insurance" />
                <button type="submit" style={{ marginTop: 12 }}>Save vendor</button>
              </form>
            )}

            {showAddBill && (
              <form className="auth-card" onSubmit={handleAddBill} style={{ maxWidth: 'none', marginBottom: 16 }}>
                <label>Vendor</label>
                <select value={billVendorId} onChange={(e) => setBillVendorId(e.target.value)}>
                  <option value="">Select vendor…</option>
                  {vendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                </select>
                <label style={{ marginTop: 6 }}>Bill number</label>
                <input type="text" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                  <div>
                    <label>Amount</label>
                    <input type="number" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} />
                  </div>
                  <div>
                    <label>Currency</label>
                    <select value={billCurrency} onChange={(e) => setBillCurrency(e.target.value)}>
                      <option value="USD">USD</option><option value="TZS">TZS</option><option value="CDF">CDF</option>
                    </select>
                  </div>
                </div>
                <label style={{ marginTop: 6 }}>Due date</label>
                <input type="date" value={billDueDate} onChange={(e) => setBillDueDate(e.target.value)} />
                <button type="submit" style={{ marginTop: 12 }}>Save bill</button>
              </form>
            )}

            <div className="trip-list">
              {bills.map((b) => (
                <div className="trip-card" key={b.id}>
                  <div className="trip-card-header">
                    <p className="trip-card-title">{b.vendor?.name} {b.bill_no ? `· ${b.bill_no}` : ''}</p>
                    <span className={`pill ${b.status === 'paid' ? 'pill-success' : 'pill-danger'}`}>{b.status}</span>
                  </div>
                  <p className="trip-route">{b.currency} {Number(b.amount).toFixed(2)} · due {b.due_date || '—'}</p>
                  {b.status !== 'paid' && (
                    <button onClick={() => markBillPaid(b)} style={{ fontSize: 12, padding: '4px 10px', marginTop: 6 }}>Mark paid</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
