import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function PayrollPage() {
  const router = useRouter();
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const [driverId, setDriverId] = useState('');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [basePay, setBasePay] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      setMyRole(profile?.role);
      if (profile?.role !== 'owner') { setLoading(false); return; }

      const [entryRes, driverRes] = await Promise.all([
        supabase.from('payroll_entries').select('*, driver:drivers(full_name)').order('period', { ascending: false }),
        supabase.from('drivers').select('id, full_name').order('full_name'),
      ]);
      setEntries(entryRes.data || []);
      setDrivers(driverRes.data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!driverId || !period) { alert('Please select a driver and enter a period.'); return; }
    const { data, error } = await supabase
      .from('payroll_entries')
      .insert({
        driver_id: driverId,
        period,
        base_pay: basePay ? Number(basePay) : 0,
        allowances: allowances ? Number(allowances) : 0,
        deductions: deductions ? Number(deductions) : 0,
      })
      .select('*, driver:drivers(full_name)')
      .single();
    if (error) { alert('Could not save: ' + error.message); return; }
    setEntries([data, ...entries]);
    setBasePay(''); setAllowances(''); setDeductions('');
    setShowAdd(false);
  }

  async function markPaid(entry) {
    await supabase.from('payroll_entries').update({ status: 'paid' }).eq('id', entry.id);
    setEntries(entries.map((e) => (e.id === entry.id ? { ...e, status: 'paid' } : e)));
  }

  if (loading) return <p className="center-text">Loading…</p>;

  if (myRole !== 'owner') {
    return (
      <div className="page">
        <header className="topbar"><h1>TransitOps</h1><button onClick={() => router.push('/')}>← Back</button></header>
        <main className="content"><p className="empty-state">Payroll is only visible to the owner.</p></main>
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
          <h2 className="section-title" style={{ margin: 0 }}>Payroll</h2>
          <button onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ New entry'}</button>
        </div>

        {showAdd && (
          <form className="auth-card" onSubmit={handleAdd} style={{ maxWidth: 'none', marginBottom: 16 }}>
            <label>Driver</label>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              <option value="">Select driver…</option>
              {drivers.map((d) => (<option key={d.id} value={d.id}>{d.full_name}</option>))}
            </select>
            <label style={{ marginTop: 6 }}>Period (YYYY-MM)</label>
            <input type="text" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-09" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
              <div><label>Base pay</label><input type="number" value={basePay} onChange={(e) => setBasePay(e.target.value)} /></div>
              <div><label>Allowances</label><input type="number" value={allowances} onChange={(e) => setAllowances(e.target.value)} /></div>
              <div><label>Deductions</label><input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} /></div>
            </div>
            <button type="submit" style={{ marginTop: 12 }}>Save entry</button>
          </form>
        )}

        <div className="trip-list">
          {entries.map((entry) => {
            const net = Number(entry.base_pay) + Number(entry.allowances) - Number(entry.deductions);
            return (
              <div className="trip-card" key={entry.id}>
                <div className="trip-card-header">
                  <p className="trip-card-title">{entry.driver?.full_name} · {entry.period}</p>
                  <span className={`pill ${entry.status === 'paid' ? 'pill-success' : 'pill-accent'}`}>{entry.status}</span>
                </div>
                <p className="trip-route">
                  Base {entry.base_pay} + Allowances {entry.allowances} − Deductions {entry.deductions} = Net {net.toFixed(2)}
                </p>
                {entry.status !== 'paid' && (
                  <button onClick={() => markPaid(entry)} style={{ fontSize: 12, padding: '4px 10px', marginTop: 6 }}>Mark paid</button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
