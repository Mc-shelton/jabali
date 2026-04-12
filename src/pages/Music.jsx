import { PauseCircleOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import {
  CustomerServiceOutlined,
  PlayCircleOutlined,
  SoundOutlined,
  YoutubeOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import '../styles/music.scss';
import {
  heroImg1,
  heroImg2,
} from '../assets';
import { featuredReleases, musicCatalog, musicPlatformLinks } from '../data/music';
import useAudioPlayer from '../hooks/useAudioPlayer';

const Music = () => {
  const { toggleTrack, isTrackActive, isTrackLoading, getTrackLoadingProgress } = useAudioPlayer();

  return (
  <main className="music-page">
    <section className="music-hero">
      <div className="music-copy">
        <p className="music-pill">All Our Music</p>
        <h1>Every song in one listening room.</h1>
        <p className="music-lead">
          The Jabali catalogue gathered onto one page: featured releases, the full song list currently in the project,
          and quick paths to the platforms where listeners expect to find the chorale.
        </p>
        <div className="music-actions">
          <a className="music-btn primary" href={musicPlatformLinks.spotify} aria-label="Open Spotify">
            <CustomerServiceOutlined />
            <span>Spotify</span>
          </a>
          <a className="music-btn ghost" href={musicPlatformLinks.youtubeMusic} aria-label="Open YouTube Music">
            <YoutubeOutlined />
            <span>YouTube Music</span>
          </a>
          <Link className="music-btn ghost" to="/about">
            <span>Meet The Chorale</span>
            <ArrowRightOutlined />
          </Link>
        </div>
      </div>

      <div className="music-hero-art">
        <div className="hero-stack-card primary" style={{ backgroundImage: `url(${heroImg1})` }} />
        <div className="hero-stack-card secondary" style={{ backgroundImage: `url(${heroImg2})` }} />
        <div className="hero-floating-note">
          <SoundOutlined />
          <span>{musicCatalog.length} tracks live in the catalogue</span>
        </div>
      </div>
    </section>

    <section className="music-featured">
      <div className="music-section-head">
        <div>
          <p className="music-pill">Featured</p>
          <h2>Current releases and highlighted listening.</h2>
        </div>
      </div>

      <div className="release-grid">
        {featuredReleases.map((release) => (
          <article className="release-card" key={release.title}>
            <div className="release-cover" style={{ backgroundImage: `url(${release.image})` }}>
              <span className="release-tag">
                {release.type} · {release.year}
              </span>
            </div>
            <div className="release-meta">
              <h3>{release.title}</h3>
              <p>{release.summary}</p>
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="music-catalogue" id="all-music">
      <div className="music-section-head">
        <div>
          <p className="music-pill">Catalogue</p>
          <h2>Full music list.</h2>
        </div>
        <p className="music-section-copy">
          This page now acts as the full music destination for the songs currently defined in the project.
        </p>
      </div>

      <div className="catalogue-list">
        {musicCatalog.map((track, index) => (
          <article className="catalogue-row" key={track.title}>
            <div className="catalogue-index">{String(index + 1).padStart(2, '0')}</div>
            <div className="catalogue-art" style={{ backgroundImage: `url(${track.art})` }} />
            <div className="catalogue-track">
              <h3>{track.title}</h3>
              <p>{track.category}</p>
            </div>
            <div className="catalogue-mood">{track.mood}</div>
            <div className="catalogue-duration">{track.duration}</div>
            <button
              className="catalogue-play"
              type="button"
              aria-label={`${isTrackActive(track.id) ? 'Pause' : 'Play'} ${track.title}`}
              onClick={() => toggleTrack(track)}
              disabled={!track.audioSrc}
              data-loading={isTrackLoading(track.id)}
            >
              {isTrackLoading(track.id)
                ? <span className="audio-load-label">{getTrackLoadingProgress(track.id)}%</span>
                : isTrackActive(track.id)
                  ? <PauseCircleOutlined />
                  : <PlayCircleOutlined />}
            </button>
          </article>
        ))}
      </div>
    </section>
  </main>
  );
};

export default Music;
