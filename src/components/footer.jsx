import { Link } from 'react-router-dom';
import {
  InstagramOutlined,
  TikTokOutlined,
  TwitterOutlined,
  WhatsAppOutlined,
  YoutubeOutlined,
} from '@ant-design/icons';
import './../styles/footer.scss';
import { useContent } from '../hooks/usePublicData';

const socialIcons = {
  instagram: <InstagramOutlined />,
  tiktok: <TikTokOutlined />,
  youtube: <YoutubeOutlined />,
  x: <TwitterOutlined />,
  whatsapp: <WhatsAppOutlined />,
};

const navGroups = [
  {
    title: 'Explore',
    links: [
      { to: '/about', label: 'About' },
      { to: '/music', label: 'Music' },
      { to: '/events', label: 'Events' },
      { to: '/gallery', label: 'Gallery' },
    ],
  },
  {
    title: 'Get Involved',
    links: [
      { to: '/jabali-at-5', label: 'Jabali @5' },
      { to: '/join', label: 'Join the Chorale' },
      { to: '/partnerships', label: 'Partnerships' },
      { to: '/community', label: 'JC Community' },
      { to: '/contact', label: 'Contact' },
    ],
  },
];

const Footer = () => {
  const { data: contact } = useContent('contact');
  const { data: social } = useContent('social');
  const { data: pages } = useContent('pages');

  const email = contact.items.find((item) => item.label === 'Email')?.value;
  // A platform with no URL is hidden rather than rendered as a dead link.
  const activeSocialLinks = social.links.filter((link) => Boolean(link.url));

  return (
    <footer className="footer">
      <div className="footer-inner shell">
        <div className="footer-brand">
          <Link className="footer-wordmark" to="/">
            Jabali <em>Chorale</em>
          </Link>
          <p className="footer-mission">{pages.footer.mission}</p>
        </div>

        <nav className="footer-nav" aria-label="Footer">
          {navGroups.map((group) => (
            <div className="footer-group" key={group.title}>
              <p className="footer-group-title">{group.title}</p>
              {group.links.map((link) => (
                <Link key={link.to} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}

          <div className="footer-group">
            <p className="footer-group-title">Reach Us</p>
            {email && <a href={`mailto:${email}`}>{email}</a>}

            {activeSocialLinks.length > 0 && (
              <div className="footer-social">
                {activeSocialLinks.map((social) => (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                  >
                    {socialIcons[social.id]}
                  </a>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="footer-base shell">
        <small>© {new Date().getFullYear()} Jabali Chorale</small>
        <small>Nairobi, Kenya</small>
      </div>
    </footer>
  );
};

export default Footer;
