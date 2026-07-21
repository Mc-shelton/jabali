import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useParams, Navigate } from 'react-router-dom';
import { adminFetchContent, adminFetchContentSchema, saveContent } from '../lib/api';
import { contentSeed } from '../data/content';
import SchemaField, { emptyValue } from './SchemaField';
import PageLoader from '../components/PageLoader';

// Site content editor. Every form on this page is generated from the schema the
// server sends, so this component never needs to change when a section gains a
// field — or when a whole new section is added.

const AdminContent = () => {
  const { section } = useParams();
  const [schema, setSchema] = useState(null);
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Schema is fetched once and reused across section switches.
  useEffect(() => {
    let active = true;
    adminFetchContentSchema()
      .then((s) => active && setSchema(s))
      .catch((err) => active && setError(err.message || 'Could not load the content schema.'));
    return () => {
      active = false;
    };
  }, []);

  const sectionNames = useMemo(() => (schema ? Object.keys(schema) : []), [schema]);
  const spec = section && schema ? schema[section] : null;

  const blankFor = useCallback(
    (fields) =>
      Object.fromEntries(Object.entries(fields).map(([name, f]) => [name, emptyValue(f)])),
    [],
  );

  useEffect(() => {
    if (!spec || !section) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    setSaved(false);

    adminFetchContent(section)
      .then((data) => active && setValues(data))
      .catch((err) => {
        if (!active) return;
        // 404 means nothing has been saved for this section yet — start the form
        // from what the site currently shows rather than from blank fields.
        if (err.status === 404) {
          setValues(contentSeed(section) ?? blankFor(spec.fields));
        } else {
          setError(err.message || 'Could not load this section.');
        }
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [section, spec, blankFor]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const stored = await saveContent(section, values);
      setValues(stored); // show exactly what the server kept, caps and all
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!schema) {
    return (
      <div className="admin-page">
        {error ? <p className="admin-error">{error}</p> : <PageLoader label="Loading…" compact />}
      </div>
    );
  }

  if (!section) {
    return <Navigate to={`/admin/content/${sectionNames[0]}`} replace />;
  }

  if (!spec) {
    return (
      <div className="admin-page">
        <p className="admin-error">Unknown content section “{section}”.</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1>Site content</h1>
          <p>Edit what the public site shows. Changes go live as soon as you save.</p>
        </div>
      </header>

      <nav className="admin-tabs">
        {sectionNames.map((name) => (
          <NavLink key={name} to={`/admin/content/${name}`} className="admin-tab">
            {schema[name].label ?? name}
          </NavLink>
        ))}
      </nav>

      {error && <p className="admin-error">{error}</p>}
      {saved && <p className="admin-success">Saved. The site is updated.</p>}

      {loading || !values ? (
        <PageLoader label={`Loading ${spec.label ?? section}…`} compact />
      ) : (
        <form className="admin-form" onSubmit={submit}>
          {spec.blurb && <p className="admin-hint">{spec.blurb}</p>}

          {Object.entries(spec.fields).map(([name, fieldSpec]) => (
            <SchemaField
              key={name}
              name={name}
              spec={fieldSpec}
              path={name}
              value={values[name]}
              onChange={(next) => setValues((v) => ({ ...v, [name]: next }))}
            />
          ))}

          <div className="admin-form-foot">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminContent;
