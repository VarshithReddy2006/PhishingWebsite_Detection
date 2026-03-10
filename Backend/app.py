from __future__ import annotations

import logging
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

from utils import relaunch_in_venv_if_needed, ensure_dependencies

relaunch_in_venv_if_needed()

ensure_dependencies(
    [
        ("flask", "flask"),
        ("flask_cors", "flask-cors"),
        ("pandas", "pandas"),
        ("numpy", "numpy"),
        ("sklearn", "scikit-learn"),
        ("joblib", "joblib"),
    ],
    r"Backend\app.py",
)

# Keep tokenizers from spawning too many threads (common Windows stability setting)
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd

from features import FEATURE_COLUMNS, get_structural_features


def _normalize_prediction(pred):
    if isinstance(pred, (int, float, np.integer, np.floating)):
        code = int(pred)
        return code, ("Phishing" if code == 1 else "Legitimate")
    if isinstance(pred, str):
        lowered = pred.strip().lower()
        if lowered in {"phishing", "1", "true"}:
            return 1, "Phishing"
        if lowered in {"legitimate", "0", "false"}:
            return 0, "Legitimate"
    raise ValueError(f"Unexpected model prediction type/value: {type(pred).__name__}={pred!r}")

_BASE_DIR = Path(__file__).resolve().parent
_WEBUI_DIR = (_BASE_DIR.parent / "WebUI").resolve()

# Serve WebUI assets directly from the backend without changing API routes.
app = Flask(__name__, static_folder=str(_WEBUI_DIR), static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("phishguard")

model_path = os.path.join(os.path.dirname(__file__), 'model_v1.pkl')
feature_names_path = os.path.join(os.path.dirname(__file__), 'feature_names.pkl')

try:
    print("Loading phishing detection model...")
    model = joblib.load(model_path)
    expected_features = joblib.load(feature_names_path)
    print("Backend ready.")
except Exception as e:
    logger.error("Error loading model artifacts; run Backend/train.py first. %s", e)
    model = None
    expected_features = None

# Prediction cache: avoids redundant computation for repeated URLs
prediction_cache = {}


# ── Feedback-based override cache ─────────────────────────────────────────
class FeedbackCache:
    """O(1) URL lookup against feedback.csv using a dict (hashmap).

    Auto-refreshes when the file's mtime changes.
    """

    def __init__(self, csv_path: str):
        self._csv_path = csv_path
        self._cache: dict[str, str] = {}   # url -> label
        self._last_mtime: float = 0.0
        self._refresh()

    def _refresh(self) -> None:
        """Reload feedback.csv into memory if it changed on disk."""
        try:
            if not os.path.exists(self._csv_path):
                return
            mtime = os.path.getmtime(self._csv_path)
            if mtime == self._last_mtime:
                return
            self._last_mtime = mtime
            df = pd.read_csv(self._csv_path, engine="python", on_bad_lines="skip")
            if "url" not in df.columns:
                return
            label_col = "label" if "label" in df.columns else (
                "status" if "status" in df.columns else None
            )
            if label_col is None:
                return
            new_cache: dict[str, str] = {}
            for _, row in df.iterrows():
                url = str(row["url"]).strip()
                raw = str(row[label_col]).strip().lower()
                if raw in {"legitimate", "0", "false"}:
                    new_cache[url] = "legitimate"
                elif raw in {"phishing", "1", "true"}:
                    new_cache[url] = "phishing"
            self._cache = new_cache
        except Exception:
            pass  # keep stale cache on read errors

    def lookup(self, url: str) -> dict | None:
        """Return a prediction dict if the URL is in feedback, else None."""
        self._refresh()
        label = self._cache.get(url)
        if label is None:
            return None
        is_phishing = label == "phishing"
        return {
            "url": url,
            "status_code": 1 if is_phishing else 0,
            "result": "Phishing" if is_phishing else "Legitimate",
            "confidence": 1.0,
            "source": "feedback",
        }

    def invalidate(self) -> None:
        """Force a refresh on next lookup (called after new feedback is saved)."""
        self._last_mtime = 0.0


_feedback_cache = FeedbackCache(os.path.join(os.path.dirname(__file__), "feedback.csv"))

@app.route("/")
def home():
    index_path = Path(app.static_folder or "") / "index.html"
    if index_path.exists():
        return send_from_directory(app.static_folder, "index.html")
    return "PhishGuard backend running", 200

@app.route("/predict", methods=["POST"])
def predict():
    try:
        if model is None:
            raise Exception("Model not loaded. Please run train.py on the backend.")

        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"error": "Invalid JSON input"}), 400
            
        url = data.get("url")
        if not url:
            return jsonify({"error": "No URL provided"}), 400

        feature_list = expected_features or FEATURE_COLUMNS

        # Check prediction cache
        if url in prediction_cache:
            return jsonify(prediction_cache[url])

        # Check feedback cache (hashset O(1) lookup)
        fb_hit = _feedback_cache.lookup(url)
        if fb_hit is not None:
            prediction_cache[url] = fb_hit
            return jsonify(fb_hit)

        structural = get_structural_features(url, feature_list)
        features = np.array(structural, dtype=np.float32).reshape(1, -1)

        raw_prediction = model.predict(features)[0]
        status_code, result = _normalize_prediction(raw_prediction)
        probability = model.predict_proba(features)[0].max() if hasattr(model, "predict_proba") else None

        # Low-confidence safety rule: avoid false negatives
        if probability is not None and result == "Legitimate" and float(probability) < 0.60:
            result = "Suspicious"
            # Keep frontend safe without UI changes: treat Suspicious as non-safe.
            status_code = 1
        
        response = {
            "url": url,
            "status_code": int(status_code),
            "result": result,
            "confidence": round(float(probability), 2) if probability is not None else None,
        }

        # Store in prediction cache
        prediction_cache[url] = response

        return jsonify(response)
    except Exception as e:
        logger.error("Error in /predict: %s", e)
        return jsonify({"error": str(e)}), 500

