import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AssetMaintenanceFinance({ assetType, assetId }) {
  const [records, setRecords] = useState([]);
  const [agreement, setAgreement] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [showAddAgreement, setShowAddAgreement] = useState(false);

  const [recordType, setRecordType] = useState('service');
  const [odometerKm, setOdometerKm] = useState('');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [nextDueKm, setNextDueKm] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');

  const [lenderName, setLenderName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [termMonths, setTermMonths] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      setIsOwner(profile?.role === 'owner');
    }

    const { data: recordData } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('asset_type', assetType)
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });
    setRecords(recordData || []);

    const { data: agreementData } = await supabase
      .from('finance_agreements')
      .select('*')
      .eq('asset_type', assetType)
      .eq('asset_id', assetId)
      .maybeSingle();
    setAgreement(agreementData);

    if (agreementData) {
      const { data: scheduleData } = await supabase
        .from('loan_repayment_schedule')
        .select('*')
        .eq('finance_agreement_id', agreementData.id)
        .order('due_date', { ascending: true });
      setSchedule(scheduleData || []);
    }
  }

  async function handleAddMaintenance(e) {
    e.preventDefault();
    const { error } = await supabase.from('maintenance_records').insert({
      asset_type: assetType,
      asset_id: assetId,
      record_type: recordType,
      odometer_km: odometerKm ? Number(odometerKm) : null,
      cost: cost ? Number(cost) : null,
      vendor: vendor || null,
      next_due_km: nextDueKm ? Number(nextDueKm) : null,
      next_due_date: nextDueDate || null,
    });
    if (error) { alert('Could not save: ' + error.message); return; }
    setOdometerKm(''); setCost(''); setVendor(''); setNextDueKm(''); setNextDueDate('');
    setShowAddMaintenance(false);
    load();
  }

  async function handleAddAgreement(e) {
    e.preventDefault();
    if (!lenderName.trim() || !principal || !startDate || !termMonths) {
      alert('Please fill in lender, principal, start date, and term.');
      return;
    }
    const { error } = await supabase.from('finance_agreements').insert({
      asset_type: assetType,
      asset_id: assetId,
      lender_name: lenderName.trim(),
      principal: Number(principal),
      interest_rate: interestRate ? Number(interestRate) : null,
      start_date: startDate,
      term_months: Number(termMonths),
    });
    if (error) { alert('Could not save: ' + error.message); return; }
    setShowAddAgreement(false);
    load();
  }

  async function markPaid(scheduleRow) {
    const { error } = await supabase
      .from('loan_repayment_schedule')
      .update({ status: 'paid', amount_paid: scheduleRow.amount_due, paid_date: new Date().toISOString().slice(0, 10) })
      .eq('id', scheduleRow.id);
    if (error) { alert('Could not update: ' + error.message); return; }
    load();
  }

  async function handleGenerateSchedule() {
    if (schedule.length > 0) {
      const confirmed = confirm('This will replace the existing repayment schedule. Continue?');
      if (!confirmed) return;
    }

    const principal = Number(agreement.principal);
    const termMonths = Number(agreement.term_months);
    const annualRate = agreement.interest_rate ? Number(agreement.interest_rate) : 0;
    const monthlyRate = annualRate / 100 / 12;

    let monthlyPayment;
    if (monthlyRate > 0) {
      monthlyPayment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
    } else {
      monthlyPayment = principal / termMonths;
    }
    monthlyPayment = Math.round(monthlyPayment * 100) / 100;

    const start = new Date(agreement.start_date);
    const rows = [];
    for (let i = 1; i <= termMonths; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + i);
      rows.push({
        finance_agreement_id: agreement.id,
        due_date: dueDate.toISOString().slice(0, 10),
        amount_due: monthlyPayment,
        status: 'upcoming',
      });
    }

    if (schedule.length > 0) {
      await supabase.from('loan_repayment_schedule').delete().eq('finance_agreement_id', agreement.id);
    }

    const { error } = await supabase.from('loan_repayment_schedule').insert(rows);
    if (error) { alert('Could not generate schedule: ' + error.message); return; }
    load();
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#555', margin: '4px 0 8px', fontWeight: 600 }}>Maintenance</p>
      {records.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>No maintenance records yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {records.map((r) => (
          <div key={r.id} style={{ fontSize: 13, background: '#f7f7f8', padding: '8px 10px', borderRadius: 6 }}>
            <b style={{ textTransform: 'capitalize' }}>{r.record_type}</b> {r.odometer_km ? `· ${r.odometer_km}km` : ''} {r.cost ? `· ${r.cost}` : ''} {r.vendor ? `· ${r.vendor}` : ''}
            {r.next_due_km || r.next_due_date ? (
              <div style={{ color: '#b25e00', marginTop: 2 }}>
                Next due: {r.next_due_km ? `${r.next_due_km}km` : ''} {r.next_due_date || ''}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!showAddMaintenance ? (
        <button onClick={() => setShowAddMaintenance(true)} style={{ marginBottom: 20 }}>+ Log maintenance</button>
      ) : (
        <form onSubmit={handleAddMaintenance} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <select value={recordType} onChange={(e) => setRecordType(e.target.value)}>
              <option value="service">Service</option>
              <option value="repair">Repair</option>
              <option value="tyre">Tyre</option>
              <option value="inspection">Inspection</option>
            </select>
            <input type="number" placeholder="Odometer (km)" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} style={{ width: 130 }} />
            <input type="number" placeholder="Cost" value={cost} onChange={(e) => setCost(e.target.value)} style={{ width: 100 }} />
            <input type="text" placeholder="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} style={{ width: 130 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <input type="number" placeholder="Next due (km)" value={nextDueKm} onChange={(e) => setNextDueKm(e.target.value)} style={{ width: 130 }} />
            <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setShowAddMaintenance(false)} style={{ background: 'white' }}>Cancel</button>
          </div>
        </form>
      )}

      {isOwner ? (
        <>
          <p style={{ fontSize: 13, color: '#555', margin: '4px 0 8px', fontWeight: 600 }}>Finance / loan</p>
          {!agreement && !showAddAgreement && (
            <>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>No finance agreement recorded.</p>
              <button onClick={() => setShowAddAgreement(true)}>+ Add finance agreement</button>
            </>
          )}

          {!agreement && showAddAgreement && (
            <form onSubmit={handleAddAgreement}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <input type="text" placeholder="Lender name" value={lenderName} onChange={(e) => setLenderName(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
                <input type="number" placeholder="Principal" value={principal} onChange={(e) => setPrincipal(e.target.value)} style={{ width: 120 }} />
                <input type="number" placeholder="Interest %" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} style={{ width: 100 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="number" placeholder="Term (months)" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} style={{ width: 130 }} />
              </div>
              <p style={{ fontSize: 12, color: '#777', marginBottom: 8 }}>
                After saving, you'll be able to auto-generate the monthly repayment schedule from these terms.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit">Save</button>
                <button type="button" onClick={() => setShowAddAgreement(false)} style={{ background: 'white' }}>Cancel</button>
              </div>
            </form>
          )}

          {agreement && (
            <div>
              <p style={{ fontSize: 13, marginBottom: 8 }}>
                {agreement.lender_name} · principal {agreement.principal} · {agreement.term_months} months from {agreement.start_date}
              </p>
              {schedule.length === 0 ? (
                <button onClick={handleGenerateSchedule} style={{ marginBottom: 8 }}>Generate monthly repayment schedule</button>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {schedule.filter((s) => s.status === 'paid').length} of {schedule.length} paid
                  </span>
                  <button onClick={handleGenerateSchedule} style={{ fontSize: 12, padding: '4px 10px' }}>Regenerate</button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {schedule.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: '#f7f7f8', padding: '8px 10px', borderRadius: 6 }}>
                    <span>{s.due_date} · {s.amount_due}</span>
                    {s.status === 'paid' ? (
                      <span className="pill pill-success">paid</span>
                    ) : (
                      <button onClick={() => markPaid(s)} className="pill pill-warning pill-button">mark paid</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 12, color: '#999' }}>Finance details are visible to the owner only.</p>
      )}
    </div>
  );
}
