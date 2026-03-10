// PhishGuard AI — Content Script
// Injects a professional, Shadow-DOM-isolated floating security shield on every webpage.
// The shield shows real-time ML phishing-detection results from the local Flask backend.

(function initPhishGuard() {
  "use strict";

  // ── One-time injection guard ──────────────────────────────────────────
  if (document.getElementById("__phishguard_host__")) return;

  // ── Helper utilities ───────────────────────────────────────────────────
  function confToPercent(c) {
    if (c == null) return null;
    const n = Number(c);
    if (!isFinite(n)) return null;
    return Math.max(0, Math.min(100, n <= 1 ? n * 100 : n));
  }

  function fmtUrl(url, maxLen) {
    try {
      const u = new URL(url);
      const s = u.hostname + u.pathname.replace(/\/$/, "");
      return s.length > maxLen ? s.slice(0, maxLen) + "\u2026" : s;
    } catch (_) {
      return url.length > maxLen ? url.slice(0, maxLen) + "\u2026" : url;
    }
  }

  // ── CSS (entirely inside Shadow DOM — zero style leakage) ──────────────
  const CSS = `
    *, *::before, *::after { box-sizing: border-box; }

    /* ── Wrapper (fixed to viewport bottom-right) ───────────────── */
    #pg-root {
      all: initial;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }

    /* ── Report panel ────────────────────────────────────────────── */
    #pg-panel {
      width: 278px;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 28px 70px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.07);
      opacity: 0;
      transform: translateY(14px) scale(0.95);
      pointer-events: none;
      transition: opacity 230ms cubic-bezier(.4,0,.2,1),
                  transform 230ms cubic-bezier(.4,0,.2,1);
    }
    #pg-panel.pg-show {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* panel header */
    .pg-ph {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 11px 14px;
      background: #0f172a;
    }
    .pg-ph-brand {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .pg-ph-ico  { font-size: 17px; }
    .pg-ph-name {
      font-size: 12.5px;
      font-weight: 700;
      color: #f1f5f9;
      letter-spacing: 0.2px;
    }
    .pg-close {
      background: none;
      border: none;
      color: #64748b;
      font-size: 15px;
      line-height: 1;
      cursor: pointer;
      padding: 0 2px;
      transition: color 140ms;
    }
    .pg-close:hover { color: #f1f5f9; }

    /* panel body */
    .pg-pb { padding: 14px 14px 12px; background: #1e293b; }

    .pg-verdict {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .pg-v-ico {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 21px;
      flex-shrink: 0;
    }
    .pg-v-ico.s  { background: rgba(34,197,94,0.15); }
    .pg-v-ico.p  { background: rgba(239,68,68,0.15); }
    .pg-v-ico.o  { background: rgba(249,115,22,0.15); }

    .pg-v-head   { font-size: 15px; font-weight: 700; line-height: 1.25; }
    .pg-v-head.s { color: #4ade80; }
    .pg-v-head.p { color: #f87171; }
    .pg-v-head.o { color: #fb923c; }
    .pg-v-sub    { font-size: 11.5px; color: #94a3b8; margin-top: 2px; }

    .pg-lbl {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #64748b;
      margin-bottom: 5px;
    }
    .pg-track { height: 5px; background: #334155; border-radius: 99px; overflow: hidden; }
    .pg-fill  { height: 100%; border-radius: 99px; transition: width 700ms cubic-bezier(.4,0,.2,1); }
    .pg-fill.s { background: linear-gradient(90deg,#15803d,#4ade80); }
    .pg-fill.p { background: linear-gradient(90deg,#991b1b,#f87171); }
    .pg-fill.o { background: linear-gradient(90deg,#9a3412,#fb923c); }

    .pg-url {
      margin-top: 9px;
      font-size: 10.5px;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Shield button ───────────────────────────────────────────── */
    #pg-btn {
      width: 62px;
      height: 62px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      position: relative;
      overflow: visible;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    #pg-btn:hover  { transform: scale(1.09); }
    #pg-btn:active { transform: scale(0.95); }

    #pg-btn.scanning {
      background: linear-gradient(135deg,#1e293b,#334155);
      box-shadow: 0 8px 30px rgba(0,0,0,0.45);
    }
    #pg-btn.safe {
      background: linear-gradient(135deg,#14532d,#22c55e);
      box-shadow: 0 8px 30px rgba(34,197,94,0.38);
    }
    #pg-btn.phishing {
      background: linear-gradient(135deg,#7f1d1d,#ef4444);
      box-shadow: 0 8px 30px rgba(239,68,68,0.42);
      animation: pg-threat-pulse 2.2s ease-in-out infinite;
    }
    #pg-btn.offline {
      background: linear-gradient(135deg,#7c2d12,#f97316);
      box-shadow: 0 8px 30px rgba(249,115,22,0.38);
    }

    @keyframes pg-threat-pulse {
      0%,100% { box-shadow: 0 8px 30px rgba(239,68,68,0.42); }
      50%      { box-shadow: 0 8px 30px rgba(239,68,68,0.42), 0 0 0 12px rgba(239,68,68,0.14); }
    }

    .pg-ring {
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: rgba(255,255,255,0.78);
      border-right-color: rgba(255,255,255,0.22);
      animation: pg-spin 850ms linear infinite;
      pointer-events: none;
    }
    @keyframes pg-spin { to { transform: rotate(360deg); } }

    .pg-b-ico { font-size: 23px; line-height: 1; }
    .pg-b-lbl {
      font-size: 8px;
      font-weight: 700;
      color: rgba(255,255,255,0.88);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
  `;

  // ── Build shadow host ──────────────────────────────────────────────────
  const host = document.createElement("div");
  host.id = "__phishguard_host__";
  host.style.cssText =
    "all:initial;position:fixed;bottom:0;right:0;z-index:2147483647;" +
    "width:0;height:0;overflow:visible;pointer-events:none;";

  const shadow = host.attachShadow({ mode: "open" });

  // ── HTML skeleton ──────────────────────────────────────────────────────
  shadow.innerHTML = `
    <style>${CSS}</style>
    <div id="pg-root">

      <!-- Report panel (hidden by default) -->
      <div id="pg-panel" role="dialog" aria-label="PhishGuard security report">
        <div class="pg-ph">
          <div class="pg-ph-brand">
            <span class="pg-ph-ico">&#128737;</span>
            <span class="pg-ph-name">PhishGuard AI</span>
          </div>
          <button class="pg-close" id="pg-close-btn" aria-label="Close">&#10005;</button>
        </div>
        <div class="pg-pb">
          <div class="pg-verdict">
            <div class="pg-v-ico s" id="pg-vw">
              <span id="pg-vi">&#128737;</span>
            </div>
            <div>
              <div class="pg-v-head s" id="pg-vt">Safe Website</div>
              <div class="pg-v-sub"   id="pg-vs">ML model prediction</div>
            </div>
          </div>
          <div class="pg-lbl">Confidence</div>
          <div class="pg-track">
            <div class="pg-fill s" id="pg-cf" style="width:0%"></div>
          </div>
          <div class="pg-url" id="pg-url"></div>
        </div>
      </div>

      <!-- Floating shield button -->
      <button id="pg-btn" class="scanning" aria-label="PhishGuard AI security shield" style="pointer-events:auto;">
        <div class="pg-ring"></div>
        <span class="pg-b-ico" id="pg-bi">&#9711;</span>
        <span class="pg-b-lbl" id="pg-bl">Scanning</span>
      </button>

    </div>
  `;

  (document.body || document.documentElement).appendChild(host);

  // ── Element references ─────────────────────────────────────────────────
  const btn   = shadow.getElementById("pg-btn");
  const panel = shadow.getElementById("pg-panel");
  const closeBtn = shadow.getElementById("pg-close-btn");
  const pgVW  = shadow.getElementById("pg-vw");
  const pgVI  = shadow.getElementById("pg-vi");
  const pgVT  = shadow.getElementById("pg-vt");
  const pgVS  = shadow.getElementById("pg-vs");
  const pgCF  = shadow.getElementById("pg-cf");
  const pgURL = shadow.getElementById("pg-url");
  const pgBI  = shadow.getElementById("pg-bi");
  const pgBL  = shadow.getElementById("pg-bl");

  // ── State ──────────────────────────────────────────────────────────────
  let shieldState = "scanning";  // scanning | safe | phishing | offline
  let lastData    = null;
  let lastContentResult = null;
  let panelOpen   = false;
  let autoClose   = null;

  // Debounced scan scheduling (prevents repeated scans on rapid reloads / SPA churn).
  let scanTimeout = null;

  // ── Update shield button appearance ───────────────────────────────────
  function applyShieldState(state, data) {
    shieldState = state;
    lastData    = data || null;
    btn.className = state;  // scanning | safe | phishing | offline

    const ring = shadow.querySelector(".pg-ring");

    if (state === "scanning") {
      if (!ring) { const r = document.createElement("div"); r.className = "pg-ring"; btn.prepend(r); }
      pgBI.textContent = "\u25CF";
      pgBL.textContent = "Scanning";
    } else {
      if (ring) ring.remove();
      if (state === "safe")     { pgBI.textContent = "\uD83D\uDEE1"; pgBL.textContent = "Protected"; }
      if (state === "phishing") { pgBI.textContent = "\u26A0";       pgBL.textContent = "Threat!";   }
      if (state === "offline")  { pgBI.textContent = "\u26A0";       pgBL.textContent = "Offline";   }
    }
  }

  // ── Populate panel content before showing ─────────────────────────────
  function populatePanel(state, data) {
    const p   = confToPercent(data && data.confidence);
    const cls = state === "safe" ? "s" : state === "phishing" ? "p" : "o";

    pgVW.className = "pg-v-ico " + cls;
    pgCF.className = "pg-fill " + cls;
    pgCF.style.width = p !== null ? p.toFixed(0) + "%" : (state === "offline" ? "0%" : "55%");
    pgURL.textContent = fmtUrl((data && data.url) ? data.url : window.location.href, 40);

    if (state === "safe") {
      pgVI.textContent = "\uD83D\uDEE1";
      pgVT.className   = "pg-v-head s";
      pgVT.textContent = "Safe Website";
      pgVS.textContent = (data && data.result) ? String(data.result) : "Legitimate";
    } else if (state === "phishing") {
      pgVI.textContent = "\u26A0";
      pgVT.className   = "pg-v-head p";
      pgVT.textContent = "Phishing Detected";
      pgVS.textContent = (data && data.result) ? String(data.result) : "Malicious URL";
    } else {
      pgVI.textContent = "\u26A0";
      pgVT.className   = "pg-v-head o";
      pgVT.textContent = "Backend Offline";
      pgVS.textContent = "Start Flask on port 5000";
    }
  }

  function openPanel() {
    if (autoClose) clearTimeout(autoClose);
    populatePanel(shieldState, lastData);
    panel.classList.add("pg-show");
    panelOpen = true;
    autoClose = setTimeout(closePanel, 6000);
  }

  function closePanel() {
    panel.classList.remove("pg-show");
    panelOpen = false;
    if (autoClose) { clearTimeout(autoClose); autoClose = null; }
  }

  // ── User interactions ──────────────────────────────────────────────────
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    panelOpen ? closePanel() : openPanel();
  });

  closeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    closePanel();
  });

  // Click anywhere outside → close panel
  document.addEventListener("click", function () {
    if (panelOpen) closePanel();
  }, { passive: true, capture: false });

  // ── Active Protection: fullscreen blocking overlay ────────────────────
  // Injected directly into the main document (not Shadow DOM) so it covers
  // the entire viewport and prevents all interaction with the page beneath.
  function activateProtection(rawConfidence, rawResult) {
    if (document.getElementById("__pg_block__")) return; // once per URL

    // Inject keyframes into document <head> if not already present.
    if (!document.getElementById("__pg_block_style__")) {
      const style = document.createElement("style");
      style.id = "__pg_block_style__";
      style.textContent = `
        @keyframes __pg_fadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes __pg_bgIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        #__pg_block__ * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
        #__pg_block__ button:hover { filter: brightness(1.14); }
        #__pg_block__ button:active { transform: scale(0.97) !important; }
        .pg-feedback-container { margin-top:30px; text-align:center; }
        .pg-feedback-title { font-size:14px; color:#9aa4b2; margin-bottom:10px; }
        .pg-feedback-buttons { display:flex; justify-content:center; gap:12px; }
        .pg-feedback-btn { padding:10px 16px; border-radius:8px; border:none; font-size:13px; cursor:pointer; transition:0.2s ease; }
        .pg-feedback-btn.correct { background:#1f2937; color:#22c55e; }
        .pg-feedback-btn.correct:hover { background:#22c55e; color:white; }
        .pg-feedback-btn.wrong { background:#1f2937; color:#ef4444; }
        .pg-feedback-btn.wrong:hover { background:#ef4444; color:white; }
        .pg-feedback-thanks { font-size:13px; color:#4ade80; margin-top:10px; }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    const conf = confToPercent(rawConfidence);
    const confLabel = conf !== null ? conf.toFixed(1) + "%" : "N/A";
    const resultLabel = rawResult ? String(rawResult) : "Phishing";

    // ── Overlay (blocks all page interaction) ─────────────────────────
    const overlay = document.createElement("div");
    overlay.id = "__pg_block__";
    overlay.style.cssText = [
      "position:fixed", "inset:0", "width:100%", "height:100%",
      "background:rgba(3,7,18,0.93)",
      "z-index:2147483647",
      "display:flex", "align-items:center", "justify-content:center",
      "padding:20px",
      "animation:__pg_bgIn 280ms ease both",
      // Block all pointer events on the backdrop itself.
      "pointer-events:all",
      // Prevent scroll on the page body without touching body.style.
      "overflow:hidden",
    ].join(";");

    // ── Warning card ───────────────────────────────────────────────────
    const card = document.createElement("div");
    card.style.cssText = [
      "background:linear-gradient(160deg,#0b1220 0%,#110a1a 100%)",
      "border:1px solid rgba(239,68,68,0.35)",
      "border-radius:20px",
      "padding:40px 36px 32px",
      "max-width:480px", "width:100%",
      "text-align:center",
      "box-shadow:0 32px 80px rgba(0,0,0,0.70),0 0 0 1px rgba(255,255,255,0.05)",
      "animation:__pg_fadeIn 340ms cubic-bezier(.4,0,.2,1) both",
      "position:relative",
    ].join(";");

    // ── Icon ring ─────────────────────────────────────────────────────
    card.innerHTML = `
      <div style="
        width:72px;height:72px;border-radius:50%;
        background:rgba(239,68,68,0.12);
        border:2px solid rgba(239,68,68,0.40);
        display:flex;align-items:center;justify-content:center;
        font-size:32px;margin:0 auto 18px;
        box-shadow:0 0 28px rgba(239,68,68,0.20);">
        &#9888;
      </div>

      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef4444;margin-bottom:8px;">
        PhishGuard AI &mdash; Active Protection
      </div>

      <h2 style="
        font-size:22px;font-weight:800;color:#fef2f2;
        margin:0 0 12px;line-height:1.25;">
        Phishing Website Detected
      </h2>

      <p style="font-size:13.5px;color:#94a3b8;line-height:1.6;margin:0 0 6px;">
        This website has been identified as a potential
        <strong style="color:#fca5a5;">phishing threat</strong> by the
        PhishGuard AI machine learning engine.
        It may attempt to steal your passwords, credit card details,
        or other sensitive information.
      </p>

      <div style="
        display:inline-flex;align-items:center;gap:8px;
        background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.25);
        border-radius:99px;padding:6px 16px;margin:14px 0 24px;
        font-size:12px;color:#fca5a5;">
        <span>&#128737;</span>
        <span>ML Confidence: <strong>${confLabel}</strong></span>
        <span style="color:#475569;">&bull;</span>
        <span>Result: <strong>${resultLabel}</strong></span>
      </div>

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button id="__pg_back__" style="
          padding:12px 28px;
          background:linear-gradient(135deg,#15803d,#22c55e);
          border:none;border-radius:10px;
          color:#fff;font-size:14px;font-weight:700;
          cursor:pointer;letter-spacing:0.2px;
          box-shadow:0 4px 18px rgba(34,197,94,0.35);
          transition:filter 140ms,transform 120ms;">
          &#8592; Go Back to Safety
        </button>
        <button id="__pg_continue__" style="
          padding:12px 28px;
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.12);
          border-radius:10px;
          color:#94a3b8;font-size:14px;font-weight:600;
          cursor:pointer;letter-spacing:0.2px;
          transition:filter 140ms,transform 120ms;">
          Continue Anyway
        </button>
      </div>

      <div class="pg-feedback-container">
        <p class="pg-feedback-title">Was this detection correct?</p>
        <div class="pg-feedback-buttons">
          <button id="__pg_fb_correct__" class="pg-feedback-btn correct">\uD83D\uDC4D Yes, correct</button>
          <button id="__pg_fb_wrong__" class="pg-feedback-btn wrong">\uD83D\uDC4E Report mistake</button>
        </div>
      </div>

      <p style="margin:18px 0 0;font-size:11px;color:#334155;">
        Powered by PhishGuard AI &bull; ML-Based Phishing Detection
      </p>
    `;

    overlay.appendChild(card);

    // Append to documentElement so it works even if body is minimal / SPA.
    (document.body || document.documentElement).appendChild(overlay);

    // ── Feedback handlers ──────────────────────────────────────────────
    function sendFeedback(type) {
      var feedbackUrl = window.location.href;
      chrome.runtime.sendMessage(
        { type: "PHISHGUARD_FEEDBACK", url: feedbackUrl, feedback_type: type, original_prediction: lastContentResult },
        function () { /* response ignored */ }
      );
      var container = document.querySelector("#__pg_block__ .pg-feedback-buttons");
      if (container) {
        container.innerHTML = '<p class="pg-feedback-thanks">Thank you for your feedback!</p>';
      }
    }

    document.getElementById("__pg_fb_correct__").addEventListener("click", function () {
      sendFeedback("correct");
    });
    document.getElementById("__pg_fb_wrong__").addEventListener("click", function () {
      sendFeedback("incorrect_flag");
    });

    // ── Button handlers ────────────────────────────────────────────────
    document.getElementById("__pg_back__").addEventListener("click", function () {
      // Fade overlay out, then go back (gives a smoother feel).
      overlay.style.transition = "opacity 220ms ease";
      overlay.style.opacity = "0";
      setTimeout(function () { window.history.back(); }, 240);
    });

    document.getElementById("__pg_continue__").addEventListener("click", function () {
      overlay.style.transition = "opacity 220ms ease";
      overlay.style.opacity = "0";
      setTimeout(function () {
        overlay.remove();
        const blockStyle = document.getElementById("__pg_block_style__");
        if (blockStyle) blockStyle.remove();
      }, 240);
    });
  }

  function scheduleScan(url) {
    if (scanTimeout) {
      clearTimeout(scanTimeout);
      scanTimeout = null;
    }

    scanTimeout = setTimeout(function () {
      applyShieldState("scanning", null);

      chrome.runtime.sendMessage({ type: "PHISHGUARD_PREDICT", url: url }, function (resp) {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          applyShieldState("offline", null);
          return;
        }

        const d = resp.data;
        const raw = (d && d.result) ? String(d.result).toLowerCase() : "";
        const bad = (d && d.status_code === 1) ||
          raw.indexOf("phish") !== -1 ||
          raw.indexOf("suspicious") !== -1;

        lastContentResult = bad ? "phishing" : "legitimate";
        applyShieldState(bad ? "phishing" : "safe", d);
        if (bad) activateProtection(d && d.confidence, d && d.result);
      });
    }, 800);
  }

  // ── Auto-scan (debounced) ─────────────────────────────────────────────
  scheduleScan(window.location.href);

}()); // end IIFE
