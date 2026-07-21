import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { CloseOutlined, MenuOutlined } from '@ant-design/icons';
import '../styles/site-nav.scss';
import { jcMonogram } from '../assets';
import { cssUrl } from '../utils/assetPath';

// Masked rather than <img> so the mark inherits the brand link's colour:
// white over the hero photograph, ink on the solid bar.
const monogramMask = {
  WebkitMaskImage: cssUrl(jcMonogram),
  maskImage: cssUrl(jcMonogram),
};

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/music', label: 'Music' },
  { to: '/events', label: 'Events' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/join', label: 'Join' },
  { to: '/partnerships', label: 'Partnerships' },
  { to: '/community', label: 'JC Community' },
  { to: '/contact', label: 'Contact' },
  // The anniversary campaign — flagged so it reads as a feature, not a section.
  { to: '/jabali-at-5', label: 'Jabali @5', feature: true }
];

// `variant="home"` floats the bar over the hero photograph until the user
// scrolls; every other page gets the solid bar immediately.
const SiteNav = ({ variant = 'page' }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const isOverHero = variant === 'home' && !isScrolled && !isMenuOpen;

  return (
    <header
      className={`site-nav ${isOverHero ? 'is-over-hero' : 'is-solid'} ${isMenuOpen ? 'is-open' : ''}`}
    >
      <nav className="site-nav-bar" aria-label="Primary">
        <Link className="site-nav-brand" to="/" aria-label="Jabali Chorale — home">
          <span className="site-nav-mark" style={monogramMask} aria-hidden="true" />
        </Link>

        <div className="site-nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `site-nav-link ${item.feature ? 'is-feature' : ''} ${isActive ? 'is-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <button
          type="button"
          className="site-nav-toggle"
          aria-expanded={isMenuOpen}
          aria-controls="site-nav-menu"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <CloseOutlined /> : <MenuOutlined />}
        </button>
      </nav>

      <div className="site-nav-menu" id="site-nav-menu" hidden={!isMenuOpen}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `site-nav-menu-link ${item.feature ? 'is-feature' : ''} ${isActive ? 'is-active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </header>
  );
};

export default SiteNav;
