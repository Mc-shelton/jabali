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
  // details | payment | processing | waiting | success | failed
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

  const unit = openAmount ? Number(customAmount) || 0 : priceToNumber(item.price) + optionDelta;
  const qty = openAmount ? 1 : Math.max(1, Number(form.quantity) || 1);
  const estTotal = unit * qty;

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

  const goToPayment = (e) => {
    e.preventDefault();
    setError('');
    setMpesaPhone((p) => p || form.phone);
    setStage('payment');
  };

  const pay = async (e) => {
    e.preventDefault();
    setError('');
    setStage('processing');
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
              {openAmount ? ' · you choose the amount' : ` · ${money(priceToNumber(item.price))}`}
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
          <span className={`co-step ${['payment', 'processing', 'waiting', 'success', 'failed'].includes(stage) ? 'is-on' : ''}`}>Payment</span>
          <span className={`co-step ${['success', 'failed'].includes(stage) ? 'is-on' : ''}`}>Done</span>
        </div>

        {error && stage !== 'failed' && <p className="co-error">{error}</p>}

        {/* ---------------------------------------------------------- details */}
        {stage === 'details' && (
          <form className="co-body" onSubmit={goToPayment}>
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

        {/* ---------------------------------------------------------- payment */}
        {stage === 'payment' && (
          <form className="co-body" onSubmit={pay}>
            <div className="co-summary">
              <div>
                <span>
                  {item.name}
                  {!openAmount && ` × ${qty}`}
                </span>
                <strong>{money(estTotal)}</strong>
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
              <button type="button" className="btn btn-ghost" onClick={() => setStage('details')}>
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
