import { useEffect, useRef, useState, useCallback } from 'react';
import { CameraOutlined, StopOutlined } from '@ant-design/icons';
import { lookupTicket, admitTicket } from '../lib/api';

// Wording the door can act on without thinking. The verdict has to be readable
// at arm's length, in poor light, with a queue waiting.
const VERDICT = {
  ok:        { tone: 'good', title: 'ADMIT',           note: 'Valid ticket.' },
  already:   { tone: 'bad',  title: 'ALREADY USED',    note: 'This ticket has been scanned before.' },
  unpaid:    { tone: 'bad',  title: 'NOT PAID',        note: 'The payment for this order never completed.' },
  merch:     { tone: 'warn', title: 'MERCHANDISE',     note: 'A shop receipt, not an entry ticket.' },
  not_found: { tone: 'bad',  title: 'UNKNOWN CODE',    note: 'No ticket exists with this code.' },
};

const at = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

const AdminScan = () => {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraMsg, setCameraMsg] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Guards against the camera firing the same code dozens of times a second
  // while it stays in frame.
  const lastSeen = useRef({ code: '', at: 0 });

  const look = useCallback(async (raw) => {
    const value = (raw || '').trim();
    if (!value) return;

    setBusy(true);
    setError('');
    try {
      setResult(await lookupTicket(value));
    } catch (err) {
      setError(err.message || 'Could not check that code.');
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const admit = async () => {
    setBusy(true);
    setError('');
    try {
      setResult(await admitTicket(result.code));
    } catch (err) {
      setError(err.message || 'Could not admit that ticket.');
    } finally {
      setBusy(false);
    }
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = async () => {
    setCameraMsg('');
    // BarcodeDetector is native in Chrome and in Safari 17+. Rather than ship a
    // decoder, the page falls back to typing the code — which staff need anyway
    // for a cracked screen or a creased printout.
    if (!('BarcodeDetector' in window)) {
      setCameraMsg('This browser cannot scan. Use Chrome, or type the code below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },   // the back camera, at a door
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
    } catch {
      setCameraMsg('No camera access. Allow it in your browser, or type the code below.');
    }
  };

  // Poll the video for a QR while the camera is on.
  useEffect(() => {
    if (!scanning) return undefined;

    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    let stopped = false;

    const tick = async () => {
      if (stopped || !videoRef.current) return;
      try {
        const found = await detector.detect(videoRef.current);
        const value = found?.[0]?.rawValue?.trim();

        // Ignore a repeat of the same code within two seconds, so one ticket
        // held in frame does not hammer the server or flicker the verdict.
        const now = Date.now();
        if (value && !(value === lastSeen.current.code && now - lastSeen.current.at < 2000)) {
          lastSeen.current = { code: value, at: now };
          setCode(value);
          look(value);
        }
      } catch {
        // A frame that fails to decode is the normal case, not an error.
      }
    };

    const id = setInterval(tick, 350);
    return () => { stopped = true; clearInterval(id); };
  }, [scanning, look]);

  // Release the camera when leaving the page — a live stream left running keeps
  // the indicator light on and drains the phone.
  useEffect(() => stopCamera, [stopCamera]);

  // A freshly admitted ticket comes back as 'ok' WITH a timestamp, which reads
  // identically to one not yet used. Separating the two stops the button
  // inviting a second press on a ticket already let through.
  const done = result?.status === 'ok' && !!result.admittedAt;
  const verdict = result
    ? (done ? { tone: 'good', title: 'ADMITTED', note: 'Let them through.' } : VERDICT[result.status])
    : null;

  return (
    <section className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1>Door check-in</h1>
          <p className="admin-page-sub">
            Scan a ticket QR, or type the code. Checking a code never uses it up —
            only <strong>Admit</strong> does.
          </p>
        </div>
        {scanning ? (
          <button type="button" className="admin-btn" onClick={stopCamera}>
            <StopOutlined /> Stop camera
          </button>
        ) : (
          <button type="button" className="admin-btn admin-btn-primary" onClick={startCamera}>
            <CameraOutlined /> Start camera
          </button>
        )}
      </header>

      {error && <p className="admin-error">{error}</p>}
      {cameraMsg && <p className="admin-note">{cameraMsg}</p>}

      <div className="admin-scan-grid">
        <div>
          <video
            ref={videoRef}
            className={`admin-scan-video${scanning ? '' : ' is-idle'}`}
            muted
            playsInline
          />

          <form
            className="admin-scan-manual"
            onSubmit={(e) => { e.preventDefault(); look(code); }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="JC-A1B2C3D4E5"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label="Ticket code"
            />
            <button type="submit" className="admin-btn" disabled={busy || !code.trim()}>
              {busy ? 'Checking…' : 'Check'}
            </button>
          </form>
        </div>

        <div>
          {!result && <p className="admin-empty">No ticket checked yet.</p>}

          {result && verdict && (
            <div className={`admin-verdict is-${verdict.tone}`}>
              <p className="admin-verdict-title">{verdict.title}</p>
              <p className="admin-verdict-note">{verdict.note}</p>

              {result.status === 'already' && result.admittedAt && (
                <p className="admin-verdict-when">First admitted {at(result.admittedAt)}</p>
              )}

              {result.code && (
                <dl className="admin-verdict-facts">
                  <div><dt>Code</dt><dd>{result.code}</dd></div>
                  {result.event && <div><dt>Event</dt><dd>{result.event}</dd></div>}
                  {result.item && (
                    <div><dt>Admits</dt><dd>{result.quantity} × {result.item}</dd></div>
                  )}
                  {result.buyer && <div><dt>Buyer</dt><dd>{result.buyer}</dd></div>}
                </dl>
              )}

              {result.status === 'ok' && !done && (
                <button
                  type="button"
                  className="admin-btn admin-btn-primary admin-verdict-action"
                  onClick={admit}
                  disabled={busy}
                >
                  {busy ? 'Admitting…' : `Admit ${result.quantity > 1 ? `${result.quantity} people` : ''}`.trim()}
                </button>
              )}

              {done && <p className="admin-verdict-when">Admitted {at(result.admittedAt)}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default AdminScan;
