import { useState } from 'react';
import AboutSection from '../components/AboutSection';
import '../styles/about.scss';
import { desertSunrise, heroImg1, heroImg2 } from '../assets';
import { choirMembers, memberDetailFields } from '../data/about';

const About = () => {
  const [selectedMember, setSelectedMember] = useState(choirMembers[0]);

  return (
    <main className="about-page-detail">
      <section className="about-intro-panel">
        <AboutSection heroImg1={heroImg1} heroImg2={heroImg2} />

        <section className="about-story-grid">
          <article className="about-card">
            <p className="about-card-label">Our Calling</p>
            <h2>One chorale, one message, many voices.</h2>
            <p>
              Jabali Chorale exists to carry the gospel in song with warmth, discipline, and conviction. A chorale shaped by worship, close
              fellowship, and the desire to serve both church and community.
            </p>
            <p>
              We rehearse consistently, build blend across sections, and approach each performance as ministry first.
              Every arrangement is meant to be clear in message, rich in harmony, and grounded in the hope of Christ.
            </p>
          </article>

          <article className="about-card about-card-accent">
            <p className="about-card-label">What Defines Jabali</p>
            <ul className="about-points">
              <li>Christ-centered repertoire and testimony-driven performances.</li>
              <li>Balanced sections across soprano, alto, tenor, and bass.</li>
              <li>Weekly rehearsals focused on blend, diction, timing, and spiritual preparation.</li>
              <li>Performance that values reverence, clarity, and strong choral presence.</li>
            </ul>
          </article>
        </section>
      </section>

      <section className="choir-roster choir-roster-interactive">
        <div className="roster-heading">
          <div>
            <p className="about-card-label">The Chorale</p>
            <h2>Tap a face and open the member profile.</h2>
          </div>
        </div>

        <div className="member-showcase">
          <div className="avatar-cloud" aria-label="Choir member selector">
            {choirMembers.map((member) => {
              const isActive = member.name === selectedMember.name;

              return (
                <button
                  type="button"
                  key={member.name}
                  className={`avatar-badge ${isActive ? 'is-active' : ''}`}
                  onClick={() => setSelectedMember(member)}
                  aria-pressed={isActive}
                >
                  <span className="avatar-image" style={{ backgroundImage: `url(${member.photo})` }} />
                  <span className="sr-only">{member.name}</span>
                </button>
              );
            })}
          </div>

          <article className="member-profile-card">
            <div className="profile-banner" style={{ backgroundImage: `url(${selectedMember.photo})` }} />
            <div className="profile-body">
              <div className="profile-hero">
                <div className="profile-portrait-wrap">
                  <div className="profile-portrait" style={{ backgroundImage: `url(${selectedMember.photo})` }} />
                  <div className="profile-mini-avatar" style={{ backgroundImage: `url(${selectedMember.photo})` }} />
                </div>

                <div className="profile-intro">
                  <p className="profile-kicker">Jabali Chorale</p>
                  <h3>{selectedMember.name}</h3>
                  <p className="profile-summary">{selectedMember.voice} from {selectedMember.church}.</p>
                </div>
              </div>

              <div className="profile-details-grid">
                {memberDetailFields.map((field) => (
                  <div className="profile-detail" key={field.key}>
                    <p className="profile-detail-label">{field.label}</p>
                    <p className="profile-detail-value">{selectedMember[field.key]}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
};

export default About;
