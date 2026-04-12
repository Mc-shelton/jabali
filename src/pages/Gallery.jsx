import { useEffect, useState } from 'react';
import '../styles/extra-pages.scss';
import { galleryBoards, galleryCategories, galleryFeature } from '../data/gallery';

const Gallery = () => {
  const [activeCategoryId, setActiveCategoryId] = useState(galleryCategories[0].id);
  const [activeBoardTitle, setActiveBoardTitle] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const activeCategory = galleryCategories.find(({ id }) => id === activeCategoryId) ?? galleryCategories[0];
  const activeBoard = galleryBoards.find(({ title }) => title === activeBoardTitle) ?? null;

  useEffect(() => {
    const isOverlayOpen = Boolean(activeBoard || activeImage);

    document.body.classList.toggle('gallery-overlay-open', isOverlayOpen);

    return () => {
      document.body.classList.remove('gallery-overlay-open');
    };
  }, [activeBoard, activeImage]);

  return (
    <main className="extra-page">
    <section className="extra-hero">
      <div>
        <p className="extra-pill">Gallery</p>
        <h1>Rehearsals, ministry moments, and stage memories.</h1>
        <p className="extra-lead">
          A visual archive for chorale life: concerts, practice sessions, recordings, travel, and the quiet moments in
          between.
        </p>
      </div>
      <div className="extra-hero-card">
        <p className="hero-card-label">Archive</p>
        <strong>Photos & visual moments</strong>
        <span>Use this page as the destination for your growing image library.</span>
      </div>
    </section>

    <section className="gallery-showcase">
      <article className="gallery-phone gallery-phone-board">
        <div className="gallery-phone-head">
          <button type="button" className="gallery-icon-button" aria-label="Next">
            &#8250;
          </button>
          <div>
            <h2>Boards</h2>
            <p>Gather concert memories and rehearsal highlights into clean visual collections.</p>
          </div>
        </div>

        <div className="gallery-board-list">
          {galleryBoards.map((board) => (
            <button
              type="button"
              className="gallery-board-card"
              key={board.title}
              onClick={() => setActiveBoardTitle(board.title)}
            >
              <div className="gallery-board-mosaic">
                {board.images.map((image) => (
                  <div key={`${board.title}-${image}`} style={{ backgroundImage: `url(${image})` }} />
                ))}
              </div>
              <div className="gallery-board-meta">
                <strong>{board.title}</strong>
              </div>
            </button>
          ))}
        </div>
      </article>

      <article className="gallery-phone gallery-phone-section">
        <div className="gallery-phone-head">
          <button type="button" className="gallery-icon-button" aria-label="Next">
            &#8250;
          </button>
          <div>
            <h2>Concert Nights</h2>
            <p>One board opened into a section page with related albums and selected images underneath.</p>
          </div>
        </div>

        <div className="gallery-category-strip">
          {galleryCategories.map((category) => (
            <button
              type="button"
              className={`gallery-category-chip${category.id === activeCategory.id ? ' is-active' : ''}`}
              key={category.id}
              onClick={() => setActiveCategoryId(category.id)}
              aria-pressed={category.id === activeCategory.id}
            >
              <span style={{ backgroundImage: `url(${category.image})` }} />
              <small>{category.label}</small>
            </button>
          ))}
        </div>

        <div className="gallery-section-card">
          <div className="gallery-section-hero" style={{ backgroundImage: `url(${activeCategory.hero})` }} />
          <div className="gallery-section-copy">
            <strong>{activeCategory.featureTitle}</strong>
            <p>{activeCategory.featureText}</p>
          </div>
          <div className="gallery-section-grid">
            {activeCategory.images.map((image, index) => (
              <button
                type="button"
                className="gallery-section-thumb"
                key={`${image}-${index}`}
                style={{ backgroundImage: `url(${image})` }}
                onClick={() => setActiveImage(image)}
                aria-label={`Open section image ${index + 1} from ${activeCategory.label}`}
              />
            ))}
          </div>
        </div>
      </article>

      <article className="gallery-phone gallery-phone-detail">
        <div className="gallery-detail-top" style={{ backgroundImage: `url(${galleryFeature.image})` }}>
          <button type="button" className="gallery-icon-button gallery-icon-overlay" aria-label="Next">
            &#8250;
          </button>
          <button type="button" className="gallery-icon-button gallery-icon-overlay is-right" aria-label="Favorite">
            &#9829;
          </button>
        </div>

        <div className="gallery-detail-sheet">
          <button type="button" className="gallery-cta">
            Overview
          </button>
          <p className="gallery-detail-category">{galleryFeature.category}</p>

          <div className="gallery-detail-facts">
            <div>
              <span>Captured by</span>
              <strong>{galleryFeature.artist}</strong>
            </div>
            <div>
              <span>Collection size</span>
              <strong>{galleryFeature.size}</strong>
            </div>
            <div>
              <span>Location</span>
              <strong>{galleryFeature.location}</strong>
            </div>
          </div>

          <p className="gallery-detail-note">{galleryFeature.note}</p>

          <div className="gallery-audio-row" aria-hidden="true">
            <span className="gallery-audio-play" />
            <span className="gallery-audio-bar" />
          </div>
        </div>
      </article>
    </section>

    {activeBoard ? (
      <div className="gallery-modal-backdrop" role="presentation" onClick={() => setActiveBoardTitle(null)}>
        <div
          className="gallery-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-board-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="gallery-modal-head">
            <div>
              <p className="extra-pill">Board</p>
              <h2 id="gallery-board-modal-title">{activeBoard.title}</h2>
            </div>
            <button type="button" className="gallery-modal-close" aria-label="Close board" onClick={() => setActiveBoardTitle(null)}>
              &times;
            </button>
          </div>

          <div className="gallery-modal-grid">
            {activeBoard.images.map((image, index) => (
              <button
                type="button"
                className="gallery-modal-image"
                key={`${activeBoard.title}-${image}-${index}`}
                onClick={() => setActiveImage(image)}
                style={{ backgroundImage: `url(${image})` }}
                aria-label={`Open image ${index + 1} from ${activeBoard.title}`}
              />
            ))}
          </div>
        </div>
      </div>
    ) : null}

    {activeImage ? (
      <div className="gallery-lightbox-backdrop" role="presentation" onClick={() => setActiveImage(null)}>
        <div className="gallery-lightbox" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="gallery-modal-close gallery-lightbox-close" aria-label="Close image" onClick={() => setActiveImage(null)}>
            &times;
          </button>
          <img src={activeImage} alt="Gallery preview" className="gallery-lightbox-image" />
        </div>
      </div>
    ) : null}
    </main>
  );
};

export default Gallery;
