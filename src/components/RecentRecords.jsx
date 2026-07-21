import {
  PauseCircleFilled,
  PlayCircleFilled,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import './../styles/recent.scss';
import { useMusic } from '../hooks/usePublicData';
import useAudioPlayer from '../hooks/useAudioPlayer';

const RecentRecords = () => {
  const { byIds, recentRecordIds } = useMusic();
  const tracks = byIds(recentRecordIds);
  const { toggleTrack, isTrackActive, isTrackLoading, getTrackLoadingProgress } = useAudioPlayer();

  return (
    <section className="records section" id="records">
      <div className="records-inner shell">
        <header className="records-head reveal">
          <p className="eyebrow is-centered">Our Music</p>
          <h2 className="display-lg">Recent Records</h2>
          <blockquote className="records-quote">
            Music forms a part of God’s worship in the courts above. We should endeavor in our songs of
            praise to approach as nearly as possible to the harmony of the heavenly choirs.
          </blockquote>
        </header>

        <ol className="records-list reveal">
          {tracks.map((track, index) => {
            const isActive = isTrackActive(track.id);
            const isLoading = isTrackLoading(track.id);

            return (
              <li className={`records-row ${isActive ? 'is-playing' : ''}`} key={track.id}>
                <span className="records-index">{String(index + 1).padStart(2, '0')}</span>

                <button
                  type="button"
                  className="records-play"
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

                <span className="records-title">{track.title}</span>
                <span className="records-mood">{track.mood}</span>
                <span className="records-time">{track.duration}</span>
              </li>
            );
          })}
        </ol>

        <div className="records-cta reveal">
          <Link className="btn btn-light" to="/music">
            Listen to more music
            <ArrowRightOutlined />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default RecentRecords;
