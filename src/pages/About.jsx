import GalleryMarquee from '../components/GalleryMarquee';
import '../styles/about.scss';
import heroImg1 from '../../public/images/jc_1.jpeg';
import heroImg2 from '../../public/images/jc_2.jpeg';
import desertSunrise from '../../public/images/beautiful-scenery-pinnacle-sunrise-desert.jpg';

const galleryImages = [heroImg1, heroImg2, desertSunrise, heroImg2, heroImg1];

const members = [
  { name: 'Nia Muthoni', role: 'Artistic Director', voice: 'Soprano', photo: heroImg2 },
  { name: 'Brian Kibet', role: 'Choirmaster', voice: 'Tenor', photo: heroImg1 },
  { name: 'Lydia Wairimu', role: 'Section Leader', voice: 'Alto' },
  { name: 'Peter Okello', role: 'Percussion Lead', voice: 'Baritone' },
  { name: 'Joy Achieng', role: 'Vocal Coach', voice: 'Alto', photo: desertSunrise },
  { name: 'David Kimani', role: 'Arranger', voice: 'Bass' },
  { name: 'Grace Mwende', role: 'Logistics & Care', voice: 'Soprano' },
  { name: 'Sammy Kariuki', role: 'Tenor Section', voice: 'Tenor' }
];

const gradients = [
  'linear-gradient(135deg, #fcd34d, #f97316)',
  'linear-gradient(135deg, #60a5fa, #2563eb)',
  'linear-gradient(135deg, #f472b6, #db2777)',
  'linear-gradient(135deg, #34d399, #059669)',
  'linear-gradient(135deg, #a78bfa, #7c3aed)',
  'linear-gradient(135deg, #facc15, #eab308)',
  'linear-gradient(135deg, #fb7185, #f43f5e)',
  'linear-gradient(135deg, #38bdf8, #0ea5e9)'
];

const About = () => (
  <main className="about-page">
    <section className="about-hero-card">
      <div className="hero-copy">
        <p className="pill">Since 18 August 2022</p>
        <h1>Jabali Chorale</h1>
        <p className="lead">
          A collective of singers, percussionists, and storytellers carrying the hope of the gospel through vibrant
          African choral traditions. Every note, every harmony, is crafted to lift weary hearts and build community.
        </p>
        <div className="hero-stats">
          <div>
            <span className="stat-number">20</span>
            <span className="stat-label">vocalists</span>
          </div>
          <div>
            <span className="stat-number">3</span>
            <span className="stat-label">countries toured</span>
          </div>
          <div>
            <span className="stat-number">12</span>
            <span className="stat-label">original works</span>
          </div>
        </div>
      </div>
      <div className="hero-gallery">
        <div className="hero-tile" style={{ backgroundImage: `url(${heroImg1})` }} />
        <div className="hero-tile offset" style={{ backgroundImage: `url(${heroImg2})` }} />
        <div className="hero-tag">Joy · Justice · Storytelling</div>
      </div>
    </section>

    <section className="story-panel">
      <div>
        <p className="pill">About Jabali</p>
        <h2>Why we gather</h2>
        <p className="body-text">
          Jabali means “rock” in Swahili. We began as a small prayer circle that sang together after worship nights,
          realizing that harmonies could reach neighbors long before sermons did. What started as five friends now
          moves as a family of twenty, fusing tight vocal stacks with hand drums, mbira, and movement.
        </p>
        <p className="body-text">
          We rehearse weekly, mentor youth choirs, and commission Kenyan composers to tell stories of courage,
          lament, and resurrection. Our sets weave Kiswahili spirituals, contemporary gospel, and bold new originals
          written in-house.
        </p>
      </div>
      <div className="timeline">
        <div className="timeline-item">
          <span className="dot" />
          <div>
            <p className="timeline-year">2020</p>
            <p className="timeline-copy">Five friends gather after church to sing for hospital outreaches.</p>
          </div>
        </div>
        <div className="timeline-item">
          <span className="dot" />
          <div>
            <p className="timeline-year">2022</p>
            <p className="timeline-copy">Officially launch as Jabali Chorale; first sold-out concert in Nairobi.</p>
          </div>
        </div>
        <div className="timeline-item">
          <span className="dot" />
          <div>
            <p className="timeline-year">2023</p>
            <p className="timeline-copy">Release 12 original arrangements and host free school workshops.</p>
          </div>
        </div>
        <div className="timeline-item">
          <span className="dot" />
          <div>
            <p className="timeline-year">2024</p>
            <p className="timeline-copy">Regional tour across East Africa with community choir collaborations.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="gallery-block">
      <div className="section-header">
        <p className="pill">Gallery</p>
        <div>
          <h3>Moments we hold onto</h3>
          <p className="body-text">Rehearsal nights, festival stages, and the quiet prayers in between.</p>
        </div>
      </div>
      <GalleryMarquee images={galleryImages} />
    </section>

    <section className="team-block">
      <div className="section-header">
        <p className="pill">The family</p>
        <div>
          <h3>Faces and voices</h3>
          <p className="body-text">Meet the people shaping the Jabali sound.</p>
        </div>
      </div>
      <div className="member-grid">
        {members.map((member, idx) => {
          const initials = member.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const bgStyle = member.photo
            ? { backgroundImage: `url(${member.photo})` }
            : { background: gradients[idx % gradients.length] };

          return (
            <article className="member-card" key={member.name}>
              <div className={`member-headshot ${member.photo ? 'has-photo' : ''}`} style={bgStyle}>
                {!member.photo && <span className="initials">{initials}</span>}
              </div>
              <div className="member-meta">
                <p className="member-name">{member.name}</p>
                <p className="member-role">{member.role}</p>
                <p className="member-voice">{member.voice}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>

    <section className="newsletter-cta">
      <div>
        <p className="pill">Stay in tune</p>
        <h3>Subscribe to our newsletter</h3>
        <p className="body-text">
          Monthly notes with behind-the-scenes stories, new music drops, and early access to tickets.
        </p>
      </div>
      <form className="cta-form" onSubmit={(e) => e.preventDefault()}>
        <input type="email" name="email" placeholder="Email address" required />
        <button type="submit">Subscribe</button>
      </form>
    </section>
  </main>
);

export default About;
