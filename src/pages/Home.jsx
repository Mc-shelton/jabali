import { useEffect, useState } from 'react';
import {
  InstagramOutlined,
  TikTokOutlined,
  YoutubeOutlined,
  TwitterOutlined,
  WhatsAppOutlined,
  AppleOutlined,
  CloudOutlined,
  PlayCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import './../styles/home.scss';
import heroImg1 from '../../public/images/jc_1.jpeg';
import heroImg2 from '../../public/images/jc_2.jpeg';
import jcLogo from '../../public/graphics/jc_logo_nopg.png';
import AboutSection from '../components/AboutSection';
import RecentRecords from '../components/RecentRecords';
import GalleryMarquee from '../components/GalleryMarquee';
import docoreImg from '../../public/graphics/docore.jpg';
import mictrackImg from '../../public/graphics/mictrack.png';
import headphonesImg from '../../public/graphics/headphones.png';

const Home = () => (
  (() => {
    const images = [heroImg1, heroImg2];
    const shows = [
      { title: 'Sunset Echoes', venue: 'Harbor Arena', date: '12 Aug 2024' },
      { title: 'Neon Nights', venue: 'Skyline Dome', date: '27 Sep 2024' },
      { title: 'Aurora Pulse', venue: 'North Field', date: '15 Nov 2024' },
    ];
    const loopShows = [...shows, ...shows];
    const [activeIdx, setActiveIdx] = useState(0);

    useEffect(() => {
      const id = setInterval(() => {
        setActiveIdx((prev) => (prev + 1) % images.length);
      }, 16000);
      return () => clearInterval(id);
    }, [images.length]);

    return (
      <>
        <div className="sun-backdrop" aria-hidden="true" />
        <div className="home-page">
          <div className="hero-banner">
          <div className="hero-frames">
            {images.map((img, idx) => (
              <div
                key={img}
                className={`hero-frame ${idx === activeIdx ? 'is-active' : ''}`}
                style={{ backgroundImage: `url(${img})` }}
              />
            ))}
          </div>

          <div className="sun-glow" />
          <div className="frost" />

          <header className="hero-nav">
            <div className="hero-nav-inner">
              <div className="brand">Jabali Chorale</div>
              {/* <form className="search">
                <input type="search" placeholder="Search here" aria-label="Search festivals" />
                <button type="submit" aria-label="Search">🔍</button>
              </form> */}
              {/* <div className="logo-mark" style={{ '--logo-url': `url(${jcLogo})`}} aria-label="Jabali logo" /> */}
            </div>
          </header>

          <div className="hero-grid">
              <div className="logo-mark"></div>
            <div className="copy">
              {/* <p className="eyebrow">Music Concert</p> */}
              <h1>
                Founded <span>Music.</span>
              </h1>
              <p className="lead">
                The melody of song, poured forth from many hearts in clear, distinct utterance,
                 is one of God’s instrumentalities in the work of saving souls. 
              </p>
              <button className="primary-cta">About Jabali  <ArrowRightOutlined style={{marginLeft:'15px'}}/></button>

              <div className="socials">
                <a href="https://instagram.com" aria-label="Instagram" className="social-pill ig">
                  <InstagramOutlined />
                </a>
                <a href="https://www.tiktok.com" aria-label="TikTok" className="social-pill tt">
                  <TikTokOutlined />
                </a>
                <a href="https://www.youtube.com" aria-label="YouTube" className="social-pill yt">
                  <YoutubeOutlined />
                </a>
                <a href="https://x.com" aria-label="X (Twitter)" className="social-pill x">
                  <TwitterOutlined />
                </a>
                <a href="https://www.whatsapp.com" aria-label="WhatsApp" className="social-pill wa">
                  <WhatsAppOutlined />
                </a>
              </div>
            </div>

            <div className="promo-card">
              <div
                className="promo-cover"
                style={{
                  backgroundImage: `url(${heroImg2})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="pm-cover-overlay">
                  <button className="play-btn" aria-label="Play new release">
                    <PlayCircleOutlined />
                  </button>
                </div>
              </div>
              <div className="promo-details">
                <p className="promo-tag">New Release</p>
                <h3 className="promo-title">Ni Kazi Nzuri</h3>
                <p className="promo-artist">Jabali Chorale · Single</p>
                <div className="promo-progress">
                  <span className="progress-bar">
                    <span className="progress-fill" />
                  </span>
                  <div className="timecode">
                    <span>0:42</span>
                    <span>3:18</span>
                  </div>
                </div>
                <div className="promo-platforms">
                  <a href="https://spotify.com" aria-label="Spotify" className="promo-pill">
                    <span className="platform-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.55 13.46c-.18.3-.56.4-.86.22-2.36-1.44-5.33-1.76-8.83-.94a.64.64 0 0 1-.3-1.24c3.8-.92 7.14-.55 9.78 1.03.3.18.4.56.23.86zm1.2-2.68c-.22.35-.69.46-1.05.24-2.7-1.64-6.82-2.11-10-1.13a.74.74 0 1 1-.4-1.42c3.52-.99 8.02-.47 11.12 1.39.36.22.48.69.25 1.04zm.1-2.8c-3.23-1.92-8.6-2.1-11.7-1.13a.85.85 0 1 1-.46-1.63c3.48-1 9.35-.76 13 1.4a.85.85 0 0 1-.84 1.46z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span className="platform-label">Spotify</span>
                  </a>
                  <a href="https://music.youtube.com" aria-label="YouTube Music" className="promo-pill">
                    <YoutubeOutlined />
                    <span className="platform-label">YT Music</span>
                  </a>
                  <a href="https://music.apple.com" aria-label="Apple Music" className="promo-pill">
                    <AppleOutlined />
                    <span className="platform-label">Apple</span>
                  </a>
                  <a href="https://soundcloud.com" aria-label="SoundCloud" className="promo-pill">
                    <CloudOutlined />
                    <span className="platform-label">SoundCloud</span>
                  </a>
                </div>
              </div>
            </div>
            <div className="promo-card" style={{
              bottom:'-155px'
            }}>
              <div
                className="promo-cover"
                style={{
                  backgroundImage: `url(${heroImg2})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="pm-cover-overlay">
                  <button className="play-btn" aria-label="Play new release">
                    <PlayCircleOutlined />
                  </button>
                </div>
              </div>
              <div className="promo-details">
                <p className="promo-tag">New Release</p>
                <h3 className="promo-title">Salvation Has Been Brought Down</h3>
                <p className="promo-artist">Jabali Chorale · Single</p>
                <div className="promo-progress">
                  <span className="progress-bar">
                    <span className="progress-fill" />
                  </span>
                  <div className="timecode">
                    <span>0:42</span>
                    <span>3:18</span>
                  </div>
                </div>
                <div className="promo-platforms">
                  <a href="https://spotify.com" aria-label="Spotify" className="promo-pill">
                    <span className="platform-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.55 13.46c-.18.3-.56.4-.86.22-2.36-1.44-5.33-1.76-8.83-.94a.64.64 0 0 1-.3-1.24c3.8-.92 7.14-.55 9.78 1.03.3.18.4.56.23.86zm1.2-2.68c-.22.35-.69.46-1.05.24-2.7-1.64-6.82-2.11-10-1.13a.74.74 0 1 1-.4-1.42c3.52-.99 8.02-.47 11.12 1.39.36.22.48.69.25 1.04zm.1-2.8c-3.23-1.92-8.6-2.1-11.7-1.13a.85.85 0 1 1-.46-1.63c3.48-1 9.35-.76 13 1.4a.85.85 0 0 1-.84 1.46z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <span className="platform-label">Spotify</span>
                  </a>
                  <a href="https://music.youtube.com" aria-label="YouTube Music" className="promo-pill">
                    <YoutubeOutlined />
                    <span className="platform-label">YT Music</span>
                  </a>
                  <a href="https://music.apple.com" aria-label="Apple Music" className="promo-pill">
                    <AppleOutlined />
                    <span className="platform-label">Apple</span>
                  </a>
                  <a href="https://soundcloud.com" aria-label="SoundCloud" className="promo-pill">
                    <CloudOutlined />
                    <span className="platform-label">SoundCloud</span>
                  </a>
                </div>
              </div>
            </div>

            {/* <div className="timeline">
              {loopShows.map((show, idx) => (
                <div className="timeline-card" key={`${show.title}-${idx}`}>
                  <div className="dot" />
                  <div className="card-body">
                    <div className="card-title">{show.title}</div>
                    <div className="card-meta">{show.venue}</div>
                    <div className="card-date">{show.date}</div>
                  </div>
                  {idx !== loopShows.length - 1 && <div className="link" />}
                </div>
              ))}
            </div> */}
          </div>
          </div>
        </div>

        <AboutSection heroImg1={heroImg1} heroImg2={heroImg2} />
        <RecentRecords />
        <GalleryMarquee images={[heroImg1, heroImg2, docoreImg, mictrackImg, headphonesImg]} />
      </>
    );
  })()
);

export default Home;
