import { ArrowRightOutlined } from '@ant-design/icons';
import '../styles/join-page.scss';
import { useContent } from '../hooks/usePublicData';
import { cssUrl } from '../utils/assetPath';

// The form previously had no submit handler at all: pressing the button did a
// default form submission, reloading the page and silently discarding everything
// the applicant typed. With no backend to post to, the honest fix is to hand the
// details to their mail client, addressed to the chorale.
const buildMailto = (formData, contactEmail) => {
  const field = (name) => String(formData.get(name) ?? '').trim();

  const lines = [
    `Full name: ${field('fullName') || '—'}`,
    `Email: ${field('email') || '—'}`,
    `Phone: ${field('phone') || '—'}`,
    `Church / fellowship: ${field('church') || '—'}`,
    `Voice part / area: ${field('voicePart') || '—'}`,
    '',
    'Why I want to join:',
    field('motivation') || '—',
  ];

  const subject = `Chorale interest — ${field('fullName') || 'New applicant'}`;

  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    lines.join('\n')
  )}`;
};

const Join = () => {
  // Shadowing the old module-level name keeps the JSX below unchanged.
  const { data: joinPageData } = useContent('join');
  const { data: contact } = useContent('contact');
  const contactEmail = contact.items.find((item) => item.label === 'Email')?.value ?? '';

  const handleSubmit = (event) => {
    event.preventDefault();
    window.location.href = buildMailto(new FormData(event.currentTarget), contactEmail);
  };

  return (
    <main className="apply-page">
      <section className="apply-hero">
        <div
          className="apply-hero-photo"
          style={{ backgroundImage: cssUrl(joinPageData.backgroundImage) }}
          aria-hidden="true"
        />
        <div className="apply-hero-scrim" aria-hidden="true" />

        <div className="apply-hero-inner shell">
          <p className="eyebrow on-dark">{joinPageData.eyebrow}</p>
          <h1 className="display-lg apply-title">{joinPageData.title}</h1>
          <p className="apply-lead">{joinPageData.lead}</p>

          <ul className="apply-values">
            {joinPageData.values.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section shell apply-body">
        <div className="apply-main">
          <div className="section-head reveal">
            <p className="eyebrow">Where You Fit</p>
            <h2 className="display-md">Three ways to serve.</h2>
          </div>

          <div className="apply-paths reveal">
            {joinPageData.pathways.map((path) => (
              <article className="apply-path" key={path.title}>
                <h3>{path.title}</h3>
                <p>{path.copy}</p>
              </article>
            ))}
          </div>

          <div className="section-head apply-steps-head reveal">
            <p className="eyebrow">How It Works</p>
            <h2 className="display-md">What to expect after you reach out.</h2>
          </div>

          <ol className="apply-steps reveal">
            {joinPageData.steps.map((step, index) => (
              <li key={step}>
                <span className="apply-step-index">{String(index + 1).padStart(2, '0')}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>

          <aside className="apply-rehearsal reveal">
            <p className="eyebrow">Rehearsals</p>
            <strong>{joinPageData.rehearsal}</strong>
            <span>{joinPageData.rehearsalNote}</span>
          </aside>
        </div>

        <aside className="apply-sidebar">
          <form className="apply-form" onSubmit={handleSubmit}>
            <div className="apply-form-head">
              <p className="eyebrow">Join Form</p>
              <h2 className="display-md">Tell us where you fit.</h2>
              <p>Share your details and the voice part or support area you would like to join.</p>
            </div>

            <label className="apply-field">
              <span>Full name</span>
              <input type="text" name="fullName" placeholder="Your name" required />
            </label>

            <label className="apply-field">
              <span>Email</span>
              <input type="email" name="email" placeholder="you@example.com" required />
            </label>

            <label className="apply-field">
              <span>Phone</span>
              <input type="tel" name="phone" placeholder="+254..." />
            </label>

            <label className="apply-field">
              <span>Church / fellowship</span>
              <input type="text" name="church" placeholder="Your church" />
            </label>

            <label className="apply-field">
              <span>Voice part / area</span>
              <select name="voicePart" defaultValue="">
                <option value="" disabled>
                  Select one
                </option>
                {joinPageData.voiceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="apply-field">
              <span>Why do you want to join?</span>
              <textarea name="motivation" rows="5" placeholder="Tell us a bit about yourself and your interest." />
            </label>

            <button type="submit" className="btn btn-primary apply-submit">
              Submit interest
              <ArrowRightOutlined />
            </button>

            <p className="apply-form-note">
              This opens your email app with the details filled in, addressed to {contactEmail}.
            </p>
          </form>
        </aside>
      </section>
    </main>
  );
};

export default Join;
