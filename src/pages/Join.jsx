import { Link } from 'react-router-dom';
import '../styles/extra-pages.scss';
import { joinPageData } from '../data/join';

const Join = () => (
  <main className="extra-page join-page">
    <section className="join-hero">
      <div
        className="join-hero-copy"
        style={{
          backgroundImage: `linear-gradient(145deg, rgba(14, 23, 39, 0.92), rgba(23, 38, 64, 0.82)), url(${joinPageData.backgroundImage})`,
        }}
      >
        <p className="extra-pill light">{joinPageData.eyebrow}</p>
        <h1>{joinPageData.title}</h1>
        <p className="extra-lead">{joinPageData.lead}</p>

        <div className="join-value-pills">
          {joinPageData.values.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <aside className="join-hero-card">
        <p className="hero-card-label">Rehearsals</p>
        <strong>{joinPageData.rehearsal}</strong>
        <span>{joinPageData.rehearsalNote}</span>
      </aside>
    </section>

    <section className="join-layout">
      <div className="join-main">
        <section className="extra-card join-process-card">
          <p className="extra-pill">How It Works</p>
          <h2>What to expect after you reach out.</h2>
          <div className="step-list">
            {joinPageData.steps.map((step, index) => (
              <div className="step-row" key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="join-sidebar">
        <form className="join-form-card">
          <div className="join-form-head">
            <p className="extra-pill">Join Form</p>
            <h2>Tell us where you fit.</h2>
            <p>Share your details and the voice part or support area you would like to join.</p>
          </div>

          <label className="join-field">
            <span>Full name</span>
            <input type="text" name="fullName" placeholder="Your name" />
          </label>

          <label className="join-field">
            <span>Email</span>
            <input type="email" name="email" placeholder="you@example.com" />
          </label>

          <label className="join-field">
            <span>Phone</span>
            <input type="tel" name="phone" placeholder="+254..." />
          </label>

          <label className="join-field">
            <span>Church / fellowship</span>
            <input type="text" name="church" placeholder="Your church" />
          </label>

          <label className="join-field">
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

          <label className="join-field">
            <span>Why do you want to join?</span>
            <textarea name="motivation" rows="5" placeholder="Tell us a bit about yourself and your interest." />
          </label>

          <button type="submit" className="join-submit-btn">
            Submit Interest
          </button>

          <p className="join-form-note">
            This form is currently a layout-only form. For direct contact, use the <Link to="/contact">contact page</Link>.
          </p>
        </form>
      </aside>
    </section>
  </main>
);

export default Join;
