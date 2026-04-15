// Shared utilities loaded from shared.js: getVerdict, getReasons, confToPercent, fmtUrl

function sendMsg(type, extra) {
  return new Promise(function (resolve) {
    chrome.runtime.sendMessage(Object.assign({ type: type }, extra), function (resp) {
      if (chrome.runtime.lastError) resolve({ ok: false, error: "BACKEND_UNREACHABLE" });
      else resolve(resp);
    });
  });
}

// ── Element references ────────────────────────────────────────────────────────
const scanBtn    = document.getElementById("scanBtn");
const btnIco     = document.getElementById("btn-ico");
const btnTxt     = document.getElementById("btn-txt");
const hdrDot     = document.getElementById("hdr-dot");
const resultCard = document.getElementById("result-card");
const errMsg     = document.getElementById("err-msg");
const rcIcoWrap  = document.getElementById("rc-ico-wrap");
const rcIco      = document.getElementById("rc-ico");
const rcLabel    = document.getElementById("rc-label");
const rcSub      = document.getElementById("rc-sub");
const rcFill     = document.getElementById("rc-fill");
const rcConfVal  = document.getElementById("rc-conf-val");
const rcUrl      = document.getElementById("rc-url");
const ftrDot     = document.getElementById("ftr-dot");
const ftrTxt     = document.getElementById("ftr-txt");
const fbSection  = document.getElementById("feedback-section");
const fbCorrect  = document.getElementById("fb-correct");
const fbWrong    = document.getElementById("fb-wrong");
const fbStatus   = document.getElementById("fb-status");

let lastScanUrl = null;
let lastScanResult = null;

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
    rcSub.style.whiteSpace = "pre-line";
  } else if (state === "phishing") {
    rcIco.textContent   = "\u26A0";
    rcLabel.className   = "rc-label p";
    rcLabel.textContent = "Phishing Detected";
    rcSub.textContent   = (data && data.result) ? String(data.result) : "Malicious URL";
    rcSub.style.whiteSpace = "pre-line";
  } else if (state === "warning") {
    rcIco.textContent   = "\u26A0";
    rcLabel.className   = "rc-label o";
    rcLabel.textContent = "Warning";
    rcSub.textContent   = (data && data.result) ? String(data.result) : "Suspicious";
    rcSub.style.whiteSpace = "pre-line";
  } else {
    rcIco.textContent   = "\u26A0";
    rcLabel.className   = "rc-label o";
    rcLabel.textContent = "Backend Offline";
    rcSub.textContent   = "Start Flask on port 5000";
    rcSub.style.whiteSpace = "pre-line";
  }

  var urlForReasons = (data && data.url) ? String(data.url) : lastScanUrl;
  var reasons = getReasons(urlForReasons);
  if (reasons.length) {
    rcSub.textContent += "\nReasons:\n- " + reasons.join("\n- ");
  }

  rcUrl.textContent = (data && data.url) ? fmtUrl(data.url, 44) : "";
  resultCard.classList.add("show");
  errMsg.classList.remove("show");

  // Show feedback section after scan result
  if (state === "safe" || state === "phishing" || state === "warning") {
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
      const verdict = getVerdict(d);
      lastScanResult = verdict === "high_risk" ? "phishing" : verdict === "suspicious" ? "suspicious" : "safe";
      var uiState = verdict === "high_risk" ? "phishing" : verdict === "suspicious" ? "warning" : "safe";

      showResult(uiState, d);
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
