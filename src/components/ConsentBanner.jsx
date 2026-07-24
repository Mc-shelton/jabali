import { useEffect, useState } from 'react';
import '../styles/consent.scss';
import { analyticsEnabled } from '../lib/analytics';
import { consentDecision, setConsent } from '../lib/consent';

// A one-time cookie notice. Shows only when analytics is actually configured
// (there is no point asking for consent we'd never use) and the visitor hasn't
// yet chosen. Accepting switches GA/Clarity on; declining is remembered so we
// don't ask again.
const ConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (analyticsEnabled && consentDecision() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const decide = (granted) => {
    setConsent(granted);
    setVisible(false);
  };

  return (
    <div className="consent" role="dialog" aria-live="polite" aria-label="Cookie notice">
      <p className="consent-text">
        We use cookies to understand how the site is used, so we can make it better.
        Nothing is shared that identifies you.
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-ghost consent-decline" onClick={() => decide(false)}>
          Decline
        </button>
        <button type="button" className="btn btn-primary consent-accept" onClick={() => decide(true)}>
          Accept
        </button>
      </div>
    </div>
  );
};

export default ConsentBanner;
