const form = document.getElementById("scan-form");
const urlInput = document.getElementById("url-input");
const analyzeButton = document.getElementById("analyze-button");
const btnYes = document.getElementById("btn-yes");
const btnNo = document.getElementById("btn-no");
const analysisResultEl = document.getElementById("analysis-result");

const thankyouOverlay = document.getElementById("thankyou-overlay");
const thankyouClose = document.getElementById("thankyou-close");
const thankyouModal = thankyouOverlay?.querySelector?.(".pg-modal") || null;

let thankyouTimer = null;
let lastAnalysis = null;

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
});

function setupEventListeners() {
    if (form) form.addEventListener("submit", handleAnalyzeSubmit);
    if (btnYes) btnYes.addEventListener("click", handleYes);
    if (btnNo) btnNo.addEventListener("click", handleNo);
}

function handleYes() {
    openThankYouModal();
}

function handleNo() {
    const url = lastAnalysis?.url || (urlInput?.value || "").trim();
    const target = url ? `feedback.html?url=${encodeURIComponent(url)}` : "feedback.html";
    window.location.href = target;
}

async function handleAnalyzeSubmit(e) {
    e.preventDefault();
    const url = (urlInput?.value || "").trim();
    if (!validateURL(url)) {
        showToast("Please enter a valid URL (e.g., https://example.com).", 3200);
        return;
    }

    setAnalyzing(true);
    clearResult();

    try {
        const result = await fetchPrediction(url);
        lastAnalysis = { url: result?.url || url, result };
        renderResult(result);
    } catch (err) {
        let message = err?.message || "Could not reach detection server. Please try again.";

        // Browsers often surface blocked network requests as "Failed to fetch".
        if (
            String(message).toLowerCase().includes("failed to fetch") ||
            String(message).toLowerCase().includes("networkerror")
        ) {
            const pageIsHttps = window.location.protocol === "https:";
            const apiIsHttp = API_BASE.startsWith("http://");
            message =
                "Request was blocked by the browser.\n" +
                "- Ensure the backend is running on http://127.0.0.1:5000\n" +
                (pageIsHttps && apiIsHttp
                    ? "- Open this frontend page over http (not https), otherwise the browser blocks calls to the http API (mixed content)."
                    : "- If using Live Server, keep it on http and allow cross-origin requests.");
        }
        showToast(message, 3200);
        renderError(message);
    } finally {
        setAnalyzing(false);
    }
}

function setResultHidden(hidden) {
    if (!analysisResultEl) return;
    analysisResultEl.classList.toggle("pg-hidden", hidden);
}

function clearResult() {
    if (!analysisResultEl) return;
    analysisResultEl.textContent = "";
    analysisResultEl.classList.add("pg-hidden");
    analysisResultEl.classList.remove(
        "pg-result-bad",
        "pg-result-good",
        "pg-result-warn",
        "safe-result",
        "phishing-result"
    );
}

function setResultClasses(verdict) {
    const isHighRisk = verdict === "high_risk";
    const isSafe = verdict === "safe";
    const isWarning = verdict === "suspicious";

    analysisResultEl.classList.toggle("phishing-result", isHighRisk);
    analysisResultEl.classList.toggle("safe-result", isSafe);
    analysisResultEl.classList.toggle("pg-result-bad", isHighRisk);
    analysisResultEl.classList.toggle("pg-result-good", isSafe);
    analysisResultEl.classList.toggle("pg-result-warn", isWarning);
}

function renderResult(data) {
    if (!analysisResultEl) return;

    const verdict = getVerdict(data);
    const label = verdict === "high_risk" ? "Phishing" : verdict === "suspicious" ? "Warning" : "Safe";
    const confidence = typeof data?.confidence === "number" ? data.confidence : null;
    const confidenceText = confidence === null ? "" : `\nConfidence: ${(confidence * 100).toFixed(1)}%`;

    const url = lastAnalysis?.url || (urlInput?.value || "").trim();
    const reasons = getReasons(url);
    const reasonsText = reasons.length ? `\nReasons:\n- ${reasons.join("\n- ")}` : "";

    analysisResultEl.textContent = `${label}${confidenceText}${reasonsText}`;
    setResultClasses(verdict);
    setResultHidden(false);
}

function renderError(message) {
    if (!analysisResultEl) return;
    analysisResultEl.textContent = message;
    setResultClasses("high_risk");
    setResultHidden(false);
}

function setAnalyzing(isAnalyzing) {
    if (!analyzeButton) return;
    analyzeButton.disabled = isAnalyzing;
    analyzeButton.textContent = isAnalyzing ? "Analyzing..." : "Analyze Now";
}

function validateURL(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

async function fetchPrediction(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`${API_BASE}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
            signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const msg = data?.error || `Predict request failed (${response.status})`;
            throw new Error(msg);
        }
        return data;
    } finally {
        clearTimeout(timeoutId);
    }
}

function openThankYouModal() {
    if (!thankyouOverlay) {
        showToast(
            "Thank you for your feedback!\nWe’re glad the prediction was helpful.\nVisit again anytime.",
            4000
        );
        return;
    }

    if (thankyouTimer) {
        clearTimeout(thankyouTimer);
        thankyouTimer = null;
    }

    thankyouOverlay.classList.remove("pg-hidden");
    // next tick for transition
    requestAnimationFrame(() => {
        thankyouOverlay.classList.add("show");
        thankyouOverlay.setAttribute("aria-hidden", "false");
        thankyouModal?.focus?.();
    });

    thankyouTimer = setTimeout(() => {
        closeThankYouModal();
    }, 4000);
}

function closeThankYouModal() {
    if (!thankyouOverlay) return;
    if (thankyouTimer) {
        clearTimeout(thankyouTimer);
        thankyouTimer = null;
    }

    thankyouOverlay.classList.remove("show");
    thankyouOverlay.setAttribute("aria-hidden", "true");

    // allow fade-out transition to finish
    window.setTimeout(() => {
        thankyouOverlay.classList.add("pg-hidden");
    }, 230);
}

// Modal event wiring (kept simple, no layout impact)
if (thankyouClose) {
    thankyouClose.addEventListener("click", closeThankYouModal);
}

if (thankyouOverlay) {
    thankyouOverlay.addEventListener("click", (e) => {
        if (e.target === thankyouOverlay) closeThankYouModal();
    });
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeThankYouModal();
});