import {
  CalendarOutlined,
  CreditCardOutlined,
  IdcardOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import './../styles/about.scss';

const AboutSection = ({ heroImg1, heroImg2 }) => (
  <section className="about-section" id="about">
    <div className="about-inner">
      <div className="about-copy">
        <p className="about-eyebrow">Christ Founded</p>
        <h1 className="about-headline">
          About Jabali
          <span>Chorale</span>
        </h1>
        <p className="about-lead">
          We’re committed to bringing Jesus, the transforming power of the gospel, to the life of every soul 
          for a full reflection of His image without spot or wrinkle.
        </p>
        <div className="about-date">
          <div>
            <div className="about-date-main">Founded: 18 August 2022</div>
          </div>
        </div>
      </div>

      <div className="about-media">
        <div className="about-strip tall" style={{ backgroundImage: `url(${heroImg1})`, marginLeft:'1.5rem'}} />
        <div className="about-strip" style={{ backgroundImage: `url(${heroImg2})`, marginLeft:'9rem' }} />
        <div className="about-strip warm" style={{ backgroundImage: `url(${heroImg1})`, marginLeft:'5rem'}} />
      </div>
    </div>
  </section>
);

export default AboutSection;
