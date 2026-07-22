import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusOutlined, DeleteOutlined, UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { adminFetchEvents, createEvent, updateEvent, uploadImage, fetchMerch } from '../lib/api';
import AdminImageField from './AdminImageField';
import PageLoader from '../components/PageLoader';

const blank = {
  title: '',
  type: '',
  status: 'upcoming',
  date: '',
  time: '',
  venue: '',
  summary: '',
  aboutText: '', // edited as text, split into paragraphs on save
  poster: '',
  packages: [],
  merchIds: [],
  promoCodes: [],
  media: [],
};

// The API stores `about` as an array of paragraphs; the form edits it as one
// textarea (blank line between paragraphs) and converts on load/save.
const toForm = (event) => ({
  ...blank,
  ...event,
  aboutText: (event.about || []).join('\n\n'),
  packages: event.packages || [],
  merchIds: event.merchIds || [],
  promoCodes: event.promoCodes || [],
  media: event.media || [],
});

const toPayload = (form) => ({
  title: form.title,
  type: form.type,
  status: form.status,
  date: form.date,
  time: form.time,
  venue: form.venue,
  summary: form.summary,
  about: form.aboutText.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
  poster: form.poster,
  packages: form.packages,
  merchIds: form.merchIds,
  promoCodes: form.promoCodes,
  media: form.media,
});

