import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { exportToCsv } from '../../lib/csvExport';

export default function ReportsPage() {
  const router = useRouter();
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [legProfitability, setLegProfitability] = useState([]);
  const [cashSummary, setCashSummary] = useState(null);
  const [reportingCurrency, setReportingCurrency] = useState('USD');

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

      // Latest exchange rate per currency, converting everything to USD.
      // Convention: exchange_rates.rate = how many USD one unit of from_currency is worth.
      const { data: rates } = await supabase
        .from('exchange_rates')
        .select('from_currency, rate, rate_date')
        .eq('to_currency', 'USD')
        .order('rate_date', { ascending: false });
      const rateMap = {};
      (rates || []).forEach((r) => {
        if (!(r.from_currency in rateMap)) rateMap[r.from_currency] = Number(r.rate);
      });
      const toUsd = (amount, currency) => {
        if (currency === 'USD') return amount;
        if (rateMap[currency]) return amount * rateMap[currency];
        return amount; // no rate on file — best effort, flagged in the UI note below
      };

      const { data: legs } = await supabase
        .from('trip_legs')
        .select('id, direction, origin, destination, round_trip:round_trips(truck:trucks(plate_no))')
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: expensesAll } = await supabase.from('trip_leg_expenses').select('trip_leg_id, amount, currency');
      const { data: invoicesAll } = await supabase
        .from('invoices')
        .select('trip_leg_id, currency, invoice_lines(amount)')
        .not('trip_leg_id', 'is', null);

      const expenseByLeg = {};
      (expensesAll || []).forEach((e) => {
        const usd = toUsd(Number(e.amount), e.currency);
        expenseByLeg[e.trip_leg_id] = (expenseByLeg[e.trip_leg_id] || 0) + usd;
      });

      const revenueByLeg = {};
      (invoicesAll || []).forEach((inv) => {
        const total = inv.invoice_lines.reduce((s, l) => s + Number(l.amount), 0);
        const usd = toUsd(total, inv.currency);
        revenueByLeg[inv.trip_leg_id] = (revenueByLeg[inv.trip_leg_id] || 0) + usd;
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

      const { data: allInvoices } = await supabase.from('invoices').select('status, currency, invoice_lines(amount)');
      let totalInvoiced = 0, totalPaid = 0, totalOutstanding = 0;
      (allInvoices || []).forEach((inv) => {
        const total = inv.invoice_lines.reduce((s, l) => s + Number(l.amount), 0);
        const usd = toUsd(total, inv.currency);
        totalInvoiced += usd;
        if (inv.status === 'paid') totalPaid += usd;
        else totalOutstanding += usd;
      });

      const totalExpenses = (expensesAll || []).reduce((s, e) => s + toUsd(Number(e.amount), e.currency), 0);

      const thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
      const { data: upcomingLoans } = await supabase
        .from('loan_repayment_schedule')
        .select('amount_due, due_date, status')
        .eq('status', 'upcoming')
        .lte('due_date', thirtyDaysOut.toISOString().slice(0, 10));
      const upcomingLoanTotal = (upcomingLoans || []).reduce((s, l) => s + Number(l.amount_due), 0);

      setCashSummary({
        totalInvoiced, totalPaid, totalOutstanding, totalExpenses,
        upcomingLoanTotal, upcomingLoanCount: (upcomingLoans || []).length,
        hasRates: Object.keys(rateMap).length > 0,
      });

      setLoading(false);
    }

    load();
  }, [router]);

  function handleExportProfitability() {
    exportToCsv('trip_profitability.csv', legProfitability.map((r) => ({
      leg: r.label, revenue_usd: r.revenue.toFixed(2), expense_usd: r.expense.toFixed(2), profit_usd: r.profit.toFixed(2),
    })));
  }

  function handleExportCashSummary() {
    exportToCsv('cash_summary.csv', [{
      total_invoiced_usd: cashSummary.totalInvoiced.toFixed(2),
      total_paid_usd: cashSummary.totalPaid.toFixed(2),
      total_outstanding_usd: cashSummary.totalOutstanding.toFixed(2),
      total_expenses_usd: cashSummary.totalExpenses.toFixed(2),
      upcoming_loan_payments_next_30d: cashSummary.upcomingLoanTotal.toFixed(2),
    }]);
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
        <div className="trip-card-header" style={{ marginBottom: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Cash summary (converted to USD)</h2>
          <button onClick={handleExportCashSummary} style={{ fontSize: 12, padding: '4px 10px' }}>Export CSV</button>
        </div>
        {!cashSummary.hasRates && (
          <p style={{ fontSize: 12, color: '#b25e00', marginBottom: 12 }}>
            No exchange rates on file yet — non-USD amounts are shown at face value until you add rates in Supabase → exchange_rates.
          </p>
        )}
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
            <p className="trip-route">{cashSummary.upcomingLoanCount} payment(s) totaling {cashSummary.upcomingLoanTotal.toFixed(2)} (as entered, not currency-converted)</p>
          </div>
        )}

        <div className="trip-card-header" style={{ marginBottom: 8 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Trip profitability (by leg, USD)</h2>
          <button onClick={handleExportProfitability} style={{ fontSize: 12, padding: '4px 10px' }}>Export CSV</button>
        </div>
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
