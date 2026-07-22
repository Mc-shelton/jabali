import { useEffect, useState } from 'react';
import { ArrowRightOutlined, CheckCircleFilled, LoadingOutlined } from '@ant-design/icons';
import '../styles/enquiry-form.scss';
import { useEnquirySubmit, revealOnMount } from '../hooks/useEnquirySubmit';

// The topic values here are the ones enquiries.php recognises. An unknown value
// is filed as 'general' server-side rather than rejected, so the two can drift
// without dropping anyone's message — but they shouldn't.
export const ENQUIRY_TOPICS = [
  {
    value: 'booking',
    label: 'Book the chorale',
    blurb: 'Invite us to a service, programme, camp meeting, or community event.',
  },
  {
    value: 'partnership',
    label: 'Partnership',
    blurb: 'Sponsorship, collaboration, or working together on a production.',
  },
  {
    value: 'membership',
    label: 'Join the chorale',
    blurb: 'Sing with us, or serve on the support team.',
  },
  {
    value: 'media',
    label: 'Media & press',
    blurb: 'Interviews, coverage, and requests for material.',
  },
  {
    value: 'general',
    label: 'Something else',
    blurb: 'Anything that doesn’t fit the boxes above.',
  },
];

const isValidTopic = (value) => ENQUIRY_TOPICS.some((t) => t.value === value);

// Which extra questions a topic warrants. Asking a booking enquiry for a date
// and venue up front saves an entire round trip; asking everyone for them turns
// a short form into a chore.
const wantsEventDetails = (topic) => topic === 'booking' || topic === 'partnership';
const wantsOrganisation = (topic) => topic !== 'general';

const EnquiryForm = ({ initialTopic = 'booking' }) => {
  const [topic, setTopic] = useState(isValidTopic(initialTopic) ? initialTopic : 'booking');

  // Arriving from /partnerships or /events carries the reason in the URL, and a
  // later navigation between those links must move the selection with it.
  useEffect(() => {
    if (isValidTopic(initialTopic)) setTopic(initialTopic);
  }, [initialTopic]);

  const { status, error, submit, reset, sending } = useEnquirySubmit({
    topic: () => topic,
    mapFields: (value) => ({
      name: value('name'),
      email: value('email'),
      phone: value('phone'),
      organisation: value('organisation'),
      eventDate: value('eventDate'),
      location: value('location'),
      message: value('message'),
    }),
  });

  const active = ENQUIRY_TOPICS.find((t) => t.value === topic);

  if (status === 'sent') {
    return (
      <div className="eq-form eq-done" role="status" ref={revealOnMount}>
        <CheckCircleFilled className="eq-done-icon" />
        <h3>Message sent</h3>
        <p>
          Thank you — we’ve got it, and we’ll reply to the email address you gave us. Bookings and
          partnership enquiries usually hear back within a few days.
        </p>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className="eq-form" onSubmit={submit} noValidate={false}>
      <div className="eq-head">
        <p className="eyebrow">Send A Message</p>
        <h2 className="display-md">Tell us what you have in mind.</h2>
        <p className="eq-head-note">
          Bookings, partnerships, media, or membership — this form reaches the chorale directly.
        </p>
      </div>

      <fieldset className="eq-topics">
        <legend className="eq-label">What is this about?</legend>
        <div className="eq-topic-grid">
          {ENQUIRY_TOPICS.map((option) => (
            <label
              className={`eq-topic ${topic === option.value ? 'is-on' : ''}`}
              key={option.value}
            >
              <input
                type="radio"
                name="topic"
                value={option.value}
                checked={topic === option.value}
                onChange={() => setTopic(option.value)}
              />
              <span className="eq-topic-label">{option.label}</span>
            </label>
          ))}
        </div>
        {active && <p className="eq-topic-blurb">{active.blurb}</p>}
      </fieldset>

      <div className="eq-row">
        <label className="eq-field">
          <span className="eq-label">Your name *</span>
          <input type="text" name="name" placeholder="Full name" autoComplete="name" required />
        </label>

        <label className="eq-field">
          <span className="eq-label">Email *</span>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
      </div>

      <div className="eq-row">
        <label className="eq-field">
          <span className="eq-label">Phone</span>
          <input type="tel" name="phone" placeholder="+254…" autoComplete="tel" />
        </label>

        {wantsOrganisation(topic) && (
          <label className="eq-field">
            <span className="eq-label">
              {topic === 'membership' ? 'Church / fellowship' : 'Organisation / church'}
            </span>
            <input type="text" name="organisation" placeholder="Optional" autoComplete="organization" />
          </label>
        )}
      </div>

      {wantsEventDetails(topic) && (
        <div className="eq-row">
          <label className="eq-field">
            <span className="eq-label">Date in mind</span>
            <input type="text" name="eventDate" placeholder="e.g. 14 Dec, or flexible" />
          </label>

          <label className="eq-field">
            <span className="eq-label">Location / venue</span>
            <input type="text" name="location" placeholder="Where it would happen" />
          </label>
        </div>
      )}

      <label className="eq-field">
        <span className="eq-label">Message *</span>
        <textarea
          name="message"
          rows="6"
          required
          placeholder={
            wantsEventDetails(topic)
              ? 'Tell us about the event, the audience, and what you’d like the chorale to do.'
              : 'A few lines about what you’re after.'
          }
        />
      </label>

      {/* Honeypot: hidden from people, irresistible to bots. */}
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

      <button type="submit" className="btn btn-primary eq-submit" disabled={sending}>
        {sending ? <LoadingOutlined /> : null}
        {sending ? 'Sending…' : 'Send message'}
        {!sending && <ArrowRightOutlined />}
      </button>

      <p className="eq-note">
        We use your details only to reply to this message. Nothing is shared or added to a mailing
        list.
      </p>
    </form>
  );
};

export default EnquiryForm;
