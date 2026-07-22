import { Link } from 'react-router-dom';
import { ArrowRightOutlined } from '@ant-design/icons';
import '../styles/partnerships-page.scss';
import { useContent } from '../hooks/usePublicData';
import { cssUrl } from '../utils/assetPath';

// The closing button's destination is editable from the dashboard, so it may
// still be a bare '/contact' saved before the enquiry form existed. Landing
// there with no topic would make a partnership enquiry open on the booking
// form, so the reason is re-attached here rather than depending on the stored
// value carrying it.
const withPartnershipTopic = (to) => {
  if (typeof to !== 'string' || !to.startsWith('/contact')) return to;
  return to.includes('topic=') ? to : `${to.split('?')[0]}?topic=partnership`;
};

const Partnerships = () => {
  // Shadowing the old module-level name keeps the JSX below unchanged.
  const { data: partnershipsPageData } = useContent('partnerships');

  return (
  <main className="pt-page">
    <section className="pt-hero">
      <div
        className="pt-hero-photo"
        style={{ backgroundImage: cssUrl(partnershipsPageData.backgroundImage) }}
        aria-hidden="true"
      />
      <div className="pt-hero-scrim" aria-hidden="true" />

      <div className="pt-hero-inner shell">
        <p className="eyebrow on-dark">{partnershipsPageData.eyebrow}</p>
        <h1 className="display-lg pt-title">{partnershipsPageData.title}</h1>
        <p className="pt-lead">{partnershipsPageData.lead}</p>

        <dl className="pt-stats" aria-label="Partnership overview">
          {partnershipsPageData.stats.map((item) => (
            <div key={item.label}>
              <dt>{item.value}</dt>
              <dd>{item.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>

    <section className="section shell">
      <div className="section-head reveal">
        <p className="eyebrow">Where We Partner</p>
        <h2 className="display-md">Three lanes of collaboration.</h2>
        <p className="section-head-note">
          {partnershipsPageData.highlight.title} — {partnershipsPageData.highlight.text}
        </p>
      </div>

      <div className="pt-types reveal">
        {partnershipsPageData.partnerTypes.map((item) => (
          <article className="pt-type" key={item.title}>
            <p className="eyebrow">{item.tag}</p>
            <h3>{item.title}</h3>
            <p className="pt-type-copy">{item.copy}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="section shell pt-summary">
      <article className="pt-panel reveal">
        <p className="eyebrow">What We Bring</p>
        <h2 className="display-md">Performance, planning, and ministry credibility.</h2>
        <ul className="pt-list">
          {partnershipsPageData.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="pt-panel pt-panel-dark reveal">
        <p className="eyebrow on-dark">Working Rhythm</p>
        <h2 className="display-md">Simple, clear, and planned around the objective.</h2>
        <ol className="pt-process">
          {partnershipsPageData.process.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </article>
    </section>

    <section className="shell">
      <div className="pt-cta reveal">
        <div>
          <p className="eyebrow">{partnershipsPageData.inquiry.label}</p>
          <h2 className="display-md">{partnershipsPageData.inquiry.title}</h2>
          <p className="pt-cta-copy">{partnershipsPageData.inquiry.text}</p>
        </div>

        <Link className="btn btn-primary" to={withPartnershipTopic(partnershipsPageData.inquiry.ctaTo)}>
          {partnershipsPageData.inquiry.ctaLabel}
          <ArrowRightOutlined />
        </Link>
      </div>
    </section>
  </main>
  );
};

export default Partnerships;