const AdminEventForm = () => {
  const { slug } = useParams();
  const editing = Boolean(slug);
  const navigate = useNavigate();
  const mediaInput = useRef(null);

  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [catalogue, setCatalogue] = useState([]);
  // Products this event still defines inline, from before the catalogue. The
  // server keeps them and keeps selling them; the form only reports them.
  const [legacyMerch, setLegacyMerch] = useState([]);

  // The catalogue backs the picker. A failure here is not surfaced as a page
  // error: it would block editing the date or the venue over a list the admin
  // may not even be changing, and the picker says plainly when it is empty.
  useEffect(() => {
    fetchMerch()
      .then((data) => setCatalogue(data.products ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    adminFetchEvents()
      .then(({ upcoming, past }) => {
        const found = [...upcoming, ...past].find((e) => e.slug === slug);
        if (found) {
          setForm(toForm(found));
          // `merch` on a loaded event is the RESOLVED list, so the inline
          // leftovers are the ones the catalogue didn't account for.
          const ids = new Set(found.merchIds ?? []);
          setLegacyMerch(
            (found.merch ?? []).filter((m) => !ids.has(m.id) && String(m.id ?? '').startsWith('legacy:')),
          );
        } else setError('Event not found.');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, editing]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // ---- packages
  const addPackage = () =>
    setForm((f) => ({ ...f, packages: [...f.packages, { name: '', price: '', note: '', url: '' }] }));
  const setPackage = (i, key, val) =>
    setForm((f) => ({
      ...f,
      packages: f.packages.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)),
    }));
  const removePackage = (i) =>
    setForm((f) => ({ ...f, packages: f.packages.filter((_, idx) => idx !== i) }));

  // ---- merchandise
  // Products live in the catalogue now, so the event only records which ones it
  // sells. Everything about a product — price, sizes, photo — is edited once,
  // under Merchandise.
  const toggleMerch = (id) =>
    setForm((f) => ({
      ...f,
      merchIds: f.merchIds.includes(id)
        ? f.merchIds.filter((x) => x !== id)
        : [...f.merchIds, id],
    }));

  // ---- promo codes
  const addPromo = () =>
    setForm((f) => ({ ...f, promoCodes: [...f.promoCodes, { code: '', type: 'percent', value: '' }] }));
  const setPromo = (i, key, val) =>
    setForm((f) => ({ ...f, promoCodes: f.promoCodes.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)) }));
  const removePromo = (i) =>
    setForm((f) => ({ ...f, promoCodes: f.promoCodes.filter((_, idx) => idx !== i) }));

  // ---- media
  const addMedia = async (e) => {
    const files = Array.from(e.target.files || []);
    if (mediaInput.current) mediaInput.current.value = '';
    for (const file of files) {
      try {
        const url = await uploadImage(file);
        setForm((f) => ({ ...f, media: [...f.media, url] }));
      } catch (err) {
        setError(err.message);
      }
    }
  };
  const removeMedia = (i) => setForm((f) => ({ ...f, media: f.media.filter((_, idx) => idx !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editing) await updateEvent(slug, payload);
      else await createEvent(payload);
      navigate('/admin/events');
    } catch (err) {
      setError(err.message || 'Save failed.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <PageLoader label="Loading event…" compact />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <Link className="admin-back" to="/admin/events">
        <ArrowLeftOutlined /> Events
      </Link>

      <header className="admin-page-head">
        <h1>{editing ? 'Edit event' : 'New event'}</h1>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <form className="admin-form" onSubmit={submit}>
        <div className="admin-grid-2">
          <label className="admin-field">
            <span>Title *</span>
            <input type="text" value={form.title} onChange={set('title')} required />
          </label>
          <label className="admin-field">
            <span>Type * (e.g. Concert, Camp Meeting)</span>
            <input type="text" value={form.type} onChange={set('type')} required />
          </label>
        </div>

        <div className="admin-grid-3">
          <label className="admin-field">
            <span>Status</span>
            <select value={form.status} onChange={set('status')}>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Date *</span>
            <input type="date" value={form.date} onChange={set('date')} required />
          </label>
          <label className="admin-field">
            <span>Time (e.g. 6:00 PM)</span>
            <input type="text" value={form.time || ''} onChange={set('time')} placeholder="6:00 PM" />
          </label>
        </div>

        <label className="admin-field">
          <span>Venue</span>
          <input type="text" value={form.venue} onChange={set('venue')} />
        </label>

        <label className="admin-field">
          <span>Summary (one line, shown in the events list)</span>
          <input type="text" value={form.summary} onChange={set('summary')} />
        </label>

        <label className="admin-field">
          <span>About (full description — leave a blank line between paragraphs)</span>
          <textarea rows="5" value={form.aboutText} onChange={set('aboutText')} />
        </label>

        <AdminImageField
          label="Poster"
          value={form.poster}
          onChange={(url) => setForm((f) => ({ ...f, poster: url }))}
        />

        {/* Packages */}
        <fieldset className="admin-fieldset">
          <legend>Ticket packages</legend>
          <p className="admin-hint">Leave empty for a free event. Each package can carry its own ticket URL.</p>

          {form.packages.map((p, i) => (
            <div className="admin-package" key={i}>
              <input placeholder="Name (e.g. Regular)" value={p.name} onChange={(e) => setPackage(i, 'name', e.target.value)} />
              <input placeholder="Price (e.g. KES 500)" value={p.price} onChange={(e) => setPackage(i, 'price', e.target.value)} />
              <input placeholder="Note (optional)" value={p.note} onChange={(e) => setPackage(i, 'note', e.target.value)} />
              <input placeholder="Ticket URL (optional)" value={p.url || ''} onChange={(e) => setPackage(i, 'url', e.target.value)} />
              <button type="button" className="admin-icon-btn is-danger" onClick={() => removePackage(i)} aria-label="Remove package">
                <DeleteOutlined />
              </button>
            </div>
          ))}

          <button type="button" className="admin-btn admin-btn-ghost" onClick={addPackage}>
            <PlusOutlined /> Add package
          </button>
        </fieldset>

        {/* Promo codes */}
        <fieldset className="admin-fieldset">
          <legend>Promo codes</legend>
          <p className="admin-hint">Buyers can enter these at checkout for a discount on this event.</p>

          {form.promoCodes.map((p, i) => (
            <div className="admin-promo" key={i}>
              <input placeholder="Code (e.g. JC10)" value={p.code} onChange={(e) => setPromo(i, 'code', e.target.value.toUpperCase())} />
              <select value={p.type} onChange={(e) => setPromo(i, 'type', e.target.value)}>
                <option value="percent">% off</option>
                <option value="flat">KES off</option>
              </select>
              <input type="number" min="1" placeholder="Value" value={p.value} onChange={(e) => setPromo(i, 'value', e.target.value)} />
              <button type="button" className="admin-icon-btn is-danger" onClick={() => removePromo(i)} aria-label="Remove promo code">
                <DeleteOutlined />
              </button>
            </div>
          ))}

          <button type="button" className="admin-btn admin-btn-ghost" onClick={addPromo}>
            <PlusOutlined /> Add promo code
          </button>
        </fieldset>

        {/* Merchandise */}
        <fieldset className="admin-fieldset">
          <legend>Merchandise</legend>
          <p className="admin-hint">
            Choose which products this event sells. Add or edit products under{' '}
            <Link to="/admin/merch">Merchandise</Link> — changing a price there updates every event
            selling it.
          </p>

          {catalogue.length === 0 ? (
            <p className="admin-hint">
              No products in the catalogue yet. <Link to="/admin/merch">Add one</Link> first.
            </p>
          ) : (
            <div className="admin-merch-picker">
              {catalogue.map((p) => {
                const on = form.merchIds.includes(p.id);
                return (
                  <label className={`admin-merch-pick ${on ? 'is-on' : ''}`} key={p.id}>
                    <input type="checkbox" checked={on} onChange={() => toggleMerch(p.id)} />
                    <span
                      className="admin-merch-pick-photo"
                      style={p.image ? { backgroundImage: `url("${p.image}")` } : undefined}
                    />
                    <span className="admin-merch-pick-text">
                      <strong>{p.name}</strong>
                      <small>{p.openAmount?.enabled ? 'Buyer names the amount' : p.price}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* An event saved before the catalogue keeps its own products until
              the import is run, and they stay on sale meanwhile. Shown so the
              admin can see why an event offers something not ticked above. */}
          {legacyMerch.length > 0 && (
            <p className="admin-notice">
              This event still has {legacyMerch.length} product
              {legacyMerch.length === 1 ? '' : 's'} defined on it directly
              ({legacyMerch.map((m) => m.name).join(', ')}). They are still on sale. Run{' '}
              <Link to="/admin/merch">Import merchandise from events</Link> to move them into the
              catalogue.
            </p>
          )}
        </fieldset>

        {/* Media */}
        <fieldset className="admin-fieldset">
          <legend>Media (photos shown on the event page)</legend>

          <div className="admin-media-grid">
            {form.media.map((url, i) => (
              <div className="admin-media-item" key={`${url}-${i}`} style={{ backgroundImage: `url("${url}")` }}>
                <button type="button" className="admin-icon-btn is-danger" onClick={() => removeMedia(i)} aria-label="Remove photo">
                  <DeleteOutlined />
                </button>
              </div>
            ))}
            <button type="button" className="admin-media-add" onClick={() => mediaInput.current?.click()}>
              <UploadOutlined /> Add photos
            </button>
          </div>
          <input ref={mediaInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addMedia} hidden />
        </fieldset>

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create event'}
          </button>
          <Link className="admin-btn admin-btn-ghost" to="/admin/events">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
};

export default AdminEventForm;
