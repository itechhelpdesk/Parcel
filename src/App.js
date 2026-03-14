/* global BarcodeDetector */
import { useState, useRef, useEffect } from 'react';

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

// ─── Draw sheet — no crop, preserves aspect ratio ───────────────────────────
function drawSheet(canvas, img, cols, rows) {
  const CELL_W = Math.max(img.width, 600);
  const CELL_H = Math.round(CELL_W * (img.height / img.width));
  const GAP    = Math.round(CELL_W * 0.015);
  const PAD    = Math.round(CELL_W * 0.025);
  const W = PAD*2 + cols*CELL_W + (cols-1)*GAP;
  const H = PAD*2 + rows*CELL_H + (rows-1)*GAP;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      ctx.drawImage(img, PAD+c*(CELL_W+GAP), PAD+r*(CELL_H+GAP), CELL_W, CELL_H);
}

function renderToDataUrl(img, cols, rows) {
  const c = document.createElement('canvas');
  drawSheet(c, img, cols, rows);
  return c.toDataURL('image/png', 1.0);
}

function thumbUrl(img) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 80;
  const cx = c.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0,0,64,80);
  const s = Math.min(64/img.width, 80/img.height);
  const tw = img.width*s, th = img.height*s;
  cx.drawImage(img, (64-tw)/2, (80-th)/2, tw, th);
  return c.toDataURL();
}

