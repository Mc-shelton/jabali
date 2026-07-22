import { useEffect, useMemo, useState } from 'react';
import {
  ReloadOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { adminFetchOrders, reconcileOrders, resendConfirmation } from '../lib/api';
import PageLoader from '../components/PageLoader';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const when = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';

const buyerName = (o) =>
  `${o.customer?.preferredName ?? ''} ${o.customer?.otherNames ?? ''}`.trim();
const reference = (o) => o.receipt || o.ticketCode || '';

// Each column declares how to sort itself, so the header row and the sort logic
// can't drift apart.
const COLUMNS = [
  { key: 'createdAt', label: 'Date', value: (o) => o.createdAt ?? '' },
  { key: 'buyer', label: 'Buyer', value: (o) => buyerName(o).toLowerCase() },
  { key: 'event', label: 'Event', value: (o) => (o.eventTitle ?? '').toLowerCase() },
  { key: 'item', label: 'Item', value: (o) => (o.itemName ?? '').toLowerCase() },
  { key: 'quantity', label: 'Qty', value: (o) => Number(o.quantity ?? 0), numeric: true },
  { key: 'amount', label: 'Amount', value: (o) => Number(o.amount ?? 0), numeric: true },
  { key: 'status', label: 'Status', value: (o) => o.status ?? '' },
  { key: 'reference', label: 'Reference', value: (o) => reference(o).toLowerCase() },
];

const EMPTY_FILTERS = {
  q: '',
  event: '',
  item: '',
  status: '',
  from: '',
  to: '',
};

const AdminOrders = () => {
  const [data, setData] = useState({ orders: [], stats: { total: 0, paid: 0, revenue: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [reconciling, setReconciling] = useState(false);
  const [reconcileNote, setReconcileNote] = useState('');
  // Which order is mid-resend, so only that row's button shows a busy state.
  const [resendingId, setResendingId] = useState('');

  const load = () =>
    adminFetchOrders()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const { orders } = data;

  // Dropdown choices come from the orders themselves — no separate config to
  // keep in step.
  const eventOptions = useMemo(
    () => [...new Set(orders.map((o) => o.eventTitle).filter(Boolean))].sort(),
    [orders],
  );
  const itemOptions = useMemo(
    () => [...new Set(orders.map((o) => o.itemName).filter(Boolean))].sort(),
    [orders],
  );

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();

    const rows = orders.filter((o) => {
      // Free text covers who bought it and how to identify the transaction.
      // Event and item are deliberately excluded — they have their own
      // dropdowns, and including them made searches ambiguous (searching a
      // buyer called "Carol" also matched the "Christmas Carols" event).
      if (q) {
        const haystack = [
          buyerName(o),
          o.customer?.email,
          o.customer?.phone,
          o.mpesaPhone,
          reference(o),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.event && o.eventTitle !== filters.event) return false;
      if (filters.item && o.itemName !== filters.item) return false;
      if (filters.status && o.status !== filters.status) return false;

      // Date bounds are inclusive of the whole `to` day.
      if (filters.from && (o.createdAt ?? '') < filters.from) return false;
      if (filters.to && (o.createdAt ?? '') > `${filters.to}T23:59:59`) return false;

      return true;
    });

    const col = COLUMNS.find((c) => c.key === sort.key) ?? COLUMNS[0];
    const factor = sort.dir === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      if (col.numeric) return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [orders, filters, sort]);

  // Stats follow the filter, so a filtered view reports on what's on screen.
  const shownStats = useMemo(() => {
    const paid = visible.filter((o) => o.status === 'success');
    return {
      count: visible.length,
      paid: paid.length,
      revenue: paid.reduce((sum, o) => sum + Number(o.amount ?? 0), 0),
    };
  }, [visible]);

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : // Dates and amounts are most useful highest-first on a first click.
          { key, dir: ['createdAt', 'amount', 'quantity'].includes(key) ? 'desc' : 'asc' },
    );

  const runReconcile = async () => {
    setReconciling(true);
    setReconcileNote('');
    setError('');
    try {
      const res = await reconcileOrders();
      await load();
      setReconcileNote(
        res.checked === 0
          ? 'No unsettled orders to check.'
          : `Checked ${res.checked} unsettled order${res.checked === 1 ? '' : 's'}. ` +
            `${res.settled} now settled` +
            (res.recovered > 0
              ? `, including ${res.recovered} that had been wrongly marked failed`
              : '') +
            '.' +
            // Surfaced rather than hidden: the payment status is still correct,
            // but something went wrong and it's in the log.
            (res.errored > 0
              ? ` ${res.errored} could not be checked — see Logs for details.`
              : ''),
      );
    } catch (err) {
      setError(err.message || 'Could not reconcile orders.');
    } finally {
      setReconciling(false);
    }
  };

  // Re-deliver one buyer's confirmation. The payment is already settled, so the
  // only thing at stake is the message — a failure here is reported and the row
  // simply keeps its warning flag.
  const runResend = async (order) => {
    setResendingId(order.id);
    setReconcileNote('');
    setError('');
    try {
      const res = await resendConfirmation(order.id);
      await load();
      setReconcileNote(
        res.ok
          ? `Confirmation re-sent to ${order.customer?.email || 'the buyer'}.`
          : `Could not send to ${order.customer?.email || 'the buyer'}` +
            (res.error ? `: ${res.error}` : '. See Logs for details.'),
      );
    } catch (err) {
      setError(err.message || 'Could not re-send the confirmation.');
    } finally {
      setResendingId('');
    }
  };

  const filtersActive = Object.values(filters).some(Boolean);

  if (loading) {
    return (
      <div className="admin-page">
        <PageLoader label="Loading orders…" compact />
      </div>
    );
  }

  return (
    <div className="admin-page admin-page-wide">
      <header className="admin-page-head">
        <div>
          <h1>Orders</h1>
          <p>Ticket and merchandise sales. Click a column heading to sort by it.</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={runReconcile}
          disabled={reconciling}
          title="Re-check unsettled orders against M-Pesa"
        >
          <ReloadOutlined /> {reconciling ? 'Checking…' : 'Re-check with M-Pesa'}
        </button>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {reconcileNote && <p className="admin-success">{reconcileNote}</p>}

      <div className="admin-stats">
        <div className="admin-stat">
          <span>{filtersActive ? 'Paid (filtered)' : 'Paid orders'}</span>
          <strong>{shownStats.paid}</strong>
        </div>
        <div className="admin-stat">
          <span>{filtersActive ? 'Revenue (filtered)' : 'Revenue'}</span>
          <strong>{money(shownStats.revenue)}</strong>
        </div>
        <div className="admin-stat">
          <span>{filtersActive ? 'Showing' : 'All orders'}</span>
          <strong>
            {shownStats.count}
            {filtersActive && <em className="admin-stat-of"> of {orders.length}</em>}
          </strong>
        </div>
      </div>

      <div className="admin-filters">
        <label className="admin-field admin-filter-search">
          <span>Search</span>
          <div className="admin-input-icon">
            <SearchOutlined />
            <input
              type="search"
              value={filters.q}
              onChange={setFilter('q')}
              placeholder="Name, email, phone, receipt…"
            />
          </div>
        </label>

        <label className="admin-field">
          <span>Event</span>
          <select value={filters.event} onChange={setFilter('event')}>
            <option value="">All events</option>
            {eventOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Item</span>
          <select value={filters.item} onChange={setFilter('item')}>
            <option value="">All items</option>
            {itemOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Status</span>
          <select value={filters.status} onChange={setFilter('status')}>
            <option value="">Any status</option>
            <option value="success">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </label>

        <label className="admin-field">
          <span>From</span>
          <input type="date" value={filters.from} onChange={setFilter('from')} />
        </label>

        <label className="admin-field">
          <span>To</span>
          <input type="date" value={filters.to} onChange={setFilter('to')} />
        </label>

        {filtersActive && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-filter-clear"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Clear
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="admin-muted">No orders yet.</p>
      ) : visible.length === 0 ? (
        <p className="admin-muted">No orders match these filters.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const active = sort.key === col.key;
                  return (
                    <th key={col.key}>
                      <button
                        type="button"
                        className={`admin-sort ${active ? 'is-active' : ''}`}
                        onClick={() => toggleSort(col.key)}
                        aria-label={`Sort by ${col.label}`}
                      >
                        {col.label}
                        {active ? (
                          sort.dir === 'asc' ? (
                            <CaretUpOutlined />
                          ) : (
                            <CaretDownOutlined />
                          )
                        ) : (
                          <span className="admin-sort-idle" aria-hidden="true">
                            <CaretUpOutlined />
                          </span>
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id}>
                  <td className="admin-nowrap">{when(o.createdAt)}</td>
                  <td>
                    <div className="admin-cell-strong">{buyerName(o)}</div>
                    <div className="admin-cell-sub">{o.customer?.email}</div>
                  </td>
                  <td>{o.eventTitle}</td>
                  <td>
                    {o.itemName}
                    <span
                      className={`admin-pill ${o.itemType === 'merch' ? 'is-merch' : 'is-ticket'}`}
                    >
                      {o.itemType}
                    </span>
                    {/* Chosen size / colour etc., recorded at checkout. */}
                    {o.options?.length > 0 && (
                      <div className="admin-cell-sub">
                        {o.options.map((opt) => `${opt.name}: ${opt.choice}`).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td>{o.quantity}</td>
                  <td className="admin-nowrap">{money(o.amount)}</td>
                  <td>
                    <span className={`admin-status is-${o.status}`}>{o.status}</span>
                    {/* Flags an order that polling had wrongly marked failed. */}
                    {o.correctedFrom === 'failed' && o.status === 'success' && (
                      <div className="admin-cell-sub" title="This order was wrongly marked failed and has been corrected">
                        recovered
                      </div>
                    )}
                    {/* Paid, but the confirmation never went out — the customer
                        has no ticket and needs contacting. */}
                    {o.status === 'success' && o.emailed && o.emailOk === false && (
                      <div
                        className="admin-flag-warn"
                        title={o.emailError || 'The confirmation email could not be sent. See Logs.'}
                      >
                        no email sent
                      </div>
                    )}
                    {/* Makes the flag above actionable. Only offered when there
                        is an address to send to — without one the button could
                        only ever fail. */}
                    {o.status === 'success' && o.emailOk === false && o.customer?.email && (
                      <button
                        type="button"
                        className="admin-resend-btn"
                        onClick={() => runResend(o)}
                        disabled={resendingId === o.id}
                        title={`Re-send the confirmation to ${o.customer.email}`}
                      >
                        {resendingId === o.id ? 'Sending…' : 'Re-send'}
                      </button>
                    )}
                  </td>
                  <td className="admin-cell-sub">{reference(o) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
