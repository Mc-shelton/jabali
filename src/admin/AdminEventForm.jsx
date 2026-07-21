import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusOutlined, DeleteOutlined, UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { adminFetchEvents, createEvent, updateEvent, uploadImage } from '../lib/api';
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
  merch: [],
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
  merch: event.merch || [],
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
  merch: form.merch,
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

  useEffect(() => {
    if (!editing) return;
    adminFetchEvents()
      .then(({ upcoming, past }) => {
        const found = [...upcoming, ...past].find((e) => e.slug === slug);
        if (found) setForm(toForm(found));
        else setError('Event not found.');
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

  // ---- merch
  const addMerch = () =>
    setForm((f) => ({
      ...f,
      merch: [
        ...f.merch,
        {
          name: '',
          price: '',
          description: '',
          image: '',
          openAmount: { enabled: false, min: 50 },
          options: [],
        },
      ],
    }));
  const setMerch = (i, key, val) =>
    setForm((f) => ({ ...f, merch: f.merch.map((m, idx) => (idx === i ? { ...m, [key]: val } : m)) }));
  const removeMerch = (i) =>
    setForm((f) => ({ ...f, merch: f.merch.filter((_, idx) => idx !== i) }));

  // ---- merch options (Size: S/M/L …). Each choice may carry a price delta.
  const mutateOptions = (i, fn) =>
    setForm((f) => ({
      ...f,
      merch: f.merch.map((m, idx) => (idx === i ? { ...m, options: fn(m.options ?? []) } : m)),
    }));

  const addOption = (i) =>
    mutateOptions(i, (opts) => [...opts, { name: '', required: true, choices: [{ label: '', priceDelta: 0 }] }]);
  const removeOption = (i, oi) => mutateOptions(i, (opts) => opts.filter((_, idx) => idx !== oi));
  const setOption = (i, oi, key, val) =>
    mutateOptions(i, (opts) => opts.map((o, idx) => (idx === oi ? { ...o, [key]: val } : o)));

  const addChoice = (i, oi) =>
    mutateOptions(i, (opts) =>
      opts.map((o, idx) =>
        idx === oi ? { ...o, choices: [...(o.choices ?? []), { label: '', priceDelta: 0 }] } : o,
      ),
    );
  const removeChoice = (i, oi, ci) =>
    mutateOptions(i, (opts) =>
      opts.map((o, idx) =>
        idx === oi ? { ...o, choices: o.choices.filter((_, x) => x !== ci) } : o,
      ),
    );
  const setChoice = (i, oi, ci, key, val) =>
    mutateOptions(i, (opts) =>
      opts.map((o, idx) =>
        idx === oi
          ? { ...o, choices: o.choices.map((c, x) => (x === ci ? { ...c, [key]: val } : c)) }
          : o,
      ),
    );

  const setOpenAmount = (i, key, val) =>
    setForm((f) => ({
      ...f,
      merch: f.merch.map((m, idx) =>
        idx === i
          ? { ...m, openAmount: { ...(m.openAmount ?? { enabled: false, min: 50 }), [key]: val } }
          : m,
      ),
    }));
  const uploadMerchImage = async (i, file) => {
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setMerch(i, 'image', url);
    } catch (err) {
      setError(err.message);
    }
  };

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
          <p className="admin-hint">Products sold on this event’s page (T-shirts, CDs…). Paid via M-Pesa like tickets.</p>

          {form.merch.map((m, i) => (
            <div className="admin-merch-row" key={i}>
              <label className="admin-merch-image" style={m.image ? { backgroundImage: `url("${m.image}")` } : undefined}>
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => uploadMerchImage(i, e.target.files?.[0])} />
                {!m.image && <UploadOutlined />}
              </label>
              <div className="admin-merch-fields">
                <div className="admin-grid-2">
                  <input placeholder="Name (e.g. T-Shirt)" value={m.name} onChange={(e) => setMerch(i, 'name', e.target.value)} />
                  <input
                    placeholder="Price (e.g. KES 1,200)"
                    value={m.price}
                    onChange={(e) => setMerch(i, 'price', e.target.value)}
                    disabled={m.openAmount?.enabled}
                  />
                </div>
                <input placeholder="Description (optional)" value={m.description} onChange={(e) => setMerch(i, 'description', e.target.value)} />

                {/* Open amount — for donations, where the buyer names the figure. */}
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={Boolean(m.openAmount?.enabled)}
                    onChange={(e) => setOpenAmount(i, 'enabled', e.target.checked)}
                  />
                  <span>Let the buyer enter their own amount (e.g. a donation)</span>
                </label>

                {m.openAmount?.enabled && (
                  <label className="admin-field admin-min-field">
                    <span>Minimum amount (KES)</span>
                    <input
                      type="number"
                      min="1"
                      value={m.openAmount?.min ?? 50}
                      onChange={(e) => setOpenAmount(i, 'min', Number(e.target.value) || 1)}
                    />
                    <small>Quantity is hidden for these — the amount is the total.</small>
                  </label>
                )}

                {/* Buyer-selectable parameters, e.g. Size → S / M / L. */}
                <div className="admin-options">
                  {(m.options ?? []).map((opt, oi) => (
                    <div className="admin-option" key={oi}>
                      <div className="admin-option-head">
                        <input
                          className="admin-option-name"
                          placeholder="Parameter (e.g. Size)"
                          value={opt.name}
                          onChange={(e) => setOption(i, oi, 'name', e.target.value)}
                        />
                        <label className="admin-check">
                          <input
                            type="checkbox"
                            checked={opt.required !== false}
                            onChange={(e) => setOption(i, oi, 'required', e.target.checked)}
                          />
                          <span>Required</span>
                        </label>
                        <button
                          type="button"
                          className="admin-icon-btn is-danger"
                          onClick={() => removeOption(i, oi)}
                          aria-label={`Remove ${opt.name || 'parameter'}`}
                        >
                          <DeleteOutlined />
                        </button>
                      </div>

                      {(opt.choices ?? []).map((c, ci) => (
                        <div className="admin-choice" key={ci}>
                          <input
                            placeholder="Option (e.g. XL)"
                            value={c.label}
                            onChange={(e) => setChoice(i, oi, ci, 'label', e.target.value)}
                          />
                          <input
                            type="number"
                            placeholder="+0"
                            value={c.priceDelta ?? 0}
                            onChange={(e) => setChoice(i, oi, ci, 'priceDelta', Number(e.target.value) || 0)}
                            title="Price change for this option, in KES. Leave 0 for no change."
                          />
                          <button
                            type="button"
                            className="admin-icon-btn is-danger"
                            onClick={() => removeChoice(i, oi, ci)}
                            aria-label={`Remove ${c.label || 'option'}`}
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      ))}

                      <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => addChoice(i, oi)}>
                        <PlusOutlined /> Add option
                      </button>
                    </div>
                  ))}

                  <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => addOption(i)}>
                    <PlusOutlined /> Add parameter (size, colour…)
                  </button>
                </div>
              </div>
              <button type="button" className="admin-icon-btn is-danger" onClick={() => removeMerch(i)} aria-label="Remove merchandise">
                <DeleteOutlined />
              </button>
            </div>
          ))}

          <button type="button" className="admin-btn admin-btn-ghost" onClick={addMerch}>
            <PlusOutlined /> Add merchandise
          </button>
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
