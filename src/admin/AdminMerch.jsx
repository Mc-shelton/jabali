import { useEffect, useState } from 'react';
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import {
  fetchMerch,
  createMerchProduct,
  updateMerchProduct,
  deleteMerchProduct,
  saveMerchPromos,
  importMerchFromEvents,
  uploadImage,
} from '../lib/api';
import PageLoader from '../components/PageLoader';

// The merchandise catalogue.
//
// Products used to be typed into each event, so the same shirt was re-entered —
// name, price, sizes, price deltas — for every event that sold it, and fixing a
// price meant finding every copy. They live here once now; an event just picks
// from this list.

const blankProduct = () => ({
  name: '',
  price: '',
  description: '',
  image: '',
  openAmount: { enabled: false, min: 50 },
  options: [],
});

const AdminMerch = () => {
  const [products, setProducts] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // The product open in the editor: an existing one, or a blank new one.
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const load = () =>
    fetchMerch()
      .then((data) => {
        setProducts(data.products ?? []);
        setPromoCodes(data.promoCodes ?? []);
      })
      .catch((err) => setError(err.message || 'Could not load merchandise.'));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const openNew = () => {
    setEditingId(null);
    setDraft(blankProduct());
    setNotice('');
    setError('');
  };

  const openExisting = (product) => {
    setEditingId(product.id);
    setDraft({ ...blankProduct(), ...product });
    setNotice('');
    setError('');
  };

  const closeEditor = () => {
    setDraft(null);
    setEditingId(null);
  };

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const setOpenAmount = (key, value) =>
    setDraft((d) => ({ ...d, openAmount: { ...(d.openAmount ?? {}), [key]: value } }));

  // ---- variant pickers (Size → S/M/L, each with an optional price delta)
  const mapOptions = (fn) => setDraft((d) => ({ ...d, options: fn(d.options ?? []) }));

  const addOption = () =>
    mapOptions((opts) => [...opts, { name: '', required: true, choices: [{ label: '', priceDelta: 0 }] }]);
  const setOption = (oi, key, value) =>
    mapOptions((opts) => opts.map((o, i) => (i === oi ? { ...o, [key]: value } : o)));
  const removeOption = (oi) => mapOptions((opts) => opts.filter((_, i) => i !== oi));

  const mapChoices = (oi, fn) =>
    mapOptions((opts) => opts.map((o, i) => (i === oi ? { ...o, choices: fn(o.choices ?? []) } : o)));
  const addChoice = (oi) => mapChoices(oi, (cs) => [...cs, { label: '', priceDelta: 0 }]);
  const setChoice = (oi, ci, key, value) =>
    mapChoices(oi, (cs) => cs.map((c, i) => (i === ci ? { ...c, [key]: value } : c)));
  const removeChoice = (oi, ci) => mapChoices(oi, (cs) => cs.filter((_, i) => i !== ci));

  const uploadPhoto = async (file) => {
    if (!file) return;
    try {
      set('image', await uploadImage(file, 'site'));
    } catch (err) {
      setError(err.message || 'Image upload failed.');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editingId) await updateMerchProduct(editingId, draft);
      else await createMerchProduct(draft);
      await load();
      setNotice(editingId ? 'Product updated.' : 'Product added.');
      closeEditor();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (product) => {
    // Deleting is the one action here that can change what an event sells, so
    // it names the product and says what happens to those events.
    const ok = window.confirm(
      `Delete “${product.name}”?\n\nIt will stop being offered on every event that sells it. ` +
        `Orders already placed are unaffected.`,
    );
    if (!ok) return;

    setBusy(true);
    try {
      await deleteMerchProduct(product.id);
      await load();
      setNotice(`“${product.name}” deleted.`);
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await importMerchFromEvents();
      await load();
      setNotice(
        res.added.length
          ? `Imported ${res.added.length} product${res.added.length === 1 ? '' : 's'} (${res.added.join(', ')}) and linked ${res.eventsLinked} event${res.eventsLinked === 1 ? '' : 's'}.`
          : 'Nothing to import — every event already uses the catalogue.',
      );
    } catch (err) {
      setError(err.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  // ---- promo codes
  const addPromo = () => setPromoCodes((p) => [...p, { code: '', type: 'percent', value: 10 }]);
  const setPromo = (i, key, value) =>
    setPromoCodes((p) => p.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
  const removePromo = (i) => setPromoCodes((p) => p.filter((_, idx) => idx !== i));

  const savePromos = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await saveMerchPromos(promoCodes);
      setPromoCodes(res.promoCodes ?? []);
      setNotice('Merchandise promo codes saved.');
    } catch (err) {
      setError(err.message || 'Could not save promo codes.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <PageLoader label="Loading merchandise…" compact />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1>Merchandise</h1>
          <p>
            Products are defined once here and sold on any event. Pick which ones an event offers
            from its own page.
          </p>
        </div>
        {!draft && (
          <button type="button" className="admin-btn admin-btn-primary" onClick={openNew}>
            <PlusOutlined /> New product
          </button>
        )}
      </header>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-success" role="status">{notice}</p>}

      {/* ---------------------------------------------------------- editor */}
      {draft ? (
        <form className="admin-form" onSubmit={save}>
          <fieldset className="admin-fieldset">
            <legend>{editingId ? `Edit ${draft.name || 'product'}` : 'New product'}</legend>

            <div className="admin-merch-row">
              <label
                className="admin-merch-image"
                style={draft.image ? { backgroundImage: `url("${draft.image}")` } : undefined}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => uploadPhoto(e.target.files?.[0])}
                />
                {!draft.image && <UploadOutlined />}
              </label>

              <div className="admin-merch-fields">
                <div className="admin-grid-2">
                  <input
                    placeholder="Name (e.g. T-Shirt)"
                    value={draft.name}
                    onChange={(e) => set('name', e.target.value)}
                    autoFocus
                  />
                  <input
                    placeholder="Price (e.g. KES 1,200)"
                    value={draft.price}
                    onChange={(e) => set('price', e.target.value)}
                    disabled={draft.openAmount?.enabled}
                  />
                </div>
                <input
                  placeholder="Description (optional)"
                  value={draft.description}
                  onChange={(e) => set('description', e.target.value)}
                />

                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.openAmount?.enabled)}
                    onChange={(e) => setOpenAmount('enabled', e.target.checked)}
                  />
                  <span>Let the buyer enter their own amount (e.g. a donation)</span>
                </label>

                {draft.openAmount?.enabled && (
                  <label className="admin-field admin-min-field">
                    <span>Minimum amount (KES)</span>
                    <input
                      type="number"
                      min="1"
                      value={draft.openAmount?.min ?? 50}
                      onChange={(e) => setOpenAmount('min', Number(e.target.value) || 1)}
                    />
                    <small>Quantity is hidden for these — the amount is the total.</small>
                  </label>
                )}

                <div className="admin-options">
                  {(draft.options ?? []).map((opt, oi) => (
                    <div className="admin-option" key={oi}>
                      <div className="admin-option-head">
                        <input
                          className="admin-option-name"
                          placeholder="Parameter (e.g. Size)"
                          value={opt.name}
                          onChange={(e) => setOption(oi, 'name', e.target.value)}
                        />
                        <label className="admin-check">
                          <input
                            type="checkbox"
                            checked={opt.required !== false}
                            onChange={(e) => setOption(oi, 'required', e.target.checked)}
                          />
                          <span>Required</span>
                        </label>
                        <button
                          type="button"
                          className="admin-icon-btn is-danger"
                          onClick={() => removeOption(oi)}
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
                            onChange={(e) => setChoice(oi, ci, 'label', e.target.value)}
                          />
                          <input
                            type="number"
                            placeholder="+0"
                            value={c.priceDelta ?? 0}
                            onChange={(e) => setChoice(oi, ci, 'priceDelta', Number(e.target.value) || 0)}
                            title="Price change for this option, in KES. Leave 0 for no change."
                          />
                          <button
                            type="button"
                            className="admin-icon-btn is-danger"
                            onClick={() => removeChoice(oi, ci)}
                            aria-label={`Remove ${c.label || 'option'}`}
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-sm"
                        onClick={() => addChoice(oi)}
                      >
                        <PlusOutlined /> Add option
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost admin-btn-sm"
                    onClick={addOption}
                  >
                    <PlusOutlined /> Add parameter (size, colour…)
                  </button>
                </div>
              </div>
            </div>
          </fieldset>

          <div className="admin-form-foot">
            <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}
            </button>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={closeEditor} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* -------------------------------------------------------- list */}
          {products.length === 0 ? (
            <p className="admin-hint">
              No products yet. Add one above, or import the products already defined inside your
              events.
            </p>
          ) : (
            <div className="admin-merch-cards">
              {products.map((p) => (
                <article className="admin-merch-card" key={p.id}>
                  <div
                    className="admin-merch-card-photo"
                    style={p.image ? { backgroundImage: `url("${p.image}")` } : undefined}
                  />
                  <div className="admin-merch-card-body">
                    <strong>{p.name}</strong>
                    <span>{p.openAmount?.enabled ? 'Buyer names the amount' : p.price}</span>
                    {p.options?.length > 0 && (
                      <small>
                        {p.options.map((o) => `${o.name} (${o.choices.length})`).join(' · ')}
                      </small>
                    )}
                  </div>
                  <div className="admin-merch-card-tools">
                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openExisting(p)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn is-danger"
                      onClick={() => remove(p)}
                      aria-label={`Delete ${p.name}`}
                    >
                      <DeleteOutlined />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* ------------------------------------------------------ promos */}
          <fieldset className="admin-fieldset">
            <legend>Merchandise promo codes</legend>
            <p className="admin-hint">
              These apply to merchandise only. An event’s own codes are for its tickets, so a
              concert discount can’t be spent on a hoodie.
            </p>

            {promoCodes.map((p, i) => (
              <div className="admin-promo" key={i}>
                <input
                  placeholder="Code (e.g. MERCH10)"
                  value={p.code}
                  onChange={(e) => setPromo(i, 'code', e.target.value.toUpperCase())}
                />
                <select value={p.type} onChange={(e) => setPromo(i, 'type', e.target.value)}>
                  <option value="percent">% off</option>
                  <option value="flat">KES off</option>
                </select>
                <input
                  type="number"
                  min="1"
                  placeholder="Value"
                  value={p.value}
                  onChange={(e) => setPromo(i, 'value', e.target.value)}
                />
                <button
                  type="button"
                  className="admin-icon-btn is-danger"
                  onClick={() => removePromo(i)}
                  aria-label="Remove promo code"
                >
                  <DeleteOutlined />
                </button>
              </div>
            ))}

            <div className="admin-form-foot">
              <button type="button" className="admin-btn admin-btn-ghost" onClick={addPromo}>
                <PlusOutlined /> Add promo code
              </button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={savePromos} disabled={busy}>
                {busy ? 'Saving…' : 'Save promo codes'}
              </button>
            </div>
          </fieldset>

          {/* ------------------------------------------------------ import */}
          <fieldset className="admin-fieldset">
            <legend>Import from events</legend>
            <p className="admin-hint">
              Moves products still defined inside individual events into this catalogue and links
              those events to them. Safe to run more than once — it only adds what is missing, and
              nothing stops being sold while it runs.
            </p>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={runImport} disabled={busy}>
              <ImportOutlined /> Import merchandise from events
            </button>
          </fieldset>
        </>
      )}
    </div>
  );
};

export default AdminMerch;
