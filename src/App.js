/* global BarcodeDetector */
import { useState, useRef, useEffect } from "react";

// ─── Barcode SVG generator ───────────────────────────────────────────────────
function makeBarcodeSVG(code = "") {
  const enc = {
    "0":"11011","1":"00110","2":"01001","3":"10001","4":"01100",
    "5":"00011","6":"10100","7":"00101","8":"10010","9":"01010",
    J:"10000",T:"00100",A:"00010",
  };
  const bars = [];
  let x = 0;
  for (let i = 0; i < Math.min(code.length, 20); i++) {
    const bits = enc[code[i].toUpperCase()] || "10110";
    for (let b = 0; b < 5; b++) {
      const w = b % 2 === 0 ? 2 : 1;
      if (bits[b] === "1")
        bars.push(
          <rect key={`${i}-${b}`} x={x} y={0} width={w} height={28} fill="#000" />
        );
      x += w;
    }
    x += 1;
  }
  return (
    <svg viewBox={`0 0 ${x + 20} 28`} style={{ width: "85%", height: 30 }} preserveAspectRatio="none">
      {bars}
    </svg>
  );
}

// ─── Mini QR placeholder ─────────────────────────────────────────────────────
function QRPlaceholder({ size = 30 }) {
  const cell = size / 7;
  const pattern = [
    [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],
    [0,1],[6,1],[0,2],[2,2],[3,2],[4,2],[6,2],
    [0,3],[2,3],[4,3],[6,3],[0,4],[2,4],[3,4],[4,4],[6,4],
    [0,5],[6,5],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[3,3],
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="#fff" stroke="#ddd" strokeWidth={0.5} />
      {pattern.map(([col, row], i) => (
        <rect key={i} x={col * cell} y={(6 - row) * cell} width={cell} height={cell} fill="#000" />
      ))}
    </svg>
  );
}

