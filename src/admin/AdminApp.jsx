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

  useEffect(() => {
    let active = true;
    getSession()
      .then((s) => active && setStatus(s.authenticated ? 'in' : 'out'))
      .catch(() => active && setStatus('out'));
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (password) => {
    await apiLogin(password);
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

  return (
    <AdminLayout onLogout={handleLogout}>
      <Outlet />
    </AdminLayout>
  );
};

export default AdminApp;
