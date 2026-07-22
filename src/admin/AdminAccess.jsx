import { useEffect, useState } from 'react';
import { adminFetchSettings, saveSettings } from '../lib/api';
import PageLoader from '../components/PageLoader';

// Opens and closes the member portal at /members.
const AdminAccess = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    adminFetchSettings()
      .then((s) => active && setSettings(s))
      .catch((err) => active && setError(err.message || 'Could not load settings.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      setSettings(await saveSettings(settings));
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <PageLoader label="Loading…" compact />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="admin-page">
        <p className="admin-error">{error || 'Settings could not be loaded.'}</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1>Member access</h1>
          <p>
            Controls the members portal at <code>/members</code>, where the choir can update their
            own name, voice part, church, and photo.
          </p>
        </div>
      </header>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {saved && <p className="admin-success" role="status">Saved.</p>}

      {/* Access needs the switch AND a password. Saying so here is the whole
          difference between "I turned it on and it doesn't work" and a
          five-second fix. */}
      {!settings.memberCredentialsSet && (
        <p className="admin-notice">
          No member password is set on the server, so member sign-in stays closed even with this
          switched on. Set <code>MEMBER_PASSWORD_HASH</code> in <code>api/config.php</code> to
          enable it.
        </p>
      )}

      <form className="admin-form" onSubmit={submit}>
        <label className="admin-field is-bool">
          <span>Members can sign in</span>
          <input
            type="checkbox"
            checked={Boolean(settings.memberAccessOpen)}
            onChange={(e) =>
              setSettings((s) => ({ ...s, memberAccessOpen: e.target.checked }))
            }
          />
          <small className="admin-hint">
            When this is off, the portal shows a “closed” message and no member password is
            accepted. Turning it off does not sign out anyone already in.
          </small>
        </label>

        <div className="admin-field">
          <span>Username members use</span>
          <input type="text" value={settings.memberUsername ?? ''} readOnly />
          <small className="admin-hint">
            Set in <code>api/config.php</code>. Share this with the choir along with the password —
            the password itself is never shown here.
          </small>
        </div>

        <p className="admin-hint">
          This is one shared login for the whole choir: anyone who has it can edit any member’s
          entry, not only their own. Every change is recorded under Logs.
        </p>

        <div className="admin-form-foot">
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminAccess;
