import { useState } from 'react';

// Sign-in for the member portal. Username is shown and pre-filled rather than
// hidden: it is not a secret, everyone uses the same one, and pre-filling it
// removes the most likely reason a correct password gets rejected.
const MemberLogin = ({ onLogin, accessOpen = true }) => {
  const [username, setUsername] = useState('jabali-member');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Sign in failed.');
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <p className="admin-login-brand">
          Jabali <em>Chorale</em>
        </p>
        <h1>Member sign in</h1>
        <p className="admin-login-sub">Update your details and photo on the chorale roster.</p>

        {/* Said up front rather than after a failed attempt, so nobody spends
            the evening deciding they have forgotten a password that is right. */}
        {!accessOpen && (
          <p className="admin-notice" role="status">
            Member access is closed at the moment. The chorale admin can open it.
          </p>
        )}

        <label className="admin-field">
          <span>Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="admin-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>

        {error && <p className="admin-error">{error}</p>}

        <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="admin-login-foot">
          This is the shared chorale member login. For the full dashboard, go to{' '}
          <a href="/admin">/admin</a>.
        </p>
      </form>
    </div>
  );
};

export default MemberLogin;
