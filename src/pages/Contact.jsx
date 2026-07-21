import { Link } from 'react-router-dom';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import '../styles/contact-page.scss';
import { useContent } from '../hooks/usePublicData';

const icons = {
  Email: <MailOutlined />,
  Phone: <PhoneOutlined />,
  Rehearsals: <CalendarOutlined />,
};

// The details were previously plain text — you could read the email and phone
// but not act on them. Anything reachable gets a real link.
const linkFor = (item) => {
  if (item.label === 'Email') return `mailto:${item.value}`;
  if (item.label === 'Phone') return `tel:${item.value.replace(/\s+/g, '')}`;
  return null;
};

const Contact = () => {
  const { data } = useContent('contact');
  const { intro, items } = data;

  return (
  <main className="ct-page">
    <header className="page-header shell">
      <p className="eyebrow">Contact</p>
      <h1 className="display-lg">{intro.title}</h1>
      <p className="lead">{intro.lead}</p>
    </header>

    <section className="section shell">
      <div className="ct-grid reveal">
        {items.map((item) => {
          const href = linkFor(item);

          const body = (
            <>
              <span className="ct-icon" aria-hidden="true">
                {icons[item.label]}
              </span>
              <span className="ct-label">{item.label}</span>
              <span className="ct-value">{item.value}</span>
            </>
          );

          return href ? (
            <a className="ct-card is-actionable" href={href} key={item.label}>
              {body}
            </a>
          ) : (
            <div className="ct-card" key={item.label}>
              {body}
            </div>
          );
        })}
      </div>

      <p className="ct-note reveal">{intro.note}</p>

      <div className="ct-cta reveal">
        <div>
          <p className="eyebrow">Next Steps</p>
          <h2 className="display-md">Singing with us, or working with us?</h2>
        </div>

        <div className="ct-cta-actions">
          <Link className="btn btn-primary" to="/join">
            Join the chorale
            <ArrowRightOutlined />
          </Link>
          <Link className="btn btn-ghost" to="/partnerships">
            Partner with us
            <ArrowRightOutlined />
          </Link>
        </div>
      </div>
    </section>
  </main>
  );
};

export default Contact;
