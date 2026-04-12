import {
  PauseCircleOutlined,
  SoundOutlined,
  YoutubeOutlined,
  CustomerServiceOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import './../styles/recent.scss';
import { headphonesImg, mictrackImg } from '../assets';
import { getTracksByIds, musicPlatformLinks, recentRecordIds } from '../data/music';
import useAudioPlayer from '../hooks/useAudioPlayer';

const tracks = getTracksByIds(recentRecordIds);

const RecentRecords = () => {
  const { toggleTrack, isTrackActive, isTrackLoading, getTrackLoadingProgress } = useAudioPlayer();

  return (
  <section className="recent-section" id="records">

    <div className="recent-inner">
      <div className="recent-eyebrow">Our Music</div>
      <h2 className="recent-title">Recent Records</h2>
      <p className="recent-quote">
        “Music forms a part of God’s worship in the courts above. We should endeavor in
         our songs of praise to approach as nearly as possible to the harmony of the heavenly choirs.”
      </p>

      <div className="recent-list">
        {tracks.map((track) => (
          <div className="recent-row" key={track.title}>
            <div className="recent-track">
              <div className="recent-track-title">{track.title}</div>
              <div className="recent-track-artist">{track.artist}</div>
            </div>
            <button
              className="recent-play"
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
            <div className="recent-time">{track.duration}</div>
            <button className="recent-volume" aria-label={`Volume for ${track.title}`}>
              <SoundOutlined />
            </button>
          </div>
        ))}
      </div>

      <div className="recent-ctas">
        <a className="recent-btn ghost" href={musicPlatformLinks.spotify} aria-label="Open Spotify">
          <CustomerServiceOutlined />
        </a>
        <Link className="recent-btn primary" to="/music">
          Listen To More Music
        </Link>
        <a className="recent-btn ghost" href={musicPlatformLinks.youtubeMusic} aria-label="Open YouTube Music">
          <YoutubeOutlined />
        </a>
      </div>
    </div>

    <img src={mictrackImg} alt="Studio microphone" className="recent-side mic" />
    <img src={headphonesImg} alt="Headphones" className="recent-side cans" />
  </section>
  );
};

export default RecentRecords;
