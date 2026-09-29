import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import DocumentUploader from '../../components/DocumentUploader';

export default function DriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [leaveByDriver, setLeaveByDriver] = useState({});
  const [showAddLeave, setShowAddLeave] = useState(null);
  const [leaveType, setLeaveType] = useState('annual');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data } = await supabase.from('drivers').select('*').order('full_name');
      setDrivers(data || []);
      setLoading(false);
    }

    load();
  }, [router]);

  async function toggleExpand(driverId) {
    const next = expandedId === driverId ? null : driverId;
    setExpandedId(next);
    if (next && !leaveByDriver[driverId]) {
      const { data } = await supabase.from('leave_records').select('*').eq('driver_id', driverId).order('start_date', { ascending: false });
      setLeaveByDriver((prev) => ({ ...prev, [driverId]: data || [] }));
    }
  }

  async function handleAddLeave(driverId) {
    if (!leaveStart || !leaveEnd) { alert('Please enter start and end dates.'); return; }
    const { data, error } = await supabase
      .from('leave_records')
      .insert({ driver_id: driverId, leave_type: leaveType, start_date: leaveStart, end_date: leaveEnd })
      .select()
      .single();
    if (error) { alert('Could not save: ' + error.message); return; }
    setLeaveByDriver((prev) => ({ ...prev, [driverId]: [data, ...(prev[driverId] || [])] }));
    setLeaveStart(''); setLeaveEnd(''); setShowAddLeave(null);
  }

  async function updateLeaveStatus(driverId, leaveId, status) {
    await supabase.from('leave_records').update({ status }).eq('id', leaveId);
    setLeaveByDriver((prev) => ({
      ...prev,
      [driverId]: prev[driverId].map((l) => (l.id === leaveId ? { ...l, status } : l)),
    }));
  }

  if (loading) return <p className="center-text">Loading…</p>;

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <button onClick={() => router.push('/')}>← Back</button>
      </header>

      <main className="content">
        <h2 className="section-title">Drivers</h2>

        {drivers.length === 0 && (
          <p className="empty-state">No drivers yet. Add one in Supabase → Table Editor → drivers.</p>
        )}

        <div className="trip-list">
          {drivers.map((d) => (
            <div className="trip-card" key={d.id}>
              <div className="trip-card-header" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(d.id)}>
                <p className="trip-card-title">{d.full_name}</p>
                <span className="pill pill-accent">{d.status}</span>
              </div>

              <p className="trip-route">
                License expiry: {d.license_expiry || '—'} · Passport expiry: {d.passport_expiry || '—'}
              </p>

              {expandedId === d.id && (
                <div style={{ marginTop: 12 }}>
                  <DocumentUploader recordTable="drivers" recordId={d.id} />

                  <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Leave</p>
                    {(leaveByDriver[d.id] || []).length === 0 && <p style={{ fontSize: 13, color: '#999' }}>No leave records.</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {(leaveByDriver[d.id] || []).map((l) => (
                        <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: '#f7f7f8', padding: '8px 10px', borderRadius: 6 }}>
                          <span style={{ textTransform: 'capitalize' }}>{l.leave_type} · {l.start_date} to {l.end_date}</span>
                          {l.status === 'requested' ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => updateLeaveStatus(d.id, l.id, 'approved')} style={{ fontSize: 11, padding: '2px 8px' }}>Approve</button>
                              <button onClick={() => updateLeaveStatus(d.id, l.id, 'rejected')} style={{ fontSize: 11, padding: '2px 8px' }}>Reject</button>
                            </div>
                          ) : (
                            <span className={`pill ${l.status === 'approved' ? 'pill-success' : 'pill-danger'}`}>{l.status}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {showAddLeave !== d.id ? (
                      <button onClick={() => setShowAddLeave(d.id)} style={{ fontSize: 12, padding: '4px 10px' }}>+ Log leave</button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                          <option value="annual">Annual</option>
                          <option value="sick">Sick</option>
                          <option value="unpaid">Unpaid</option>
                          <option value="other">Other</option>
                        </select>
                        <input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
                        <input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
                        <button onClick={() => handleAddLeave(d.id)} style={{ fontSize: 12, padding: '4px 10px' }}>Save</button>
                        <button onClick={() => setShowAddLeave(null)} style={{ fontSize: 12, padding: '4px 10px', background: 'white' }}>Cancel</button>
                      </div>
                    )}
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
