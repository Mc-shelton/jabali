import { ArrowRightOutlined, CheckCircleFilled, LoadingOutlined } from '@ant-design/icons';
import '../styles/join-page.scss';
import '../styles/enquiry-form.scss';
import { useContent } from '../hooks/usePublicData';
import { useEnquirySubmit, revealOnMount } from '../hooks/useEnquirySubmit';
import { cssUrl } from '../utils/assetPath';

// This form used to build a mailto: link. That worked on a desktop with a mail
// client configured and did nothing at all on a phone — the applicant pressed
// Submit, no mail app opened, and their answers were gone. It now posts to
// api/enquiries.php like every other form on the site.
const Join = () => {
  // Shadowing the old module-level name keeps the JSX below unchanged.
  const { data: joinPageData } = useContent('join');

  const { status, error, submit, reset, sending } = useEnquirySubmit({
    topic: 'membership',
    mapFields: (value) => ({
      name: value('fullName'),
      email: value('email'),
      phone: value('phone'),
      organisation: value('church'),
      voicePart: value('voicePart'),
      message: value('motivation'),
    }),
  });

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
          {status === 'sent' ? (
            <div className="apply-form eq-done" role="status" ref={revealOnMount}>
              <CheckCircleFilled className="eq-done-icon" />
              <h3>Thank you</h3>
              <p>
                We’ve received your details. Someone from the chorale will be in touch about the next
                rehearsal and what to expect when you visit.
              </p>
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Submit another
              </button>
            </div>
          ) : (
          <form className="apply-form" onSubmit={submit}>
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
              <span>Why do you want to join? *</span>
              <textarea
                name="motivation"
                rows="5"
                required
                placeholder="Tell us a bit about yourself and your interest."
              />
            </label>

            {/* Honeypot — see EnquiryForm. */}
            <div className="eq-trap" aria-hidden="true">
              <label>
                Do not fill this in
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            {error && (
              <p className="eq-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary apply-submit" disabled={sending}>
              {sending ? <LoadingOutlined /> : null}
              {sending ? 'Sending…' : 'Submit interest'}
              {!sending && <ArrowRightOutlined />}
            </button>

            <p className="apply-form-note">
              Your details go straight to the chorale. We use them only to reply about joining.
            </p>
          </form>
          )}
        </aside>
      </section>
    </main>
  );
};

export default Join;
