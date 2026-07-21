import { useRef, useState } from 'react';
import { UploadOutlined, CloseOutlined } from '@ant-design/icons';
import { uploadImage } from '../lib/api';

// A single image: upload a file (goes through the PHP upload endpoint) or paste
// a URL. `folder` files it by subject; omitted means the events folder.
const AdminImageField = ({ label, value, onChange, folder }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="admin-field">
      <span>{label}</span>

      <div className="admin-image">
        {value ? (
          <div className="admin-image-preview" style={{ backgroundImage: `url("${value}")` }}>
            <button
              type="button"
              className="admin-image-remove"
              onClick={() => onChange('')}
              aria-label="Remove image"
            >
              <CloseOutlined />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="admin-image-drop"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <UploadOutlined />
            {busy ? 'Uploading…' : 'Upload image'}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pick}
          hidden
        />
      </div>

      <input
        type="text"
        className="admin-image-url"
        placeholder="…or paste an image URL"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />

      {error && <p className="admin-error">{error}</p>}
    </div>
  );
};

export default AdminImageField;
