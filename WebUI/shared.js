// PhishGuard AI — Shared utilities across WebUI pages

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
