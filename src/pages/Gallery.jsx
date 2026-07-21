import { useCallback, useEffect, useState } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import '../styles/gallery-page.scss';
import { useContent } from '../hooks/usePublicData';
import { cssUrl } from '../utils/assetPath';

const Gallery = () => {
  const { data } = useContent('gallery');
  // Shadowing the old module-level names keeps the JSX below unchanged.
  const galleryBoards = data.boards;
  const galleryCategories = data.categories;
  const galleryFeature = data.feature;

  // Selections are held as id/title, not as objects: the gallery arrives from
  // the API after first paint, so a stored object would go stale. An id that no
  // longer exists falls back to the first category.
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeBoardTitle, setActiveBoardTitle] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  const activeCategory =
    galleryCategories.find(({ id }) => id === activeCategoryId) ?? galleryCategories[0] ?? null;
  const activeBoard = galleryBoards.find(({ title }) => title === activeBoardTitle) ?? null;
  const isOverlayOpen = Boolean(activeBoard || activeImage);

  // Escape closes the topmost layer only: the lightbox first, then the board
  // behind it — so it never dumps you out of two levels at once.
  const closeTopLayer = useCallback(() => {
    if (activeImage) {
      setActiveImage(null);
      return;
    }
    setActiveBoardTitle(null);
  }, [activeImage]);

  useEffect(() => {
    document.body.classList.toggle('gallery-overlay-open', isOverlayOpen);
    document.body.style.overflow = isOverlayOpen ? 'hidden' : '';

    if (!isOverlayOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeTopLayer();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('gallery-overlay-open');
      document.body.style.overflow = '';
    };
  }, [isOverlayOpen, closeTopLayer]);

  return (
    <main className="gal-page">
      <header className="page-header shell">
        <p className="eyebrow">Gallery</p>
        <h1 className="display-lg gal-title">
          Rehearsals, ministry moments,
          <em>and stage memories.</em>
        </h1>
        <p className="lead">
          A visual archive of chorale life: concerts, practice sessions, recordings, travel, and the quiet
          moments in between.
        </p>
      </header>

      <section className="section shell">
        <div className="section-head reveal">
          <p className="eyebrow">Collections</p>
          <h2 className="display-md">Boards</h2>
          <p className="section-head-note">Concert memories and rehearsal highlights, grouped together.</p>
        </div>

        <div className="gal-boards reveal">
          {galleryBoards.map((board) => (
            <button
              type="button"
              className="gal-board"
              key={board.title}
              onClick={() => setActiveBoardTitle(board.title)}
            >
              <span className="gal-mosaic">
                {board.images.slice(0, 4).map((image) => (
                  <span key={`${board.title}-${image}`} style={{ backgroundImage: cssUrl(image) }} />
                ))}
              </span>
              <span className="gal-board-meta">
                <strong>{board.title}</strong>
                <small>{board.images.length} photos</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      {activeCategory && (
      <section className="section shell gal-browse">
        <div className="section-head reveal">
          <p className="eyebrow">Browse</p>
          <h2 className="display-md">{activeCategory.featureTitle}</h2>
          <p className="section-head-note">{activeCategory.featureText}</p>
        </div>

        <div className="gal-filters reveal">
          {galleryCategories.map((category) => (
            <button
              type="button"
              className={`gal-chip${category.id === activeCategory.id ? ' is-active' : ''}`}
              key={category.id}
              onClick={() => setActiveCategoryId(category.id)}
              aria-pressed={category.id === activeCategory.id}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="gal-grid reveal">
          {activeCategory.images.map((image, index) => (
            <button
              type="button"
              className="gal-tile"
              key={`${image}-${index}`}
              style={{ backgroundImage: cssUrl(image) }}
              onClick={() => setActiveImage(image)}
              aria-label={`Open image ${index + 1} from ${activeCategory.label}`}
            />
          ))}
        </div>

        <p className="gal-note">{galleryFeature.note}</p>
      </section>
      )}

      {activeBoard ? (
        <div className="gal-overlay" role="presentation" onClick={() => setActiveBoardTitle(null)}>
          <div
            className="gal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gal-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="gal-modal-head">
              <div>
                <p className="eyebrow">Board</p>
                <h2 id="gal-modal-title" className="display-md">
                  {activeBoard.title}
                </h2>
              </div>
              <button
                type="button"
                className="gal-close"
                aria-label="Close board"
                onClick={() => setActiveBoardTitle(null)}
              >
                <CloseOutlined />
              </button>
            </div>

            <div className="gal-modal-grid">
              {activeBoard.images.map((image, index) => (
                <button
                  type="button"
                  className="gal-tile"
                  key={`${activeBoard.title}-${image}-${index}`}
                  style={{ backgroundImage: cssUrl(image) }}
                  onClick={() => setActiveImage(image)}
                  aria-label={`Open image ${index + 1} from ${activeBoard.title}`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeImage ? (
        <div className="gal-overlay is-lightbox" role="presentation" onClick={() => setActiveImage(null)}>
          <div className="gal-lightbox" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="gal-close gal-close-floating"
              aria-label="Close image"
              onClick={() => setActiveImage(null)}
            >
              <CloseOutlined />
            </button>
            <img src={activeImage} alt="" className="gal-lightbox-image" />
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default Gallery;
