import { Link } from 'react-router-dom';
import '../styles/extra-pages.scss';
import { partnershipsPageData } from '../data/partnerships';

const Partnerships = () => (
  <main className="extra-page partnerships-page">
    <section className="partnerships-flow">
      <section className="partnerships-hero">
        <div
          className="partnerships-intro"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(15, 25, 42, 0.94), rgba(42, 27, 14, 0.74)), url(${partnershipsPageData.backgroundImage})`,
          }}
        >
          <p className="extra-pill">{partnershipsPageData.eyebrow}</p>
          <h1>{partnershipsPageData.title}</h1>
          <p className="extra-lead">{partnershipsPageData.lead}</p>

          <div className="partnerships-stats" aria-label="Partnership overview">
            {partnershipsPageData.stats.map((item) => (
              <div className="partnerships-stat" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="partnerships-highlight">
          <p className="hero-card-label">{partnershipsPageData.highlight.label}</p>
          <strong>{partnershipsPageData.highlight.title}</strong>
          <span>{partnershipsPageData.highlight.text}</span>
        </aside>
      </section>

      <section className="partnerships-types">
        {partnershipsPageData.partnerTypes.map((item) => (
          <article className="partnerships-block" key={item.title}>
            <p className="partnerships-tag">{item.tag}</p>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>

      <section className="partnerships-summary">
        <article className="partnerships-block">
          <p className="extra-pill">What We Bring</p>
          <h2>Performance, planning, and ministry credibility.</h2>
          <div className="partnerships-list">
            {partnershipsPageData.strengths.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </article>

        <article className="partnerships-block partnerships-block-accent">
          <p className="extra-pill">Working Rhythm</p>
          <h2>Simple, clear, and planned around the objective.</h2>
          <div className="partnerships-process">
            {partnershipsPageData.process.map((item, index) => (
              <div className="partnerships-process-row" key={item}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="partnerships-cta-band">
        <div className="partnerships-cta-copy">
          <p className="extra-pill">{partnershipsPageData.inquiry.label}</p>
          <h2>{partnershipsPageData.inquiry.title}</h2>
          <p>{partnershipsPageData.inquiry.text}</p>
        </div>
        <Link className="partnerships-cta-link" to={partnershipsPageData.inquiry.ctaTo}>
          {partnershipsPageData.inquiry.ctaLabel}
        </Link>
      </section>
    </section>
  </main>
);

export default Partnerships;
