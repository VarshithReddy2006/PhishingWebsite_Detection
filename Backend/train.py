from __future__ import annotations

import os
import time
from pathlib import Path

from utils import relaunch_in_venv_if_needed, ensure_dependencies, read_csv_robust

relaunch_in_venv_if_needed()

ensure_dependencies(
    [
        ("pandas", "pandas"),
        ("numpy", "numpy"),
        ("sklearn", "scikit-learn"),
        ("joblib", "joblib"),
        ("torch", "torch"),
        ("transformers", "transformers"),
    ],
    r"Backend\train.py",
)

# Keep tokenizers from spawning too many threads (common Windows stability setting)
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import joblib
import numpy as np
import pandas as pd
from pandas.api.types import is_string_dtype
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

from features import FEATURE_COLUMNS, get_structural_features


def _read_dataset(path: str) -> pd.DataFrame:
    """Load dataset.csv with best-effort delimiter detection."""
    return read_csv_robust(Path(path))


def _normalize_status(df: pd.DataFrame) -> pd.DataFrame:
    if "status" not in df.columns and "label" in df.columns:
        df = df.rename(columns={"label": "status"})

    if "status" not in df.columns:
        raise ValueError("dataset.csv must include a 'status' column")

    status = df["status"]
    if is_string_dtype(status) or status.dtype == "O":
        status = status.astype(str).str.strip().str.lower()
        status = status.replace({"legitimate": "0", "phishing": "1", "false": "0", "true": "1"})
    status = pd.to_numeric(status, errors="coerce")
    df["status"] = status
    df = df.dropna(subset=["status"]).copy()
    df["status"] = df["status"].astype(int)
    return df

# 2. Load or Create Dataset
base_dir = os.path.dirname(__file__)
dataset_path = os.path.join(base_dir, "dataset.csv")
feedback_path = os.path.join(base_dir, "feedback.csv")
embedding_cache_path = os.path.join(base_dir, "embedding_cache.pkl")

# Load embedding cache (used for fast retraining; not included in deployed model features)
embedding_cache = {}
if os.path.exists(embedding_cache_path):
    try:
        embedding_cache = joblib.load(embedding_cache_path)
        print(f"Loaded embedding cache with {len(embedding_cache)} entries.")
    except Exception:
        embedding_cache = {}

if os.path.exists(dataset_path):
    print("Loading dataset.csv...")
    df = _read_dataset(dataset_path)
    df = _normalize_status(df)

    # Remove noisy rows
    if "url" in df.columns:
        df["url"] = df["url"].astype(str)
        df = df.dropna(subset=["url", "status"]).copy()
        df = df.drop_duplicates(subset=["url"]).copy()
    else:
        df = df.dropna(subset=["status"]).copy()
    
    # Use the extractor's structural feature set to avoid train/inference mismatch.
    feature_cols = list(FEATURE_COLUMNS)

    if "url" in df.columns:
        urls = df["url"].fillna("").astype(str).tolist()

        print(f"Generating structural features for {len(urls)} URLs...")
        t0 = time.time()

        X = np.array(
            [get_structural_features(u, feature_cols) for u in urls],
            dtype=np.float32,
        )
        print(f"Structural features ready in {time.time() - t0:.1f}s. Shape={X.shape}")

        # Build embedding cache for future fast retraining (optional, CPU-intensive)
        # Set PHISHGUARD_CACHE_EMBEDDINGS=1 to enable
        if os.getenv("PHISHGUARD_CACHE_EMBEDDINGS", "0").strip() == "1":
            try:
                from features import get_bert_embeddings_batch
                print("Generating DistilBERT embeddings for cache...")
                t1 = time.time()
                get_bert_embeddings_batch(urls, batch_size=64, cache=embedding_cache)
                joblib.dump(embedding_cache, embedding_cache_path)
                print(f"Embedding cache updated ({len(embedding_cache)} entries) in {time.time() - t1:.1f}s.")
            except (Exception, KeyboardInterrupt) as e:
                print(f"Embedding cache step skipped: {e}")
        else:
            print("Embedding cache step skipped (set PHISHGUARD_CACHE_EMBEDDINGS=1 to enable).")
    else:
        raise ValueError("dataset.csv must include a 'url' column")

    y = df["status"].astype(int)
