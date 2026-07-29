import { useEffect, useRef, useState } from 'react';
import {
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  MobileOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import '../styles/checkout.scss';
import { getPaymentStatus, initiateTicketPayment } from '../lib/api';
import { beginCheckout, purchase } from '../lib/analytics';

// Poll every 5s for the first 30s. After that we stop polling automatically but
// deliberately do NOT declare failure: M-Pesa can take minutes when the customer
// is slow to enter their PIN, and calling that a failure — as this used to —
// tells someone their payment failed while the money is on its way. Instead the
// checkout moves to a "still waiting" state with a Refresh button they can press
// until the real answer arrives.
const POLL_MS = 5000;
const AUTO_POLL_MS = 30000;

const priceToNumber = (price) => Number(String(price ?? '').replace(/[^0-9]/g, '')) || 0;
const money = (n) => `KES ${Number(n).toLocaleString('en-KE')}`;

// `kind` is 'ticket' or 'merch'. `item` is a { name, price, note } object — a
// ticket package or a merch product.
const TicketCheckout = ({ event, item, kind = 'ticket', onClose }) => {
  const isMerch = kind === 'merch';
  const qtyLabel = isMerch ? 'Quantity' : 'Number of tickets';
  // details | extras | payment | processing | waiting | success | failed
  // `waiting` is not a failure — it's "we stopped auto-checking, press Refresh".
  const [stage, setStage] = useState('details');
  const [form, setForm] = useState({
    preferredName: '',
    otherNames: '',
    phone: '',
    email: '',
    quantity: 1,
    promoCode: '',
  });
  // Variant choices, keyed by option name. Required options default to their
  // first choice so the buyer can't submit an incomplete selection by accident.
  const itemOptions = item.options ?? [];
  const [choices, setChoices] = useState(() =>
    Object.fromEntries(
      itemOptions.map((opt) => [opt.name, opt.required ? opt.choices?.[0]?.label ?? '' : '']),
    ),
  );

  const openAmount = item.openAmount?.enabled ? item.openAmount : null;
  const [customAmount, setCustomAmount] = useState('');

  // ---- add-ons: merchandise bolted onto this order, paid in one prompt.
  //
  // Offered from the same event, minus the thing already being bought and
  // minus any open-amount product (a donation has no quantity, so it makes no
  // sense as a bolt-on line). Keyed by product name, which is what the server
  // resolves against.
  const addOnCatalogue = (event.merch ?? []).filter(
    (p) => p.name !== item.name && !p.openAmount?.enabled,
  );
  // { [name]: { quantity, choices: { [optionName]: label } } }
  const [addOns, setAddOns] = useState({});

  const addOnQty = (name) => addOns[name]?.quantity ?? 0;

  const setAddOnQty = (product, next) =>
    setAddOns((prev) => {
      const qty = Math.max(0, Math.min(20, next));
      if (qty === 0) {
        const { [product.name]: _drop, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [product.name]: {
          quantity: qty,
          // Required variants default to their first choice, so a line can
          // never be submitted half-specified.
          choices:
            prev[product.name]?.choices ??
            Object.fromEntries(
              (product.options ?? [])
                .filter((o) => o.required)
                .map((o) => [o.name, o.choices?.[0]?.label ?? '']),
            ),
        },
      };
    });

  const setAddOnChoice = (name, optionName, label) =>
    setAddOns((prev) => ({
      ...prev,
      [name]: { ...prev[name], choices: { ...prev[name]?.choices, [optionName]: label } },
    }));

  // Mirrors the server's arithmetic for display only — tickets.php re-derives
  // every figure from the stored products.
  const addOnLines = Object.entries(addOns).map(([name, line]) => {
    const product = addOnCatalogue.find((p) => p.name === name);
    const delta = (product?.options ?? []).reduce((sum, opt) => {
      const picked = opt.choices?.find((c) => c.label === line.choices?.[opt.name]);
      return sum + (picked ? Number(picked.priceDelta) || 0 : 0);
    }, 0);
    const unit = (product?.priceFinal ?? priceToNumber(product?.price)) + delta;
    return { name, product, quantity: line.quantity, choices: line.choices, amount: unit * line.quantity };
  });

  const addOnTotal = addOnLines.reduce((sum, l) => sum + l.amount, 0);

  const [mpesaPhone, setMpesaPhone] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [checking, setChecking] = useState(false);
  const [order, setOrder] = useState(null);
  const [result, setResult] = useState(null);
  const pollRef = useRef({ timer: null });

  // Mirror of the server's pricing, for display only — tickets.php recomputes
  // everything from the stored item, so this can never set what's charged.
  const optionDelta = itemOptions.reduce((sum, opt) => {
    const picked = opt.choices?.find((c) => c.label === choices[opt.name]);
    return sum + (picked ? Number(picked.priceDelta) || 0 : 0);
  }, 0);

  // `priceFinal` is the server's own figure with any product discount already
  // applied. Falling back to parsing the label keeps ticket packages — which
  // have no discount — working unchanged.
  const basePrice = item.priceFinal ?? priceToNumber(item.price);
  const unit = openAmount ? Number(customAmount) || 0 : basePrice + optionDelta;
  const qty = openAmount ? 1 : Math.max(1, Number(form.quantity) || 1);
  const itemTotal = unit * qty;
  const estTotal = itemTotal + addOnTotal;

  const amountTooLow = Boolean(openAmount) && unit < (openAmount.min ?? 1);

  // Lock scroll + close on Escape (except mid-payment, where closing would be
  // confusing while the phone prompt is live).
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && stage !== 'processing') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [stage, onClose]);

  // Apply a status response. `failed` here is a real answer from M-Pesa (a
  // cancelled prompt, a wrong PIN), never a timeout on our side.
  const applyStatus = (status) => {
    if (status.status === 'success') {
      setResult(status);
      setError('');
      setStage('success');
      // GA4 purchase — the value M-Pesa actually confirmed, falling back to our
      // estimate if the server didn't echo one back.
      purchase({
        orderId: status.orderId ?? order?.orderId,
        value: status.amount ?? amount,
        item,
        quantity: status.quantity ?? qty,
        kind,
        receipt: status.receipt,
      });
      return true;
    }
    if (status.status === 'failed') {
      setResult(status);
      setError(status.message || 'The payment was not completed.');
      setStage('failed');
      return true;
    }
    return false;
  };

  // Auto-poll for the first 30s only, then hand over to the Refresh button.
  useEffect(() => {
    if (stage !== 'processing' || !order?.orderId) return undefined;

    const startedAt = Date.now();
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const status = await getPaymentStatus(order.orderId);
        if (cancelled) return;
        if (applyStatus(status)) return;
      } catch {
        // Transient network/server hiccup — keep waiting, never fail on it.
      }
      if (cancelled) return;

      if (Date.now() - startedAt >= AUTO_POLL_MS) {
        setStage('waiting');   // stop checking, but nothing has gone wrong
        return;
      }
      pollRef.current.timer = setTimeout(tick, POLL_MS);
    };

    pollRef.current.timer = setTimeout(tick, POLL_MS);

    return () => {
      cancelled = true;
      clearTimeout(pollRef.current.timer);
    };
  }, [stage, order]);

  // Manual check, from the waiting or failed screen. Forces a fresh Daraja query
  // server-side — which can also correct an order that was wrongly marked failed.
  const refreshNow = async () => {
    if (!order?.orderId || checking) return;
    setChecking(true);
    setError('');
    try {
      const status = await getPaymentStatus(order.orderId, { force: true });
      if (!applyStatus(status)) {
        setNote('Still no confirmation from M-Pesa yet. Give it a moment and check again.');
      }
    } catch {
      setNote('Couldn’t reach the server just then. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Details → extras → payment. The extras step is skipped entirely when there
  // is nothing to offer, rather than showing an empty screen to click past.
  const goToExtras = (e) => {
    e.preventDefault();
    setError('');
    setMpesaPhone((p) => p || form.phone);
    setStage(addOnCatalogue.length > 0 ? 'extras' : 'payment');
  };

  const pay = async (e) => {
    e.preventDefault();
    setError('');
    setStage('processing');
    beginCheckout({ item, quantity: qty, value: estTotal, kind });
    try {
      const res = await initiateTicketPayment({
        eventSlug: event.slug,
        itemType: kind,
        itemName: item.name,
        quantity: qty,
        // Only which option and which label — the server prices it.
        options: itemOptions
          .filter((opt) => choices[opt.name])
          .map((opt) => ({ name: opt.name, choice: choices[opt.name] })),
        ...(openAmount ? { amount: unit } : {}),
        // Which product, how many, which variant. Never a price — the server
        // reads that from the stored product.
        addOns: addOnLines.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          options: Object.entries(l.choices ?? {})
            .filter(([, choice]) => choice)
            .map(([name, choice]) => ({ name, choice })),
        })),
        promoCode: form.promoCode,
        mpesaPhone,
        customer: {
          preferredName: form.preferredName,
          otherNames: form.otherNames,
          phone: form.phone,
          email: form.email,
        },
      });
      setOrder(res);
      // A guarded local-development bypass returns an already-settled order,
      // so there is no M-Pesa result to wait and poll for.
      if (res.status === 'success') applyStatus(res);
    } catch (err) {
      setError(err.message || 'Could not start the payment.');
      setStage('payment');
    }
  };

  const amount = order?.amount ?? estTotal;

  return (
    <div className="co-overlay" role="presentation" onClick={() => stage !== 'processing' && onClose()}>
      <div className="co-modal" role="dialog" aria-modal="true" aria-label={isMerch ? "Buy merchandise" : "Buy tickets"} onClick={(e) => e.stopPropagation()}>
        <header className="co-head">
          <div>
            <p className="co-kicker">{event.title}</p>
            <h2 className="co-title">
              {item.name}
              {openAmount ? (
                ' · you choose the amount'
              ) : (
                <>
                  {' · '}
                  {item.hasDiscount && <s className="co-was">{money(item.priceOriginal)}</s>}
                  {money(basePrice)}
                </>
              )}
            </h2>
          </div>
          {stage !== 'processing' && (
            <button type="button" className="co-close" aria-label="Close" onClick={onClose}>
              <CloseOutlined />
            </button>
          )}
        </header>

        {/* progress dots */}
        <div className="co-steps" aria-hidden="true">
          <span className="co-step is-on">Details</span>
          {addOnCatalogue.length > 0 && (
            <span className={`co-step ${stage !== 'details' ? 'is-on' : ''}`}>Extras</span>
          )}
          <span className={`co-step ${['payment', 'processing', 'waiting', 'success', 'failed'].includes(stage) ? 'is-on' : ''}`}>Payment</span>
          <span className={`co-step ${['success', 'failed'].includes(stage) ? 'is-on' : ''}`}>Done</span>
        </div>

        {error && stage !== 'failed' && <p className="co-error">{error}</p>}

        {/* ---------------------------------------------------------- details */}
        {stage === 'details' && (
          <form className="co-body" onSubmit={goToExtras}>
            <div className="co-grid-2">
              <label className="co-field">
                <span>Preferred name *</span>
                <input value={form.preferredName} onChange={setField('preferredName')} required autoFocus />
              </label>
              <label className="co-field">
                <span>Other names</span>
                <input value={form.otherNames} onChange={setField('otherNames')} />
              </label>
            </div>

            <div className="co-grid-2">
              <label className="co-field">
                <span>Phone *</span>
                <input type="tel" value={form.phone} onChange={setField('phone')} placeholder="07XX XXX XXX" required />
              </label>
              <label className="co-field">
                <span>Email *</span>
                <input type="email" value={form.email} onChange={setField('email')} placeholder="you@example.com" required />
              </label>
            </div>

            {/* Variant pickers (size, colour…), defined per product in the admin. */}
            {itemOptions.length > 0 && (
              <div className="co-grid-2">
                {itemOptions.map((opt) => (
                  <label className="co-field" key={opt.name}>
                    <span>
                      {opt.name} {opt.required && '*'}
                    </span>
                    <select
                      value={choices[opt.name] ?? ''}
                      required={opt.required}
                      onChange={(e) =>
                        setChoices((c) => ({ ...c, [opt.name]: e.target.value }))
                      }
                    >
                      {!opt.required && <option value="">No preference</option>}
                      {opt.choices?.map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.label}
                          {c.priceDelta ? ` (+${money(c.priceDelta)})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            <div className="co-grid-2">
              {openAmount ? (
                <label className="co-field">
                  <span>Amount (KES) *</span>
                  <input
                    type="number"
                    min={openAmount.min ?? 1}
                    step="1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={String(openAmount.min ?? 1)}
                    required
                  />
                  <small>Minimum {money(openAmount.min ?? 1)}.</small>
                </label>
              ) : (
                <label className="co-field">
                  <span>{qtyLabel} *</span>
                  <input type="number" min="1" max="20" value={form.quantity} onChange={setField('quantity')} required />
                </label>
              )}
              <label className="co-field">
                <span>Promo code</span>
                <input value={form.promoCode} onChange={setField('promoCode')} placeholder="Optional" />
              </label>
            </div>

            <div className="co-total">
              <span>{openAmount ? 'Your amount' : 'Estimated total'}</span>
              <strong>{money(estTotal)}</strong>
            </div>

            {amountTooLow && customAmount !== '' && (
              <p className="co-error">Please enter at least {money(openAmount.min ?? 1)}.</p>
            )}

            <button type="submit" className="btn btn-primary co-submit" disabled={amountTooLow}>
              Continue to payment
              <ArrowRightOutlined />
            </button>
          </form>
        )}

        {/* ---------------------------------------------------------- extras */}
        {stage === 'extras' && (
          <div className="co-body">
            <div className="co-extras-head">
              <h3>Add merchandise?</h3>
              <p>Anything you add is paid for in the same M-Pesa prompt — one payment, one order.</p>
            </div>

            <div className="co-extras">
              {addOnCatalogue.map((product) => {
                const qty = addOnQty(product.name);
                const chosen = addOns[product.name]?.choices ?? {};

                return (
                  <div className={`co-extra ${qty > 0 ? 'is-on' : ''}`} key={product.name}>
                    <div
                      className="co-extra-photo"
                      style={product.image ? { backgroundImage: `url("${product.image}")` } : undefined}
                      aria-hidden="true"
                    />

                    <div className="co-extra-main">
                      <strong>{product.name}</strong>
                      <span className="co-extra-price">
                        {product.hasDiscount && (
                          <s>{money(product.priceOriginal)}</s>
                        )}
                        {money(product.priceFinal ?? priceToNumber(product.price))}
                      </span>

                      {/* Variant pickers appear only once the item is in the
                          basket — asking for a size before you've said you want
                          one is noise. */}
                      {qty > 0 &&
                        (product.options ?? []).map((opt) => (
                          <label className="co-extra-option" key={opt.name}>
                            <span>{opt.name}</span>
                            <select
                              value={chosen[opt.name] ?? ''}
                              onChange={(e) => setAddOnChoice(product.name, opt.name, e.target.value)}
                            >
                              {!opt.required && <option value="">No preference</option>}
                              {opt.choices?.map((c) => (
                                <option key={c.label} value={c.label}>
                                  {c.label}
                                  {c.priceDelta ? ` (+${money(c.priceDelta)})` : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                    </div>

                    <div className="co-extra-qty">
                      <button
                        type="button"
                        onClick={() => setAddOnQty(product, qty - 1)}
                        disabled={qty === 0}
                        aria-label={`Remove one ${product.name}`}
                      >
                        −
                      </button>
                      <span aria-live="polite">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setAddOnQty(product, qty + 1)}
                        aria-label={`Add one ${product.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="co-summary">
              <div>
                <span>
                  {item.name}
                  {!openAmount && ` × ${qty}`}
                </span>
                <strong>{money(itemTotal)}</strong>
              </div>
              {addOnTotal > 0 && (
                <div>
                  <span>Merchandise</span>
                  <strong>{money(addOnTotal)}</strong>
                </div>
              )}
            </div>

            <div className="co-total">
              <span>Total</span>
              <strong>{money(estTotal)}</strong>
            </div>

            <div className="co-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStage('details')}>
                <ArrowLeftOutlined />
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStage('payment')}>
                {addOnTotal > 0 ? 'Continue' : 'No thanks, continue'}
                <ArrowRightOutlined />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- payment */}
        {stage === 'payment' && (
          <form className="co-body" onSubmit={pay}>
            <div className="co-summary">
              <div>
                <span>
                  {item.name}
                  {!openAmount && ` × ${qty}`}
                </span>
                <strong>{money(itemTotal)}</strong>
              </div>
              {/* Repeat the chosen variant so it's confirmed before paying. */}
              {itemOptions.some((opt) => choices[opt.name]) && (
                <p className="co-summary-note">
                  {itemOptions
                    .filter((opt) => choices[opt.name])
                    .map((opt) => `${opt.name}: ${choices[opt.name]}`)
                    .join(' · ')}
                </p>
              )}

              {/* Every add-on line, itemised. The buyer is about to approve a
                  single figure on their phone and should be able to see
                  exactly what it is made of before they do. */}
              {addOnLines.map((line) => (
                <div key={line.name}>
                  <span>
                    {line.name} × {line.quantity}
                    {Object.values(line.choices ?? {}).filter(Boolean).length > 0 &&
                      ` (${Object.values(line.choices).filter(Boolean).join(' · ')})`}
                  </span>
                  <strong>{money(line.amount)}</strong>
                </div>
              ))}

              {addOnTotal > 0 && (
                <div className="co-summary-total">
                  <span>Total</span>
                  <strong>{money(estTotal)}</strong>
                </div>
              )}

              <p className="co-summary-note">You’ll approve the exact amount on your phone.</p>
            </div>

            <label className="co-field">
              <span>M-Pesa phone number *</span>
              <div className="co-phone">
                <MobileOutlined />
                <input
                  type="tel"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  required
                  autoFocus
                />
              </div>
              <small>A payment prompt will be sent to this number.</small>
            </label>

            <div className="co-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStage(addOnCatalogue.length > 0 ? 'extras' : 'details')}
              >
                <ArrowLeftOutlined />
                Back
              </button>
              <button type="submit" className="btn btn-primary">
                Pay {money(estTotal)}
              </button>
            </div>
          </form>
        )}

        {/* ---------------------------------------------------------- processing */}
        {stage === 'processing' && (
          <div className="co-body co-centre">
            <LoadingOutlined className="co-spinner" />
            <h3>Check your phone</h3>
            <p className="co-centre-text">
              We’ve sent an M-Pesa prompt to <strong>{mpesaPhone}</strong>. Enter your PIN to pay{' '}
              <strong>{money(amount)}</strong>. This can take a few seconds.
            </p>
          </div>
        )}

        {/* ---------------------------------------------------------- waiting */}
        {stage === 'waiting' && (
          <div className="co-body co-centre">
            <ClockCircleOutlined className="co-icon is-wait" />
            <h3>Still waiting for M-Pesa</h3>
            <p className="co-centre-text">
              We haven’t had confirmation yet. This is normal if it took a moment to enter your PIN —
              your payment may still be going through. If you’ve completed the prompt on{' '}
              <strong>{mpesaPhone}</strong>, press Check again.
            </p>
            <p className="co-centre-text co-muted">
              You can safely close this — if the payment goes through we’ll email your confirmation to{' '}
              <strong>{form.email}</strong> either way.
            </p>
            {note && <p className="co-note">{note}</p>}
            <div className="co-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={refreshNow} disabled={checking}>
                {checking ? <LoadingOutlined /> : <ReloadOutlined />}
                {checking ? 'Checking…' : 'Check again'}
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- success */}
        {stage === 'success' && (
          <div className="co-body co-centre">
            <CheckCircleFilled className="co-icon is-ok" />
            <h3>Payment received</h3>
            <p className="co-centre-text">
              Thank you! We’ve got your {result?.quantity ?? form.quantity}× {item.name} for {event.title}.
              {result?.receipt && (
                <>
                  {' '}
                  M-Pesa receipt <strong>{result.receipt}</strong>.
                </>
              )}{' '}
              A confirmation will follow to <strong>{form.email}</strong>.
            </p>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------- failed */}
        {stage === 'failed' && (
          <div className="co-body co-centre">
            <CloseCircleFilled className="co-icon is-bad" />
            <h3>Payment not completed</h3>
            <p className="co-centre-text">{error}</p>
            <p className="co-centre-text co-muted">
              If you did complete the payment on your phone, press Check again — we’ll re-confirm with
              M-Pesa before you retry.
            </p>
            {note && <p className="co-note">{note}</p>}
            <div className="co-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-ghost" onClick={refreshNow} disabled={checking}>
                {checking ? <LoadingOutlined /> : <ReloadOutlined />}
                {checking ? 'Checking…' : 'Check again'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setError(''); setNote(''); setStage('payment'); }}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketCheckout;
