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

const defaultFamily = () => ({
  basePrice: '',
  minMembers: 3,
  maxMembers: 8,
  groups: [
    { id: 'parent-guardian', label: 'Parent / guardian', ageLabel: '18+', min: 1, max: 2, default: 2, pricing: { type: 'full', value: 0 } },
    { id: 'child', label: 'Child', ageLabel: '3–12', min: 0, max: 4, default: 1, pricing: { type: 'percent', value: 50 } },
    { id: 'teen', label: 'Teen', ageLabel: '13–17', min: 0, max: 4, default: 0, pricing: { type: 'percent', value: 30 } },
    { id: 'youth-adult', label: 'Youth / adult', ageLabel: '18+', min: 0, max: 4, default: 0, pricing: { type: 'percent', value: 10 } },
  ],
});

const packageToForm = (pkg) => ({
  ...pkg,
  allowPromo: pkg.allowPromo !== false,
  type: ['family', 'group'].includes(pkg.type) ? pkg.type : 'standard',
  family: pkg.type === 'family' ? { ...defaultFamily(), ...pkg.family } : pkg.family,
});

const familyPreview = (family) => {
  const base = Number(family?.basePrice) || 0;
  return (family?.groups || []).reduce((preview, group) => {
    const quantity = Math.max(0, Number(group.default) || 0);
    const type = group.pricing?.type || 'full';
    const value = Math.max(0, Number(group.pricing?.value) || 0);
    const unit = type === 'fixed'
      ? value
      : type === 'percent'
        ? Math.max(0, Math.round(base * (1 - Math.min(100, value) / 100)))
        : base;
    return { members: preview.members + quantity, amount: preview.amount + quantity * unit };
  }, { members: 0, amount: 0 });
};

