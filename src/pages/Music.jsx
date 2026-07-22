import { Link } from 'react-router-dom';
import {
  ArrowRightOutlined,
  CustomerServiceOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  YoutubeOutlined,
} from '@ant-design/icons';
import '../styles/music.scss';
import { useMusic } from '../hooks/usePublicData';
import useAudioPlayer from '../hooks/useAudioPlayer';
import { cssUrl } from '../utils/assetPath';

const Music = () => {
  // Shadowing the old module-level names keeps the JSX below unchanged.
  const {
    catalog: musicCatalog,
    platformLinks: musicPlatformLinks,
    featuredReleases,
  } = useMusic();
  const { toggleTrack, isTrackActive, isTrackLoading, getTrackLoadingProgress } = useAudioPlayer();
  const listedTracks = musicCatalog.filter((track) => track.listInCatalogue !== false);

  return (
    <main className="music-page">
      <header className="page-header shell">
        <p className="eyebrow">Our Music</p>
        <h1 className="display-lg music-title">
          Every song in one
          <em>listening room.</em>
        </h1>
        <p className="lead">
          The Jabali catalogue gathered onto one page: featured releases, the full song list currently in
          the project, and quick paths to the platforms where listeners expect to find the chorale.
        </p>

        <div className="page-header-actions">
          <a className="btn btn-primary" href={musicPlatformLinks.spotify} target="_blank" rel="noreferrer">
            <CustomerServiceOutlined />
            Spotify
          </a>
          <a className="btn btn-ghost" href={musicPlatformLinks.youtubeMusic} target="_blank" rel="noreferrer">
            <YoutubeOutlined />
            YouTube Music
          </a>
          <Link className="btn btn-ghost" to="/about">
            Meet the chorale
            <ArrowRightOutlined />
          </Link>
        </div>
      </header>

      <section className="featured section">
        <div className="shell">
          <div className="section-head reveal">
            <p className="eyebrow">Featured</p>
            <h2 className="display-md">Current releases and highlighted listening.</h2>
          </div>

          <div className="featured-grid reveal">
            {featuredReleases.map((release) => (
              <article className="feature-card" key={release.id}>
                <div className="feature-cover" style={{ backgroundImage: cssUrl(release.image) }} />
                <div className="feature-body">
                  <p className="feature-tag">
                    {release.type} · {release.year}
                  </p>
                  <h3 className="feature-title">{release.title}</h3>
                  <p className="feature-summary">{release.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="catalogue section" id="all-music">
        <div className="shell">
          <div className="section-head is-centered reveal">
            <p className="eyebrow is-centered on-dark">Catalogue</p>
            <h2 className="display-md">Some of our music.</h2>
            <p className="catalogue-note">
              {listedTracks.length} pieces from the repertoire. Press play for a thirty-second preview.
            </p>
          </div>

          <ol className="catalogue-list reveal">
            {listedTracks.map((track, index) => {
              const isActive = isTrackActive(track.id);
              const isLoading = isTrackLoading(track.id);

              return (
                <li className={`catalogue-row ${isActive ? 'is-playing' : ''}`} key={track.id}>
                  <span className="catalogue-index">{String(index + 1).padStart(2, '0')}</span>

                  <span className="catalogue-art" style={{ backgroundImage: cssUrl(track.art) }} />

                  <span className="catalogue-track">
                    <span className="catalogue-track-title">{track.title}</span>
                    <span className="catalogue-track-meta">{track.category}</span>
                  </span>

                  <span className="catalogue-mood">{track.mood}</span>
                  <span className="catalogue-duration">{track.duration}</span>

                  <button
                    type="button"
                    className="catalogue-play"
                    aria-label={`${isActive ? 'Pause' : 'Play'} ${track.title}`}
                    onClick={() => toggleTrack(track)}
                    disabled={!track.audioSrc}
                    data-loading={isLoading}
                  >
                    {isLoading ? (
                      <span className="audio-load-label">{getTrackLoadingProgress(track.id)}%</span>
                    ) : isActive ? (
                      <PauseCircleOutlined />
                    ) : (
                      <PlayCircleOutlined />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </main>
  );
};

export default Music;
