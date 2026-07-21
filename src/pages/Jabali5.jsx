import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import '../styles/jabali5.scss';
import { useJabali5 } from '../hooks/usePublicData';
import { cssUrl } from '../utils/assetPath';
import PageLoader from '../components/PageLoader';

// Render `children` as the right element for a link target: an internal router
// Link for site paths, a new-tab anchor for external URLs, and a plain span when
// there's no target at all (a manual chapter with no link, say).
const SmartLink = ({ to, className, children, tabIndex }) => {
  if (!to) {
    return (
      <span className={className} tabIndex={tabIndex}>
        {children}
      </span>
    );
  }
  if (/^https?:\/\//i.test(to)) {
    return (
      <a className={className} href={to} target="_blank" rel="noreferrer" tabIndex={tabIndex}>
        {children}
      </a>
    );
  }
  return (
    <Link className={className} to={to} tabIndex={tabIndex}>
      {children}
    </Link>
  );
};

const Jabali5 = () => {
  const { tag, eyebrow, title, intro, chapters, endCard = {}, loading } = useJabali5();
  const doneCount = chapters.filter((c) => c.done).length;
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  // Which chapter is centred in the rail right now — drives the timeline and
  // the arrow disabled states. Read straight off native scroll, rAF-throttled.
  const syncActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const centre = track.scrollLeft + track.clientWidth / 2;
    const panels = Array.from(track.querySelectorAll('.j5-chapter'));
    let nearest = 0;
    let best = Infinity;

    panels.forEach((panel, index) => {
      const mid = panel.offsetLeft + panel.offsetWidth / 2;
      const dist = Math.abs(mid - centre);
      if (dist < best) {
        best = dist;
        nearest = index;
      }
    });

    setActive(nearest);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncActive);
    };

    track.addEventListener('scroll', onScroll, { passive: true });
    syncActive();

    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
    };
  }, [syncActive]);

  const scrollToChapter = useCallback((index) => {
    const track = trackRef.current;
    if (!track) return;

    const panel = track.querySelectorAll('.j5-chapter')[index];
    if (!panel) return;

    track.scrollTo({
      left: panel.offsetLeft - (track.clientWidth - panel.offsetWidth) / 2,
      behavior: 'smooth',
    });
  }, []);

  const move = useCallback(
    (delta) => scrollToChapter(Math.min(chapters.length - 1, Math.max(0, active + delta))),
    [active, scrollToChapter]
  );

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }
  };

  if (loading) {
    return (
      <main className="j5-page">
        <PageLoader label="Loading the Jabali @5 journey…" />
      </main>
    );
  }

  return (
    <main className="j5-page">
      <div className="j5-glow" aria-hidden="true" />

      <header className="j5-intro shell">
        <p className="j5-eyebrow">{eyebrow}</p>
        <h1 className="j5-wordmark">{tag}</h1>
        <p className="j5-title">{title}</p>
        <p className="j5-lead">{intro}</p>

        <div className="j5-progress" aria-hidden="true">
          <span className="j5-progress-track">
            <span
              className="j5-progress-fill"
              style={{ width: `${(doneCount / chapters.length) * 100}%` }}
            />
          </span>
          <span className="j5-progress-label">
            {doneCount} of {chapters.length} chapters complete
          </span>
        </div>
      </header>

      {/* Timeline: click a node to jump; reflects the centred chapter. */}
      <nav className="j5-timeline shell" aria-label="Journey chapters">
        <span className="j5-timeline-line" aria-hidden="true" />
        {chapters.map((chapter, index) => (
          <button
            type="button"
            key={chapter.number}
            className={`j5-node ${chapter.done ? 'is-done' : 'is-upcoming'} ${
              index === active ? 'is-active' : ''
            }`}
            onClick={() => scrollToChapter(index)}
            aria-label={`Chapter ${chapter.number}: ${chapter.heading}`}
            aria-current={index === active ? 'true' : undefined}
          >
            <span className="j5-node-dot" />
            <span className="j5-node-num">{chapter.number}</span>
          </button>
        ))}
      </nav>

      <div
        className="j5-track"
        ref={trackRef}
        tabIndex={0}
        role="region"
        aria-label="Journey — scroll horizontally"
        onKeyDown={onKeyDown}
      >
        {chapters.map((chapter) => (
          <article className="j5-chapter" key={chapter.number}>
            <span className="j5-ghost" aria-hidden="true">
              {chapter.number}
            </span>

            <SmartLink className="j5-card" to={chapter.href}>
              <span className="j5-card-photo" style={{ backgroundImage: cssUrl(chapter.poster) }}>
                <span className={`j5-status ${chapter.done ? 'is-done' : 'is-upcoming'}`}>
                  {chapter.done
                    ? 'Chapter complete'
                    : chapter.dateLabel
                    ? `Coming · ${chapter.dateLabel}`
                    : 'Coming soon'}
                </span>
              </span>

              <span className="j5-card-body">
                <span className="j5-kicker">
                  Chapter {chapter.number}
                  {chapter.dateLabel ? ` · ${chapter.dateLabel}` : ''}
                </span>
                <span className="j5-heading">{chapter.heading}</span>
                <span className="j5-tale">{chapter.tale}</span>

                {(chapter.eventTitle || chapter.href) && (
                  <span className="j5-event">
                    <span className="j5-event-meta">
                      {chapter.type && <span className="j5-event-type">{chapter.type}</span>}
                      {chapter.eventTitle && (
                        <span className="j5-event-title">{chapter.eventTitle}</span>
                      )}
                    </span>
                    {chapter.href && (
                      <span className="j5-event-cta">
                        {chapter.done ? 'Relive it' : 'See the event'}
                        <ArrowRightOutlined />
                      </span>
                    )}
                  </span>
                )}
              </span>
            </SmartLink>
          </article>
        ))}

        <div className="j5-end" aria-hidden="true">
          {endCard.kicker && <p className="j5-end-kicker">{endCard.kicker}</p>}
          {endCard.line && <p className="j5-end-line">{endCard.line}</p>}
          {endCard.ctaLabel && endCard.ctaHref && (
            <SmartLink className="btn btn-light" to={endCard.ctaHref} tabIndex={-1}>
              {endCard.ctaLabel}
              <ArrowRightOutlined />
            </SmartLink>
          )}
        </div>
      </div>

      <div className="j5-controls shell">
        <div className="j5-arrows">
          <button
            type="button"
            className="j5-arrow"
            onClick={() => move(-1)}
            disabled={active === 0}
            aria-label="Previous chapter"
          >
            <ArrowLeftOutlined />
          </button>
          <button
            type="button"
            className="j5-arrow"
            onClick={() => move(1)}
            disabled={active === chapters.length - 1}
            aria-label="Next chapter"
          >
            <ArrowRightOutlined />
          </button>
        </div>

        <p className="j5-count">
          <span>{String(active + 1).padStart(2, '0')}</span> / {String(chapters.length).padStart(2, '0')}
        </p>
      </div>
    </main>
  );
};

export default Jabali5;