// The API stores `about` as an array of paragraphs; the form edits it as one
// textarea (blank line between paragraphs) and converts on load/save.
const toForm = (event) => ({
  ...blank,
  ...event,
  aboutText: (event.about || []).join('\n\n'),
  packages: (event.packages || []).map(packageToForm),
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
    setForm((f) => ({
      ...f,
      packages: [...f.packages, { type: 'standard', name: '', price: '', ticketCount: 1, allowPromo: true, note: '', url: '' }],
    }));
  const setPackage = (i, key, val) =>
    setForm((f) => ({
      ...f,
      packages: f.packages.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)),
    }));
  const removePackage = (i) =>
    setForm((f) => ({ ...f, packages: f.packages.filter((_, idx) => idx !== i) }));
  const setPackageType = (i, type) =>
    setForm((f) => ({
      ...f,
      packages: f.packages.map((p, idx) => {
        if (idx !== i) return p;
        if (type === 'family') {
          return { ...p, type, family: p.family || { ...defaultFamily(), basePrice: String(p.price ?? '').replace(/[^0-9]/g, '') } };
        }
        return { ...p, type: type === 'group' ? 'group' : 'standard' };
      }),
    }));
  const setFamily = (i, key, value) =>
    setForm((f) => ({
      ...f,
      packages: f.packages.map((p, idx) => (
        idx === i ? { ...p, family: { ...p.family, [key]: value } } : p
      )),
    }));
  const setFamilyGroup = (packageIndex, groupIndex, key, value) =>
    setForm((f) => ({
      ...f,
      packages: f.packages.map((p, idx) => {
        if (idx !== packageIndex) return p;
        const groups = p.family.groups.map((group, gIdx) => {
          if (gIdx !== groupIndex) return group;
          if (key === 'pricingType') {
            return { ...group, pricing: { ...group.pricing, type: value } };
          }
          if (key === 'pricingValue') {
            return { ...group, pricing: { ...group.pricing, value } };
          }
          return { ...group, [key]: value };
        });
        return { ...p, family: { ...p.family, groups } };
      }),
    }));
  const addFamilyGroup = (i) =>
    setForm((f) => ({
      ...f,
      packages: f.packages.map((p, idx) => idx === i
        ? {
            ...p,
            family: {
              ...p.family,
              groups: [
                ...p.family.groups,
                { id: `member-${Date.now()}`, label: '', ageLabel: '', min: 0, max: 4, default: 0, pricing: { type: 'full', value: 0 } },
              ],
            },
          }
        : p),
    }));
  const removeFamilyGroup = (packageIndex, groupIndex) =>
    setForm((f) => ({
      ...f,
      packages: f.packages.map((p, idx) => idx === packageIndex
        ? { ...p, family: { ...p.family, groups: p.family.groups.filter((_, gIdx) => gIdx !== groupIndex) } }
        : p),
    }));

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
          <p className="admin-hint">
            Leave empty for a free event. Shared groups let each member claim and pay for one place through the same invite link.
          </p>

          {form.packages.map((p, i) => {
            const isFamily = p.type === 'family';
            const isGroup = p.type === 'group';
            const preview = familyPreview(p.family);
            return (
              <div className={`admin-package-card ${isFamily ? 'is-family' : ''}`} key={i}>
                <div className="admin-package">
                  <label className="admin-package-count">
                    <span>Package type</span>
                    <select value={p.type || 'standard'} onChange={(e) => setPackageType(i, e.target.value)}>
                      <option value="standard">Standard</option>
                      <option value="group">Shared group</option>
                      <option value="family">Family</option>
                    </select>
                  </label>
                  <input required placeholder="Name (e.g. Regular)" value={p.name} onChange={(e) => setPackage(i, 'name', e.target.value)} />
                  {!isFamily && (
                    <>
                      <input
                        required
                        placeholder={isGroup ? 'Total group price (e.g. KES 4,000)' : 'Price (e.g. KES 500)'}
                        value={p.price}
                        onChange={(e) => setPackage(i, 'price', e.target.value)}
                      />
                      <label className="admin-package-count">
                        <span>{isGroup ? 'Group size' : 'Tickets included'}</span>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          step="1"
                          value={p.ticketCount ?? 1}
                          onChange={(e) => setPackage(i, 'ticketCount', e.target.value)}
                          required
                        />
                      </label>
                    </>
                  )}
                  <input placeholder="Note (optional)" value={p.note} onChange={(e) => setPackage(i, 'note', e.target.value)} />
                  <input placeholder="Ticket URL (optional)" value={p.url || ''} onChange={(e) => setPackage(i, 'url', e.target.value)} />
                  <label className="admin-check admin-package-promo">
                    <input
                      type="checkbox"
                      checked={p.allowPromo !== false}
                      onChange={(e) => setPackage(i, 'allowPromo', e.target.checked)}
                    />
                    Allow promo codes
                  </label>
                  <button type="button" className="admin-icon-btn is-danger" onClick={() => removePackage(i)} aria-label="Remove package">
                    <DeleteOutlined />
                  </button>
                </div>

                {isGroup && (
                  <p className="admin-family-preview">
                    Each member pays{' '}
                    <strong>
                      KES {Math.floor((Number(String(p.price).replace(/[^0-9]/g, '')) || 0) / Math.max(1, Number(p.ticketCount) || 1)).toLocaleString('en-KE')}
                    </strong>.
                    The total must divide evenly by the group size.
                  </p>
                )}

                {isFamily && (
                  <div className="admin-family-config">
                    <div className="admin-grid-3">
                      <label className="admin-field">
                        <span>Base member price (KES)</span>
                        <input type="number" min="1" step="1" required value={p.family?.basePrice ?? ''} onChange={(e) => setFamily(i, 'basePrice', e.target.value)} />
                      </label>
                      <label className="admin-field">
                        <span>Minimum family size</span>
                        <input type="number" min="1" max="50" step="1" required value={p.family?.minMembers ?? 3} onChange={(e) => setFamily(i, 'minMembers', e.target.value)} />
                      </label>
                      <label className="admin-field">
                        <span>Maximum family size</span>
                        <input type="number" min="1" max="50" step="1" required value={p.family?.maxMembers ?? 8} onChange={(e) => setFamily(i, 'maxMembers', e.target.value)} />
                      </label>
                    </div>

                    <div className="admin-family-head">
                      <div>
                        <strong>Member categories</strong>
                        <p className="admin-hint">Set the allowed count and price for each kind of family member.</p>
                      </div>
                      <button type="button" className="admin-btn admin-btn-ghost" onClick={() => addFamilyGroup(i)}>
                        <PlusOutlined /> Add category
                      </button>
                    </div>

                    <div className="admin-family-groups">
                      {(p.family?.groups || []).map((group, groupIndex) => (
                        <div className="admin-family-group" key={group.id || groupIndex}>
                          <label>
                            <span>Category</span>
                            <input required placeholder="Child" value={group.label} onChange={(e) => setFamilyGroup(i, groupIndex, 'label', e.target.value)} />
                          </label>
                          <label>
                            <span>Age guidance</span>
                            <input placeholder="3–12" value={group.ageLabel || ''} onChange={(e) => setFamilyGroup(i, groupIndex, 'ageLabel', e.target.value)} />
                          </label>
                          <label>
                            <span>Min</span>
                            <input type="number" min="0" max="50" step="1" required value={group.min ?? 0} onChange={(e) => setFamilyGroup(i, groupIndex, 'min', e.target.value)} />
                          </label>
                          <label>
                            <span>Max</span>
                            <input type="number" min="0" max="50" step="1" required value={group.max ?? 0} onChange={(e) => setFamilyGroup(i, groupIndex, 'max', e.target.value)} />
                          </label>
                          <label>
                            <span>Default</span>
                            <input type="number" min="0" max="50" step="1" required value={group.default ?? 0} onChange={(e) => setFamilyGroup(i, groupIndex, 'default', e.target.value)} />
                          </label>
                          <label>
                            <span>Pricing</span>
                            <select value={group.pricing?.type || 'full'} onChange={(e) => setFamilyGroup(i, groupIndex, 'pricingType', e.target.value)}>
                              <option value="full">Full base price</option>
                              <option value="percent">Percentage off</option>
                              <option value="fixed">Exact KES price</option>
                            </select>
                          </label>
                          <label>
                            <span>{group.pricing?.type === 'percent' ? 'Discount %' : group.pricing?.type === 'fixed' ? 'Price (KES)' : 'Value'}</span>
                            <input
                              type="number"
                              min="0"
                              max={group.pricing?.type === 'percent' ? 100 : undefined}
                              step="1"
                              required={group.pricing?.type !== 'full'}
                              disabled={group.pricing?.type === 'full'}
                              value={group.pricing?.value ?? 0}
                              onChange={(e) => setFamilyGroup(i, groupIndex, 'pricingValue', e.target.value)}
                            />
                          </label>
                          <button type="button" className="admin-icon-btn is-danger" onClick={() => removeFamilyGroup(i, groupIndex)} aria-label={`Remove ${group.label || 'category'}`}>
                            <DeleteOutlined />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="admin-family-preview">
                      Default buyer selection: <strong>{preview.members} tickets</strong>
                      {' · '}
                      <strong>KES {preview.amount.toLocaleString('en-KE')}</strong>
                    </p>
                  </div>
                )}
              </div>
            );
          })}

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
