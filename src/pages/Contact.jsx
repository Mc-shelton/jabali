import '../styles/extra-pages.scss';
import { contactIntro, contactItems } from '../data/contact';

const Contact = () => (
  <main className="extra-page contact-page">
    <section className="contact-shell">
      <div className="contact-copy">
        <p className="extra-pill">Contact</p>
        <h1>{contactIntro.title}</h1>
        <p className="extra-lead">
          {contactIntro.lead}
        </p>
      </div>

      <div className="contact-panel">
        {contactItems.map((item) => (
          <div className="contact-row" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <p className="contact-note">
        {contactIntro.note}
      </p>
    </section>
  </main>
);

export default Contact;
