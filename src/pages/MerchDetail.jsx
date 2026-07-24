import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, ArrowRightOutlined, ShoppingOutlined } from '@ant-design/icons';
import '../styles/merch.scss';
import { viewItem } from '../lib/analytics';
import { useMerch, useMerchProduct } from '../hooks/usePublicData';
import TicketCheckout from '../components/TicketCheckout';
import PageLoader from '../components/PageLoader';
import Price from '../components/Price';
import NotFound from './NotFound';

// A product's own page — the merch equivalent of the event detail page. Buying
// opens the same checkout used everywhere else, so there is exactly one payment
// flow on the site.
//
// The checkout is built around an event, so a purchase made here supplies a
// stand-in with no slug. tickets.php reads that as "sold from the shop" and
// resolves the product straight from the catalogue; the price still comes from
// the stored product either way.
const SHOP = { slug: '', title: 'Jabali Chorale' };

const RECOMMEND_LIMIT = 3;

const MerchDetail = () => {
  const { id } = useParams();
  const { product, loading } = useMerchProduct(id);
  const { products } = useMerch();
  const [buying, setBuying] = useState(false);

  // Record the product view once it has loaded (GA4 view_item).
  useEffect(() => {
    if (product) viewItem(product, 'merch');
  }, [product]);

  if (loading) {
    return (
      <main className="mr-page">
        <PageLoader label="Loading…" />
      </main>
    );
  }

  if (!product) return <NotFound />;

  const isOpen = Boolean(product.openAmount?.enabled);
  const recommendations = products.filter((p) => p.id !== product.id).slice(0, RECOMMEND_LIMIT);

  return (
    <main className="mr-page">
      <div className="shell mr-back">
        <Link className="mr-back-link" to="/merch">
          <ArrowLeftOutlined /> All merchandise
        </Link>
      </div>

      <section className="section shell mr-detail">
        <div
          className="mr-detail-photo"
          style={product.image ? { backgroundImage: `url("${product.image}")` } : undefined}
          role="img"
          aria-label={product.name}
        />

        <div className="mr-detail-body">
          <p className="eyebrow">Merchandise</p>
          <h1 className="display-md">{product.name}</h1>
          <Price product={product} className="mr-detail-price" />

          {product.description && <p className="mr-detail-copy">{product.description}</p>}

          {/* The choices themselves are made in the checkout, where they change
              the price. Listing them here answers "does it come in my size?"
              before someone commits to opening the form. */}
          {product.options?.length > 0 && (
            <dl className="mr-detail-options">
              {product.options.map((opt) => (
                <div key={opt.name}>
                  <dt>{opt.name}</dt>
                  <dd>{opt.choices.map((c) => c.label).join(', ')}</dd>
                </div>
              ))}
            </dl>
          )}

          <button type="button" className="btn btn-primary mr-buy" onClick={() => setBuying(true)}>
            <ShoppingOutlined />
            {isOpen ? 'Give now' : 'Buy now'}
          </button>

          <p className="mr-detail-note">
            Paid by M-Pesa. You’ll get a confirmation email, and we’ll be in touch about
            collection or delivery.
          </p>
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="section shell mr-more">
          <div className="section-head">
            <p className="eyebrow">Also In The Shop</p>
            <h2 className="display-md">You might like these.</h2>
          </div>

          <div className="mr-grid">
            {recommendations.map((item) => (
              <article className="mr-card" key={item.id}>
                <Link className="mr-card-link" to={`/merch/${item.id}`}>
                  <span
                    className="mr-card-photo"
                    style={item.image ? { backgroundImage: `url("${item.image}")` } : undefined}
                    role="img"
                    aria-label={item.name}
                  />
                  <span className="mr-card-body">
                    <strong className="mr-card-name">{item.name}</strong>
                    <Price product={item} className="mr-card-price" showBadge={false} />
                  </span>
                  <span className="mr-card-cta">
                    View
                    <ArrowRightOutlined />
                  </span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {buying && (
        <TicketCheckout
          event={SHOP}
          item={product}
          kind="merch"
          onClose={() => setBuying(false)}
        />
      )}
    </main>
  );
};

export default MerchDetail;
