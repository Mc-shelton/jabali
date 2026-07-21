import { useEffect, useRef, useState } from 'react';
import AboutSection from '../components/AboutSection';
import '../styles/about.scss';
import { heroImg1, heroImg2 } from '../assets';
import { useContent } from '../hooks/usePublicData';
import { cssUrl } from '../utils/assetPath';

const About = () => {
  const { data } = useContent('members');
  const members = data.members;
  const { data: pages } = useContent('pages');
  const story = pages.aboutStory;
  const roster = pages.roster;

  // Track the selection by name rather than by object: the roster arrives from
  // the API after first paint, so holding a member object would pin a stale one
  // (or a member an admin has since removed). An unmatched name falls back to
  // the first member.
  const [selectedName, setSelectedName] = useState(null);
  const [memberListHeight, setMemberListHeight] = useState(null);
  const profileCardRef = useRef(null);

  const foundIndex = members.findIndex((member) => member.name === selectedName);
  const selectedIndex = foundIndex === -1 ? 0 : foundIndex;
  const selectedMember = members[selectedIndex] ?? null;

  // Keep the portrait rail exactly as tall as the profile card beside it, so the
  // two columns bottom out together instead of one dangling past the other.
  useEffect(() => {
    const card = profileCardRef.current;

    if (!card || typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 961px)');

    const syncHeight = () => {
      if (!mediaQuery.matches) {
        setMemberListHeight(null);
        return;
      }

      setMemberListHeight(card.offsetHeight);
    };

    syncHeight();

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncHeight) : null;

    resizeObserver?.observe(card);
    mediaQuery.addEventListener?.('change', syncHeight);
    window.addEventListener('resize', syncHeight);

    return () => {
      resizeObserver?.disconnect();
      mediaQuery.removeEventListener?.('change', syncHeight);
      window.removeEventListener('resize', syncHeight);
    };
  }, [selectedMember]);

  return (
    <main className="about-page">
      <AboutSection heroImg1={heroImg1} heroImg2={heroImg2} showCta={false} />

      <section className="about-story section">
        <div className="shell about-story-grid">
          <article className="story-panel reveal">
            <p className="eyebrow">{story.eyebrow}</p>
            <h2 className="display-md">{story.title}</h2>
            {story.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>

          <article className="story-panel story-panel-dark reveal">
            <p className="eyebrow on-dark">{story.pointsEyebrow}</p>
            <ul className="story-points">
              {story.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="roster section">
        <div className="shell">
          <div className="section-head reveal">
            <p className="eyebrow">{roster.eyebrow}</p>
            <h2 className="display-md">{roster.title}</h2>
            <p className="section-head-note">
              {members.length} {roster.note}
            </p>
          </div>

          {selectedMember && (
          <div className="member-showcase reveal">
            <div
              className="member-rail"
              aria-label="Choir member selector"
              style={memberListHeight ? { maxHeight: `${memberListHeight}px` } : undefined}
            >
              {members.map((member) => {
                const isActive = member.name === selectedMember.name;

                return (
                  <button
                    type="button"
                    key={member.name}
                    className={`member-thumb ${isActive ? 'is-active' : ''}`}
                    onClick={() => setSelectedName(member.name)}
                    aria-pressed={isActive}
                  >
                    <span className="member-thumb-image" style={{ backgroundImage: cssUrl(member.photo) }} />
                    <span className="sr-only">{member.name}</span>
                  </button>
                );
              })}
            </div>

            <article className="member-card" ref={profileCardRef}>
              <div className="member-card-photo" style={{ backgroundImage: cssUrl(selectedMember.photo) }} />

              <div className="member-card-body">
                <p className="eyebrow">
                  {String(selectedIndex + 1).padStart(2, '0')} / {String(members.length).padStart(2, '0')}
                </p>
                <h3 className="member-card-name">{selectedMember.name}</h3>
                <p className="member-card-role">{selectedMember.voice}</p>
              </div>
            </article>
          </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default About;
