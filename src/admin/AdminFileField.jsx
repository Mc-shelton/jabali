import { useRef, useState } from 'react';
import { CloseOutlined, CustomerServiceOutlined, UploadOutlined } from '@ant-design/icons';
import { uploadMedia } from '../lib/api';

const AdminFileField = ({ label, value, onChange, folder = 'music', accept = 'audio/*' }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await uploadMedia(file, folder));
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

      <div className="admin-file-control">
        {value ? (
          <div className="admin-file-current">
            <CustomerServiceOutlined />
            <a href={value} target="_blank" rel="noreferrer">Open uploaded file</a>
            <button type="button" onClick={() => onChange('')} aria-label="Remove media file">
              <CloseOutlined />
            </button>
          </div>
        ) : (
          <button type="button" className="admin-image-drop" onClick={() => inputRef.current?.click()} disabled={busy}>
            <UploadOutlined /> {busy ? 'Uploading…' : 'Upload audio'}
          </button>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={pick} hidden />
      </div>

      <input
        type="url"
        className="admin-image-url"
        placeholder="…or paste a media URL"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
      {value?.startsWith('/bucket/') && <small className="admin-hint">Uploaded to the protected server media bucket. Save changes to publish it.</small>}
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
};

export default AdminFileField;
