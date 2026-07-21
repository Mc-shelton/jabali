import { useState } from 'react';

const AdminLogin = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onLogin(password);
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
        <h1>Admin sign in</h1>
        <p className="admin-login-sub">Manage events and the Jabali @5 journey.</p>

        <label className="admin-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
        </label>

        {error && <p className="admin-error">{error}</p>}

        <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};

export default AdminLogin;
