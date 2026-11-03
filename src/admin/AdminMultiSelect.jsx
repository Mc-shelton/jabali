import { useEffect, useRef, useState } from 'react';
import { DownOutlined } from '@ant-design/icons';

const AdminMultiSelect = ({ label, values, options, placeholder, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const toggle = (value) => {
    onChange(
      values.includes(value)
        ? values.filter((selected) => selected !== value)
        : [...values, value],
    );
  };

  const summary = values.length === 0
    ? placeholder
    : values.length === 1
      ? options.find((option) => option.value === values[0])?.label ?? values[0]
      : `${values.length} selected`;

  return (
    <div className="admin-field admin-multiselect" ref={rootRef}>
      <span>{label}</span>
      <button
        type="button"
        className={`admin-multiselect-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{summary}</span>
        <DownOutlined />
      </button>
      {open && (
        <div className="admin-multiselect-menu" role="listbox" aria-multiselectable="true">
          {values.length > 0 && (
            <button type="button" className="admin-multiselect-clear" onClick={() => onChange([])}>
              Clear selection
            </button>
          )}
          {options.map((option) => (
            <label
              className="admin-multiselect-option"
              key={option.value}
              role="option"
              aria-selected={values.includes(option.value)}
            >
              <input
                type="checkbox"
                checked={values.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMultiSelect;
