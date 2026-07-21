import { useCallback, useEffect, useState } from 'react';
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminFetchLogs, clearLogs } from '../lib/api';
import PageLoader from '../components/PageLoader';

// Server-side log viewer. The log files sit under api/data/, which is blocked
// from the web, so this is the only way to read them without shell access.

const LEVELS = ['', 'error', 'warning', 'deprecated', 'notice', 'info'];
const LEVEL_LABEL = {
  '': 'All levels',
  error: 'Errors',
  warning: 'Warnings',
  deprecated: 'Deprecations',
  notice: 'Notices',
  info: 'Info',
};

const time = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' });
};

const AdminLogs = () => {
  const [data, setData] = useState({ day: '', days: [], entries: [] });
  const [day, setDay] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminFetchLogs({ day, level }));
    } catch (err) {
      setError(err.message || 'Could not load the log.');
    } finally {
      setLoading(false);
    }
  }, [day, level]);

  useEffect(() => {
    load();
  }, [load]);

  const onClear = async () => {
    const target = data.day;
    if (!target) return;
    setNote('');
    try {
      await clearLogs(target);
      setNote(`Cleared the log for ${target}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Could not clear the log.');
    }
  };

  return (
    <div className="admin-page admin-page-wide">
      <header className="admin-page-head">
        <div>
          <h1>Logs</h1>
          <p>
            Server errors and M-Pesa activity. Quote the reference shown in an error message to find
            it here.
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn-ghost" onClick={load} disabled={loading}>
          <ReloadOutlined /> Refresh
        </button>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {note && <p className="admin-success">{note}</p>}

      <div className="admin-filters">
        <label className="admin-field">
          <span>Day</span>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            <option value="">Today</option>
            {data.days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Level</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l || 'all'} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </label>

        {data.entries.length > 0 && (
          <button type="button" className="admin-btn admin-btn-ghost admin-filter-clear" onClick={onClear}>
            <DeleteOutlined /> Clear this day
          </button>
        )}
      </div>

      {loading ? (
        <PageLoader label="Loading log…" compact />
      ) : data.entries.length === 0 ? (
        <p className="admin-muted">
          Nothing logged for {data.day || 'today'}
          {level ? ` at level "${level}"` : ''}. That’s usually good news.
        </p>
      ) : (
        <div className="admin-log">
          {data.entries.map((entry, i) => (
            <article className={`admin-log-row is-${entry.level}`} key={`${entry.time}-${i}`}>
              <div className="admin-log-meta">
                <span className={`admin-log-level is-${entry.level}`}>{entry.level}</span>
                <span className="admin-nowrap">{time(entry.time)}</span>
                {entry.ref && <code className="admin-log-ref">{entry.ref}</code>}
              </div>
              <div className="admin-log-body">
                <p className="admin-log-message">{entry.message}</p>
                {(entry.method || entry.path) && (
                  <p className="admin-cell-sub">
                    {entry.method} {entry.path}
                  </p>
                )}
                {entry.context && Object.keys(entry.context).length > 0 && (
                  <pre className="admin-log-context">{JSON.stringify(entry.context, null, 2)}</pre>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLogs;
