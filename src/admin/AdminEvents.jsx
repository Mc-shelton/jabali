import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminFetchEvents, deleteEvent } from '../lib/api';
import PageLoader from '../components/PageLoader';

const Row = ({ event, onDelete }) => (
  <li className="admin-event-row">
    <span
      className="admin-event-thumb"
      style={event.poster ? { backgroundImage: `url("${event.poster}")` } : undefined}
    />
    <span className="admin-event-info">
      <span className="admin-event-title">{event.title}</span>
      <span className="admin-event-meta">
        {event.date} · {event.type}
        {event.ticketed ? ' · Ticketed' : ''}
      </span>
    </span>
    <span className={`admin-tag ${event.status === 'past' ? 'is-muted' : 'is-live'}`}>
      {event.status === 'past' ? 'Past' : 'Upcoming'}
    </span>
    <span className="admin-event-actions">
      <Link className="admin-icon-btn" to={`/admin/events/${event.slug}/edit`} aria-label={`Edit ${event.title}`}>
        <EditOutlined />
      </Link>
      <button
        type="button"
        className="admin-icon-btn is-danger"
        onClick={() => onDelete(event)}
        aria-label={`Delete ${event.title}`}
      >
        <DeleteOutlined />
      </button>
    </span>
  </li>
);

const AdminEvents = () => {
  const [events, setEvents] = useState({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    adminFetchEvents()
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onDelete = async (event) => {
    if (!window.confirm(`Delete “${event.title}”? This can't be undone.`)) return;
    try {
      await deleteEvent(event.slug);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1>Events</h1>
          <p>Create and manage everything shown on the Events page.</p>
        </div>
        <Link className="admin-btn admin-btn-primary" to="/admin/events/new">
          <PlusOutlined /> New event
        </Link>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {loading ? (
        <PageLoader label="Loading events…" compact />
      ) : (
        <>
          <h2 className="admin-section-title">Upcoming</h2>
          <ul className="admin-event-list">
            {events.upcoming.length ? (
              events.upcoming.map((e) => <Row key={e.slug} event={e} onDelete={onDelete} />)
            ) : (
              <li className="admin-muted">No upcoming events.</li>
            )}
          </ul>

          <h2 className="admin-section-title">Past</h2>
          <ul className="admin-event-list">
            {events.past.length ? (
              events.past.map((e) => <Row key={e.slug} event={e} onDelete={onDelete} />)
            ) : (
              <li className="admin-muted">No past events.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
};

export default AdminEvents;
