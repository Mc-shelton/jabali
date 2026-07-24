import { useEffect, useState } from 'react';
import { LogoutOutlined, ExportOutlined, TeamOutlined } from '@ant-design/icons';
import '../styles/admin.scss';
import '../styles/members-portal.scss';
import { getSession, login as apiLogin, logout as apiLogout } from '../lib/api';
import MemberLogin from './MemberLogin';
import MemberRoster from './MemberRoster';
import PageLoader from '../components/PageLoader';

// The member portal at /members.
//
// Separate from /admin on purpose. It reuses the dashboard's styling so it
// feels like the same product, but it is its own gate with its own credential
// and its own single screen — a member never sees a nav full of doors that
// would 403 if they tried them.
//
// An admin signing in here is allowed and useful: it's the same roster editor,
// and they can reach it without switching accounts.
const MemberApp = () => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'in' | 'out'
  const [role, setRole] = useState('');
  const [accessOpen, setAccessOpen] = useState(true);

  useEffect(() => {
    document.title = 'Members | Jabali Chorale';
    const robots = document.head.querySelector('meta[name="robots"]');
    if (robots) robots.content = 'noindex, nofollow';
  }, []);

  useEffect(() => {
    let active = true;
    getSession()
      .then((s) => {
        if (!active) return;
        setRole(s.role ?? '');
        setAccessOpen(s.authenticated ? true : s.memberAccessOpen !== false);
        setStatus(s.authenticated ? 'in' : 'out');
      })
      .catch(() => active && setStatus('out'));
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (username, password) => {
    const s = await apiLogin(password, username);
    setRole(s.role ?? 'member');
    setStatus('in');
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } finally {
      setRole('');
      setStatus('out');
    }
  };

  if (status === 'checking') {
    return (
      <div className="admin-boot">
        <PageLoader label="Checking your session…" />
      </div>
    );
  }

  if (status === 'out') {
    return <MemberLogin onLogin={handleLogin} accessOpen={accessOpen} />;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          Jabali <em>Chorale</em>
          <span>Members</span>
        </div>

        <nav className="admin-nav">
          {/* Not a link: it is the only screen here, and a nav item that goes
              nowhere shouldn't pretend to be clickable. */}
          <span className="admin-nav-link active">
            <TeamOutlined /> Choir members
          </span>
        </nav>

        <div className="admin-sidebar-foot">
          {role === 'admin' && (
            <a href="/admin" className="admin-nav-link">
              <ExportOutlined /> Admin dashboard
            </a>
          )}
          <a href="/" target="_blank" rel="noreferrer" className="admin-nav-link">
            <ExportOutlined /> View site
          </a>
          <button type="button" className="admin-nav-link admin-logout" onClick={handleLogout}>
            <LogoutOutlined /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <MemberRoster role={role} />
      </main>
    </div>
  );
};

export default MemberApp;
