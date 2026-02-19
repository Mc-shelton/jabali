import {
  PlayCircleFilled,
  SoundOutlined,
  YoutubeOutlined,
  CustomerServiceOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import micImg from '../../public/graphics/mictrack.png';
import headphonesImg from '../../public/graphics/headphones.png';
import './../styles/recent.scss';

const tracks = [
  { title: 'Heavenly Home', artist: 'Jabali Chraole', time: '00:00' },
  { title: 'Agnus Dei', artist: 'Jabali Chraole', time: '00:00' },
  { title: 'Mataifa Yote', artist: 'Jabali Chraole', time: '00:00' },
  { title: 'Twae Wangu', artist: 'Jabali Chraole', time: '00:00' },
];

const RecentRecords = () => (
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
            <button className="recent-play" aria-label={`Play ${track.title}`}>
              <PlayCircleOutlined />
            </button>
            <div className="recent-time">{track.time}</div>
            <button className="recent-volume" aria-label={`Volume for ${track.title}`}>
              <SoundOutlined />
            </button>
          </div>
        ))}
      </div>

      <div className="recent-ctas">
        <a className="recent-btn ghost" href="https://spotify.com" aria-label="Open Spotify">
          <CustomerServiceOutlined />
        </a>
        <a className="recent-btn primary" href="#more-music">
          Listen To More Music
        </a>
        <a className="recent-btn ghost" href="https://music.youtube.com" aria-label="Open YouTube Music">
          <YoutubeOutlined />
        </a>
      </div>
    </div>

    <img src={micImg} alt="Studio microphone" className="recent-side mic" />
    <img src={headphonesImg} alt="Headphones" className="recent-side cans" />
  </section>
);

export default RecentRecords;