@app.route("/feedback", methods=["POST"])
def feedback():
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"error": "Invalid JSON input"}), 400
            
        url = data.get("url")
        # Accept either legacy `label` or spec `feedback_type`.
        label = data.get("label")
        feedback_type = data.get("feedback_type")
        original_prediction = data.get("original_prediction")

        if not url or (label is None and feedback_type is None):
            return jsonify({"error": "Missing URL or feedback_type/label"}), 400

        if label is None and isinstance(feedback_type, str):
            ft = feedback_type.strip().lower()
            if ft == "incorrect_flag":
                # Invert the original prediction; fall back to "legitimate" for legacy callers
                if isinstance(original_prediction, str) and original_prediction.strip().lower() in {"phishing", "suspicious"}:
                    label = "legitimate"
                elif isinstance(original_prediction, str) and original_prediction.strip().lower() in {"legitimate", "safe"}:
                    label = "phishing"
                else:
                    label = "legitimate"
            elif ft == "missed_threat":
                label = "phishing"
            elif ft == "correct":
                # User confirmed the prediction — store the confirmed label
                if isinstance(original_prediction, str) and original_prediction.strip().lower() in {"phishing", "suspicious"}:
                    label = "phishing"
                elif isinstance(original_prediction, str) and original_prediction.strip().lower() in {"legitimate", "safe"}:
                    label = "legitimate"
                else:
                    # No original_prediction available — cannot store, just acknowledge
                    return jsonify({"message": "Thank you for confirming!"})
            else:
                # Allow direct label values as feedback_type too.
                label = ft

        if isinstance(label, str):
            label = label.strip().lower()
            if label in {"phishing", "1", "true"}:
                label = "phishing"
            elif label in {"legitimate", "0", "false"}:
                label = "legitimate"
            else:
                return jsonify({"error": "Invalid label. Use phishing or legitimate."}), 400
        elif isinstance(label, (int, float)):
            label = "phishing" if int(label) == 1 else "legitimate"
        else:
            return jsonify({"error": "Invalid label. Use phishing or legitimate."}), 400

        feedback_path = os.path.join(os.path.dirname(__file__), 'feedback.csv')
        comment = data.get("comment", "") or ""
        df = pd.DataFrame([[url, label, feedback_type or "", comment]],
                          columns=['url', 'label', 'feedback_type', 'comment'])

        if not os.path.exists(feedback_path):
            df.to_csv(feedback_path, index=False)
        else:
            df.to_csv(feedback_path, mode='a', header=False, index=False)

        # Invalidate caches so next prediction reflects the new feedback
        _feedback_cache.invalidate()
        prediction_cache.pop(url, None)

        return jsonify({"message": "Feedback saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/features", methods=["POST"])
def features():
    try:
        data = request.get_json(force=True, silent=True)
        url = data.get("url") if data else None
        if not url:
            return jsonify({"error": "No URL provided"}), 400

        feature_list = expected_features or FEATURE_COLUMNS
        feats = get_structural_features(url, feature_list)
        return jsonify(dict(zip(feature_list, feats)))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "running"})

