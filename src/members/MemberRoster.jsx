import { useEffect, useMemo, useState } from 'react';
import { SearchOutlined, UserAddOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import {
  adminFetchContent,
  adminFetchContentSchema,
  saveContent,
} from '../lib/api';
import SchemaField, { emptyValue } from '../admin/SchemaField';
import PageLoader from '../components/PageLoader';

// Find your entry, then edit it.
//
// The roster is one content section holding a list of ~200 people, and the
// admin screen edits it as a list. That is the wrong shape here: a member wants
// their own row and has no business scrolling past everyone else's to reach it.
// So this screen searches first and only ever opens one person at a time.

const norm = (s) => String(s ?? '').trim().toLowerCase();

const MemberRoster = ({ role }) => {
  const [schema, setSchema] = useState(null);
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  // The row being edited, plus the name it had when opened — that name is how
  // it's found again at save time, because its index may have moved.
  const [draft, setDraft] = useState(null);
  const [originalName, setOriginalName] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState('');

  const memberSpec = schema?.members?.fields?.members?.of ?? null;

  useEffect(() => {
    let active = true;
    Promise.all([adminFetchContentSchema(), adminFetchContent('members')])
      .then(([s, data]) => {
        if (!active) return;
        setSchema(s);
        setMembers(Array.isArray(data?.members) ? data.members : []);
      })
      .catch((err) => {
        if (!active) return;
        // 404 is "nothing saved yet", which is an empty roster, not a failure.
        if (err.status === 404) setMembers([]);
        else setError(err.message || 'Could not load the roster.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const matches = useMemo(() => {
    const q = norm(query);
    if (!q || !members) return [];
    return members
      .map((m, index) => ({ m, index }))
      .filter(({ m }) =>
        [m.name, m.voice, m.church].some((field) => norm(field).includes(q)),
      )
      .slice(0, 25);
  }, [query, members]);

  const exactExists = useMemo(
    () => (members ?? []).some((m) => norm(m.name) === norm(query)),
    [members, query],
  );

  const openExisting = (member) => {
    setSavedName('');
    setError('');
    setOriginalName(member.name ?? '');
    setDraft({ ...member });
  };

  const openNew = () => {
    setSavedName('');
    setError('');
    setOriginalName(null);
    setDraft({ ...emptyValue(memberSpec), name: query.trim() });
  };

  const cancel = () => {
    setDraft(null);
    setOriginalName(null);
    setError('');
  };

  const save = async () => {
    if (!draft || saving) return;

    if (!String(draft.name ?? '').trim()) {
      setError('A name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Re-read immediately before writing. This credential is shared, so two
      // people can be in here at once, and this endpoint replaces the whole
      // list — saving the copy fetched on page load would silently revert
      // anything anyone else changed in the meantime. Only the row being
      // edited is applied to the current roster.
      let current;
      try {
        const fresh = await adminFetchContent('members');
        current = Array.isArray(fresh?.members) ? fresh.members : [];
      } catch (err) {
        if (err.status === 404) current = [];
        else throw err;
      }

      const at = originalName === null
        ? -1
        : current.findIndex((m) => norm(m.name) === norm(originalName));

      const next = at >= 0
        ? current.map((m, i) => (i === at ? { ...m, ...draft } : m))
        : [...current, draft];

      const stored = await saveContent('members', { members: next });
      setMembers(Array.isArray(stored?.members) ? stored.members : next);
      setSavedName(String(draft.name).trim());
      setDraft(null);
      setOriginalName(null);
      setQuery('');
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <PageLoader label="Loading the roster…" compact />
      </div>
    );
  }

  if (!memberSpec) {
    return (
      <div className="admin-page">
        <p className="admin-error">{error || 'The roster form could not be loaded.'}</p>
      </div>
    );
  }

  // ------------------------------------------------------------------ editing
  if (draft) {
    return (
      <div className="admin-page">
        <header className="admin-page-head">
          <div>
            <h1>{originalName === null ? 'Add a member' : `Editing ${originalName}`}</h1>
            <p>
              {originalName === null
                ? 'Fill in the details and save to add this person to the roster.'
                : 'Update the details below. Changes go live on the About page as soon as you save.'}
            </p>
          </div>
        </header>

        {error && <p className="admin-error" role="alert">{error}</p>}

        <form
          className="admin-form mp-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="admin-grid-2">
            {Object.entries(memberSpec.fields ?? {}).map(([name, spec]) => (
              <SchemaField
                key={name}
                name={name}
                spec={spec}
                path={name}
                value={draft[name]}
                onChange={(next) => setDraft((d) => ({ ...d, [name]: next }))}
              />
            ))}
          </div>

          <div className="admin-form-foot">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={cancel}
              disabled={saving}
            >
              <ArrowLeftOutlined /> Back to search
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ------------------------------------------------------------------ search
  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1>Choir members</h1>
          <p>
            Search for your name to update your details and photo. If you are not on the roster
            yet, you can add yourself.
          </p>
        </div>
      </header>

      {savedName && (
        <p className="admin-success" role="status">
          Saved. {savedName}’s details are live on the site.
        </p>
      )}
      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="mp-search">
        <SearchOutlined />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, voice part, or church"
          aria-label="Search the roster"
          autoFocus
        />
      </div>

      {query.trim() === '' ? (
        <p className="admin-hint mp-empty">
          {members.length} {members.length === 1 ? 'person is' : 'people are'} on the roster. Start
          typing to find one.
        </p>
      ) : (
        <>
          <ul className="mp-results">
            {matches.map(({ m, index }) => (
              <li key={`${m.name}-${index}`}>
                <button type="button" className="mp-result" onClick={() => openExisting(m)}>
                  {m.photo ? (
                    <img className="mp-result-photo" src={m.photo} alt="" />
                  ) : (
                    <span className="mp-result-photo is-blank" aria-hidden="true" />
                  )}
                  <span className="mp-result-text">
                    <strong>{m.name || 'Unnamed'}</strong>
                    <small>
                      {[m.voice, m.church].filter(Boolean).join(' · ') || 'No details yet'}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {matches.length === 0 && (
            <p className="admin-hint mp-empty">
              Nobody on the roster matches “{query.trim()}”.
            </p>
          )}

          {/* Offered whenever the typed name isn't already taken — including
              alongside partial matches, since "Ann" matching "Anne" must not
              stop a real Ann from adding herself. */}
          {!exactExists && (
            <button type="button" className="admin-btn admin-btn-primary mp-add" onClick={openNew}>
              <UserAddOutlined /> Add “{query.trim()}” as a new member
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default MemberRoster;
