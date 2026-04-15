const API_PREDICT  = "http://127.0.0.1:5000/predict";
const API_HEALTH   = "http://127.0.0.1:5000/health";
const API_FEEDBACK = "http://127.0.0.1:5000/feedback";

// Cache to avoid re-scanning same domain multiple times
const domainCache = Object.create(null);

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return String(url || "");
  }
}

async function callPredict(url) {
  const domain = getDomain(url);

  const cached = domainCache[domain];
  if (cached) {
    return await cached;
  }

  const pending = (async () => {
    const res = await fetch(API_PREDICT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    let body;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) throw new Error((body && body.error) ? body.error : `HTTP ${res.status}`);
    return body;
  })();

  // Store in-flight promise so concurrent requests for same domain dedupe.
  domainCache[domain] = pending;
  try {
    const data = await pending;
    domainCache[domain] = Promise.resolve(data);
    return data;
  } catch (err) {
    delete domainCache[domain];
    throw err;
  }
}

async function callHealth() {
  const res = await fetch(API_HEALTH);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function callFeedback(url, feedbackType, originalPrediction) {
  const payload = { url, feedback_type: feedbackType };
  if (originalPrediction) payload.original_prediction = originalPrediction;
  const res = await fetch(API_FEEDBACK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "PHISHGUARD_PREDICT") {
    if (!msg.url || typeof msg.url !== "string") {
      sendResponse({ ok: false, error: "INVALID_URL" });
      return;
    }
    callPredict(msg.url)
      .then(data  => sendResponse({ ok: true,  data }))
      .catch(_err => sendResponse({ ok: false, error: "BACKEND_UNREACHABLE" }));
    return true; // keep channel open for async response
  }

  if (msg.type === "PHISHGUARD_HEALTH") {
    callHealth()
      .then(data  => sendResponse({ ok: true,  data }))
      .catch(_err => sendResponse({ ok: false, error: "BACKEND_UNREACHABLE" }));
    return true;
  }

  if (msg.type === "PHISHGUARD_FEEDBACK") {
    if (!msg.url || !msg.feedback_type) {
      sendResponse({ ok: false, error: "INVALID_FEEDBACK" });
      return;
    }
    callFeedback(msg.url, msg.feedback_type, msg.original_prediction)
      .then(data  => sendResponse({ ok: true,  data }))
      .catch(_err => sendResponse({ ok: false, error: "BACKEND_UNREACHABLE" }));
    return true;
  }
});