// ─── Theme ──────────────────────────────────────────────────────────────────
const THEME = {
  light: {
    bg:'#f5f4f0', surface:'#ffffff', border:'#e2dfd8',
    text:'#1a1a1a', textMuted:'#888', textFaint:'#bbb',
    accent:'#fe2c55', cyan:'#0ea5a0',
    tabActiveBg:'#1a1a1a', tabActiveTxt:'#ffffff',
    layoutOptBg:'#f8f7f3', layoutOptActiveBg:'#fff0f3',
    canvasBg:'#ededea',
    btnPrintBg:'linear-gradient(135deg,#fe2c55,#c41030)',
    btnPdfBorder:'#0ea5a0', btnPdfColor:'#0ea5a0', btnPdfBg:'rgba(14,165,160,0.07)',
    toastBg:'#1a1a1a', toastTxt:'#fff',
    shadow:'0 2px 16px rgba(0,0,0,0.08)',
    toggleBg:'#e2dfd8', toggleKnob:'#fff', toggleIcon:'🌙',
    uploadHoverBg:'#fff6f8', deleteBg:'rgba(254,44,85,0.08)',
    scanActiveBg:'rgba(14,165,160,0.08)', scanActiveBorder:'#0ea5a0',
  },
  dark: {
    bg:'#0d0d0d', surface:'#161616', border:'#2a2a2a',
    text:'#f0f0f0', textMuted:'#777', textFaint:'#444',
    accent:'#fe2c55', cyan:'#25f4ee',
    tabActiveBg:'#fe2c55', tabActiveTxt:'#ffffff',
    layoutOptBg:'#111', layoutOptActiveBg:'#1a0a0e',
    canvasBg:'#111',
    btnPrintBg:'linear-gradient(135deg,#fe2c55,#c41030)',
    btnPdfBorder:'#25f4ee55', btnPdfColor:'#25f4ee', btnPdfBg:'rgba(37,244,238,0.07)',
    toastBg:'#1e1e1e', toastTxt:'#eee',
    shadow:'0 2px 20px rgba(0,0,0,0.4)',
    toggleBg:'#2a2a2a', toggleKnob:'#fe2c55', toggleIcon:'☀️',
    uploadHoverBg:'#1a0a0e', deleteBg:'rgba(254,44,85,0.12)',
    scanActiveBg:'rgba(37,244,238,0.06)', scanActiveBorder:'#25f4ee44',
  },
};

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark]               = useState(false);
  const T = dark ? THEME.dark : THEME.light;

  const [tab, setTab]                 = useState('upload');
  const [queue, setQueue]             = useState([]);   // Image objects
  const [selIdx, setSelIdx]           = useState(0);
  const [layout, setLayout]           = useState(LAYOUTS[2]);
  const [sizeMm, setSizeMm]           = useState(100);
  const [copies, setCopies]           = useState(1);
  const [scanning, setScanning]       = useState(false);
  const [uploadHover, setUploadHover] = useState(false);
  const [toast, setToast]             = useState('');
  const [toastShow, setToastShow]     = useState(false);
  const [scanStatus, setScanStatus]   = useState(''); // live scan feedback
  const [loadingUrl, setLoadingUrl]   = useState(''); // currently fetching

  const canvasRef  = useRef(null);
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const scanRef    = useRef(null);
  const scannedSet = useRef(new Set()); // dedupe QRs in one session

  useEffect(() => {
    if (!queue.length || !canvasRef.current) return;
    drawSheet(canvasRef.current, queue[selIdx], layout.cols, layout.rows);
  }, [queue, selIdx, layout, tab]);

  useEffect(() => () => stopScan(), []); // eslint-disable-line

  function ping(msg) {
    setToast(msg); setToastShow(true);
    setTimeout(() => setToastShow(false), 2800);
  }

  // ── Add image to queue ──
  function addImg(img) {
    setQueue(prev => {
      const next = [...prev, img];
      setSelIdx(next.length - 1);
      return next;
    });
  }

  // ── Load image from URL (from QR) ──
  function loadFromUrl(url) {
    if (scannedSet.current.has(url)) return; // already scanned this one
    scannedSet.current.add(url);
    setLoadingUrl(url);
    setScanStatus(`⬇ Loading waybill…`);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      addImg(img);
      setLoadingUrl('');
      setScanStatus(`✓ Waybill loaded! Keep scanning for more…`);
      ping(`✓ Waybill #${scannedSet.current.size} added`);
    };
    img.onerror = () => {
      // crossOrigin failed — try without it (works for some CDNs)
      const img2 = new Image();
      img2.onload = () => {
        addImg(img2);
        setLoadingUrl('');
        setScanStatus(`✓ Waybill loaded! Keep scanning for more…`);
        ping(`✓ Waybill #${scannedSet.current.size} added`);
      };
      img2.onerror = () => {
        setLoadingUrl('');
        setScanStatus(`⚠ Could not load image — is it a direct image URL?`);
        scannedSet.current.delete(url); // allow retry
      };
      img2.src = url;
    };
    img.src = url;
  }

  // ── Camera scan — stays ON, continuous ──
  async function startScan() {
    scannedSet.current = new Set();
    setScanStatus('📷 Camera ready — point at QR code');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = s;
      videoRef.current.srcObject = s;
      setScanning(true);
      // Scan every 500ms
      scanRef.current = setInterval(tryDecode, 500);
    } catch {
      ping('Camera permission denied');
      setScanStatus('');
    }
  }

  function stopScan() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    clearInterval(scanRef.current);
    setScanning(false);
    setScanStatus('');
  }

  function tryDecode() {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    const tmp = document.createElement('canvas');
    tmp.width = video.videoWidth; tmp.height = video.videoHeight;
    tmp.getContext('2d').drawImage(video, 0, 0);

    if (typeof BarcodeDetector !== 'undefined') {
      // Try both QR and all other 2D codes
      new BarcodeDetector({ formats: ['qr_code', 'data_matrix', 'aztec'] })
        .detect(tmp)
        .then(codes => {
          codes.forEach(code => {
            const raw = code.rawValue?.trim();
            if (!raw) return;
            // Check if it's a URL
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
              loadFromUrl(raw);
            } else {
              // Not a URL — show the raw text as status
              if (!scannedSet.current.has(raw)) {
                scannedSet.current.add(raw);
                setScanStatus(`📄 QR contains text: ${raw.substring(0, 60)}`);
                ping(`Scanned: ${raw.substring(0, 40)}`);
              }
            }
          });
        })
        .catch(() => {});
    } else {
      setScanStatus('⚠ BarcodeDetector not supported — use Chrome/Edge on Android');
    }
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
          if (loaded.length === total) {
            loaded.forEach(i => addImg(i));
            setTab('layout');
            ping(`✓ ${total} waybill${total>1?'s':''} added`);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function handleDrop(e) {
    e.preventDefault(); setUploadHover(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  function removeItem(i) {
    setQueue(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      setSelIdx(Math.min(i, Math.max(0, next.length-1)));
      return next;
    });
  }

  // ── Print ALL ──
  function doPrint() {
    if (!queue.length) return;
    const { cols, rows } = layout;
    const allPages = queue.flatMap(img => {
      const dataUrl  = renderToDataUrl(img, cols, rows);
      const labelW   = sizeMm;
      const labelH   = Math.round(sizeMm * (img.height / img.width));
      const pw = PRINT_PAD*2 + cols*labelW + (cols-1)*PRINT_GAP;
      const ph = PRINT_PAD*2 + rows*labelH + (rows-1)*PRINT_GAP;
      const cells = Array(cols*rows).fill(null)
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
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000);}<\/script>
</body></html>`);
    win.document.close();
    ping(`🖨️ Printing ${queue.length} waybill${queue.length>1?'s':''} × ${cols*rows} tiles × ${copies} cop${copies>1?'ies':'y'}`);
  }

  // ── PDF ALL ──
  async function doPDF() {
    if (!queue.length) return;
    ping(`📄 Building PDF…`);
    try {
      const JsPDF = await loadJsPDF();
      const { cols, rows } = layout;
      let doc = null;
      for (const img of queue) {
        const dataUrl = renderToDataUrl(img, cols, rows);
        const labelW  = sizeMm;
        const labelH  = Math.round(sizeMm * (img.height / img.width));
        const pw = PRINT_PAD*2 + cols*labelW + (cols-1)*PRINT_GAP;
        const ph = PRINT_PAD*2 + rows*labelH + (rows-1)*PRINT_GAP;
        for (let copy = 0; copy < copies; copy++) {
          if (!doc) {
            doc = new JsPDF({ orientation: pw>ph?'landscape':'portrait', unit:'mm', format:[pw,ph] });
          } else {
            doc.addPage([pw,ph], pw>ph?'landscape':'portrait');
          }
          for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++)
              doc.addImage(dataUrl,'PNG', PRINT_PAD+c*(labelW+PRINT_GAP), PRINT_PAD+r*(labelH+PRINT_GAP), labelW, labelH);
        }
      }
      doc.save('waybills.pdf');
      const total = queue.length * copies;
      ping(`✓ waybills.pdf — ${total} page${total>1?'s':''}`);
    } catch(e) { ping('PDF error: '+e.message); }
  }

  const hasItems = queue.length > 0;
  const base = { fontFamily:"'DM Sans',sans-serif", transition:'all 0.2s', cursor:'pointer', border:'none' };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ minHeight:'100vh', background:T.bg, transition:'background 0.3s', fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ maxWidth:480, margin:'0 auto', padding:'28px 16px 60px' }}>

          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, letterSpacing:-1, background:'linear-gradient(135deg,#fe2c55,#ff8f3f)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>StickerBooth</div>
              <div style={{ fontSize:12, color:T.textMuted, marginTop:3 }}>scan QR or upload → tile → bulk print / PDF</div>
            </div>
            <button onClick={() => setDark(d=>!d)} title="Toggle theme"
              style={{ width:46, height:26, borderRadius:13, background:T.toggleBg, border:'none', cursor:'pointer', position:'relative', flexShrink:0, marginTop:4, transition:'background 0.3s' }}>
              <div style={{ position:'absolute', top:3, left:dark?22:3, width:20, height:20, borderRadius:'50%', background:T.toggleKnob, transition:'left 0.25s', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>
                {T.toggleIcon}
              </div>
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:6, background:T.surface, padding:6, borderRadius:16, marginBottom:22, boxShadow:T.shadow }}>
            {[['upload','📁 Upload'],['scan','📷 Scan QR'],['layout','🖨️ Print']].map(([id,label]) => (
              <button key={id} onClick={() => { setTab(id); if(id!=='scan') stopScan(); }}
                style={{ ...base, flex:1, padding:'10px 6px', borderRadius:10, fontSize:13, fontWeight:500, background:tab===id?T.tabActiveBg:'transparent', color:tab===id?T.tabActiveTxt:T.textMuted }}>
                {label}
                {id==='scan' && scanning && <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'#fe2c55', marginLeft:5, verticalAlign:'middle' }} />}
              </button>
            ))}
          </div>

          {/* ══ Upload ══ */}
          {tab === 'upload' && (
            <div>
              <label style={{ position:'relative', display:'block', border:`2px dashed ${uploadHover?T.accent:T.border}`, borderRadius:18, padding:'44px 20px', textAlign:'center', cursor:'pointer', background:uploadHover?T.uploadHoverBg:T.surface, transition:'all 0.2s', boxShadow:T.shadow }}
                onMouseEnter={() => setUploadHover(true)}
                onMouseLeave={() => setUploadHover(false)}
                onDragOver={e => { e.preventDefault(); setUploadHover(true); }}
                onDragLeave={() => setUploadHover(false)}
                onDrop={handleDrop}
              >
                <input type="file" accept="image/*" multiple style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }} onChange={e => handleFiles(e.target.files)} />
                <span style={{ fontSize:40, display:'block', marginBottom:12 }}>🖼️</span>
                <p style={{ fontSize:14, color:T.textMuted }}><span style={{ color:T.accent, fontWeight:600 }}>Tap to upload</span> or drag waybill images here</p>
                <p style={{ fontSize:12, color:T.textFaint, marginTop:6 }}>Multiple waybills OK — each on its own page</p>
              </label>

              {hasItems && (
                <div style={{ marginTop:14 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:12, color:T.textMuted, fontWeight:500 }}>{queue.length} waybill{queue.length>1?'s':''} queued</span>
                    <button onClick={() => { setQueue([]); setSelIdx(0); ping('Cleared!'); }}
                      style={{ ...base, fontSize:11, color:T.accent, background:T.deleteBg, padding:'4px 10px', borderRadius:8, border:`1px solid ${T.accent}44` }}>Clear all</button>
                  </div>
                  <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
                    {queue.map((img, i) => (
                      <div key={i} style={{ position:'relative', flexShrink:0 }}>
                        <img src={thumbUrl(img)} alt="" onClick={() => { setSelIdx(i); setTab('layout'); }}
                          style={{ width:64, height:80, objectFit:'contain', background:'#fff', borderRadius:10, display:'block', cursor:'pointer', border:`3px solid ${i===selIdx?T.accent:T.border}` }} />
                        <button onClick={() => removeItem(i)}
                          style={{ ...base, position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:T.accent, color:'#fff', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                        <div style={{ textAlign:'center', fontSize:9, color:T.textMuted, marginTop:3 }}>#{i+1}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ Scan QR ══ */}
          {tab === 'scan' && (
            <div>
              {/* Instructions */}
              <div style={{ background:T.scanActiveBg, border:`1px solid ${T.scanActiveBorder}`, borderRadius:12, padding:'10px 14px', marginBottom:14, fontSize:12, color:T.cyan, lineHeight:1.7 }}>
                📌 I-scan yung QR code ng SPX / Shopee / Lazada waybill mo<br />
                🔄 Camera nananatili ON — pwede ka mag-scan ng marami nang sunod-sunod<br />
                ✅ Bawat scan auto-aadd sa print queue
              </div>

              {/* Video */}
              <div style={{ position:'relative', background:'#000', borderRadius:18, overflow:'hidden', aspectRatio:'4/3' }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                {/* Viewfinder */}
                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                  <div style={{ position:'relative', width:200, height:200 }}>
                    <div style={{ position:'absolute', inset:0, boxShadow:'0 0 0 9999px rgba(0,0,0,0.5)' }} />
                    {/* Corner markers */}
                    {[
                      { top:0, left:0, borderTop:`3px solid ${T.cyan}`, borderLeft:`3px solid ${T.cyan}` },
                      { top:0, right:0, borderTop:`3px solid ${T.cyan}`, borderRight:`3px solid ${T.cyan}` },
                      { bottom:0, left:0, borderBottom:`3px solid ${T.cyan}`, borderLeft:`3px solid ${T.cyan}` },
                      { bottom:0, right:0, borderBottom:`3px solid ${T.cyan}`, borderRight:`3px solid ${T.cyan}` },
                    ].map((s, i) => (
                      <div key={i} style={{ position:'absolute', width:24, height:24, ...s }} />
                    ))}
                    {scanning && <div style={{ position:'absolute', inset:0, border:`1px solid ${T.cyan}44`, animation:'none' }} />}
                  </div>
                </div>
                {/* Loading overlay */}
                {loadingUrl && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ color:'#fff', fontSize:14, textAlign:'center', padding:20 }}>
                      <div style={{ fontSize:28, marginBottom:8 }}>⬇️</div>
                      Loading waybill image…
                    </div>
                  </div>
                )}
              </div>

              {/* Status bar */}
              {scanStatus && (
                <div style={{ marginTop:10, padding:'10px 14px', background:T.surface, borderRadius:10, border:`1px solid ${T.border}`, fontSize:12, color:T.textMuted }}>
                  {scanStatus}
                </div>
              )}

              {/* Start/Stop button */}
              <button onClick={() => scanning ? stopScan() : startScan()}
                style={{ ...base, width:'100%', padding:14, borderRadius:12, marginTop:10, fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, background:scanning?T.accent:T.cyan, color:'#fff' }}>
                {scanning ? '⏹ Stop Scanning' : '▶ Start Scanning'}
              </button>

              {/* Queue status */}
              {hasItems && (
                <div style={{ marginTop:12, padding:'10px 14px', background:T.btnPdfBg, border:`1px solid ${T.btnPdfBorder}`, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, color:T.btnPdfColor, fontWeight:600 }}>
                    📦 {queue.length} waybill{queue.length>1?'s':''} ready
                  </span>
                  <button onClick={() => { stopScan(); setTab('layout'); }}
                    style={{ ...base, fontSize:12, fontWeight:700, color:'#fff', background:T.btnPrintBg, padding:'7px 14px', borderRadius:8, fontFamily:"'Syne',sans-serif" }}>
                    Print All →
                  </button>
                </div>
              )}

              {/* Scanned thumbnails */}
              {hasItems && (
                <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginTop:10 }}>
                  {queue.map((img, i) => (
                    <div key={i} style={{ flexShrink:0, textAlign:'center' }}>
                      <img src={thumbUrl(img)} alt=""
                        style={{ width:48, height:60, objectFit:'contain', background:'#fff', borderRadius:8, display:'block', border:`2px solid ${T.border}` }} />
                      <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>#{i+1}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ Layout + Print ══ */}
          {tab === 'layout' && (
            <div>
              {queue.length > 1 && (
                <div style={{ background:T.btnPdfBg, border:`1px solid ${T.btnPdfBorder}`, borderRadius:12, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18 }}>📦</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:T.btnPdfColor }}>{queue.length} waybills in queue</div>
                    <div style={{ fontSize:11, color:T.textMuted }}>PDF & Print includes ALL — each on its own page</div>
                  </div>
                </div>
              )}

              {queue.length > 1 && (
                <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, marginBottom:14 }}>
                  {queue.map((img, i) => (
                    <div key={i} style={{ flexShrink:0 }}>
                      <img src={thumbUrl(img)} alt="" onClick={() => setSelIdx(i)}
                        style={{ width:48, height:60, objectFit:'contain', background:'#fff', borderRadius:8, display:'block', cursor:'pointer', border:`3px solid ${i===selIdx?T.accent:T.border}` }} />
                      <div style={{ textAlign:'center', fontSize:9, color:T.textMuted, marginTop:2 }}>#{i+1}</div>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize:11, fontWeight:600, color:T.textMuted, textTransform:'uppercase', letterSpacing:'1.2px', marginBottom:10 }}>Grid layout</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:20 }}>
                {LAYOUTS.map(l => {
                  const active = layout.id === l.id;
                  return (
                    <div key={l.id} onClick={() => setLayout(l)}
                      style={{ border:`2px solid ${active?T.accent:T.border}`, borderRadius:12, padding:'10px 6px 8px', cursor:'pointer', background:active?T.layoutOptActiveBg:T.layoutOptBg, textAlign:'center', transition:'all 0.2s' }}>
                      <div style={{ display:'grid', gridTemplateColumns:`repeat(${l.cols},1fr)`, gap:3, width:'100%', aspectRatio:'1', marginBottom:6 }}>
                        {Array(l.cols*l.rows).fill(0).map((_,i) => <div key={i} style={{ background:active?T.accent:T.border, borderRadius:2 }} />)}
                      </div>
                      <span style={{ fontSize:11, color:active?T.accent:T.textMuted }}>{l.label}</span>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize:11, fontWeight:600, color:T.textMuted, textTransform:'uppercase', letterSpacing:'1.2px', marginBottom:10 }}>Label width</p>
              <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                {SIZES.map(sz => {
                  const active = sizeMm === sz;
                  return (
                    <button key={sz} onClick={() => setSizeMm(sz)}
                      style={{ ...base, flex:1, padding:'10px 4px', border:`2px solid ${active?T.cyan:T.border}`, borderRadius:10, background:T.surface, color:active?T.cyan:T.textMuted, fontSize:13 }}>
                      {sz}mm
                    </button>
                  );
                })}
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <p style={{ fontSize:11, fontWeight:600, color:T.textMuted, textTransform:'uppercase', letterSpacing:'1.2px', margin:0 }}>Copies per waybill</p>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <button onClick={() => setCopies(c=>Math.max(1,c-1))} style={{ ...base, width:34, height:34, borderRadius:'50%', border:`2px solid ${T.border}`, background:'transparent', color:T.text, fontSize:20, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:T.text, minWidth:30, textAlign:'center' }}>{copies}</span>
                  <button onClick={() => setCopies(c=>Math.min(20,c+1))} style={{ ...base, width:34, height:34, borderRadius:'50%', border:`2px solid ${T.border}`, background:'transparent', color:T.text, fontSize:20, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                </div>
              </div>

              <p style={{ fontSize:11, fontWeight:600, color:T.textMuted, textTransform:'uppercase', letterSpacing:'1.2px', marginBottom:10 }}>
                Preview — #{selIdx+1} of {queue.length}
              </p>
              <div style={{ background:T.canvasBg, borderRadius:18, padding:14, marginBottom:16, minHeight:220, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${T.border}` }}>
                {hasItems
                  ? <canvas ref={canvasRef} style={{ width:'100%', display:'block' }} />
                  : (
                    <>
                      <canvas ref={canvasRef} style={{ display:'none' }} />
                      <div style={{ textAlign:'center', color:T.textFaint, fontSize:14 }}>
                        <span style={{ fontSize:36, display:'block', marginBottom:8 }}>📷</span>
                        Upload or scan a waybill first
                      </div>
                    </>
                  )
                }
              </div>

              <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                <button onClick={() => { setQueue([]); setSelIdx(0); ping('Cleared!'); }}
                  style={{ ...base, flex:1, padding:'13px 10px', border:`2px solid ${T.border}`, borderRadius:12, background:'transparent', color:T.textMuted, fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700 }}>
                  Clear
                </button>
                <button disabled={!hasItems} onClick={doPDF}
                  style={{ ...base, flex:1.3, padding:'13px 10px', border:`2px solid ${T.btnPdfBorder}`, borderRadius:12, background:T.btnPdfBg, color:T.btnPdfColor, fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, opacity:!hasItems?0.4:1, cursor:!hasItems?'default':'pointer' }}>
                  📄 PDF
                </button>
                <button disabled={!hasItems} onClick={doPrint}
                  style={{ ...base, flex:2, padding:'13px 10px', border:'none', borderRadius:12, background:!hasItems?T.border:T.btnPrintBg, color:'#fff', fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:800, opacity:!hasItems?0.4:1, cursor:!hasItems?'default':'pointer', letterSpacing:0.3 }}>
                  🖨️ Print All
                </button>
              </div>

              <p style={{ fontSize:11, color:T.textFaint, textAlign:'center', lineHeight:1.7 }}>
                {hasItems && `${queue.length} waybill${queue.length>1?'s':''} × ${layout.cols*layout.rows} tiles × ${copies} cop${copies>1?'ies':'y'} = ${queue.length*layout.cols*layout.rows*copies} labels`}<br />
                PDF & Print → ALL waybills, each on its own page
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Toast */}
      <div style={{ position:'fixed', bottom:28, left:'50%', transform:`translateX(-50%) translateY(${toastShow?0:80}px)`, background:T.toastBg, color:T.toastTxt, padding:'11px 22px', borderRadius:100, fontSize:13, fontWeight:500, transition:'transform 0.3s ease', whiteSpace:'nowrap', zIndex:9999, pointerEvents:'none', border:`1px solid ${T.border}` }}>
        {toast}
      </div>
    </>
  );
}
