import { useState } from 'react';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons';
import AdminImageField from './AdminImageField';
import AdminFileField from './AdminFileField';

// Renders one field from the content schema served by content.php?schema=1.
// Recursive: a `group` renders its child fields, a `list` renders a row per item
// whose contents are themselves SchemaFields. Nothing here knows what a member
// or a contact detail is — add a field in _sections.php and it shows up.

// A blank value matching a spec, for when the user adds a list row.
export function emptyValue(spec) {
  const kind = spec?.kind ?? 'text';
  if (kind === 'group') {
    return Object.fromEntries(
      Object.entries(spec.fields ?? {}).map(([name, child]) => [name, emptyValue(child)]),
    );
  }
  if (kind === 'list') return [];
  if (kind === 'bool') return spec.default ?? false;
  if (kind === 'number') return 0;
  if (kind === 'select') return spec.options?.[0] ?? '';
  return '';
}

// Best-effort label for a collapsed list row, so a roster of 23 members is
// scannable rather than 23 identical "Item" headings.
const rowSummary = (spec, value, index) => {
  if (spec?.kind === 'group' && value && typeof value === 'object') {
    for (const key of ['name', 'title', 'label', 'heading', 'id']) {
      if (value[key]) return String(value[key]);
    }
  } else if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return `Item ${index + 1}`;
};

