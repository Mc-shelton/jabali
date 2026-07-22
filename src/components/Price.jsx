// A product's price, with its discount if it has one.
//
// One component so the rule is written once: when there is no discount, the
// original price is simply the price — no struck-through duplicate, no "0% off"
// badge, nothing extra at all. A discount that isn't there should leave no
// trace on the page.
//
// The figures come from the server (`priceFinal`, `priceOriginal`,
// `hasDiscount`), which computes them with the same function the checkout
// charges with. This component never does the arithmetic itself, so the number
// shown and the number taken can't drift apart.

const money = (n) => `KES ${Number(n).toLocaleString('en-KE')}`;

// How much off, phrased the way the admin set it.
const savingLabel = (product) => {
  const d = product.discount ?? {};
  if (d.type === 'flat') return `${money(d.value)} off`;
  if (d.value) return `${d.value}% off`;

  // A stored discount with no type still has two numbers to compare.
  const off = Math.round((1 - product.priceFinal / product.priceOriginal) * 100);
  return off > 0 ? `${off}% off` : null;
};

const Price = ({ product, showBadge = true, className = '' }) => {
  if (product?.openAmount?.enabled) {
    return <span className={`price ${className}`}>You choose the amount</span>;
  }

  // Falls back to the raw label for anything without server-computed figures —
  // a ticket package, or a legacy inline item.
  const final = product?.priceFinal;
  if (final == null) {
    return <span className={`price ${className}`}>{product?.price}</span>;
  }

  if (!product.hasDiscount) {
    return <span className={`price ${className}`}>{money(final)}</span>;
  }

  const saving = savingLabel(product);

  return (
    <span className={`price is-discounted ${className}`}>
      <s className="price-was">{money(product.priceOriginal)}</s>
      <span className="price-now">{money(final)}</span>
      {showBadge && saving && <span className="price-badge">{saving}</span>}
    </span>
  );
};

export default Price;
