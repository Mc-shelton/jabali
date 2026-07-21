import { Link, NavLink } from 'react-router-dom';
import {
  HomeOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  MailOutlined,
} from '@ant-design/icons';
import '../styles/extra-pages.scss';
import { communityPageData as communityNav } from '../data/community';
import { useContent } from '../hooks/usePublicData';
import { cssUrl } from '../utils/assetPath';

const sideIcons = {
  Home: <HomeOutlined />,
  About: <InfoCircleOutlined />,
  Gallery: <PictureOutlined />,
  Contact: <MailOutlined />,
};

const Community = () => {
  const { data } = useContent('community');
  // topLinks / sideLinks are navigation and stay in code; editable copy comes
  // from the dashboard. Shadowing the old name keeps the JSX below unchanged.
  const communityPageData = { ...communityNav, ...data };

  return (
  <main className="community-page">
    <section
      className="community-canvas"
      style={{ backgroundImage: `linear-gradient(115deg, rgba(6, 11, 26, 0.86), rgba(11, 18, 39, 0.72) 42%, rgba(100, 59, 24, 0.48)), ${cssUrl(communityPageData.backgroundImage)}` }}
    >
      <aside className="community-rail" aria-label="Community navigation">
        <Link className="community-rail-brand" to="/" aria-label="Jabali Chorale home">
          JC
        </Link>

        <div className="community-rail-links">
          {communityPageData.sideLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `community-rail-link ${isActive ? 'is-active' : ''}`}
              aria-label={item.label}
            >
              {sideIcons[item.shortLabel]}
            </NavLink>
          ))}
        </div>
      </aside>

      <div className="community-stage">
        <header className="community-topbar">
          <nav className="community-toplinks" aria-label="Secondary">
            {communityPageData.topLinks.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="community-hero-grid">
          <section className="community-metric-panel">
            <div className="community-frame">
              <p className="community-eyebrow">{communityPageData.spotlight.leadLabel} • comming soon...</p>
              <div className="community-metric-row">
                <strong>{communityPageData.spotlight.metricValue}</strong>
                <span>{communityPageData.spotlight.metric}</span>
              </div>
              <p className="community-metric-caption">{communityPageData.spotlight.metricCaption}</p>
            </div>
          </section>

          <section className="community-copy-panel">
            <p className="community-kicker">{communityPageData.spotlight.leadLabel}</p>
            <h1>{communityPageData.spotlight.title}</h1>
            <h2>{communityPageData.spotlight.subtitle}</h2>
            <div className="community-badge">{communityPageData.spotlight.badge}</div>
            <p className="community-copy-text">{communityPageData.spotlight.supportingText}</p>

            <div className="community-highlight-list">
              {communityPageData.highlights.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>
        </div>

      </div>
    </section>
  </main>
  );
};

export default Community;
