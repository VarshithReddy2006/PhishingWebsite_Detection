// Shared utility functions for PhishGuard Extension

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
