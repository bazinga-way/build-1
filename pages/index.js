import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', session.user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }

    loadSession();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) return <p className="center-text">Loading…</p>;

  return (
    <div className="page">
      <header className="topbar">
        <h1>TransitOps</h1>
        <div className="topbar-right">
          <span>{profile?.full_name || 'Signed in'} · {profile?.role}</span>
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <main className="content">
        <p>You're logged in. The control tower dashboard goes here next.</p>
      </main>
    </div>
  );
}
