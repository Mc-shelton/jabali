import './../styles/gallery.scss';

const GalleryMarquee = ({ images = [] }) => {
  if (!images.length) return null;

  const track = [...images, ...images]; // duplicate for seamless loop

  return (
    <section className="gallery-marquee" aria-label="Recent moments">
      <div className="gallery-track">
        {track.map((src, idx) => (
          <div className="gallery-frame" key={`${src}-${idx}`}>
            <img src={src} alt="Jabali gallery" loading="lazy" />
          </div>
        ))}
      </div>
    </section>
  );
};

export default GalleryMarquee;
