import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  InstagramOutlined,
  TikTokOutlined,
  YoutubeOutlined,
  TwitterOutlined,
  WhatsAppOutlined,
  AppleOutlined,
  CloudOutlined,
  PlayCircleFilled,
  PauseCircleFilled,
  ArrowRightOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import './../styles/home.scss';
import AboutSection from '../components/AboutSection';
import RecentRecords from '../components/RecentRecords';
import GalleryMarquee from '../components/GalleryMarquee';
import { heroImg1, heroImg2 } from '../assets';
import { useContent, useMusic } from '../hooks/usePublicData';
import useAudioPlayer from '../hooks/useAudioPlayer';
import { cssUrl } from '../utils/assetPath';

const socialIcons = {
  instagram: <InstagramOutlined />,
  tiktok: <TikTokOutlined />,
  youtube: <YoutubeOutlined />,
  x: <TwitterOutlined />,
  whatsapp: <WhatsAppOutlined />,
};

const platformIcons = {
  spotify: <CustomerServiceOutlined />,
  youtubeMusic: <YoutubeOutlined />,
  appleMusic: <AppleOutlined />,
  soundcloud: <CloudOutlined />,
};

const platformLabels = {
  spotify: 'Spotify',
  youtubeMusic: 'YouTube Music',
  appleMusic: 'Apple Music',
  soundcloud: 'SoundCloud',
};

const Home = () => {
  const images = [heroImg1, heroImg2];
  const { byIds, homePromoTrackIds } = useMusic();
  const promoTracks = byIds(homePromoTrackIds);
  const [activeIdx, setActiveIdx] = useState(0);
  const { data: social } = useContent('social');
  const { data: gallery } = useContent('gallery');
  const { data: pages } = useContent('pages');
  const hero = pages.homeHero;
  // A platform with no URL is hidden rather than rendered as a dead link.
  const activeSocialLinks = social.links.filter((link) => Boolean(link.url));
  const {
    toggleTrack,
    isTrackActive,
    isTrackLoading,
    getTrackLoadingProgress,
    getTrackProgress,
    getTrackTimeLabels,
  } = useAudioPlayer();

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
    }, 9000);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <>
      <section className="hero">
        <div className="hero-frames" aria-hidden="true">
          {images.map((img, idx) => (
            <div
              key={img}
              className={`hero-frame ${idx === activeIdx ? 'is-active' : ''}`}
              style={{ backgroundImage: cssUrl(img) }}
            />
          ))}
        </div>

        <div className="hero-scrim" aria-hidden="true" />

        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow on-dark">{hero.eyebrow}</p>

            <h1 className="display-xl hero-title">
              {hero.title}
              <em>{hero.titleEm}</em>
            </h1>

            <p className="hero-lead">{hero.lead}</p>

            <div className="hero-actions">
              <Link className="btn btn-light" to="/about">
                {hero.ctaPrimary}
                <ArrowRightOutlined />
              </Link>
              <Link className="btn btn-outline-light" to="/music">
                {hero.ctaSecondary}
              </Link>
            </div>

            {activeSocialLinks.length > 0 && (
              <div className="hero-socials">
                {activeSocialLinks.map((social) => (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hero-social"
                  >
                    {socialIcons[social.id]}
                    <span>{social.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <aside className="hero-releases" aria-label="Latest releases">
            <p className="eyebrow on-dark">New Release</p>

            {promoTracks.map((track) => {
              const timeLabels = getTrackTimeLabels(track);
              const isActive = isTrackActive(track.id);
              const isLoading = isTrackLoading(track.id);

              return (
                <article className="hero-release" key={track.id}>
                  <div className="hero-release-head">
                    <div className="hero-release-cover" style={{ backgroundImage: cssUrl(track.thumbnail) }} />

                    <div className="hero-release-meta">
                      <h2 className="hero-release-title">{track.title}</h2>
                      <p className="hero-release-artist">
                        {track.artist} · {track.category}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="hero-release-play"
                      aria-label={`${isActive ? 'Pause' : 'Play'} ${track.title}`}
                      onClick={() => toggleTrack(track)}
                      disabled={!track.audioSrc}
                      data-loading={isLoading}
                    >
                      {isLoading ? (
                        <span className="audio-load-label">{getTrackLoadingProgress(track.id)}%</span>
                      ) : isActive ? (
                        <PauseCircleFilled />
                      ) : (
                        <PlayCircleFilled />
                      )}
                    </button>
                  </div>

                  <div className="hero-release-progress">
                    <span className="hero-progress-track">
                      <span
                        className="hero-progress-fill"
                        style={{ width: `${getTrackProgress(track) * 100}%` }}
                      />
                    </span>
                    <div className="hero-release-time">
                      <span>{timeLabels.current}</span>
                      <span>{timeLabels.total}</span>
                    </div>
                  </div>

                  <div className="hero-release-platforms">
                    {Object.entries(platformLabels).map(([key, label]) => (
                      <a
                        key={key}
                        href={track.streamingLinks[key]}
                        target="_blank"
                        rel="noreferrer"
                        className="hero-release-platform"
                        aria-label={`${track.title} on ${label}`}
                      >
                        {platformIcons[key]}
                      </a>
                    ))}
                  </div>
                </article>
              );
            })}
          </aside>
        </div>

        <div className="hero-cue" aria-hidden="true">
          <span />
        </div>
      </section>

      <AboutSection heroImg1={heroImg1} heroImg2={heroImg2} />
      <RecentRecords />
      <GalleryMarquee images={gallery.marqueeImages} />
    </>
  );
};

export default Home;
