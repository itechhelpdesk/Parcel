/* global BarcodeDetector */
import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────
const LAYOUTS = [
  { id: '1x1', label: '1×1', cols: 1, rows: 1 },
  { id: '2x1', label: '2×1', cols: 2, rows: 1 },
  { id: '2x2', label: '2×2', cols: 2, rows: 2 },
  { id: '3x3', label: '3×3', cols: 3, rows: 3 },
];
const SIZES = [50, 60, 80, 100];
const PRINT_GAP = 2;
const PRINT_PAD = 5;

// ─── jsPDF loader ───────────────────────────────────────────────────────────
async function loadJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.jspdf.jsPDF;
}

// ─── Draw one sheet for a single image — no crop, preserves aspect ratio ────
function drawSheet(canvas, img, cols, rows) {
  const CELL_W = Math.max(img.width, 600);
  const CELL_H = Math.round(CELL_W * (img.height / img.width));
  const GAP    = Math.round(CELL_W * 0.015);
  const PAD    = Math.round(CELL_W * 0.025);

  const W = PAD * 2 + cols * CELL_W + (cols - 1) * GAP;
  const H = PAD * 2 + rows * CELL_H + (rows - 1) * GAP;

  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.drawImage(img,
        PAD + c * (CELL_W + GAP),
        PAD + r * (CELL_H + GAP),
        CELL_W, CELL_H
      );
    }
  }
}

// ─── Render one image to an offscreen canvas, return dataUrl ─────────────────
function renderToDataUrl(img, cols, rows) {
  const c = document.createElement('canvas');
  drawSheet(c, img, cols, rows);
  return c.toDataURL('image/png', 1.0);
}

function thumbUrl(img) {
  const c = document.createElement('canvas');
  c.width = 72; c.height = 72;
  const cx = c.getContext('2d');
  const s = Math.min(72 / img.width, 72 / img.height);
  const tw = img.width * s, th = img.height * s;
  cx.fillStyle = '#fff';
  cx.fillRect(0, 0, 72, 72);
  cx.drawImage(img, (72 - tw) / 2, (72 - th) / 2, tw, th);
  return c.toDataURL();
}

