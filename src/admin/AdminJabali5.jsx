import { useEffect, useState } from 'react';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { adminFetchEvents, adminFetchJabali5, saveJabali5 } from '../lib/api';
import AdminImageField from './AdminImageField';
import PageLoader from '../components/PageLoader';

const emptyEndCard = { kicker: '', line: '', ctaLabel: '', ctaHref: '' };

// A stored chapter's editable shape. Override fields (poster … href) are left
// blank to inherit from the linked event.
const emptyChapter = {
  heading: '',
  tale: '',
  eventSlug: '',
  poster: '',
  dateLabel: '',
  eventTitle: '',
  type: '',
  status: '',
  href: '',
};

const AdminJabali5 = () => {
  const [config, setConfig] = useState({
    tag: '',
    eyebrow: '',
    title: '',
    intro: '',
    endCard: emptyEndCard,
    chapters: [],
  });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([adminFetchJabali5(), adminFetchEvents()])
      .then(([cfg, evs]) => {
        setConfig({
          tag: cfg.tag || 'Jabali @5',
          eyebrow: cfg.eyebrow || '',
          title: cfg.title || '',
          intro: cfg.intro || '',
          endCard: { ...emptyEndCard, ...(cfg.endCard || {}) },
          chapters: (cfg.chapters || []).map((c) => ({ ...emptyChapter, ...c })),
        });
        setEvents([...evs.upcoming, ...evs.past]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const setMeta = (key) => (e) => setConfig((c) => ({ ...c, [key]: e.target.value }));

  const setEndCard = (key) => (e) =>
    setConfig((c) => ({ ...c, endCard: { ...c.endCard, [key]: e.target.value } }));

  const setChapter = (i, key, val) =>
    setConfig((c) => ({
      ...c,
      chapters: c.chapters.map((ch, idx) => (idx === i ? { ...ch, [key]: val } : ch)),
    }));

  const addChapter = () =>
    setConfig((c) => ({ ...c, chapters: [...c.chapters, { ...emptyChapter }] }));

  const removeChapter = (i) =>
    setConfig((c) => ({ ...c, chapters: c.chapters.filter((_, idx) => idx !== i) }));

  const moveChapter = (i, dir) =>
    setConfig((c) => {
      const next = [...c.chapters];
      const j = i + dir;
      if (j < 0 || j >= next.length) return c;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...c, chapters: next };
    });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      await saveJabali5(config);
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
        <PageLoader label="Loading the Jabali @5 editor…" compact />
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1>Jabali @5</h1>
          <p>Edit the anniversary journey. Each chapter points at an event, in story order.</p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {saved && <p className="admin-success">Saved. The Jabali @5 page is updated.</p>}

      <form className="admin-form" onSubmit={submit}>
        <fieldset className="admin-fieldset">
          <legend>Intro</legend>
          <div className="admin-grid-2">
            <label className="admin-field">
              <span>Tag</span>
              <input value={config.tag} onChange={setMeta('tag')} />
            </label>
            <label className="admin-field">
              <span>Eyebrow</span>
              <input value={config.eyebrow} onChange={setMeta('eyebrow')} />
            </label>
          </div>
          <label className="admin-field">
            <span>Title</span>
            <input value={config.title} onChange={setMeta('title')} />
          </label>
          <label className="admin-field">
            <span>Intro paragraph</span>
            <textarea rows="3" value={config.intro} onChange={setMeta('intro')} />
          </label>
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Chapters</legend>
          <p className="admin-hint">
            The poster, date, title, and done/upcoming status come from the linked event automatically.
          </p>

          {config.chapters.map((ch, i) => (
            <div className="admin-chapter" key={i}>
              <div className="admin-chapter-head">
                <strong>Chapter {String(i + 1).padStart(2, '0')}</strong>
                <div className="admin-chapter-tools">
                  <button type="button" className="admin-icon-btn" onClick={() => moveChapter(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUpOutlined />
                  </button>
                  <button type="button" className="admin-icon-btn" onClick={() => moveChapter(i, 1)} disabled={i === config.chapters.length - 1} aria-label="Move down">
                    <ArrowDownOutlined />
                  </button>
                  <button type="button" className="admin-icon-btn is-danger" onClick={() => removeChapter(i)} aria-label="Remove chapter">
                    <DeleteOutlined />
                  </button>
                </div>
              </div>

              <label className="admin-field">
                <span>Event</span>
                <select value={ch.eventSlug} onChange={(e) => setChapter(i, 'eventSlug', e.target.value)}>
                  <option value="">— choose an event —</option>
                  {events.map((ev) => (
                    <option key={ev.slug} value={ev.slug}>
                      {ev.title} ({ev.status})
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Story heading</span>
                <input value={ch.heading} onChange={(e) => setChapter(i, 'heading', e.target.value)} />
              </label>

              <label className="admin-field">
                <span>Tale</span>
                <textarea rows="2" value={ch.tale} onChange={(e) => setChapter(i, 'tale', e.target.value)} />
              </label>

              <div className="admin-chapter-overrides">
                <p className="admin-hint">
                  Overrides — leave any blank to inherit from the linked event.
                </p>

                <AdminImageField
                  label="Poster"
                  value={ch.poster}
                  onChange={(val) => setChapter(i, 'poster', val)}
                />

                <div className="admin-grid-3">
                  <label className="admin-field">
                    <span>Date label</span>
                    <input
                      value={ch.dateLabel}
                      placeholder="e.g. Aug 2026"
                      onChange={(e) => setChapter(i, 'dateLabel', e.target.value)}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Status</span>
                    <select value={ch.status} onChange={(e) => setChapter(i, 'status', e.target.value)}>
                      <option value="">Auto (from event)</option>
                      <option value="past">Complete</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                  </label>
                  <label className="admin-field">
                    <span>Type</span>
                    <input
                      value={ch.type}
                      placeholder="e.g. Concert"
                      onChange={(e) => setChapter(i, 'type', e.target.value)}
                    />
                  </label>
                </div>

                <div className="admin-grid-2">
                  <label className="admin-field">
                    <span>Display title</span>
                    <input
                      value={ch.eventTitle}
                      onChange={(e) => setChapter(i, 'eventTitle', e.target.value)}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Link URL</span>
                    <input
                      value={ch.href}
                      placeholder="/events/… or https://…"
                      onChange={(e) => setChapter(i, 'href', e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="admin-btn admin-btn-ghost" onClick={addChapter}>
            <PlusOutlined /> Add chapter
          </button>
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>End card</legend>
          <p className="admin-hint">The closing panel at the end of the journey rail.</p>
          <div className="admin-grid-2">
            <label className="admin-field">
              <span>Kicker</span>
              <input value={config.endCard.kicker} onChange={setEndCard('kicker')} />
            </label>
            <label className="admin-field">
              <span>Headline</span>
              <input value={config.endCard.line} onChange={setEndCard('line')} />
            </label>
          </div>
          <div className="admin-grid-2">
            <label className="admin-field">
              <span>Button label</span>
              <input value={config.endCard.ctaLabel} onChange={setEndCard('ctaLabel')} />
            </label>
            <label className="admin-field">
              <span>Button link</span>
              <input
                value={config.endCard.ctaHref}
                placeholder="/join or https://…"
                onChange={setEndCard('ctaHref')}
              />
            </label>
          </div>
        </fieldset>

        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Jabali @5'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminJabali5;
