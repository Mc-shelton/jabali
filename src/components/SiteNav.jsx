import { Link, NavLink } from 'react-router-dom';
import '../styles/site-nav.scss';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/music', label: 'Music' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/join', label: 'Join' },
  { to: '/partnerships', label: 'Partnerships' },
  { to: '/community', label: 'JC Community' },
  { to: '/contact', label: 'Contact' }
];

const SiteNav = ({ variant = 'page' }) => (
  <div className={`site-nav-shell ${variant === 'home' ? 'is-home' : 'is-page'}`}>
    <nav className="site-nav" aria-label="Primary">
      <Link className="site-nav-brand" to="/">
        Jabali Chorale
      </Link>

      <div className="site-nav-links">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `site-nav-link ${isActive ? 'is-active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  </div>
);

export default SiteNav;
