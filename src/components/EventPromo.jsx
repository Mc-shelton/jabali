import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CloseOutlined, ArrowRightOutlined } from '@ant-design/icons';
import '../styles/promo.scss';
import { useContent, useEvents } from '../hooks/usePublicData';
import { formatEventDate } from '../data/events';

// The event pop-up: shown once when someone arrives, over whatever page they
// landed on.
//
// ---------------------------------------------------------------------------
// "Once per visit, but not once per session" — how this works without storage
// ---------------------------------------------------------------------------
// The requirement has two halves that sound contradictory:
//
//   1. It must come back on a reload. So nothing may be persisted — no
//      localStorage, no sessionStorage, no cookie. A returning visitor, or the
//      same visitor pressing refresh, sees it again.
//   2. It must NOT come back as they move around the site. Seeing it on the
//      home page and then again on About would be intolerable.
//
// The distinction those two need is "a new document load" versus "a navigation
// inside the app I already loaded" — and the module-level variable below is
// exactly that, for free. A module's scope is created when the bundle is
// evaluated and destroyed when the document goes away:
//
//   • Home → About via a nav link is client-side routing. No new document, so
//     this module is never re-evaluated, `dismissed` stays true, nothing shows.
//     `App` is the route layout and does not unmount, so this component isn't
//     even remounted.
//   • Pressing reload, or opening /about directly from a link or a bookmark,
//     builds a new document. New module scope, `dismissed` is false again, and
//     the pop-up shows — which is the intent: that IS a fresh arrival.
//
// So the state lives for precisely one page load, which is the unit the
// requirement is actually about. No storage to expire, nothing to clean up, and
// no way for it to get stuck "already seen" on someone's machine.
let dismissedThisLoad = false;

const EventPromo = () => {
  const location = useLocation();
  const { data: promo } = useContent('promo');
  const { upcoming, past } = useEvents();

  // Read the module flag as the initial value rather than checking it in an
  // effect: under StrictMode the component mounts, unmounts and mounts again in
  // development, and anything that consumed a one-shot flag on mount would be
  // spent by the second mount and never render.
  const [dismissed, setDismissed] = useState(dismissedThisLoad);

  const close = () => {
    dismissedThisLoad = true;
    setDismissed(true);
  };

  const event = promo?.enabled
    ? [...(upcoming ?? []), ...(past ?? [])].find((e) => e.slug === promo.eventSlug)
    : null;

  // Already looking at the thing being advertised — a poster for this page, on
  // top of this page, is just an obstacle.
  const onItsOwnPage = event ? location.pathname === `/events/${event.slug}` : false;

  const open = Boolean(event) && !dismissed && !onItsOwnPage;

  // Escape to close, and hold the page still while it's up.
  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  // Everything but the event itself is optional, so an admin can promote
  // something by picking it and switching it on.
  const image = promo.image || event.poster;
  const headline = promo.headline || event.title;
  const blurb = promo.blurb || event.summary || '';
  const ctaLabel = promo.ctaLabel || 'See the event';

  return (
    <div className="promo-overlay" role="presentation" onClick={close}>
      <div
        className="promo-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="promo-close" onClick={close} aria-label="Close">
          <CloseOutlined />
        </button>

        {/* Decorative: the headline beside it already carries the same
            information, so alt text here would just be read out twice. */}
        {image && (
          <div className="promo-media">
            <img src={image} alt="" />
          </div>
        )}

        <div className="promo-body">
          <p className="eyebrow">{event.type || 'Upcoming'}</p>
          <h2 className="promo-title" id="promo-title">
            {headline}
          </h2>

          <dl className="promo-meta">
            {event.date && (
              <div>
                <dt>Date</dt>
                <dd>{formatEventDate(event.date).long}</dd>
              </div>
            )}
            {event.venue && (
              <div>
                <dt>Venue</dt>
                <dd>{event.venue}</dd>
              </div>
            )}
          </dl>

          {blurb && <p className="promo-blurb">{blurb}</p>}

          <div className="promo-actions">
            <Link className="btn btn-primary" to={`/events/${event.slug}`} onClick={close}>
              {ctaLabel}
              <ArrowRightOutlined />
            </Link>
            <button type="button" className="btn btn-ghost" onClick={close}>
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventPromo;
