import { Link } from 'react-router-dom';
import { ArrowRightOutlined } from '@ant-design/icons';
import '../styles/merch.scss';
import { useMerch } from '../hooks/usePublicData';
import PageLoader from '../components/PageLoader';

// The shop. Mirrors the Events page: a grid of cards, each opening its own
// detail page, where the actual buying happens.
const money = (product) =>
  product.openAmount?.enabled ? 'You choose the amount' : product.price;

const Merch = () => {
  const { products, loading } = useMerch();

  if (loading) {
    return (
      <main className="mr-page">
        <PageLoader label="Loading the shop…" />
      </main>
    );
  }

  return (
    <main className="mr-page">
      <header className="page-header shell">
        <p className="eyebrow">Shop</p>
        <h1 className="display-lg">Wear the sound.</h1>
        <p className="lead">
          Chorale merchandise — shirts, hoodies, and keepsakes. Every purchase supports the
          ministry and the music.
        </p>
      </header>

      <section className="section shell">
        {products.length === 0 ? (
          <div className="mr-empty">
            <p>Nothing is in the shop right now. Check back soon.</p>
            <Link className="btn btn-primary" to="/events">
              See upcoming events
              <ArrowRightOutlined />
            </Link>
          </div>
        ) : (
          <div className="mr-grid reveal">
            {products.map((product) => (
              <article className="mr-card" key={product.id}>
                <Link className="mr-card-link" to={`/merch/${product.id}`}>
                  <span
                    className="mr-card-photo"
                    style={product.image ? { backgroundImage: `url("${product.image}")` } : undefined}
                    role="img"
                    aria-label={product.name}
                  />
                  <span className="mr-card-body">
                    <strong className="mr-card-name">{product.name}</strong>
                    <span className="mr-card-price">{money(product)}</span>
                    {product.options?.length > 0 && (
                      <small className="mr-card-meta">
                        {product.options.map((o) => o.name).join(' · ')} available
                      </small>
                    )}
                  </span>
                  <span className="mr-card-cta">
                    View
                    <ArrowRightOutlined />
                  </span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default Merch;
