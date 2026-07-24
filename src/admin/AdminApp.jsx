import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import '../styles/admin.scss';
import { getSession, login as apiLogin, logout as apiLogout } from '../lib/api';
import AdminLogin from './AdminLogin';
import AdminLayout from './AdminLayout';
import PageLoader from '../components/PageLoader';

// Gate for the whole /admin area. Checks the session once, shows the login form
// when signed out, and the layout + nested routes when signed in.
const AdminApp = () => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'in' | 'out'
  const [role, setRole] = useState('');

  useEffect(() => {
    document.title = 'Administration | Jabali Chorale';
    const robots = document.head.querySelector('meta[name="robots"]');
    if (robots) robots.content = 'noindex, nofollow';
  }, []);

  useEffect(() => {
    let active = true;
    getSession()
      .then((s) => {
        if (!active) return;
        setRole(s.role ?? '');
        setStatus(s.authenticated ? 'in' : 'out');
      })
      .catch(() => active && setStatus('out'));
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (password) => {
    const s = await apiLogin(password);
    setRole(s.role ?? 'admin');
    setStatus('in');
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } finally {
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
    return <AdminLogin onLogin={handleLogin} />;
  }

  // A member who found their way here would otherwise meet a dashboard whose
  // every screen 403s. Send them to the portal that is actually theirs. This is
  // courtesy, not security — the server refuses them either way.
  if (role && role !== 'admin') {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <p className="admin-login-brand">
            Jabali <em>Chorale</em>
          </p>
          <h1>Members portal</h1>
          <p className="admin-login-sub">
            You’re signed in with the chorale member login, which manages the roster rather than
            the full dashboard.
          </p>
          <a className="admin-btn admin-btn-primary" href="/members">
            Go to the members portal
          </a>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout onLogout={handleLogout}>
      <Outlet />
    </AdminLayout>
  );
};

export default AdminApp;
