import { NavLink } from 'react-router-dom';
import {
  CalendarOutlined,
  StarOutlined,
  ShoppingOutlined,
  LogoutOutlined,
  ExportOutlined,
  EditOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

const AdminLayout = ({ onLogout, children }) => (
  <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        Jabali <em>Chorale</em>
        <span>Admin</span>
      </div>

      <nav className="admin-nav">
        <NavLink to="/admin/events" className="admin-nav-link">
          <CalendarOutlined /> Events
        </NavLink>
        <NavLink to="/admin/orders" className="admin-nav-link">
          <ShoppingOutlined /> Orders
        </NavLink>
        <NavLink to="/admin/jabali5" className="admin-nav-link">
          <StarOutlined /> Jabali @5
        </NavLink>
        <NavLink to="/admin/content" className="admin-nav-link">
          <EditOutlined /> Site content
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

export default AdminLayout;