const ScalarInput = ({ spec, value, onChange, id, context }) => {
  const kind = spec.kind ?? 'text';

  if (kind === 'image') {
    return (
      <AdminImageField
        label={spec.label}
        value={value || ''}
        onChange={onChange}
        folder={spec.upload}
      />
    );
  }

  if (kind === 'file') {
    return (
      <AdminFileField
        label={spec.label}
        value={value || ''}
        onChange={onChange}
        folder={spec.upload}
        accept={spec.accept}
      />
    );
  }

  if (kind === 'textarea') {
    return (
      <textarea
        id={id}
        rows={4}
        maxLength={spec.maxLength}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (kind === 'select') {
    return (
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {(spec.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (kind === 'track') {
    const tracks = Array.isArray(context?.catalog) ? context.catalog : [];
    const currentExists = !value || tracks.some((track) => track.id === value);

    return (
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select a track…</option>
        {!currentExists && <option value={value}>{value} (missing from catalogue)</option>}
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>
            {track.title || track.id}
          </option>
        ))}
      </select>
    );
  }

  if (kind === 'bool') {
    return (
      <input
        id={id}
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  return (
    <input
      id={id}
      type={kind === 'number' ? 'number' : 'text'}
      maxLength={kind === 'number' ? undefined : spec.maxLength}
      value={value ?? ''}
      onChange={(e) => onChange(kind === 'number' ? Number(e.target.value) : e.target.value)}
    />
  );
};

// Rows collapse once a list gets long enough that an all-open form would be
// unusable — a 23-member roster is otherwise several screens of scrolling.
const COLLAPSE_THRESHOLD = 5;

const ListField = ({ name, spec, value, onChange, path, context }) => {
  const items = Array.isArray(value) ? value : [];
  const of = spec.of ?? { kind: 'text' };
  const atCap = spec.maxItems != null && items.length >= spec.maxItems;

  // Only group rows are worth collapsing; a list of plain strings is one input
  // per row and reads better left open.
  const collapsible = of.kind === 'group' && items.length > COLLAPSE_THRESHOLD;
  const [openRows, setOpenRows] = useState(() => new Set());

  const isOpen = (i) => !collapsible || openRows.has(i);
  const toggle = (i) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  // Open state is tracked by index, so it has to move with the rows.
  const shiftAfterRemove = (removed) =>
    setOpenRows((prev) => {
      const next = new Set();
      prev.forEach((i) => {
        if (i < removed) next.add(i);
        else if (i > removed) next.add(i - 1);
      });
      return next;
    });

  const swapOpen = (i, j) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      const hadI = prev.has(i);
      const hadJ = prev.has(j);
      next.delete(i);
      next.delete(j);
      if (hadI) next.add(j);
      if (hadJ) next.add(i);
      return next;
    });

  const replace = (i, next) => onChange(items.map((it, idx) => (idx === i ? next : it)));

  const remove = (i) => {
    onChange(items.filter((_, idx) => idx !== i));
    shiftAfterRemove(i);
  };

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    swapOpen(i, j);
  };

  const add = () => {
    onChange([...items, emptyValue(of)]);
    setOpenRows((prev) => new Set(prev).add(items.length)); // new row starts open
  };

  const allOpen = collapsible && openRows.size === items.length;

  return (
    <fieldset className="admin-fieldset admin-list">
      {spec.label && (
        <legend>
          {spec.label} <span className="admin-count">({items.length})</span>
        </legend>
      )}

      <div className="admin-list-head">
        {spec.help && <p className="admin-hint">{spec.help}</p>}
        {collapsible && (
          <button
            type="button"
            className="admin-btn admin-btn-ghost admin-list-toggle-all"
            onClick={() =>
              setOpenRows(allOpen ? new Set() : new Set(items.map((_, i) => i)))
            }
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {items.map((item, i) => {
        const open = isOpen(i);
        const summary = rowSummary(of, item, i);

        return (
          <div className={`admin-list-row ${open ? 'is-open' : ''}`} key={i}>
            <div className="admin-list-row-head">
              {collapsible ? (
                <button
                  type="button"
                  className="admin-list-row-toggle"
                  onClick={() => toggle(i)}
                  aria-expanded={open}
                >
                  {open ? <DownOutlined /> : <RightOutlined />}
                  <span className="admin-list-row-title">{summary}</span>
                </button>
              ) : (
                <span className="admin-list-row-title">{summary}</span>
              )}

              <div className="admin-list-row-tools">
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${summary} up`}
                >
                  <ArrowUpOutlined />
                </button>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label={`Move ${summary} down`}
                >
                  <ArrowDownOutlined />
                </button>
                <button
                  type="button"
                  className="admin-icon-btn is-danger"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${summary}`}
                >
                  <DeleteOutlined />
                </button>
              </div>
            </div>

            {open &&
              (of.kind === 'group' ? (
                <div className="admin-grid-2">
                  {Object.entries(of.fields ?? {}).map(([childName, childSpec]) => (
                    <SchemaField
                      key={childName}
                      name={childName}
                      spec={childSpec}
                      path={`${path}.${i}.${childName}`}
                      value={item?.[childName]}
                      context={context}
                      onChange={(next) => replace(i, { ...(item ?? {}), [childName]: next })}
                    />
                  ))}
                </div>
              ) : (
                <SchemaField
                  name={`${name}-${i}`}
                  spec={{ ...of, label: undefined }}
                  path={`${path}.${i}`}
                  value={item}
                  context={context}
                  onChange={(next) => replace(i, next)}
                />
              ))}
          </div>
        );
      })}

      <button
        type="button"
        className="admin-btn admin-btn-ghost admin-add"
        onClick={add}
        disabled={atCap}
      >
        <PlusOutlined /> Add {spec.label ? spec.label.replace(/s$/i, '') : 'item'}
      </button>
      {atCap && <p className="admin-hint">Maximum of {spec.maxItems} reached.</p>}
    </fieldset>
  );
};

const SchemaField = ({ name, spec, value, onChange, path = '', context }) => {
  const kind = spec.kind ?? 'text';
  const fieldId = `f-${path || name}`;

  // ------------------------------------------------------------------ group
  if (kind === 'group') {
    return (
      <fieldset className="admin-fieldset">
        {spec.label && <legend>{spec.label}</legend>}
        {spec.help && <p className="admin-hint">{spec.help}</p>}
        <div className="admin-grid-2">
          {Object.entries(spec.fields ?? {}).map(([childName, childSpec]) => (
            <SchemaField
              key={childName}
              name={childName}
              spec={childSpec}
              path={`${path}.${childName}`}
              value={value?.[childName]}
              context={context}
              onChange={(next) => onChange({ ...(value ?? {}), [childName]: next })}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  // ------------------------------------------------------------------- list
  if (kind === 'list') {
    return <ListField name={name} spec={spec} value={value} onChange={onChange} path={path} context={context} />;
  }

  // ----------------------------------------------------------------- scalar
  // Upload fields render their own labels, so don't wrap them in a second one.
  if (kind === 'image' || kind === 'file') {
    return <ScalarInput spec={spec} value={value} onChange={onChange} id={fieldId} context={context} />;
  }

  return (
    <label className="admin-field" htmlFor={fieldId}>
      <span>{spec.label ?? name}</span>
      <ScalarInput spec={spec} value={value} onChange={onChange} id={fieldId} context={context} />
      {spec.help && <small className="admin-hint">{spec.help}</small>}
    </label>
  );
};

export default SchemaField;