else:
    raise FileNotFoundError("dataset.csv not found in Backend/. Please add dataset.csv and rerun training.")

if not os.path.exists(feedback_path):
    pd.DataFrame(columns=["url", "label", "feedback_type", "comment"]).to_csv(
        feedback_path, index=False
    )

if os.path.exists(feedback_path):
    print("Loading feedback.csv...")
    try:
        fb = pd.read_csv(feedback_path)
    except pd.errors.ParserError:
        fb = pd.read_csv(feedback_path, engine="python", on_bad_lines="skip")

    if len(fb.columns) >= 2 and "url" not in fb.columns:
        fb.columns = ["url", "label"] + list(fb.columns[2:])

    if "url" in fb.columns:
        if "label" not in fb.columns:
            fb["label"] = 1

        fb = fb[["url", "label"]].copy()
        fb = fb.dropna(subset=["url"])
        fb = fb[fb["url"].astype(str).str.startswith("http")]

        fb = fb.rename(columns={"label": "status"})
        fb["status"] = fb["status"].map({"legitimate": 0, "phishing": 1}).fillna(fb["status"])
        fb["status"] = pd.to_numeric(fb["status"], errors="coerce")
        fb = fb.dropna(subset=["status"])
        fb["url"] = fb["url"].astype(str)
        fb = fb.drop_duplicates(subset=["url"]).copy()

        if len(fb) > 0:
            fb_urls = fb["url"].fillna("").astype(str).tolist()
            fb_struct = np.array(
                [get_structural_features(u, feature_cols) for u in fb_urls],
                dtype=np.float32,
            )

            X = np.vstack([X, fb_struct])
            y = pd.concat([y, fb["status"].astype(int)], ignore_index=True)
            print(f"  Merged {len(fb)} feedback rows.")
        else:
            print("  No valid feedback rows found.")
    else:
        print("  feedback.csv missing 'url' column — skipped.")

# 3. Train Model
print("Training models...")
print(f"Feature count: {len(feature_cols)} structural features.")

# Train/test validation
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y if len(pd.unique(y)) > 1 else None,
)

# Train both RF and GBT, pick the best
rf_model = RandomForestClassifier(
    n_estimators=200,
    random_state=42,
    n_jobs=-1,
)
rf_model.fit(X_train, y_train)
rf_pred = rf_model.predict(X_test)
rf_acc = accuracy_score(y_test, rf_pred)

gbt_model = GradientBoostingClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.1,
    random_state=42,
)
gbt_model.fit(X_train, y_train)
gbt_pred = gbt_model.predict(X_test)
gbt_acc = accuracy_score(y_test, gbt_pred)

print(f"  RandomForest accuracy:       {rf_acc:.4f}")
print(f"  GradientBoosting accuracy:   {gbt_acc:.4f}")

if gbt_acc > rf_acc:
    model = gbt_model
    pred = gbt_pred
    print("  -> Selected: GradientBoosting")
else:
    model = rf_model
    pred = rf_pred
    print("  -> Selected: RandomForest")
acc = accuracy_score(y_test, pred)
prec = precision_score(y_test, pred, zero_division=0)
rec = recall_score(y_test, pred, zero_division=0)
f1 = f1_score(y_test, pred, zero_division=0)
print("Validation metrics (test split):")
print(f"  Accuracy : {acc:.4f}")
print(f"  Precision: {prec:.4f}")
print(f"  Recall   : {rec:.4f}")
print(f"  F1-score : {f1:.4f}")

# 4. Save Artifacts
output_dir = os.path.dirname(__file__)
model_tmp = os.path.join(output_dir, "model_temp.pkl")
features_tmp = os.path.join(output_dir, "feature_names_temp.pkl")
model_final = os.path.join(output_dir, "model_v1.pkl")
features_final = os.path.join(output_dir, "feature_names.pkl")

# Save artifacts safely (only replace on success)
joblib.dump(model, model_tmp)
joblib.dump(feature_cols, features_tmp)
os.replace(model_tmp, model_final)
os.replace(features_tmp, features_final)
print(f"Success! Model and features saved to {output_dir}")