// ─── Label preview component ─────────────────────────────────────────────────
function LabelPreview({ d, version }) {
  const badge = version === "ez-lot" ? "EZ" : "NDD";

  return (
    <div style={styles.label}>
      {/* Header */}
      <div style={styles.lHeader}>
        <div style={styles.lBrand}>
          <span style={{ fontSize: 9, color: "#fff" }}>♪ TikTok Shop</span>
          <span style={{ fontSize: 9, fontStyle: "italic", fontWeight: 700, color: "#fff" }}>J&T</span>
          <span style={{ fontSize: 7, color: "#ccc" }}>EXPRESS</span>
        </div>
        <span style={{ ...styles.lBadge, background: badge === "NDD" ? "#fff" : "#eee" }}>{badge}</span>
      </div>

      {/* On Time */}
      <div style={styles.lOTD}>On Time Delivery Promised</div>

      {/* Barcode */}
      <div style={styles.lBarcode}>{makeBarcodeSVG(d.tracking)}</div>
      <div style={styles.lTrackNum}>{d.tracking}</div>

      {/* Route */}
      <div style={styles.lRoute}>{d.route}</div>

      {/* Body */}
      <div style={styles.lBody}>
        <div style={{ fontSize: 7.5, color: "#555", marginBottom: 3 }}>
          Receiver: <strong style={{ color: "#000" }}>{d.rname}</strong>
          &nbsp;&nbsp;{d.rphone}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: "#000", lineHeight: 1.4 }}>
              {d.raddr}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <div style={styles.lZone}>{d.zone}</div>
            <div style={{ border: "1px solid #ddd", padding: 2, borderRadius: 2 }}>
              <QRPlaceholder size={28} />
            </div>
          </div>
        </div>

        <hr style={styles.lDivider} />
        <div style={{ fontSize: 7.5, color: "#333", marginBottom: 3 }}>
          <strong>Sender:</strong> {d.sname}
        </div>
        <div style={{ fontSize: 7.5, color: "#444", marginBottom: 5 }}>{d.saddr}</div>
        <hr style={styles.lDivider} />

        {/* Sig / Delivery attempts */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {version === "ez-lot" && d.lot ? (
            <span style={styles.lLotBadge}>{d.lot}</span>
          ) : (
            <span style={{ fontSize: 7.5, color: "#555" }}>Signature: ______________</span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 7, color: "#555" }}>Delivery Attempts</span>
            {["1", "2", "3"].map((n) => (
              <div key={n} style={styles.lAtBox}>{n}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.lFooter}>
        <div>Weight: {d.weight}&nbsp;&nbsp;Payment: {d.payment}</div>
        <div>TT Order ID: {d.orderid}</div>
        <div>RTS Time: {d.rts}&nbsp;&nbsp;EDT Time: {d.edt}</div>
      </div>

      {/* Item section */}
      {version === "ndd-item" && (
        <div style={styles.lItemSection}>
          <table style={styles.lTable}>
            <thead>
              <tr>
                {["#","Item","SKU","Qty"].map((h) => (
                  <th key={h} style={styles.lTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.lTd}>1</td>
                <td style={{ ...styles.lTd, maxWidth: 90 }}>{d.item}</td>
                <td style={styles.lTd}>{d.sku}</td>
                <td style={styles.lTd}>{d.qty}</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ ...styles.lTd, textAlign: "right", fontWeight: 600 }}>Total:</td>
                <td style={styles.lTd}>{d.qty}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {version === "ndd-sku" && (
        <>
          <div style={styles.lItemSection}>
            <table style={styles.lTable}>
              <thead>
                <tr>
                  {["#","SKU","Qty"].map((h) => <th key={h} style={styles.lTh}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.lTd}>1</td>
                  <td style={styles.lTd}>{d.wsku}</td>
                  <td style={styles.lTd}>{d.qty}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={styles.lZhSection}>
            <table style={styles.lTable}>
              <thead>
                <tr>
                  {["商品SKU","数量","货架位"].map((h) => <th key={h} style={styles.lTh}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.lTd}>{d.wsku}</td>
                  <td style={styles.lTd}>{d.qty}</td>
                  <td style={styles.lTd}>{d.shelf}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ ...styles.lTd, textAlign: "right" }}>total: {d.qty}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Print helpers ────────────────────────────────────────────────────────────
function getLabelHTML(d, version) {
  const badge = version === "ez-lot" ? "EZ" : "NDD";
  const enc = {
    "0":"11011","1":"00110","2":"01001","3":"10001","4":"01100",
    "5":"00011","6":"10100","7":"00101","8":"10010","9":"01010",
    J:"10000",T:"00100",A:"00010",
  };
  let bars = "";
  let x = 0;
  for (let i = 0; i < Math.min((d.tracking||"").length, 20); i++) {
    const bits = enc[(d.tracking[i]||"").toUpperCase()] || "10110";
    for (let b = 0; b < 5; b++) {
      const w = b % 2 === 0 ? 2 : 1;
      if (bits[b] === "1") bars += `<rect x="${x}" y="0" width="${w}" height="28" fill="#000"/>`;
      x += w;
    }
    x += 1;
  }
  const barcodeSVG = `<svg viewBox="0 0 ${x+20} 28" style="width:85%;height:30px" preserveAspectRatio="none">${bars}</svg>`;

  let itemHTML = "";
  if (version === "ndd-item") {
    itemHTML = `<div class="item-sec"><table class="tbl"><thead><tr><th>#</th><th>Item</th><th>SKU</th><th>Qty</th></tr></thead><tbody>
    <tr><td>1</td><td>${d.item}</td><td>${d.sku}</td><td>${d.qty}</td></tr>
    <tr><td colspan="3" style="text-align:right;font-weight:700">Total:</td><td>${d.qty}</td></tr></tbody></table></div>`;
  } else if (version === "ndd-sku") {
    itemHTML = `<div class="item-sec"><table class="tbl"><thead><tr><th>#</th><th>SKU</th><th>Qty</th></tr></thead><tbody>
    <tr><td>1</td><td>${d.wsku}</td><td>${d.qty}</td></tr></tbody></table></div>
    <div class="item-sec" style="color:#888"><table class="tbl"><thead><tr><th>商品SKU</th><th>数量</th><th>货架位</th></tr></thead><tbody>
    <tr><td>${d.wsku}</td><td>${d.qty}</td><td>${d.shelf}</td></tr>
    <tr><td colspan="3" style="text-align:right">total: ${d.qty}</td></tr></tbody></table></div>`;
  }

  return `<div class="label">
    <div class="hdr"><div class="brand"><span>♪ TikTok Shop</span><span class="jt">J&T</span><span style="font-size:7px;color:#ccc">EXPRESS</span></div>
    <span class="badge">${badge}</span></div>
    <div class="otd">On Time Delivery Promised</div>
    <div class="bc">${barcodeSVG}</div>
    <div class="tracknum">${d.tracking}</div>
    <div class="route">${d.route}</div>
    <div class="body">
      <div class="recv">Receiver: <strong>${d.rname}</strong>&nbsp;&nbsp;${d.rphone}</div>
      <div class="row">
        <div class="raddr">${d.raddr}</div>
        <div class="zone-wrap"><div class="zone">${d.zone}</div></div>
      </div>
      <hr class="div">
      <div class="sender"><strong>Sender:</strong> ${d.sname}</div>
      <div class="saddr">${d.saddr}</div>
      <hr class="div">
      <div class="sigrow">
        ${version === "ez-lot" && d.lot ? `<span class="lot">${d.lot}</span>` : `<span class="sig">Signature: ______________</span>`}
        <div class="attempts"><span style="font-size:7px;color:#555">Delivery Attempts</span>
        <div class="atbox">1</div><div class="atbox">2</div><div class="atbox">3</div></div>
      </div>
    </div>
    <div class="footer">
      <div>Weight: ${d.weight}&nbsp;&nbsp;Payment: ${d.payment}</div>
      <div>TT Order ID: ${d.orderid}</div>
      <div>RTS Time: ${d.rts}&nbsp;&nbsp;EDT Time: ${d.edt}</div>
    </div>
    ${itemHTML}
  </div>`;
}

const PRINT_CSS = `
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
@page{size:105mm 148mm;margin:0}
body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.label{width:105mm;min-height:148mm;border:1px solid #000;page-break-after:always;overflow:hidden}
.hdr{background:#000;padding:8px 10px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:5px;color:#fff;font-size:9px;font-weight:500}
.jt{font-style:italic;font-weight:700;font-size:9px;color:#fff}
.badge{background:#fff;color:#000;font-size:10px;font-weight:700;padding:2px 7px;border-radius:2px}
.otd{font-size:8px;color:#555;text-align:center;padding:4px 0 2px;border-bottom:1px solid #eee}
.bc{text-align:center;padding:6px 8px 2px}
.tracknum{font-size:9px;text-align:center;color:#333;padding-bottom:4px}
.route{font-size:20px;font-weight:700;text-align:center;padding:4px 0 6px;border-bottom:1px solid #eee}
.body{padding:8px 10px}
.recv{font-size:7.5px;color:#555;margin-bottom:3px}
.row{display:flex;gap:6px;margin-bottom:5px}
.raddr{flex:1;font-size:8px;font-weight:700;color:#000;line-height:1.4}
.zone-wrap{display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0}
.zone{background:#000;color:#fff;font-size:18px;font-weight:700;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:3px}
.div{border:none;border-top:1px solid #eee;margin:5px 0}
.sender{font-size:7.5px;color:#333;margin-bottom:2px}
.saddr{font-size:7.5px;color:#444;margin-bottom:4px}
.sigrow{display:flex;justify-content:space-between;align-items:center}
.sig{font-size:7.5px;color:#555}
.lot{background:#f0f0f0;border:1px solid #ccc;font-size:9px;font-weight:700;padding:1px 6px}
.attempts{display:flex;align-items:center;gap:4px}
.atbox{width:18px;height:18px;border:1px solid #999;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700}
.footer{background:#f9f9f9;padding:6px 10px;border-top:1px solid #eee;font-size:7.5px;color:#555;display:flex;flex-direction:column;gap:2px}
.item-sec{padding:5px 10px;border-top:1px solid #eee}
.tbl{width:100%;border-collapse:collapse;font-size:7.5px}
.tbl th{background:#f0f0f0;padding:2px 4px;text-align:left;font-weight:600;border:0.5px solid #ddd;font-size:7px}
.tbl td{padding:2px 4px;border:0.5px solid #ddd}
`;

// ─── Sample data ──────────────────────────────────────────────────────────────
const SAMPLE = {
  tracking:"JT0013133019084", route:"203-E082 00", zone:"101", badge:"NDD", lot:"",
  rname:"Grace Nuqui", rphone:"(+63)09*****24",
  raddr:"NCR, METRO-MANILA, MALABON-CITY, CATMON, 131 Sanciangco St, Malabon",
  sname:"E&Hcomfort.ph",
  saddr:"NCR, METRO-MANILA, VALENZUELA-CITY, MAYSAN, Unit 2, ARCA-Expo 1 Warehouses 84 E Cabral Street",
  weight:"2.000 KG", payment:"PP_PM", orderid:"582441316321822176",
  rts:"2026-01-28", edt:"",
  item:"Double Size Polyester Blanket - High Quality, Soft and Comfortable",
  sku:"TR-08-double-130X200CM-Dark Gray", qty:"1",
  wsku:"TR-08-double", shelf:"XX100-01-01",
};

const EMPTY = {
  tracking:"", route:"203-E082 00", zone:"101", badge:"NDD", lot:"",
  rname:"", rphone:"", raddr:"", sname:"", saddr:"",
  weight:"0.200 KG", payment:"PP_PM", orderid:"",
  rts:"", edt:"", item:"", sku:"", qty:"1", wsku:"", shelf:"",
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("scan");
  const [version, setVersion] = useState("ndd-item");
  const [form, setForm] = useState({ ...EMPTY });
  const [copies, setCopies] = useState(1);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [apiResult, setApiResult] = useState(null);
  const [toast, setToast] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const hiddenCanvas = useRef(document.createElement("canvas"));

  useEffect(() => () => stopCamera(), []);

  function ping(msg) {
    setToast(msg); setToastShow(true);
    setTimeout(() => setToastShow(false), 2800);
  }

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // ── Camera ────────────────────────────────────────────────────────────────
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    ping("Camera hindi supported. Mag-upload nalang.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        // HUWAG i-specify ang width — mas mabilis mag-open
      },
      audio: false,
    });

    streamRef.current = stream;
    setCameraOn(true); // i-set MUNA bago i-assign srcObject

    // Wait for next render para ma-mount ang video element
    await new Promise(r => setTimeout(r, 100));

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", ""); // iOS fix
      videoRef.current.setAttribute("muted", "");
      try {
        await videoRef.current.play();
      } catch (playErr) {
        // Autoplay blocked — user interaction needed
        // Just show the video, user can tap to play
        console.warn("Autoplay blocked:", playErr);
      }
    }
  } catch (err) {
    setCameraOn(false);
    if (err.name === "NotAllowedError") {
      ping("I-allow ang camera sa browser settings.");
    } else if (err.name === "NotFoundError") {
      ping("Walang camera na nakita sa device.");
    } else if (err.name === "NotReadableError") {
      ping("Camera in-use na ng ibang app. I-close muna.");
    } else if (err.name === "OverconstrainedError") {
      // Retry without facingMode constraint
      retryWithAnyCamera();
    } else {
      ping("Camera error: " + err.name);
    }
  }
}

// Fallback — walang facingMode constraint
async function retryWithAnyCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    streamRef.current = stream;
    setCameraOn(true);
    await new Promise(r => setTimeout(r, 100));
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
  } catch (err) {
    setCameraOn(false);
    ping("Hindi ma-access ang camera: " + err.message);
  }
}

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

 function captureAndRead() {
  const vid = videoRef.current;
  if (!vid || vid.readyState < 2) {
    ping("Camera hindi pa ready. Sandali lang.");
    return;
  }
  const c = hiddenCanvas.current;
  c.width = vid.videoWidth || 640;
  c.height = vid.videoHeight || 480;
  c.getContext("2d").drawImage(vid, 0, 0);
  readLabel(c);
  stopCamera();
}

  function handleScanFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = hiddenCanvas.current;
      c.width = img.width; c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      readLabel(c);
    };
    img.src = URL.createObjectURL(file);
  }

  async function readLabel(canvas) {
    setLoading(true);
    ping("Reading label...");
    let detected = {};

    // Try BarcodeDetector first
    try {
      if (typeof BarcodeDetector !== "undefined") {
        const bd = new BarcodeDetector({ formats: ["code_128", "qr_code"] });
        const bm = await createImageBitmap(canvas);
        const codes = await bd.detect(bm);
        if (codes.length > 0) detected.tracking = codes[0].rawValue;
      }
    } catch {}

    // OCR via Claude API
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] } },
              { type: "text", text: 'This is a TikTok Shop J&T Express shipping label. Extract ALL visible text and return ONLY a valid JSON object with these exact keys (empty string if not found): tracking, route, zone, badge (NDD or EZ), lot, rname, rphone, raddr, sname, saddr, weight, payment, orderid, rts, edt, item, sku, qty, wsku, shelf. Return only raw JSON, no markdown.' }
            ]
          }]
        }),
      });
      const data = await res.json();
      const text = data.content?.filter((c) => c.type === "text").map((c) => c.text).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) detected = { ...detected, ...JSON.parse(match[0]) };
    } catch {}

    setLoading(false);
    if (!Object.keys(detected).length) {
      ping("Hindi ma-read. Try ulit o manual input."); return;
    }
    setScanResult(detected);
    ping("Label info extracted!");
  }

  function loadScanToForm() {
    setForm({ ...EMPTY, ...scanResult });
    setTab("manual");
    ping("Loaded to form!");
  }

  // ── TikTok API ────────────────────────────────────────────────────────────
  const [apiFields, setApiFields] = useState({ appid:"", secret:"", token:"", orderid:"" });

  async function fetchFromAPI() {
    const { appid, token, orderid } = apiFields;
    if (!appid || !token || !orderid) { ping("Fill in App ID, Token, at Order ID"); return; }
    setLoading(true);
    ping("Fetching from TikTok API...");
    try {
      const res = await fetch(
        `https://open-api.tiktokglobalshop.com/order/202309/orders?ids=${orderid}`,
        { headers: { "x-tts-access-token": token, "x-tts-app-id": appid } }
      );
      const data = await res.json();
      if (data.code !== 0) throw new Error(data.message || "API error");
      const order = data.data?.orders?.[0];
      if (!order) throw new Error("Order not found");
      const addr = order.recipient_address || {};
      const mapped = {
        tracking: order.tracking_number || orderid,
        route: "203-E082 00", zone: "101", badge: "NDD", lot: "",
        rname: addr.name || "", rphone: addr.phone_number || "",
        raddr: [addr.full_address, addr.district_name, addr.city, addr.province].filter(Boolean).join(", "),
        sname: order.shop_name || "", saddr: "",
        weight: order.package_dimension?.weight ? `${order.package_dimension.weight} KG` : "0.000 KG",
        payment: order.payment_method_name || "PP_PM",
        orderid: order.order_id || orderid,
        rts: "", edt: order.expected_delivery_time || "",
        item: order.line_items?.[0]?.product_name || "",
        sku: order.line_items?.[0]?.sku_name || "",
        qty: String(order.line_items?.[0]?.quantity || 1),
        wsku: order.line_items?.[0]?.seller_sku || "",
        shelf: "",
      };
      setApiResult(mapped);
      ping("Order loaded!");
    } catch (e) {
      ping("API Error: " + e.message);
    }
    setLoading(false);
  }

  function applyAPI() {
    setForm({ ...EMPTY, ...apiResult });
    setTab("manual");
    ping("Data applied!");
  }

  // ── Print / PDF ───────────────────────────────────────────────────────────
  function doPrint() {
    const html = getLabelHTML(form, version);
    const pages = Array(copies).fill(`<div>${html}</div>`).join("");
    const win = window.open("", "_blank");
    if (!win) { ping("Allow popups para mag-print"); return; }
    win.document.write(
      `<!DOCTYPE html><html><head><title>TikTok Label</title><style>${PRINT_CSS}</style></head>` +
      `<body>${pages}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script></body></html>`
    );
    win.document.close();
    ping(`Printing ${copies} label${copies > 1 ? "s" : ""}!`);
  }

  async function doPDF() {
    ping("Building PDF...");
    setLoading(true);
    try {
      if (!window.jspdf) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
      const html = getLabelHTML(form, version);
      const div = document.createElement("div");
      div.style.cssText = "position:fixed;left:-9999px;top:0;width:105mm;background:#fff;font-family:Arial,sans-serif";
      div.innerHTML = html;
      document.body.appendChild(div);
      for (let i = 0; i < copies; i++) {
        if (i > 0) doc.addPage("a6", "portrait");
        await doc.html(div, { x: 0, y: 0, width: 105, windowWidth: 396, autoPaging: false });
      }
      document.body.removeChild(div);
      doc.save("tiktok-label.pdf");
      ping("tiktok-label.pdf saved!");
    } catch (e) { ping("PDF error: " + e.message); }
    setLoading(false);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>TikTok Label Printer</div>
        <div style={styles.subtitle}>Scan barcode · Fill form · Print template</div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[["scan","📷 Scan"],["manual","✏️ Manual"],["api","🔗 API"],["print","🖨️ Print"]].map(([id, label]) => (
          <button key={id} style={{ ...styles.tab, ...(tab === id ? styles.tabActive : {}) }}
            onClick={() => { setTab(id); if (id !== "scan") stopCamera(); }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SCAN TAB ── */}
      {tab === "scan" && (
        <div>
          <label style={styles.uploadBox}>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleScanFile} />
            <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Upload label photo</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Auto-read ng barcode + OCR</div>
          </label>

          <div style={styles.orDivider}>— or —</div>

          <button style={{ ...styles.btn, ...styles.btnPrimary, width: "100%" }}
            onClick={() => cameraOn ? stopCamera() : startCamera()}>
            {cameraOn ? "⏹ Stop Camera" : "📸 Open Camera"}
          </button>

          {cameraOn && (
            <div style={{ marginTop: 12 }}>
              <div style={styles.viewfinder}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={styles.vfOverlay}>
                  <div style={styles.vfFrame} />
                  <div style={{ ...styles.corner, top: "8%", left: "8%", borderTop: "3px solid #fff", borderLeft: "3px solid #fff" }} />
                  <div style={{ ...styles.corner, top: "8%", right: "8%", borderTop: "3px solid #fff", borderRight: "3px solid #fff" }} />
                  <div style={{ ...styles.corner, bottom: "8%", left: "8%", borderBottom: "3px solid #fff", borderLeft: "3px solid #fff" }} />
                  <div style={{ ...styles.corner, bottom: "8%", right: "8%", borderBottom: "3px solid #fff", borderRight: "3px solid #fff" }} />
                  <div style={styles.vfTip}>I-align ang buong label sa frame</div>
                </div>
              </div>
              <button style={{ ...styles.btn, ...styles.btnRed, width: "100%", marginTop: 8 }} onClick={captureAndRead}>
                📸 Capture & Read Label
              </button>
            </div>
          )}

          {scanResult && (
            <div style={{ marginTop: 14 }}>
              <div style={styles.sectionTitle}>Na-detect na info</div>
              <div style={styles.card}>
                {Object.entries(scanResult).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={styles.resultRow}>
                    <span style={styles.resultKey}>{k}</span>
                    <span style={styles.resultVal}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={styles.btnRow}>
                <button style={styles.btn} onClick={() => setScanResult(null)}>Clear</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={loadScanToForm}>Use this info →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL TAB ── */}
      {tab === "manual" && (
        <div>
          <div style={styles.sectionTitle}>Version</div>
          <div style={styles.verTabs}>
            {[["ndd-item","NDD + Item list"],["ndd-sku","NDD + SKU/Warehouse"],["ez-lot","EZ + LOT"]].map(([v, label]) => (
              <button key={v} style={{ ...styles.verTab, ...(version === v ? styles.verTabActive : {}) }}
                onClick={() => setVersion(v)}>{label}</button>
            ))}
          </div>

          {[
            { label: "Tracking number", key: "tracking" },
          ].map(({ label, key }) => <Field key={key} label={label} value={form[key]} onChange={(v) => set(key, v)} />)}

          <div style={styles.formGrid}>
            <Field label="Route code" value={form.route} onChange={(v) => set("route", v)} />
            <Field label="Zone" value={form.zone} onChange={(v) => set("zone", v)} />
          </div>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.formLabel}>Badge</label>
              <select style={styles.input} value={form.badge} onChange={(e) => set("badge", e.target.value)}>
                <option value="NDD">NDD</option>
                <option value="EZ">EZ</option>
              </select>
            </div>
            <Field label="LOT # (EZ only)" value={form.lot} onChange={(v) => set("lot", v)} placeholder="e.g. LOT 1" />
          </div>

          <div style={styles.sectionTitle}>Receiver</div>
          <div style={styles.formGrid}>
            <Field label="Name" value={form.rname} onChange={(v) => set("rname", v)} placeholder="Juan Dela Cruz" />
            <Field label="Phone" value={form.rphone} onChange={(v) => set("rphone", v)} placeholder="+63 9XX..." />
          </div>
          <Field label="Full address" value={form.raddr} onChange={(v) => set("raddr", v)}
            placeholder="NCR, METRO-MANILA, MALABON-CITY..." multiline />

          <div style={styles.sectionTitle}>Sender</div>
          <Field label="Store name" value={form.sname} onChange={(v) => set("sname", v)} placeholder="My TikTok Shop" />
          <Field label="Sender address" value={form.saddr} onChange={(v) => set("saddr", v)}
            placeholder="SEL, RIZAL..." multiline />

          <div style={styles.sectionTitle}>Order details</div>
          <div style={styles.formGrid}>
            <Field label="Weight (KG)" value={form.weight} onChange={(v) => set("weight", v)} />
            <Field label="Payment" value={form.payment} onChange={(v) => set("payment", v)} />
          </div>
          <Field label="TT Order ID" value={form.orderid} onChange={(v) => set("orderid", v)} placeholder="58243..." />
          <div style={styles.formGrid}>
            <Field label="RTS Time" value={form.rts} onChange={(v) => set("rts", v)} placeholder="2026-02-04" />
            <Field label="EDT Time" value={form.edt} onChange={(v) => set("edt", v)} placeholder="05-02-2026" />
          </div>

          {version !== "ndd-sku" && (
            <>
              <div style={styles.sectionTitle}>Item</div>
              <Field label="Item name" value={form.item} onChange={(v) => set("item", v)} placeholder="Blanket..." />
              <div style={styles.formGrid}>
                <Field label="SKU" value={form.sku} onChange={(v) => set("sku", v)} placeholder="TR-08..." />
                <Field label="Qty" value={form.qty} onChange={(v) => set("qty", v)} />
              </div>
            </>
          )}

          {version === "ndd-sku" && (
            <>
              <div style={styles.sectionTitle}>Warehouse</div>
              <div style={styles.formGrid}>
                <Field label="SKU" value={form.wsku} onChange={(v) => set("wsku", v)} placeholder="SJPJ0049-4" />
                <Field label="Shelf (货架位)" value={form.shelf} onChange={(v) => set("shelf", v)} placeholder="XX100-01-01" />
              </div>
            </>
          )}

          <div style={styles.btnRow}>
            <button style={styles.btn} onClick={() => setForm({ ...EMPTY })}>Clear</button>
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setTab("print")}>Preview & Print →</button>
          </div>
        </div>
      )}

      {/* ── API TAB ── */}
      {tab === "api" && (
        <div>
          <div style={styles.apiInfo}>
            <strong>TikTok Shop Open API</strong><br />
            I-connect ang seller account para ma-auto-load ang order details.
          </div>
          {[
            { label: "App ID", key: "appid" },
            { label: "App Secret", key: "secret", type: "password" },
            { label: "Access Token", key: "token" },
            { label: "Order ID", key: "orderid" },
          ].map(({ label, key, type }) => (
            <div key={key} style={styles.formRow}>
              <label style={styles.formLabel}>{label}</label>
              <input style={styles.input} type={type || "text"} value={apiFields[key]}
                onChange={(e) => setApiFields((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <button style={{ ...styles.btn, ...styles.btnPrimary, width: "100%", marginBottom: 8 }}
            onClick={fetchFromAPI} disabled={loading}>
            {loading ? "Loading..." : "🔗 Fetch Order Details"}
          </button>
          <button style={{ ...styles.btn, width: "100%", fontSize: 12 }}
            onClick={() => { setApiResult({ ...SAMPLE }); ping("Sample data loaded!"); }}>
            Load sample data (demo mode)
          </button>

          {apiResult && (
            <div style={{ marginTop: 14 }}>
              <div style={styles.sectionTitle}>Order data</div>
              <div style={styles.card}>
                {Object.entries(apiResult).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={styles.resultRow}>
                    <span style={styles.resultKey}>{k}</span>
                    <span style={styles.resultVal}>{v}</span>
                  </div>
                ))}
              </div>
              <button style={{ ...styles.btn, ...styles.btnPrimary, width: "100%", marginTop: 8 }}
                onClick={applyAPI}>Use this data →</button>
            </div>
          )}

          <div style={{ ...styles.apiInfo, marginTop: 16 }}>
            <strong>Paano kumuha ng credentials:</strong><br />
            1. Pumunta sa TikTok Shop Partner Center<br />
            2. Mag-create ng app sa developer portal<br />
            3. I-copy ang App ID at Secret<br />
            4. I-authorize para makuha ang Access Token
          </div>
        </div>
      )}

      {/* ── PRINT TAB ── */}
      {tab === "print" && (
        <div>
          <div style={styles.sectionTitle}>Version</div>
          <div style={styles.verTabs}>
            {[["ndd-item","NDD + Item list"],["ndd-sku","NDD + SKU/Warehouse"],["ez-lot","EZ + LOT"]].map(([v, label]) => (
              <button key={v} style={{ ...styles.verTab, ...(version === v ? styles.verTabActive : {}) }}
                onClick={() => setVersion(v)}>{label}</button>
            ))}
          </div>

          <div style={styles.sectionTitle}>Preview</div>
          <LabelPreview d={form} version={version} />

          <div style={styles.sectionTitle}>Copies</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <button style={styles.qtyBtn} onClick={() => setCopies((c) => Math.max(1, c - 1))}>−</button>
            <span style={{ fontSize: 24, fontWeight: 500, minWidth: 30, textAlign: "center" }}>{copies}</span>
            <button style={styles.qtyBtn} onClick={() => setCopies((c) => Math.min(20, c + 1))}>+</button>
            <span style={{ fontSize: 13, color: "#888" }}>copies</span>
          </div>

          <div style={styles.btnRow}>
            <button style={styles.btn} onClick={doPDF} disabled={loading}>📄 PDF</button>
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={doPrint}>🖨️ Print</button>
          </div>
          <div style={{ fontSize: 11, color: "#888", textAlign: "center", marginTop: 8 }}>
            Print size: A6 (105×148mm) · Template lang, walang photo
          </div>
        </div>
      )}
<video
  ref={videoRef}
  autoPlay
  muted
  playsInline
  webkit-playsinline="true"
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block"
  }}
/>
      {/* Toast */}
      <div style={{ ...styles.toast, transform: `translateX(-50%) translateY(${toastShow ? 0 : 80}px)` }}>
        {toast}
      </div>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder = "", multiline = false, type = "text" }) {
  return (
    <div style={styles.formRow}>
      <label style={styles.formLabel}>{label}</label>
      {multiline ? (
        <textarea style={{ ...styles.input, resize: "vertical" }} rows={2} value={value}
          placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input style={styles.input} type={type} value={value}
          placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  app:{ maxWidth:480, margin:"0 auto", padding:"16px 12px 60px", fontFamily:"system-ui,sans-serif" },
  header:{ marginBottom:20 },
  title:{ fontSize:22, fontWeight:600, color:"#0f0f0f" },
  subtitle:{ fontSize:13, color:"#888", marginTop:3 },
  tabs:{ display:"flex", gap:6, background:"#f5f5f5", padding:5, borderRadius:12, marginBottom:18 },
  tab:{ flex:1, padding:"9px 6px", border:"none", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", background:"transparent", color:"#888" },
  tabActive:{ background:"#fff", color:"#0f0f0f", border:"0.5px solid #e0e0e0" },
  sectionTitle:{ fontSize:11, fontWeight:600, color:"#999", textTransform:"uppercase", letterSpacing:"1px", margin:"14px 0 8px" },
  card:{ background:"#fff", border:"0.5px solid #e5e5e5", borderRadius:10, padding:"10px 14px", marginBottom:8 },
  formRow:{ marginBottom:10 },
  formGrid:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:0 },
  formLabel:{ fontSize:12, color:"#888", marginBottom:4, display:"block" },
  input:{ width:"100%", padding:"8px 10px", border:"0.5px solid #ddd", borderRadius:8, background:"#fff", color:"#0f0f0f", fontSize:13, fontFamily:"inherit", outline:"none" },
  btn:{ padding:"10px 16px", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer", border:"0.5px solid #ddd", background:"#fff", color:"#0f0f0f", fontFamily:"inherit", flex:1 },
  btnPrimary:{ background:"#0f0f0f", color:"#fff", borderColor:"#0f0f0f" },
  btnRed:{ background:"#fe2c55", color:"#fff", borderColor:"#fe2c55" },
  btnRow:{ display:"flex", gap:8, marginTop:12 },
  uploadBox:{ display:"block", border:"2px dashed #ddd", borderRadius:12, padding:"32px 16px", textAlign:"center", cursor:"pointer", background:"#fafafa" },
  orDivider:{ textAlign:"center", fontSize:12, color:"#ccc", margin:"12px 0" },
  viewfinder:{ position:"relative", background:"#000", borderRadius:12, overflow:"hidden", aspectRatio:"3/4" },
  vfOverlay:{ position:"absolute", inset:0, pointerEvents:"none" },
  vfFrame:{ position:"absolute", top:"8%", left:"8%", right:"8%", bottom:"8%", border:"2px solid rgba(255,255,255,.35)", borderRadius:6 },
  corner:{ position:"absolute", width:22, height:22 },
  vfTip:{ position:"absolute", bottom:12, left:0, right:0, textAlign:"center", color:"rgba(255,255,255,.7)", fontSize:11 },
  verTabs:{ display:"flex", gap:4, marginBottom:10, flexWrap:"wrap" },
  verTab:{ padding:"5px 10px", fontSize:11, border:"0.5px solid #ddd", borderRadius:8, cursor:"pointer", background:"#fff", color:"#888", fontFamily:"inherit" },
  verTabActive:{ background:"#0f0f0f", color:"#fff", borderColor:"#0f0f0f" },
  apiInfo:{ background:"#f9f9f9", border:"0.5px solid #eee", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#666", lineHeight:1.7, marginBottom:10 },
  qtyBtn:{ width:32, height:32, borderRadius:"50%", border:"0.5px solid #ddd", background:"#fff", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" },
  resultRow:{ display:"flex", gap:8, padding:"4px 0", borderBottom:"0.5px solid #f0f0f0" },
  resultKey:{ fontSize:11, color:"#999", minWidth:70 },
  resultVal:{ fontSize:12, color:"#0f0f0f", flex:1 },
  toast:{ position:"fixed", bottom:24, left:"50%", background:"#0f0f0f", color:"#fff", padding:"10px 20px", borderRadius:100, fontSize:13, transition:"transform 0.3s", whiteSpace:"nowrap", zIndex:9999, pointerEvents:"none" },
  // Label preview styles
  label:{ width:"100%", border:"1px solid #000", background:"#fff", overflow:"hidden", fontFamily:"Arial,sans-serif" },
  lHeader:{ background:"#000", padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  lBrand:{ display:"flex", alignItems:"center", gap:5, color:"#fff" },
  lBadge:{ color:"#000", fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:2 },
  lOTD:{ fontSize:8, color:"#555", textAlign:"center", padding:"4px 0 2px", borderBottom:"1px solid #eee" },
  lBarcode:{ textAlign:"center", padding:"6px 8px 2px" },
  lTrackNum:{ fontSize:9, textAlign:"center", color:"#333", paddingBottom:4 },
  lRoute:{ fontSize:20, fontWeight:700, textAlign:"center", padding:"4px 0 6px", color:"#000", borderBottom:"1px solid #eee" },
  lBody:{ padding:"8px 10px" },
  lZone:{ background:"#000", color:"#fff", fontSize:18, fontWeight:700, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:3, flexShrink:0 },
  lDivider:{ border:"none", borderTop:"1px solid #eee", margin:"5px 0" },
  lLotBadge:{ background:"#f0f0f0", border:"1px solid #ccc", fontSize:9, fontWeight:700, padding:"1px 6px" },
  lAtBox:{ width:18, height:18, border:"1px solid #999", borderRadius:2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"#000" },
  lFooter:{ background:"#f9f9f9", padding:"6px 10px", borderTop:"1px solid #eee", fontSize:7.5, color:"#555", display:"flex", flexDirection:"column", gap:2 },
  lItemSection:{ padding:"5px 10px", borderTop:"1px solid #eee" },
  lZhSection:{ padding:"5px 10px", borderTop:"1px solid #eee", color:"#888" },
  lTable:{ width:"100%", borderCollapse:"collapse", fontSize:7.5 },
  lTh:{ background:"#f0f0f0", padding:"2px 4px", textAlign:"left", fontWeight:600, border:"0.5px solid #ddd", fontSize:7 },
  lTd:{ padding:"2px 4px", border:"0.5px solid #ddd" },
};
