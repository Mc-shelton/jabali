import { useState } from 'react';
import { sendEnquiry } from '../lib/api';
import { generateLead } from '../lib/analytics';

// Submit state for any form that posts to api/enquiries.php.
//
// The contact page and the join page ask for different things and lay them out
// differently, but the submit behaviour — disable, send, report, reset — must be
// identical, and neither page should own it. Field markup stays with each page;
// this owns only what happens after the button is pressed.
//
// A callback ref that brings its element into view as it mounts.
//
// The confirmation panel replaces a form taller than a phone screen, so it is
// shorter than what it replaced: the page stays scrolled where the middle of
// the form used to be, which after submitting is somewhere past the end of the
// confirmation — the footer, usually. The person sees nothing happen and sends
// the message again.
export const revealOnMount = (el) => {
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
};

// status: 'idle' | 'sending' | 'sent' | 'error'
export const useEnquirySubmit = ({ topic, mapFields }) => {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (status === 'sending') return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name) => String(data.get(name) ?? '').trim();

    setStatus('sending');
    setError('');

    const resolvedTopic = typeof topic === 'function' ? topic(value) : topic;

    try {
      await sendEnquiry({
        topic: resolvedTopic,
        // The honeypot travels under its own name on every form, so the server
        // check is one rule rather than one per page.
        website: value('website'),
        ...mapFields(value),
      });
      setStatus('sent');
      generateLead(resolvedTopic); // GA4 lead — contact / join form submitted
      form.reset();
    } catch (err) {
      // A network failure and a 422 both land here; the server's own wording is
      // the more useful of the two when it exists.
      setError(err.message || 'Your message could not be sent. Please try again.');
      setStatus('error');
    }
  };

  // Lets the page offer "send another" without remounting the form.
  const reset = () => {
    setStatus('idle');
    setError('');
  };

  return { status, error, submit, reset, sending: status === 'sending' };
};

export default useEnquirySubmit;
