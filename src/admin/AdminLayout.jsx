import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  CalendarOutlined,
  StarOutlined,
  ShoppingOutlined,
  ScanOutlined,
  LogoutOutlined,
  ExportOutlined,
  EditOutlined,
  FileTextOutlined,
  TeamOutlined,
  SkinOutlined,
  MenuOutlined,
  CloseOutlined,
} from '@ant-design/icons';

const AdminLayout = ({ onLogout, children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // A route selection should immediately return the phone to its working
  // screen. Escape also closes the menu for attached keyboards/tablets.
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="admin-sidebar-mobile-head">
          <div className="admin-sidebar-brand">
            Jabali <em>Chorale</em>
            <span>Admin</span>
          </div>
          <button
            type="button"
            className="admin-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="admin-navigation"
            aria-label={menuOpen ? 'Close admin menu' : 'Open admin menu'}
          >
            {menuOpen ? <CloseOutlined /> : <MenuOutlined />}
          </button>
        </div>

        <nav className="admin-nav" id="admin-navigation">
          <NavLink to="/admin/events" className="admin-nav-link">
            <CalendarOutlined /> Events
          </NavLink>
          <NavLink to="/admin/merch" className="admin-nav-link">
            <SkinOutlined /> Merchandise
          </NavLink>
          <NavLink to="/admin/orders" className="admin-nav-link">
            <ShoppingOutlined /> Orders
          </NavLink>
          <NavLink to="/admin/scan" className="admin-nav-link">
            <ScanOutlined /> Door check-in
          </NavLink>
          <NavLink to="/admin/jabali5" className="admin-nav-link">
            <StarOutlined /> Jabali @5
          </NavLink>
          <NavLink to="/admin/content" className="admin-nav-link">
            <EditOutlined /> Site content
          </NavLink>
          <NavLink to="/admin/access" className="admin-nav-link">
            <TeamOutlined /> Member access
          </NavLink>
          <NavLink to="/admin/logs" className="admin-nav-link">
            <FileTextOutlined /> Logs
          </NavLink>
        </nav>

        <div className="admin-sidebar-foot">
          <a href="/" target="_blank" rel="noreferrer" className="admin-nav-link">
            <ExportOutlined /> View site
          </a>
          <button type="button" className="admin-nav-link admin-logout" onClick={onLogout}>
            <LogoutOutlined /> Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
};

export default AdminLayout;
