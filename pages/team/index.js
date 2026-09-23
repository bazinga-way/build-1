import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function TeamPage() {
  const router = useRouter();
  const [myRole, setMyRole] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('ops');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: myProfile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single();
      setMyRole(myProfile?.role);

      const { data } = await supabase.from('profiles').select('*').order('full_name');
      setProfiles(data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleRoleChange(profileId, role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
    if (error) {
      alert('Could not update role: ' + error.message);
      return;
    }
    setProfiles(profiles.map((p) => (p.id === profileId ? { ...p, role } : p)));
  }

  async function handleAddProfile(e) {
    e.preventDefault();
    if (!newId.trim() || !newName.trim()) {
      alert('Please enter both the user ID and name.');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: newId.trim(), full_name: newName.trim(), role: newRole })
      .select()
      .single();
    if (error) {
      alert('Could not add team member: ' + error.message);
      return;
    }
    setProfiles([...profiles, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setNewId(''); setNewName(''); setNewRole('ops');
    setShowAdd(false);
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
          <p className="empty-state">Team management is only available to the owner.</p>
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
          <h2 className="section-title" style={{ margin: 0 }}>Team</h2>
          <button onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add team member'}</button>
        </div>

        {showAdd && (
          <form className="auth-card" onSubmit={handleAddProfile} style={{ maxWidth: 'none', marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#777', marginBottom: 12 }}>
              First create their login in Supabase → Authentication → Users → Add user, then paste their User UID here to give them access to the app.
            </p>
            <label htmlFor="newId">User UID (from Supabase Authentication)</label>
            <input id="newId" type="text" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="e.g. a1b2c3d4-..." />
            <label htmlFor="newName">Full name</label>
            <input id="newName" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <label htmlFor="newRole">Role</label>
            <select id="newRole" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="ops">Ops</option>
              <option value="owner">Owner</option>
            </select>
            <button type="submit" style={{ marginTop: 16 }}>Add to team</button>
          </form>
        )}

        <div className="trip-list">
          {profiles.map((p) => (
            <div className="trip-card" key={p.id}>
              <div className="trip-card-header">
                <p className="trip-card-title">{p.full_name}</p>
                <select value={p.role} onChange={(e) => handleRoleChange(p.id, e.target.value)}>
                  <option value="ops">Ops</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: '#777', marginTop: 16 }}>
          Ops can manage trucks, trailers, drivers, round trips, documents, and log trip expenses.
          Invoicing, loans, and finance details are visible to Owners only.
        </p>
      </main>
    </div>
  );
}
