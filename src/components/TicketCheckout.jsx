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
  CopyOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import '../styles/checkout.scss';
import {
  fetchAvailableTicketGroups,
  getPaymentStatus,
  initiateTicketPayment,
  quoteTicketPayment,
} from '../lib/api';
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

const familyUnitPrice = (basePrice, group) => {
  const type = group.pricing?.type || 'full';
  const value = Math.max(0, Number(group.pricing?.value) || 0);
  if (type === 'fixed') return value;
  if (type === 'percent') return Math.max(0, Math.round(basePrice * (1 - Math.min(100, value) / 100)));
  return basePrice;
};

const initialFamilyCounts = (family) => {
  const groups = family?.groups ?? [];
  const counts = Object.fromEntries(groups.map((group) => {
    const min = Math.max(0, Number(group.min) || 0);
    const max = Math.max(min, Number(group.max) || min);
    return [group.id, Math.max(min, Math.min(max, Number(group.default) || 0))];
  }));

  let total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  let needed = Math.max(0, (Number(family?.minMembers) || 1) - total);
  for (const group of groups) {
    if (needed === 0) break;
    const room = Math.max(0, (Number(group.max) || 0) - (counts[group.id] || 0));
    const add = Math.min(room, needed);
    counts[group.id] = (counts[group.id] || 0) + add;
    needed -= add;
    total += add;
  }
  return counts;
};

