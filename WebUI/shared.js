const API_BASE = "http://127.0.0.1:5000";

let toastTimer = null;

function showToast(message, durationMs = 3500) {
    const el = document.getElementById("toast");
    if (!el) return;
    if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
    }
    el.textContent = message;
    el.classList.add("show");
    toastTimer = setTimeout(() => el.classList.remove("show"), durationMs);
}

function getVerdict(data) {
    const isPhish = data?.status_code === 1;
    const conf = data?.confidence || 0;

    if (isPhish && conf > 0.8) return "high_risk";
    if (isPhish && conf > 0.6) return "suspicious";
    return "safe";
}

function getReasons(url) {
    const reasons = [];

    if (!url) return reasons;

    if (url.length > 75) reasons.push("URL is unusually long");
    if ((url.match(/\./g) || []).length > 3) reasons.push("Too many subdomains");
    if (/\d/.test(url)) reasons.push("Contains suspicious digits");

    return reasons;
}
