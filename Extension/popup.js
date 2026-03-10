// PhishGuard AI — Popup Script

// ── Helpers ──────────────────────────────────────────────────────────────────
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

function sendMsg(type, extra) {
  return new Promise(function (resolve) {
    chrome.runtime.sendMessage(Object.assign({ type: type }, extra), function (resp) {
      if (chrome.runtime.lastError) resolve({ ok: false, error: "BACKEND_UNREACHABLE" });
      else resolve(resp);
    });
  });
}

// ── Element references ────────────────────────────────────────────────────────
var scanBtn    = document.getElementById("scanBtn");
var btnIco     = document.getElementById("btn-ico");
var btnTxt     = document.getElementById("btn-txt");
var hdrDot     = document.getElementById("hdr-dot");
var resultCard = document.getElementById("result-card");
var errMsg     = document.getElementById("err-msg");
var rcIcoWrap  = document.getElementById("rc-ico-wrap");
var rcIco      = document.getElementById("rc-ico");
var rcLabel    = document.getElementById("rc-label");
var rcSub      = document.getElementById("rc-sub");
var rcFill     = document.getElementById("rc-fill");
var rcConfVal  = document.getElementById("rc-conf-val");
var rcUrl      = document.getElementById("rc-url");
var ftrDot     = document.getElementById("ftr-dot");
var ftrTxt     = document.getElementById("ftr-txt");
var fbSection  = document.getElementById("feedback-section");
var fbCorrect  = document.getElementById("fb-correct");
var fbWrong    = document.getElementById("fb-wrong");
var fbStatus   = document.getElementById("fb-status");

var lastScanUrl = null;
var lastScanResult = null;

// ── Backend health check ──────────────────────────────────────────────────────
function checkHealth() {
  sendMsg("PHISHGUARD_HEALTH", {}).then(function (resp) {
    var online = resp && resp.ok;
    hdrDot.className = "hdr-dot " + (online ? "online" : "offline");
    ftrDot.className = "ftr-dot " + (online ? "online" : "offline");
    ftrTxt.textContent = online
      ? "Backend: Online \u00b7 127.0.0.1:5000"
      : "Backend: Offline \u2014 start Flask on port 5000";
  });
}

// ── Show scan result ──────────────────────────────────────────────────────────
function showResult(state, data) {
  var p   = confToPercent(data && data.confidence);
  var cls = state === "safe" ? "s" : state === "phishing" ? "p" : "o";

  rcIcoWrap.className = "rc-ico " + cls;
  rcFill.className    = "rc-fill " + cls;
  rcFill.style.width  = p !== null ? p.toFixed(0) + "%" : "55%";
  rcConfVal.textContent = p !== null ? p.toFixed(0) + "%" : "N/A";

  if (state === "safe") {
    rcIco.textContent   = "\uD83D\uDEE1";
    rcLabel.className   = "rc-label s";
    rcLabel.textContent = "Safe Website";
    rcSub.textContent   = (data && data.result) ? String(data.result) : "Legitimate";
  } else if (state === "phishing") {
    rcIco.textContent   = "\u26A0";
    rcLabel.className   = "rc-label p";
    rcLabel.textContent = "Phishing Detected";
    rcSub.textContent   = (data && data.result) ? String(data.result) : "Malicious URL";
  } else {
    rcIco.textContent   = "\u26A0";
    rcLabel.className   = "rc-label o";
    rcLabel.textContent = "Backend Offline";
    rcSub.textContent   = "Start Flask on port 5000";
  }

  rcUrl.textContent = (data && data.url) ? fmtUrl(data.url, 44) : "";
  resultCard.classList.add("show");
  errMsg.classList.remove("show");

  // Show feedback section after scan result
  if (state === "safe" || state === "phishing") {
    fbSection.classList.add("show");
    fbStatus.textContent = "";
  }
}

function showError(msg) {
  resultCard.classList.remove("show");
  errMsg.textContent = msg;
  errMsg.classList.add("show");
}

// ── Scan button handler ───────────────────────────────────────────────────────
scanBtn.addEventListener("click", function () {
  scanBtn.disabled    = true;
  btnIco.textContent  = "\u23F3";
  btnTxt.textContent  = "Scanning\u2026";
  resultCard.classList.remove("show");
  errMsg.classList.remove("show");

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    var url = tab && tab.url ? tab.url : null;

    if (!url) {
      showError("Could not read active tab URL.");
      resetBtn();
      return;
    }

    sendMsg("PHISHGUARD_PREDICT", { url: url }).then(function (resp) {
      if (!resp || !resp.ok) {
        showError("PhishGuard backend not running \u2014 start Flask on port 5000.");
        checkHealth();
        resetBtn();
        return;
      }

      lastScanUrl = url;
      var d   = resp.data;
      var raw = (d && d.result) ? String(d.result).toLowerCase() : "";
      var bad = (d && d.status_code === 1)  ||
                raw.indexOf("phish")      !== -1 ||
                raw.indexOf("suspicious") !== -1;
      lastScanResult = bad ? "phishing" : "legitimate";

      showResult(bad ? "phishing" : "safe", d);
      checkHealth();
      resetBtn();
    });
  });
});

function resetBtn() {
  scanBtn.disabled   = false;
  btnIco.textContent = "\uD83D\uDD0D";
  btnTxt.textContent = "Scan Current Tab";
}

// ── Init ──────────────────────────────────────────────────────────────────────
checkHealth();

// ── Feedback button handlers ──────────────────────────────────────────────────
function sendFeedback(feedbackType) {
  if (!lastScanUrl) return;
  fbCorrect.disabled = true;
  fbWrong.disabled   = true;
  fbStatus.textContent = "Sending...";

  sendMsg("PHISHGUARD_FEEDBACK", { url: lastScanUrl, feedback_type: feedbackType, original_prediction: lastScanResult })
    .then(function (resp) {
      if (resp && resp.ok) {
        fbStatus.textContent = "\u2705 Feedback saved. Thank you!";
      } else {
        fbStatus.textContent = "\u26A0 Could not save feedback.";
      }
    })
    .catch(function () {
      fbStatus.textContent = "\u26A0 Could not reach backend.";
    })
    .finally(function () {
      fbCorrect.disabled = false;
      fbWrong.disabled   = false;
    });
}

if (fbCorrect) {
  fbCorrect.addEventListener("click", function () {
    sendFeedback("correct");
  });
}

if (fbWrong) {
  fbWrong.addEventListener("click", function () {
    sendFeedback("incorrect_flag");
  });
}
