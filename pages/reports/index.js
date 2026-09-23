import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function ReportsPage() {
  const router = useRouter();
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [legProfitability, setLegProfitability] = useState([]);
  const [cashSummary, setCashSummary] = useState(null);

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

      // Trip profitability: revenue (invoice lines linked to a leg) minus expenses (per leg)
      const { data: legs } = await supabase
        .from('trip_legs')
        .select('id, direction, origin, destination, round_trip:round_trips(truck:trucks(plate_no))')
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: expensesAll } = await supabase.from('trip_leg_expenses').select('trip_leg_id, amount');
      const { data: invoicesAll } = await supabase
        .from('invoices')
        .select('trip_leg_id, invoice_lines(amount)')
        .not('trip_leg_id', 'is', null);

      const expenseByLeg = {};
      (expensesAll || []).forEach((e) => {
        expenseByLeg[e.trip_leg_id] = (expenseByLeg[e.trip_leg_id] || 0) + Number(e.amount);
      });

      const revenueByLeg = {};
      (invoicesAll || []).forEach((inv) => {
        const total = inv.invoice_lines.reduce((s, l) => s + Number(l.amount), 0);
        revenueByLeg[inv.trip_leg_id] = (revenueByLeg[inv.trip_leg_id] || 0) + total;
      });

      const profitRows = (legs || [])
        .filter((leg) => expenseByLeg[leg.id] || revenueByLeg[leg.id])
        .map((leg) => {
          const revenue = revenueByLeg[leg.id] || 0;
          const expense = expenseByLeg[leg.id] || 0;
          return {
            id: leg.id,
            label: `${leg.round_trip?.truck?.plate_no || ''} · ${leg.direction} · ${leg.origin} → ${leg.destination}`,
            revenue,
            expense,
            profit: revenue - expense,
          };
        });
      setLegProfitability(profitRows);

      // Cash summary
      const { data: allInvoices } = await supabase.from('invoices').select('status, invoice_lines(amount)');
      let totalInvoiced = 0, totalPaid = 0, totalOutstanding = 0;
      (allInvoices || []).forEach((inv) => {
        const total = inv.invoice_lines.reduce((s, l) => s + Number(l.amount), 0);
        totalInvoiced += total;
        if (inv.status === 'paid') totalPaid += total;
        else totalOutstanding += total;
      });

      const totalExpenses = (expensesAll || []).reduce((s, e) => s + Number(e.amount), 0);

      const thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
      const { data: upcomingLoans } = await supabase
        .from('loan_repayment_schedule')
        .select('amount_due, due_date, status')
        .eq('status', 'upcoming')
        .lte('due_date', thirtyDaysOut.toISOString().slice(0, 10));
      const upcomingLoanTotal = (upcomingLoans || []).reduce((s, l) => s + Number(l.amount_due), 0);

      setCashSummary({ totalInvoiced, totalPaid, totalOutstanding, totalExpenses, upcomingLoanTotal, upcomingLoanCount: (upcomingLoans || []).length });

      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) return <p className="center-text">Loading…</p>;

  if (myRole !== 'owner') {
    return (
      <div className="page">
        <header className="topbar">
          <h1>TransitOps</h1>
          <button onClick={() => router.push('/')}>← Back</button>
        </header>
        <main className="content">
          <p className="empty-state">Reports are only visible to the owner.</p>
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
        <h2 className="section-title">Cash summary</h2>
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <p className="stat-label">Total invoiced</p>
            <p className="stat-value">{cashSummary.totalInvoiced.toFixed(2)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Paid</p>
            <p className="stat-value" style={{ color: '#1a7f37' }}>{cashSummary.totalPaid.toFixed(2)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Outstanding</p>
            <p className="stat-value stat-danger">{cashSummary.totalOutstanding.toFixed(2)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Total trip expenses</p>
            <p className="stat-value">{cashSummary.totalExpenses.toFixed(2)}</p>
          </div>
        </div>

        {cashSummary.upcomingLoanCount > 0 && (
          <div className="trip-card" style={{ marginBottom: 24, borderColor: '#f5c6c0' }}>
            <p className="trip-card-title">Loan repayments due in next 30 days</p>
            <p className="trip-route">{cashSummary.upcomingLoanCount} payment(s) totaling {cashSummary.upcomingLoanTotal.toFixed(2)}</p>
          </div>
        )}

        <h2 className="section-title">Trip profitability (by leg)</h2>
        {legProfitability.length === 0 && (
          <p className="empty-state">No legs with expenses or linked invoices yet.</p>
        )}
        <div className="trip-list">
          {legProfitability.map((row) => (
            <div className="trip-card" key={row.id}>
              <div className="trip-card-header">
                <p className="trip-card-title" style={{ fontSize: 13 }}>{row.label}</p>
                <span className={`pill ${row.profit >= 0 ? 'pill-success' : 'pill-danger'}`}>
                  {row.profit >= 0 ? '+' : ''}{row.profit.toFixed(2)}
                </span>
              </div>
              <p className="trip-route">Revenue {row.revenue.toFixed(2)} · Expenses {row.expense.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
