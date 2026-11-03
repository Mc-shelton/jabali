import { useEffect, useMemo, useRef, useState } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { createComplimentaryTickets } from '../lib/api';

const initialForm = {
  eventSlug: '',
  packageName: '',
  quantity: 1,
  preferredName: '',
  otherNames: '',
  email: '',
  phone: '',
  note: '',
};

const AdminComplimentaryTicketForm = ({ events, onClose, onCreated }) => {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const closeRef = useRef(null);

  const ticketEvents = useMemo(
    () => [...(events.upcoming ?? []), ...(events.past ?? [])],
    [events],
  );
  const event = ticketEvents.find((row) => row.slug === form.eventSlug);
  const packages = event?.packages?.length
    ? event.packages
    : event
      ? [{ name: 'General admission', type: 'standard' }]
      : [];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, saving]);

  const update = (key) => (e) => {
    const value = e.target.value;
    setForm((current) => {
      if (key === 'eventSlug') {
        const selected = ticketEvents.find((row) => row.slug === value);
        return {
          ...current,
          eventSlug: value,
          packageName: selected?.packages?.[0]?.name ?? (selected ? 'General admission' : ''),
        };
      }
      return { ...current, [key]: value };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await createComplimentaryTickets({
        eventSlug: form.eventSlug,
        packageName: form.packageName,
        quantity: Number(form.quantity),
        customer: {
          preferredName: form.preferredName,
          otherNames: form.otherNames,
          email: form.email,
          phone: form.phone,
        },
        note: form.note,
      });
      await onCreated(result.order);
    } catch (err) {
      setError(err.message || 'Could not issue the tickets.');
      setSaving(false);
    }
  };

  return (
    <div
      className="admin-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Issue complimentary tickets">
        <header className="admin-modal-head">
          <div>
            <h2>Issue complimentary tickets</h2>
            <p className="admin-cell-sub">No payment is created. The recipient gets normal PDF tickets by email.</p>
          </div>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            ref={closeRef}
            disabled={saving}
            aria-label="Close ticket form"
          >
            <CloseOutlined />
          </button>
        </header>

        <form className="admin-modal-body admin-issue-form" onSubmit={submit}>
          {error && <p className="admin-error">{error}</p>}

          <div className="admin-grid-2">
            <label className="admin-field">
              <span>Event</span>
              <select value={form.eventSlug} onChange={update('eventSlug')} required>
                <option value="">Choose an event</option>
                {ticketEvents.map((row) => (
                  <option key={row.slug} value={row.slug}>
                    {row.title}{row.status === 'past' ? ' (past)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Ticket package</span>
              <select
                value={form.packageName}
                onChange={update('packageName')}
                required
                disabled={!event}
              >
                <option value="">Choose a package</option>
                {packages.map((ticketPackage) => (
                  <option key={ticketPackage.name} value={ticketPackage.name}>
                    {ticketPackage.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="admin-field admin-issue-quantity">
            <span>Number of individual tickets</span>
            <input
              type="number"
              min="1"
              max="50"
              value={form.quantity}
              onChange={update('quantity')}
              required
            />
            <small>Each person receives a separate QR code. Commercial bundle sizes do not multiply this number.</small>
          </label>

          <div className="admin-grid-2">
            <label className="admin-field">
              <span>Preferred name</span>
              <input value={form.preferredName} onChange={update('preferredName')} maxLength="80" required />
            </label>
            <label className="admin-field">
              <span>Other names</span>
              <input value={form.otherNames} onChange={update('otherNames')} maxLength="120" />
            </label>
          </div>

          <div className="admin-grid-2">
            <label className="admin-field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={update('email')} maxLength="160" required />
            </label>
            <label className="admin-field">
              <span>Phone (optional)</span>
              <input type="tel" value={form.phone} onChange={update('phone')} maxLength="20" />
            </label>
          </div>

          <label className="admin-field">
            <span>Internal note (optional)</span>
            <textarea
              rows="3"
              value={form.note}
              onChange={update('note')}
              maxLength="240"
              placeholder="Why these tickets were issued"
            />
          </label>

          <div className="admin-issue-actions">
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || ticketEvents.length === 0}>
              {saving ? 'Issuing and emailing…' : 'Issue tickets'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminComplimentaryTicketForm;