// ─── Theme ──────────────────────────────────────────────────────────────────
const THEME = {
  light: {
    bg: '#f5f4f0', surface: '#ffffff', border: '#e2dfd8',
    text: '#1a1a1a', textMuted: '#888', textFaint: '#bbb',
    accent: '#fe2c55', cyan: '#0ea5a0',
    tabActiveBg: '#1a1a1a', tabActiveTxt: '#ffffff',
    layoutOptBg: '#f8f7f3', layoutOptActiveBg: '#fff0f3',
    canvasBg: '#ededea',
    btnPrintBg: 'linear-gradient(135deg,#fe2c55,#c41030)',
    btnPdfBorder: '#0ea5a0', btnPdfColor: '#0ea5a0', btnPdfBg: 'rgba(14,165,160,0.07)',
    toastBg: '#1a1a1a', toastTxt: '#fff',
    shadow: '0 2px 16px rgba(0,0,0,0.08)',
    toggleBg: '#e2dfd8', toggleKnob: '#fff', toggleIcon: '🌙',
    uploadHoverBg: '#fff6f8',
    deleteBg: 'rgba(254,44,85,0.08)',
  },
  dark: {
    bg: '#0d0d0d', surface: '#161616', border: '#2a2a2a',
    text: '#f0f0f0', textMuted: '#777', textFaint: '#444',
    accent: '#fe2c55', cyan: '#25f4ee',
    tabActiveBg: '#fe2c55', tabActiveTxt: '#ffffff',
    layoutOptBg: '#111', layoutOptActiveBg: '#1a0a0e',
    canvasBg: '#111',
    btnPrintBg: 'linear-gradient(135deg,#fe2c55,#c41030)',
    btnPdfBorder: '#25f4ee55', btnPdfColor: '#25f4ee', btnPdfBg: 'rgba(37,244,238,0.07)',
    toastBg: '#1e1e1e', toastTxt: '#eee',
    shadow: '0 2px 20px rgba(0,0,0,0.4)',
    toggleBg: '#2a2a2a', toggleKnob: '#fe2c55', toggleIcon: '☀️',
    uploadHoverBg: '#1a0a0e',
    deleteBg: 'rgba(254,44,85,0.12)',
  },
};

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark]               = useState(false);
  const T = dark ? THEME.dark : THEME.light;

  const [tab, setTab]                 = useState('upload');
  const [images, setImages]           = useState([]);   // all loaded Image objects
  const [selIdx, setSelIdx]           = useState(0);    // preview selection
  const [layout, setLayout]           = useState(LAYOUTS[2]);
  const [sizeMm, setSizeMm]           = useState(100);
  const [copies, setCopies]           = useState(1);
  const [scanning, setScanning]       = useState(false);
  const [uploadHover, setUploadHover] = useState(false);
  const [toast, setToast]             = useState('');
  const [toastShow, setToastShow]     = useState(false);

  const canvasRef = useRef(null);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const scanRef   = useRef(null);

  // Preview redraws on change
  useEffect(() => {
    if (!images.length || !canvasRef.current) return;
    drawSheet(canvasRef.current, images[selIdx], layout.cols, layout.rows);
  }, [images, selIdx, layout, tab]);

  useEffect(() => () => stopScan(), []); // eslint-disable-line

  function ping(msg) {
    setToast(msg); setToastShow(true);
    setTimeout(() => setToastShow(false), 2800);
  }

  function addImages(newImgs) {
    setImages(prev => {
      const next = [...prev, ...newImgs];
      setSelIdx(next.length - 1);
      return next;
    });
    setTab('layout');
    ping(`✓ ${newImgs.length} image${newImgs.length > 1 ? 's' : ''} added — ${layout.cols * layout.rows} copies each`);
  }

  function removeImage(i) {
    setImages(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      setSelIdx(Math.min(i, next.length - 1));
      return next;
    });
  }

  // ── File upload ──
  function handleFiles(files) {
    const loaded = [];
    const total = files.length;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          loaded.push(img);
          if (loaded.length === total) addImages(loaded);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function handleDrop(e) {
    e.preventDefault();
    setUploadHover(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  // ── QR Scan ──
  const loadFromURL = useCallback((url) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => addImages([img]);
    img.onerror = () => ping('Could not load image from URL');
    img.src = url;
  }, []); // eslint-disable-line

  async function startScan() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = s;
      videoRef.current.srcObject = s;
      setScanning(true);
      scanRef.current = setInterval(tryDecode, 700);
    } catch { ping('Camera permission denied'); }
  }

  function stopScan() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    clearInterval(scanRef.current);
    setScanning(false);
  }

  function tryDecode() {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    const tmp = document.createElement('canvas');
    tmp.width = video.videoWidth; tmp.height = video.videoHeight;
    tmp.getContext('2d').drawImage(video, 0, 0);
    if (typeof BarcodeDetector !== 'undefined') {
      new BarcodeDetector({ formats: ['qr_code'] })
        .detect(tmp)
        .then(codes => { if (codes.length) { stopScan(); loadFromURL(codes[0].rawValue); } })
        .catch(() => {});
    }
  }

  // ── Print ALL images — each gets its own tiled page ──
  function doPrint() {
    if (!images.length) return;
    const { cols, rows } = layout;

    // Build pages for every image × copies
    const allPages = images.flatMap(img => {
      const dataUrl = renderToDataUrl(img, cols, rows);
      const labelW  = sizeMm;
      const labelH  = Math.round(sizeMm * (img.height / img.width));
      const pw = PRINT_PAD * 2 + cols * labelW + (cols - 1) * PRINT_GAP;
      const ph = PRINT_PAD * 2 + rows * labelH + (rows - 1) * PRINT_GAP;

      const cells = Array(cols * rows).fill(null)
        .map(() => `<div class="cell" style="width:${labelW}mm;height:${labelH}mm"><img src="${dataUrl}" alt=""></div>`)
        .join('');
      const page = `<div class="pg" style="padding:${PRINT_PAD}mm;display:grid;grid-template-columns:repeat(${cols},${labelW}mm);grid-template-rows:repeat(${rows},${labelH}mm);gap:${PRINT_GAP}mm;page-break-after:always;">${cells}</div>`;

      return Array(copies).fill(page);
    });

    const win = window.open('', '_blank');
    if (!win) { ping('⚠ Allow popups to print'); return; }

    win.document.write(`<!DOCTYPE html><html><head><title>Waybills</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{margin:0}
body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cell{overflow:hidden}
.cell img{width:100%;height:100%;object-fit:fill;display:block}
</style></head><body>${allPages.join('')}
<script>
window.onload=function(){window.print();setTimeout(function(){window.close();},1000);}
<\/script></body></html>`);
    win.document.close();
    ping(`🖨️ Printing ${images.length} waybill${images.length > 1 ? 's' : ''} × ${cols * rows} per sheet × ${copies} cop${copies > 1 ? 'ies' : 'y'}`);
  }

  // ── PDF ALL images — each image = one page per copy ──
  async function doPDF() {
    if (!images.length) return;
    ping(`📄 Building PDF for ${images.length} waybill${images.length > 1 ? 's' : ''}…`);

    try {
      const JsPDF = await loadJsPDF();
      const { cols, rows } = layout;

      let doc = null;

      for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
        const img     = images[imgIdx];
        const dataUrl = renderToDataUrl(img, cols, rows);
        const labelW  = sizeMm;
        const labelH  = Math.round(sizeMm * (img.height / img.width));
        const pw = PRINT_PAD * 2 + cols * labelW + (cols - 1) * PRINT_GAP;
        const ph = PRINT_PAD * 2 + rows * labelH + (rows - 1) * PRINT_GAP;

        for (let copy = 0; copy < copies; copy++) {
          if (!doc) {
            doc = new JsPDF({
              orientation: pw > ph ? 'landscape' : 'portrait',
              unit: 'mm',
              format: [pw, ph],
            });
          } else {
            doc.addPage([pw, ph], pw > ph ? 'landscape' : 'portrait');
          }

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              doc.addImage(
                dataUrl, 'PNG',
                PRINT_PAD + c * (labelW + PRINT_GAP),
                PRINT_PAD + r * (labelH + PRINT_GAP),
                labelW, labelH
              );
            }
          }
        }
      }

      const totalPages = images.length * copies;
      doc.save('waybills.pdf');
      ping(`✓ waybills.pdf — ${totalPages} page${totalPages > 1 ? 's' : ''}, ${cols * rows} labels each`);
    } catch (e) {
      ping('PDF error: ' + e.message);
    }
  }

  const hasImg = images.length > 0;
  const base = {
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s',
    cursor: 'pointer',
    border: 'none',
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ minHeight: '100vh', background: T.bg, transition: 'background 0.3s', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 16px 60px' }}>

          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: -1,
                background: 'linear-gradient(135deg,#fe2c55,#ff8f3f)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>StickerBooth</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                multi-upload → tile → bulk print / PDF
              </div>
            </div>
            <button onClick={() => setDark(d => !d)} title="Toggle theme"
              style={{ width: 46, height: 26, borderRadius: 13, background: T.toggleBg, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, marginTop: 4, transition: 'background 0.3s' }}>
              <div style={{ position: 'absolute', top: 3, left: dark ? 22 : 3, width: 20, height: 20, borderRadius: '50%', background: T.toggleKnob, transition: 'left 0.25s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                {T.toggleIcon}
              </div>
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, background: T.surface, padding: 6, borderRadius: 16, marginBottom: 22, boxShadow: T.shadow }}>
            {[['upload','📁 Upload'],['scan','📷 QR Scan'],['layout','🖨️ Print']].map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); if (id !== 'scan') stopScan(); }}
                style={{ ...base, flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 13, fontWeight: 500, background: tab === id ? T.tabActiveBg : 'transparent', color: tab === id ? T.tabActiveTxt : T.textMuted }}>
                {label}
              </button>
            ))}
          </div>

          {/* ══ Upload ══ */}
          {tab === 'upload' && (
            <div>
              <label
                style={{ position: 'relative', display: 'block', border: `2px dashed ${uploadHover ? T.accent : T.border}`, borderRadius: 18, padding: '44px 20px', textAlign: 'center', cursor: 'pointer', background: uploadHover ? T.uploadHoverBg : T.surface, transition: 'all 0.2s', boxShadow: T.shadow }}
                onMouseEnter={() => setUploadHover(true)}
                onMouseLeave={() => setUploadHover(false)}
                onDragOver={e => { e.preventDefault(); setUploadHover(true); }}
                onDragLeave={() => setUploadHover(false)}
                onDrop={handleDrop}
              >
                <input type="file" accept="image/*" multiple
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                  onChange={e => handleFiles(e.target.files)} />
                <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🖼️</span>
                <p style={{ fontSize: 14, color: T.textMuted }}>
                  <span style={{ color: T.accent, fontWeight: 600 }}>Tap to upload</span> or drag images here
                </p>
                <p style={{ fontSize: 12, color: T.textFaint, marginTop: 6 }}>
                  Multiple waybills OK — each gets its own page in PDF/Print
                </p>
              </label>

              {/* Image list with remove button */}
              {hasImg && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
                      {images.length} waybill{images.length > 1 ? 's' : ''} queued
                    </span>
                    <button onClick={() => { setImages([]); setSelIdx(0); ping('Cleared all!'); }}
                      style={{ ...base, fontSize: 11, color: T.accent, background: T.deleteBg, padding: '4px 10px', borderRadius: 8, border: `1px solid ${T.accent}44` }}>
                      Clear all
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {images.map((img, i) => (
                      <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={thumbUrl(img)} alt="" onClick={() => { setSelIdx(i); setTab('layout'); }}
                          style={{ width: 64, height: 80, objectFit: 'contain', background: '#fff', borderRadius: 10, display: 'block', cursor: 'pointer', border: `3px solid ${i === selIdx ? T.accent : T.border}`, transition: 'border-color 0.2s' }} />
                        <button onClick={() => removeImage(i)}
                          style={{ ...base, position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: T.accent, color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                          ×
                        </button>
                        <div style={{ textAlign: 'center', fontSize: 10, color: T.textMuted, marginTop: 3 }}>#{i + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ Scan ══ */}
          {tab === 'scan' && (
            <div>
              <span style={{ display: 'inline-block', background: `${T.cyan}18`, color: T.cyan, fontSize: 11, padding: '3px 12px', borderRadius: 100, marginBottom: 12 }}>
                Requires camera permission
              </span>
              <div style={{ position: 'relative', background: '#000', borderRadius: 18, overflow: 'hidden', aspectRatio: '4/3' }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: 170, height: 170, border: `3px solid ${T.cyan}`, borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }} />
                </div>
              </div>
              <button onClick={() => scanning ? stopScan() : startScan()}
                style={{ ...base, width: '100%', padding: 14, borderRadius: 12, marginTop: 12, fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, background: scanning ? T.accent : T.cyan, color: '#fff' }}>
                {scanning ? '⏹ Stop Camera' : '▶ Start Camera'}
              </button>
              <p style={{ fontSize: 12, color: T.textFaint, textAlign: 'center', marginTop: 10 }}>
                Scan multiple QR codes — each adds to the queue
              </p>
            </div>
          )}

          {/* ══ Layout + Print ══ */}
          {tab === 'layout' && (
            <div>
              {/* Queue indicator */}
              {images.length > 1 && (
                <div style={{ background: T.btnPdfBg, border: `1px solid ${T.btnPdfBorder}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>📦</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.btnPdfColor }}>
                      {images.length} waybills in queue
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>
                      PDF & Print will include ALL of them — each on its own page
                    </div>
                  </div>
                </div>
              )}

              {/* Preview selector */}
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
                  {images.map((img, i) => (
                    <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={thumbUrl(img)} alt="" onClick={() => setSelIdx(i)}
                        style={{ width: 48, height: 60, objectFit: 'contain', background: '#fff', borderRadius: 8, display: 'block', cursor: 'pointer', border: `3px solid ${i === selIdx ? T.accent : T.border}` }} />
                      <div style={{ textAlign: 'center', fontSize: 9, color: T.textMuted, marginTop: 2 }}>#{i + 1}</div>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 10 }}>
                Grid layout — same label tiled per page
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 20 }}>
                {LAYOUTS.map(l => {
                  const active = layout.id === l.id;
                  return (
                    <div key={l.id} onClick={() => setLayout(l)}
                      style={{ border: `2px solid ${active ? T.accent : T.border}`, borderRadius: 12, padding: '10px 6px 8px', cursor: 'pointer', background: active ? T.layoutOptActiveBg : T.layoutOptBg, textAlign: 'center', transition: 'all 0.2s' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${l.cols},1fr)`, gap: 3, width: '100%', aspectRatio: '1', marginBottom: 6 }}>
                        {Array(l.cols * l.rows).fill(0).map((_, i) => (
                          <div key={i} style={{ background: active ? T.accent : T.border, borderRadius: 2 }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: active ? T.accent : T.textMuted }}>{l.label}</span>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 10 }}>Label width</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {SIZES.map(sz => {
                  const active = sizeMm === sz;
                  return (
                    <button key={sz} onClick={() => setSizeMm(sz)}
                      style={{ ...base, flex: 1, padding: '10px 4px', border: `2px solid ${active ? T.cyan : T.border}`, borderRadius: 10, background: T.surface, color: active ? T.cyan : T.textMuted, fontSize: 13 }}>
                      {sz}mm
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '1.2px', margin: 0 }}>Copies per waybill</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button onClick={() => setCopies(c => Math.max(1, c - 1))}
                    style={{ ...base, width: 34, height: 34, borderRadius: '50%', border: `2px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: T.text, minWidth: 30, textAlign: 'center' }}>{copies}</span>
                  <button onClick={() => setCopies(c => Math.min(20, c + 1))}
                    style={{ ...base, width: 34, height: 34, borderRadius: '50%', border: `2px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>

              <p style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 10 }}>
                Preview — waybill #{selIdx + 1} of {images.length}
              </p>
              <div style={{ background: T.canvasBg, borderRadius: 18, padding: 14, marginBottom: 16, minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.border}` }}>
                {hasImg
                  ? <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />
                  : (
                    <>
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                      <div style={{ textAlign: 'center', color: T.textFaint, fontSize: 14 }}>
                        <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>📷</span>
                        Upload waybill images first
                      </div>
                    </>
                  )
                }
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <button onClick={() => { setImages([]); setSelIdx(0); ping('Cleared all!'); }}
                  style={{ ...base, flex: 1, padding: '13px 10px', border: `2px solid ${T.border}`, borderRadius: 12, background: 'transparent', color: T.textMuted, fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700 }}>
                  Clear
                </button>
                <button disabled={!hasImg} onClick={doPDF}
                  style={{ ...base, flex: 1.3, padding: '13px 10px', border: `2px solid ${T.btnPdfBorder}`, borderRadius: 12, background: T.btnPdfBg, color: T.btnPdfColor, fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, opacity: !hasImg ? 0.4 : 1, cursor: !hasImg ? 'default' : 'pointer' }}>
                  📄 PDF
                </button>
                <button disabled={!hasImg} onClick={doPrint}
                  style={{ ...base, flex: 2, padding: '13px 10px', border: 'none', borderRadius: 12, background: !hasImg ? T.border : T.btnPrintBg, color: '#fff', fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, opacity: !hasImg ? 0.4 : 1, cursor: !hasImg ? 'default' : 'pointer', letterSpacing: 0.3 }}>
                  🖨️ Print All
                </button>
              </div>

              <p style={{ fontSize: 11, color: T.textFaint, textAlign: 'center', lineHeight: 1.7 }}>
                {hasImg && `${images.length} waybill${images.length > 1 ? 's' : ''} × ${layout.cols * layout.rows} copies × ${copies} sheet${copies > 1 ? 's' : ''} = ${images.length * layout.cols * layout.rows * copies} labels total`}<br />
                PDF & Print → ALL waybills, each on its own page
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Toast */}
      <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: `translateX(-50%) translateY(${toastShow ? 0 : 80}px)`, background: T.toastBg, color: T.toastTxt, padding: '11px 22px', borderRadius: 100, fontSize: 13, fontWeight: 500, transition: 'transform 0.3s ease', whiteSpace: 'nowrap', zIndex: 9999, pointerEvents: 'none', border: `1px solid ${T.border}` }}>
        {toast}
      </div>
    </>
  );
}