// `kind` is 'ticket' or 'merch'. `item` is a { name, price, note } object — a
// ticket package or a merch product.
const TicketCheckout = ({ event, item, kind = 'ticket', inviteGroup = null, onClose }) => {
  const isMerch = kind === 'merch';
  const isFamily = !isMerch && item.type === 'family';
  const isGroup = !isMerch && item.type === 'group';
  const promoAllowed = isMerch || item.allowPromo !== false;
  const family = isFamily ? item.family ?? {} : null;
  const familyGroups = family?.groups ?? [];
  const groupCapacity = isGroup ? Math.min(50, Math.max(2, Math.trunc(Number(item.ticketCount) || 2))) : 0;
  const groupMemberPrice = isGroup ? Math.floor(priceToNumber(item.price) / groupCapacity) : 0;
  const ticketsPerPackage = isMerch || isGroup
    ? 1
    : Math.min(50, Math.max(1, Math.trunc(Number(item.ticketCount) || 1)));
  const isTicketBundle = !isMerch && !isFamily && !isGroup && ticketsPerPackage > 1;
  const qtyLabel = isMerch ? 'Quantity' : isTicketBundle ? 'Number of packages' : 'Number of tickets';
  const maxPurchaseQuantity = isMerch ? 20 : isTicketBundle ? 1 : 50;
  // details | extras | payment | processing | waiting | success | failed
  // `waiting` is not a failure — it's "we stopped auto-checking, press Refresh".
  const [activeGroup, setActiveGroup] = useState(inviteGroup);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [groupLimitReached, setGroupLimitReached] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [stage, setStage] = useState(inviteGroup?.full ? 'group-full' : 'details');
  const [form, setForm] = useState({
    groupName: '',
    preferredName: '',
    otherNames: '',
    phone: '',
    email: '',
    quantity: 1,
    promoCode: '',
  });
  const [familyCounts, setFamilyCounts] = useState(() => initialFamilyCounts(family));
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
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState(null);
  const [order, setOrder] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
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
  const basePrice = isFamily
    ? Number(family.basePrice) || 0
    : isGroup
      ? groupMemberPrice
      : item.priceFinal ?? priceToNumber(item.price);
  const familyLines = familyGroups.map((group) => {
    const quantity = familyCounts[group.id] || 0;
    const unitPrice = familyUnitPrice(basePrice, group);
    return { ...group, quantity, unitPrice, amount: quantity * unitPrice };
  });
  const familyMemberCount = familyLines.reduce((sum, line) => sum + line.quantity, 0);
  const familySubtotal = familyLines.reduce((sum, line) => sum + line.amount, 0);
  const familyMin = Number(family?.minMembers) || 1;
  const familyMax = Number(family?.maxMembers) || 50;
  const familyInvalid = isFamily && (familyMemberCount < familyMin || familyMemberCount > familyMax);

  const unit = isFamily
    ? familySubtotal
    : openAmount ? Number(customAmount) || 0 : basePrice + optionDelta;
  const qty = isFamily || isGroup
    ? 1
    : openAmount
    ? 1
    : Math.min(maxPurchaseQuantity, Math.max(1, Math.trunc(Number(form.quantity) || 1)));
  const admissionQuantity = isFamily ? familyMemberCount : isMerch ? qty : isGroup ? 1 : qty * ticketsPerPackage;
  const itemTotal = isFamily ? familySubtotal : unit * qty;
  const estTotal = itemTotal + addOnTotal;
  const promoApplied = Boolean(quote?.promoApplied);
  const promoDiscount = promoApplied ? Number(quote.discountAmount) || 0 : 0;
  const quotedItemTotal = quote ? Number(quote.itemAmount) : itemTotal;
  const displayedTotal = quotedItemTotal + addOnTotal;

  const amountTooLow = Boolean(openAmount) && unit < (openAmount.min ?? 1);

  const setFamilyCount = (group, next) => {
    const min = Math.max(0, Number(group.min) || 0);
    const max = Math.max(min, Number(group.max) || min);
    setFamilyCounts((counts) => ({ ...counts, [group.id]: Math.max(min, Math.min(max, next)) }));
    setQuote(null);
  };

  const loadAvailableGroups = async () => {
    if (!isGroup) return;
    setGroupsLoading(true);
    try {
      const data = await fetchAvailableTicketGroups(event.slug, item.name);
      setAvailableGroups(data.groups ?? []);
      setGroupLimitReached(Boolean(data.limitReached));
    } catch {
      // Availability is checked again atomically when payment starts. A brief
      // list failure must not break an otherwise valid checkout.
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    if (!isGroup || activeGroup) return;
    loadAvailableGroups();
  }, [isGroup, activeGroup?.token, event.slug, item.name]);

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
        // Analytics quantity is purchasable package units; using admissions
        // here would make a two-ticket bundle look like twice the revenue.
        quantity: status.packageQuantity ?? qty,
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

  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'promoCode' || key === 'quantity') setQuote(null);
  };

  const pricingPayload = {
    eventSlug: event.slug,
    itemType: kind,
    itemName: item.name,
    quantity: qty,
    ...(isGroup ? {
      groupToken: activeGroup?.token || '',
      groupName: activeGroup?.name || form.groupName.trim(),
    } : {}),
    ...(isFamily ? {
      family: familyLines.map((line) => ({ id: line.id, quantity: line.quantity })),
    } : {}),
    options: itemOptions
      .filter((opt) => choices[opt.name])
      .map((opt) => ({ name: opt.name, choice: choices[opt.name] })),
    ...(openAmount ? { amount: unit } : {}),
    addOns: addOnLines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      options: Object.entries(l.choices ?? {})
        .filter(([, choice]) => choice)
        .map(([name, choice]) => ({ name, choice })),
    })),
    promoCode: promoAllowed ? form.promoCode.trim() : '',
    ...(quote ? { expectedAmount: displayedTotal } : {}),
  };

  // Details → extras → payment. The extras step is skipped entirely when there
  // is nothing to offer, rather than showing an empty screen to click past.
  const goToExtras = async (e) => {
    e.preventDefault();
    setError('');
    setMpesaPhone((p) => p || form.phone);

    if (isGroup && !activeGroup && groupLimitReached) {
      setError('Five groups are already open. Please choose one of them below.');
      return;
    }
    if (isGroup && !activeGroup && !form.groupName.trim()) {
      setError('Please give your group a name.');
      return;
    }

    if (!isFamily && !isGroup && !pricingPayload.promoCode) {
      setQuote(null);
      setStage(addOnCatalogue.length > 0 ? 'extras' : 'payment');
      return;
    }

    setQuoting(true);
    try {
      const verified = await quoteTicketPayment(pricingPayload);
      if (pricingPayload.promoCode && !verified.promoApplied) {
        setError('That promo code wasn’t recognised. Check it and try again.');
        return;
      }
      setQuote(verified);
      setStage(addOnCatalogue.length > 0 ? 'extras' : 'payment');
    } catch (err) {
      if (isGroup && err.status === 409 && /group is full/i.test(err.message)) {
        setActiveGroup((group) => ({ ...(group || {}), full: true }));
        setStage('group-full');
        return;
      }
      if (isGroup && err.status === 409 && /open groups/i.test(err.message)) {
        await loadAvailableGroups();
        setError('Five groups are already open. Please join one of them.');
        setStage('details');
        return;
      }
      setError(err.message || 'Could not verify the promo code. Please try again.');
    } finally {
      setQuoting(false);
    }
  };

  const pay = async (e) => {
    e.preventDefault();
    setError('');
    setStage('processing');
    beginCheckout({ item, quantity: qty, value: displayedTotal, kind });
    try {
      const res = await initiateTicketPayment({
        ...pricingPayload,
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
      if (isGroup && err.status === 409 && /group is full/i.test(err.message)) {
        setActiveGroup((group) => ({ ...(group || {}), full: true }));
        setStage('group-full');
        return;
      }
      if (isGroup && err.status === 409 && /open groups/i.test(err.message)) {
        await loadAvailableGroups();
        setError('Five groups are already open. Please join one of them.');
        setStage('details');
        return;
      }
      setError(err.message || 'Could not start the payment.');
      setStage('payment');
    }
  };

  const amount = order?.amount ?? displayedTotal;
  const completedGroup = result?.group || order?.group || activeGroup;
  const groupInviteUrl = completedGroup?.token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/events/${encodeURIComponent(event.slug)}?group=${encodeURIComponent(completedGroup.token)}`
    : '';

  const copyGroupLink = async () => {
    if (!groupInviteUrl) return;
    try {
      await navigator.clipboard.writeText(groupInviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const startNewGroup = () => {
    setActiveGroup(null);
    setForm((current) => ({ ...current, groupName: '' }));
    setError('');
    setQuote(null);
    setStage('details');
  };

  const joinOpenGroup = (group) => {
    setActiveGroup(group);
    setError('');
    setQuote(null);
  };

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
              ) : promoApplied ? (
                ' · promo applied'
              ) : isFamily ? (
                ` · ${item.price || 'build your package'}`
              ) : isGroup ? (
                ` · ${money(groupMemberPrice)} per person`
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
          <span className={`co-step ${['success', 'failed', 'group-full'].includes(stage) ? 'is-on' : ''}`}>Done</span>
        </div>

        {error && stage !== 'failed' && <p className="co-error">{error}</p>}

        {/* ---------------------------------------------------------- details */}
        {stage === 'details' && (
          <form className="co-body" onSubmit={goToExtras}>
            {isGroup && (
              <section className="co-group-card">
                <TeamOutlined />
                <div>
                  <strong>{activeGroup ? activeGroup.name : `Create a group of ${groupCapacity}`}</strong>
                  <p>
                    {activeGroup
                      ? `${activeGroup.occupied} of ${activeGroup.capacity} places are taken. Pay for your own place, then share the same link.`
                      : groupLimitReached
                        ? 'Five groups are already open. Join one below instead of creating another.'
                        : `Name the group and pay ${money(groupMemberPrice)} for your place. You’ll get a link for ${groupCapacity - 1} friends to pay for theirs.`}
                  </p>
                </div>
              </section>
            )}

            {isGroup && !activeGroup && !groupLimitReached && (
              <label className="co-field">
                <span>Group name *</span>
                <input
                  value={form.groupName}
                  onChange={setField('groupName')}
                  placeholder="e.g. The Harmonies"
                  maxLength="80"
                  required
                  autoFocus
                />
              </label>
            )}

            {isGroup && !activeGroup && (groupsLoading || availableGroups.length > 0) && (
              <section className="co-open-groups" aria-labelledby="co-open-groups-title">
                <div>
                  <strong id="co-open-groups-title">Join an existing group</strong>
                  <p>{groupsLoading ? 'Checking open groups…' : 'Choose a group with places still available.'}</p>
                </div>
                {!groupsLoading && availableGroups.map((group) => (
                  <button type="button" key={group.token} onClick={() => joinOpenGroup(group)}>
                    <span>
                      <strong>{group.name}</strong>
                      <small>Created by {group.createdBy || 'a ticket buyer'}</small>
                    </span>
                    <span>{group.remaining} {group.remaining === 1 ? 'place' : 'places'} left</span>
                  </button>
                ))}
              </section>
            )}

            {isFamily && (
              <section className="co-family" aria-labelledby="co-family-title">
                <div className="co-family-head">
                  <div>
                    <h3 id="co-family-title">Who’s coming?</h3>
                    <p>Choose {familyMin}–{familyMax} family members. Each person receives a separate ticket.</p>
                  </div>
                  <strong>{familyMemberCount} {familyMemberCount === 1 ? 'ticket' : 'tickets'}</strong>
                </div>
                <div className="co-family-groups">
                  {familyLines.map((group) => (
                    <div className="co-family-group" key={group.id}>
                      <div className="co-family-label">
                        <strong>{group.label}</strong>
                        <span>
                          {[group.ageLabel, `${money(group.unitPrice)} each`].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <div className="co-family-qty">
                        <button
                          type="button"
                          onClick={() => setFamilyCount(group, group.quantity - 1)}
                          disabled={group.quantity <= Number(group.min || 0)}
                          aria-label={`Remove one ${group.label}`}
                        >
                          −
                        </button>
                        <span aria-live="polite">{group.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setFamilyCount(group, group.quantity + 1)}
                          disabled={group.quantity >= Number(group.max || 0) || familyMemberCount >= familyMax}
                          aria-label={`Add one ${group.label}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {familyInvalid && (
                  <p className="co-family-warning">Choose between {familyMin} and {familyMax} people to continue.</p>
                )}
              </section>
            )}

            <div className="co-grid-2">
              <label className="co-field">
                <span>Preferred name *</span>
                <input value={form.preferredName} onChange={setField('preferredName')} required autoFocus={!isFamily && !isGroup} />
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
                      onChange={(e) => {
                        setChoices((c) => ({ ...c, [opt.name]: e.target.value }));
                        setQuote(null);
                      }}
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

            {(openAmount || (!isTicketBundle && !isFamily && !isGroup) || promoAllowed) && (
            <div className={`co-grid-2 ${isTicketBundle || isFamily || isGroup ? 'is-single' : ''}`}>
              {openAmount ? (
                <label className="co-field">
                  <span>Amount (KES) *</span>
                  <input
                    type="number"
                    min={openAmount.min ?? 1}
                    step="1"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setQuote(null);
                    }}
                    placeholder={String(openAmount.min ?? 1)}
                    required
                  />
                  <small>Minimum {money(openAmount.min ?? 1)}.</small>
                </label>
              ) : !isTicketBundle && !isFamily && !isGroup ? (
                <label className="co-field">
                  <span>{qtyLabel} *</span>
                  <input
                    type="number"
                    min="1"
                    max={maxPurchaseQuantity}
                    step="1"
                    value={form.quantity}
                    onChange={setField('quantity')}
                    required
                  />
                </label>
              ) : null}
              {promoAllowed && <label className="co-field">
                <span>Promo code</span>
                <input value={form.promoCode} onChange={setField('promoCode')} placeholder="Optional" />
              </label>}
            </div>
            )}

            {(isTicketBundle || isFamily || isGroup) && (
              <p className="co-note">
                {isFamily
                  ? `Your current family mix includes ${familyMemberCount} individually scannable tickets.`
                  : isGroup
                    ? `You are paying for one place. The complete group costs ${money(priceToNumber(item.price))} for ${groupCapacity} people.`
                  : `This package includes ${ticketsPerPackage} individually scannable tickets.`}
              </p>
            )}

            <div className="co-total">
              <span>
                {form.promoCode.trim()
                  ? 'Subtotal before promo'
                  : openAmount
                    ? 'Your amount'
                    : 'Estimated total'}
              </span>
              <strong>{money(estTotal)}</strong>
            </div>

            {form.promoCode.trim() && (
              <p className="co-summary-note">We’ll verify the promo code before showing the payment amount.</p>
            )}

            {amountTooLow && customAmount !== '' && (
              <p className="co-error">Please enter at least {money(openAmount.min ?? 1)}.</p>
            )}

            <button type="submit" className="btn btn-primary co-submit" disabled={amountTooLow || familyInvalid || quoting || (isGroup && !activeGroup && groupLimitReached)}>
              {quoting ? (
                <>
                  <LoadingOutlined />
                  {isFamily || isGroup ? 'Checking availability…' : 'Verifying promo…'}
                </>
              ) : (
                <>
                  Continue to payment
                  <ArrowRightOutlined />
                </>
              )}
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
              {isFamily ? familyLines.filter((line) => line.quantity > 0).map((line) => (
                <div key={line.id}>
                  <span>{line.label} × {line.quantity}</span>
                  <strong>{money(line.amount)}</strong>
                </div>
              )) : (
                <div>
                  <span>
                    {item.name}
                    {!openAmount && ` × ${qty}`}
                    {isTicketBundle && ` (${admissionQuantity} tickets)`}
                  </span>
                  <strong>{money(itemTotal)}</strong>
                </div>
              )}
              {promoApplied && (
                <div className="co-summary-discount">
                  <span>Promo {quote.promoCode}</span>
                  <strong>−{money(promoDiscount)}</strong>
                </div>
              )}
              {addOnTotal > 0 && (
                <div>
                  <span>Merchandise</span>
                  <strong>{money(addOnTotal)}</strong>
                </div>
              )}
            </div>

            <div className="co-total">
              <span>Total</span>
              <strong>{money(displayedTotal)}</strong>
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
              {isFamily ? familyLines.filter((line) => line.quantity > 0).map((line) => (
                <div key={line.id}>
                  <span>{line.label} × {line.quantity}</span>
                  <strong>{money(line.amount)}</strong>
                </div>
              )) : (
                <div>
                  <span>
                    {item.name}
                    {!openAmount && ` × ${qty}`}
                    {isTicketBundle && ` (${admissionQuantity} tickets)`}
                  </span>
                  <strong>{money(itemTotal)}</strong>
                </div>
              )}
              {promoApplied && (
                <div className="co-summary-discount">
                  <span>Promo {quote.promoCode}</span>
                  <strong>−{money(promoDiscount)}</strong>
                </div>
              )}
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

              {(isFamily || promoApplied || addOnTotal > 0) && (
                <div className="co-summary-total">
                  <span>Total</span>
                  <strong>{money(displayedTotal)}</strong>
                </div>
              )}

              <p className="co-summary-note">
                {promoApplied
                  ? `Promo applied. You’ll approve ${money(displayedTotal)} on your phone.`
                  : 'You’ll approve the exact amount on your phone.'}
              </p>
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
                Pay {money(displayedTotal)}
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
              Thank you! {isGroup ? 'Your place' : `Your purchase for ${result?.quantity ?? admissionQuantity} ${(result?.quantity ?? admissionQuantity) === 1 ? 'ticket' : 'tickets'}`} to {event.title} is confirmed.
              {result?.receipt && (
                <>
                  {' '}
                  M-Pesa receipt <strong>{result.receipt}</strong>.
                </>
              )}{' '}
              A confirmation will follow to <strong>{form.email}</strong>.
            </p>
            {isGroup && completedGroup && !completedGroup.full && (
              <section className="co-share">
                <div>
                  <strong>Invite people to {completedGroup.name}</strong>
                  <p>
                    {completedGroup.occupied} of {completedGroup.capacity} places are taken. Anyone with this link can pay for one of the remaining {completedGroup.remaining}.
                  </p>
                </div>
                <div className="co-share-link">
                  <input value={groupInviteUrl} readOnly aria-label="Group invite link" onFocus={(e) => e.target.select()} />
                  <button type="button" className="btn btn-ghost" onClick={copyGroupLink}>
                    <CopyOutlined /> {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              </section>
            )}
            {isGroup && completedGroup?.full && (
              <p className="co-note">{completedGroup.name} is complete — all {completedGroup.capacity} places are taken.</p>
            )}
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------- group full */}
        {stage === 'group-full' && (
          <div className="co-body co-centre">
            <TeamOutlined className="co-icon is-wait" />
            <h3>This group is full</h3>
            <p className="co-centre-text">
              {activeGroup?.name ? <><strong>{activeGroup.name}</strong> has no places left. </> : null}
              You can start a new group for the same ticket package and invite your friends there.
            </p>
            <div className="co-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
              <button type="button" className="btn btn-primary" onClick={startNewGroup}>Create a new group</button>
            </div>
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
