import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import '../styles/event-detail.scss';
import { buildCalendarUrl, formatEventDate } from '../data/events';
import { useEvent } from '../hooks/usePublicData';
import { cssUrl } from '../utils/assetPath';
import PageLoader from '../components/PageLoader';
import TicketCheckout from '../components/TicketCheckout';

const EventDetail = () => {
  const { slug } = useParams();
  const { event, loading } = useEvent(slug);
  const [activeImage, setActiveImage] = useState(null);
  // { item, kind } for the open checkout, or null.
  const [checkout, setCheckout] = useState(null);

  const closeLightbox = useCallback(() => setActiveImage(null), []);

  useEffect(() => {
    if (!activeImage) return undefined;

    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => e.key === 'Escape' && closeLightbox();
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeImage, closeLightbox]);

  // Hold the layout while the live fetch settles; only declare "not found" once
  // it's confirmed missing (no seed match and the request has returned).
  if (!event) {
    if (loading) {
      return (
        <main className="evd-page">
          <PageLoader label="Loading event…" />
        </main>
      );
    }
    return (
      <main className="evd-page section">
        <div className="shell evd-missing">
          <p className="eyebrow">Not found</p>
          <h1 className="display-md">We couldn&rsquo;t find that event.</h1>
          <Link className="btn btn-primary" to="/events">
            <ArrowLeftOutlined />
            All events
          </Link>
        </div>
      </main>
    );
  }

  const d = formatEventDate(event.date);
  const past = event.status === 'past';

  return (
    <main className="evd-page">
      <div className="shell evd-back">
        <Link className="evd-back-link" to="/events">
          <ArrowLeftOutlined />
          All events
        </Link>
      </div>

      <div className="shell evd-grid">
        <div className="evd-poster-col">
          <div className="evd-poster" style={{ backgroundImage: cssUrl(event.poster) }} role="img" aria-label={`${event.title} poster`} />
        </div>

        <div className="evd-main">
          <p className="eyebrow">{event.type}</p>
          <h1 className="display-md evd-title">{event.title}</h1>

          <dl className="evd-facts">
            <div>
              <dt><CalendarOutlined /> Date</dt>
              <dd>{d.long}</dd>
            </div>
            {event.time && (
              <div>
                <dt><ClockCircleOutlined /> Time</dt>
                <dd>{event.time}</dd>
              </div>
            )}
            <div>
              <dt><EnvironmentOutlined /> Venue</dt>
              <dd>{event.venue}</dd>
            </div>
          </dl>

          {/* Ticketing / action panel. State depends on past vs upcoming and
              whether the event is ticketed. */}
          <div className={`evd-ticket ${past ? 'is-past' : ''}`}>
            {past ? (
              <>
                <p className="evd-ticket-label">This event has passed.</p>
                {event.media.length > 0 && <p className="evd-ticket-sub">Photos from the day are below.</p>}
              </>
            ) : event.ticketed ? (
              <>
                <span className="evd-ticket-label">Ticket packages</span>

                <ul className="evd-packages">
                  {event.packages.map((pkg) => {
                    // A package with its own checkout URL links out; otherwise the
                    // card opens the in-page M-Pesa checkout.
                    const external = Boolean(pkg.url);
                    const inner = (
                      <>
                        <span className="evd-package-head">
                          <span className="evd-package-name">{pkg.name}</span>
                          <span className="evd-package-price">{pkg.price}</span>
                        </span>
                        {pkg.note && <span className="evd-package-note">{pkg.note}</span>}
                        <span className="evd-package-action">
                          Get tickets
                          <ArrowRightOutlined />
                        </span>
                      </>
                    );

                    return (
                      <li key={pkg.name}>
                        {external ? (
                          <a
                            className="evd-package"
                            href={pkg.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Get ${pkg.name} tickets, ${pkg.price}`}
                          >
                            {inner}
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="evd-package"
                            onClick={() => setCheckout({ item: pkg, kind: 'ticket' })}
                            aria-label={`Buy ${pkg.name} tickets, ${pkg.price}`}
                          >
                            {inner}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <div className="evd-ticket-price">
                <span className="evd-ticket-label">Entry</span>
                <strong>Free</strong>
              </div>
            )}

            {!past && (
              <a className="evd-calendar" href={buildCalendarUrl(event)} target="_blank" rel="noreferrer">
                <CalendarOutlined />
                Add to Google Calendar
              </a>
            )}
          </div>

          {event.about.length > 0 && (
            <div className="evd-about">
              <h2 className="evd-about-title">About this event</h2>
              {event.about.map((para) => (
                <p key={para}>{para}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {event.merch?.length > 0 && (
        <section className="section shell">
          <div className="section-head">
            <p className="eyebrow">Merchandise</p>
            <h2 className="display-md">Take something home.</h2>
          </div>

          <div className="evd-merch">
            {event.merch.map((product) => (
              <article className="evd-merch-card" key={product.name}>
                <div
                  className="evd-merch-image"
                  style={product.image ? { backgroundImage: cssUrl(product.image) } : undefined}
                />
                <div className="evd-merch-body">
                  <div className="evd-merch-top">
                    <h3 className="evd-merch-name">{product.name}</h3>
                    {/* An open-amount item has no fixed price to show. */}
                    <span className="evd-merch-price">
                      {product.openAmount?.enabled
                        ? `From KES ${Number(product.openAmount.min ?? 1).toLocaleString('en-KE')}`
                        : product.price}
                    </span>
                  </div>
                  {product.description && <p className="evd-merch-desc">{product.description}</p>}
                  {product.options?.length > 0 && (
                    <p className="evd-merch-opts">
                      {product.options.map((o) => o.name).join(' · ')} options available
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost evd-merch-buy"
                    onClick={() => setCheckout({ item: product, kind: 'merch' })}
                  >
                    {product.openAmount?.enabled ? 'Give now' : 'Buy now'}
                    <ArrowRightOutlined />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {event.media.length > 0 && (
        <section className="section shell">
          <div className="section-head">
            <p className="eyebrow">Media</p>
            <h2 className="display-md">From the event.</h2>
          </div>

          <div className="evd-media">
            {event.media.map((image, index) => (
              <button
                type="button"
                className="evd-media-tile"
                key={`${image}-${index}`}
                style={{ backgroundImage: cssUrl(image) }}
                onClick={() => setActiveImage(image)}
                aria-label={`Open photo ${index + 1} from ${event.title}`}
              />
            ))}
          </div>
        </section>
      )}

      {activeImage && (
        <div className="evd-overlay" role="presentation" onClick={closeLightbox}>
          <div className="evd-lightbox" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="evd-close" aria-label="Close photo" onClick={closeLightbox}>
              <CloseOutlined />
            </button>
            <img src={activeImage} alt="" className="evd-lightbox-image" />
          </div>
        </div>
      )}

      {checkout && (
        <TicketCheckout
          event={event}
          item={checkout.item}
          kind={checkout.kind}
          onClose={() => setCheckout(null)}
        />
      )}
    </main>
  );
};

export default EventDetail;
