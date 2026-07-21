import { Link } from 'react-router-dom';
import { ArrowRightOutlined } from '@ant-design/icons';
import './../styles/about.scss';
import { useContent } from '../hooks/usePublicData';
import { cssUrl } from '../utils/assetPath';

// `showCta` is off on the About page itself — the button links to /about, and a
// CTA pointing at the page you're already on is noise.
const AboutSection = ({ heroImg1, heroImg2, showCta = true }) => {
  const { data } = useContent('pages');
  const band = data.aboutBand;

  return (
  <section className="about-band section" id="about">
    <div className="about-band-inner shell">
      <div className="about-band-copy reveal">
        <p className="eyebrow">{band.eyebrow}</p>

        <h2 className="display-lg about-band-title">
          {band.title}
          <em>{band.titleEm}</em>
        </h2>

        <p className="lead">{band.lead}</p>

        <dl className="about-facts">
          {band.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {showCta && (
          <Link className="btn btn-ghost" to="/about">
            {band.ctaLabel}
            <ArrowRightOutlined />
          </Link>
        )}
      </div>

      {/* Two overlapping plates, both clipped inside the grid column — the old
          version used margin hacks that pushed the images off the viewport. */}
      <div className="about-band-media reveal" aria-hidden="true">
        <div className="about-plate about-plate-tall" style={{ backgroundImage: cssUrl(heroImg1) }} />
        <div className="about-plate about-plate-inset" style={{ backgroundImage: cssUrl(heroImg2) }} />
      </div>
    </div>
  </section>
  );
};

export default AboutSection;
