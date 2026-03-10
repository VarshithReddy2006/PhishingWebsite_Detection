const form = document.getElementById("feedback-form");
const comments = document.getElementById("comments");
const submitBtn = document.getElementById("submit-feedback");
const formWrap = document.getElementById("feedback-form-wrap");
const processing = document.getElementById("processing");
const thanksOverlay = document.getElementById("feedback-thanks-overlay");
const thanksModal = thanksOverlay?.querySelector?.(".pg-modal") || null;

function getUrlFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const url = (params.get("url") || "").trim();
    return url || null;
  } catch {
    return null;
  }
}

let redirectTimer = null;

function updateRadioHighlights() {
  if (!form) return;
  const selected = form?.elements?.reason?.value;
  const labels = form.querySelectorAll(".pg-radio");
  labels.forEach((label) => {
    const input = label.querySelector('input[type="radio"]');
    const isSelected = !!input && input.value === selected;
    label.classList.toggle("is-selected", isSelected);
  });
}

function openThanksPopupAndRedirect() {
  // Ensure we always redirect (required), even if popup markup is missing.
  if (redirectTimer) {
    clearTimeout(redirectTimer);
    redirectTimer = null;
  }

  if (thanksOverlay) {
    thanksOverlay.classList.remove("pg-hidden");
    requestAnimationFrame(() => {
      thanksOverlay.classList.add("show");
      thanksOverlay.setAttribute("aria-hidden", "false");
      thanksModal?.focus?.();
    });

    // Allow click-outside / ESC to skip waiting and redirect immediately.
    const redirectNow = () => {
      window.location.href = "index.html";
    };

    thanksOverlay.addEventListener(
      "click",
      (e) => {
        if (e.target === thanksOverlay) redirectNow();
      },
      { once: true }
    );

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") redirectNow();
      },
      { once: true }
    );
  }

  redirectTimer = window.setTimeout(() => {
    window.location.href = "index.html";
  }, 3000);
}

if (form) {
  form.addEventListener("change", (e) => {
    if (e.target && e.target.name === "reason") {
      updateRadioHighlights();
    }
  });
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const reason = form.elements.reason.value;
    if (reason !== "incorrect_flag" && reason !== "missed_threat") return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    // Show spinner during submission (required)
    if (formWrap) formWrap.classList.add("pg-hidden");
    if (processing) processing.classList.remove("pg-hidden");
    const spinnerStart = performance.now();

    const url = getUrlFromQuery();
    if (!url) {
      showToast("No recent URL found. Go back, analyze a URL first, then submit feedback.", 4200);
      // restore UI
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Feedback";
      if (processing) processing.classList.add("pg-hidden");
      if (formWrap) formWrap.classList.remove("pg-hidden");
      return;
    }

    try {
      const commentText = (comments?.value || "").trim();
      await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, feedback_type: reason, comment: commentText }),
      });

      // Keep spinner visible briefly for a smooth transition.
      const minSpinnerMs = 650;
      const elapsed = performance.now() - spinnerStart;
      const remaining = Math.max(0, minSpinnerMs - elapsed);

      window.setTimeout(() => {
        if (processing) processing.classList.add("pg-hidden");
        openThanksPopupAndRedirect();
      }, remaining);
    } finally {
      // No-op: page will redirect.
    }
  });
}

// Initial state
updateRadioHighlights();
