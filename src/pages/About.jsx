import AboutSection from '../components/AboutSection';
import '../styles/about.scss';
import heroImg1 from '../../public/images/jc_1.jpeg';
import heroImg2 from '../../public/images/jc_2.jpeg';
import desertSunrise from '../../public/images/beautiful-scenery-pinnacle-sunrise-desert.jpg';

const choirMembers = [
  { name: 'Nia Muthoni', voice: 'Soprano', photo: heroImg1 },
  { name: 'Grace Mwende', voice: 'Soprano', photo: heroImg2 },
  { name: 'Joy Achieng', voice: 'Alto', photo: desertSunrise },
  { name: 'Lydia Wairimu', voice: 'Alto', photo: heroImg1 },
  { name: 'Mercy Atieno', voice: 'Mezzo-Soprano', photo: heroImg2 },
  { name: 'Brian Kibet', voice: 'Tenor', photo: heroImg1 },
  { name: 'Sammy Kariuki', voice: 'Tenor', photo: heroImg2 },
  { name: 'Daniel Mwangi', voice: 'Tenor', photo: desertSunrise },
  { name: 'Peter Okello', voice: 'Baritone', photo: heroImg1 },
  { name: 'David Kimani', voice: 'Bass', photo: heroImg2 },
  { name: 'Joseph Otieno', voice: 'Bass', photo: desertSunrise },
  { name: 'Faith Njeri', voice: 'Alto', photo: heroImg1 }
];

const About = () => (
  <main className="about-page-detail">
    <AboutSection heroImg1={heroImg1} heroImg2={heroImg2} />

    <section className="about-story-grid">
      <article className="about-card">
        <p className="about-card-label">Our Calling</p>
        <h2>One choir, one message, many voices.</h2>
        <p>
          Jabali Chorale exists to carry the gospel in song with warmth, discipline, and conviction. What begins on
          the home page as a short introduction opens here into the fuller story: a choir shaped by worship, close
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
          <li>Balanced sections across soprano, alto, tenor, baritone, and bass.</li>
          <li>Weekly rehearsals focused on blend, diction, timing, and spiritual preparation.</li>
          <li>Stage presentation that values reverence, clarity, and strong choral presence.</li>
        </ul>
      </article>
    </section>

    <section className="choir-roster">
      <div className="roster-heading">
        <div>
          <p className="about-card-label">The Choir</p>
          <h2>Members, voices, and portraits.</h2>
        </div>
        {/* <p>
          Each card shows a choir member with a visible portrait and voice part so the full ensemble is represented on
          the `/about` page.
        </p> */}
      </div>

      <div className="roster-grid">
        {choirMembers.map((member) => (
          <article className="roster-card" key={member.name}>
            <div className="roster-portrait" style={{ backgroundImage: `url(${member.photo})` }} />
            <div className="roster-meta">
              <h3>{member.name}</h3>
              <p>{member.voice}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  </main>
);

export default About;