@app.route("/download/feedback", methods=["GET"])
def download_feedback():
    feedback_path = os.path.join(os.path.dirname(__file__), 'feedback.csv')
    if os.path.exists(feedback_path):
        return send_file(feedback_path, as_attachment=True)
    return jsonify({"error": "Feedback file not found"}), 404

@app.route("/download/dataset", methods=["GET"])
def download_dataset():
    dataset_path = os.path.join(os.path.dirname(__file__), 'dataset.csv')
    if os.path.exists(dataset_path):
        return send_file(dataset_path, as_attachment=True)
    return jsonify({"error": "Dataset file not found"}), 404

# ── Auto-retrain watcher ─────────────────────────────────────────────────
_FEEDBACK_PATH = os.path.join(os.path.dirname(__file__), "feedback.csv")
_RETRAIN_COOLDOWN = 60  # seconds between retrain runs
_last_mtime: float = 0
_last_retrain: float = 0
_last_model_mtime: float = 0


def _reload_model() -> None:
    """Reload model artifacts from disk and clear prediction cache."""
    global model, expected_features, prediction_cache
    try:
        new_model = joblib.load(model_path)
        new_features = joblib.load(feature_names_path)
        # Atomic swap of globals
        model = new_model
        expected_features = new_features
        prediction_cache = {}
        print("[PhishGuard] Model reloaded successfully.")
    except Exception as exc:
        logger.warning("Model reload failed: %s", exc)


def _watch_feedback_file() -> None:
    """Poll feedback.csv for changes and trigger retrain.py in background.
    Also watches model_v1.pkl for changes and hot-reloads when updated."""
    global _last_mtime, _last_retrain, _last_model_mtime

    # Initialise to current mtime so startup doesn't trigger a retrain.
    if os.path.exists(_FEEDBACK_PATH):
        _last_mtime = os.path.getmtime(_FEEDBACK_PATH)
    if os.path.exists(model_path):
        _last_model_mtime = os.path.getmtime(model_path)

    while True:
        time.sleep(10)
        try:
            # Check for feedback changes → trigger retrain
            if os.path.exists(_FEEDBACK_PATH):
                mtime = os.path.getmtime(_FEEDBACK_PATH)
                if mtime != _last_mtime:
                    _last_mtime = mtime
                    now = time.time()
                    if now - _last_retrain > _RETRAIN_COOLDOWN:
                        _last_retrain = now
                        print("[PhishGuard] Feedback updated \u2014 starting retraining...")
                        subprocess.Popen(
                            [sys.executable, os.path.join(os.path.dirname(__file__), "retrain.py")]
                        )

            # Check for model file changes → hot-reload
            if os.path.exists(model_path):
                model_mtime = os.path.getmtime(model_path)
                if model_mtime != _last_model_mtime:
                    _last_model_mtime = model_mtime
                    print("[PhishGuard] Model file changed \u2014 reloading...")
                    _reload_model()
        except Exception as exc:
            logger.warning("Feedback watcher error: %s", exc)


if __name__ == "__main__":
    threading.Thread(target=_watch_feedback_file, daemon=True).start()
    app.run(host="0.0.0.0", port=5000, debug=False)