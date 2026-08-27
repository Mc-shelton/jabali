import { useEffect, useRef } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { buyerName, money, optionText, orderLines, reference, totalUnits, when } from './orderLines';

// The orders table shows one line per order so the grid stays scannable. This
// dialog is where the rest of a purchase lives: every line, every fulfilment
// choice (polo size, colour), and the payment record behind it.
const AdminOrderDetail = ({ order, onClose }) => {
  const closeRef = useRef(null);

  // Lock scroll, close on Escape, and put focus somewhere sensible so the
  // dialog can be dismissed from the keyboard alone.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!order) return null;

  const lines = orderLines(order);

  // Only the facts this order actually carries — an empty row reads as missing
  // data rather than as "not applicable".
  const meta = [
    ['Placed', when(order.createdAt)],
    ['Paid', when(order.paidAt)],
    ['Event', order.eventTitle],
    ['Venue', order.eventVenue],
    ['Email', order.customer?.email],
    ['Phone', order.customer?.phone],
    ['Paid from', order.mpesaPhone],
    ['M-Pesa receipt', order.receipt],
    ['Payment reference', order.paymentReference],
    ['Ticket code', order.ticketCode],
    ['Promo code', order.promoCode],
    ['Admitted', when(order.admittedAt)],
  ].filter(([, value]) => value);

  return (
    <div
      className="admin-modal-backdrop"
      // A click that starts inside the dialog and drags out shouldn't close it,
      // so only a press that both starts and ends on the backdrop counts.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Order details">
        <header className="admin-modal-head">
          <div>
            <h2>{buyerName(order) || 'Order'}</h2>
            <p className="admin-cell-sub">
              {reference(order) || 'No reference yet'} · {when(order.createdAt)}
            </p>
          </div>
          <div className="admin-modal-head-right">
            <span className={`admin-status is-${order.status}`}>{order.status}</span>
            <button
              type="button"
              className="admin-modal-close"
              onClick={onClose}
              ref={closeRef}
              aria-label="Close order details"
            >
              <CloseOutlined />
            </button>
          </div>
        </header>

        <div className="admin-modal-body">
          <section>
            <h3 className="admin-modal-heading">
              Items <span className="admin-cell-sub">({totalUnits(order)} in total)</span>
            </h3>
            <ul className="admin-detail-lines">
              {lines.map((line, index) => (
                <li className="admin-detail-line" key={`${line.name}-${index}`}>
                  <div className="admin-detail-line-head">
                    <span className="admin-cell-strong">{line.name}</span>
                    <span
                      className={`admin-pill ${line.type === 'merch' ? 'is-merch' : 'is-ticket'}`}
                    >
                      {line.type}
                    </span>
                    <span className="admin-line-qty">× {line.quantity}</span>
                    {line.amount != null && (
                      <span className="admin-detail-line-amount">{money(line.amount)}</span>
                    )}
                  </div>
                  {/* One row per choice rather than a run-on line — this is what
                      whoever hands over the merchandise reads off. */}
                  {line.options?.length > 0 && (
                    <dl className="admin-detail-options">
                      {line.options.map((opt) => (
                        <div key={opt.name}>
                          <dt>{opt.name}</dt>
                          <dd>{opt.choice}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
            <p className="admin-detail-total">
              <span>Order total</span>
              <strong>{money(order.amount)}</strong>
            </p>
          </section>

          <section>
            <h3 className="admin-modal-heading">Record</h3>
            <dl className="admin-detail-meta">
              {meta.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {order.status === 'success' && order.emailOk === false && (
              <p className="admin-flag-warn">
                {order.emailError || 'The confirmation email could not be sent. See Logs.'}
              </p>
            )}
            {order.status === 'failed' && order.resultDesc && (
              <p className="admin-cell-sub">{order.resultDesc}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetail;
