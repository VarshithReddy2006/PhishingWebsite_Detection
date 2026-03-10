"""Feedback-driven retraining pipeline.

Loads:
- Backend/dataset.csv
- Backend/feedback.csv

Then:
- Normalizes labels to {0,1}
- Removes duplicates
- Merges feedback into dataset
- Triggers Backend/train.py

Usage:
  python Backend/retrain.py
"""

from __future__ import annotations

import os
import runpy
from pathlib import Path

import pandas as pd

from utils import read_csv_robust, normalize_urls, normalize_status_to_int


def _load_dataset(dataset_path: Path) -> pd.DataFrame | None:
    if not dataset_path.exists():
        print("dataset.csv missing; cannot retrain.", flush=True)
        return None

    df = read_csv_robust(dataset_path)

    if "status" not in df.columns and "label" in df.columns:
        df = df.rename(columns={"label": "status"})

    if "url" not in df.columns or "status" not in df.columns:
        print("dataset.csv missing required columns ('url', 'status'); cannot retrain.", flush=True)
        return None

    df = df.copy()
    df["url"] = normalize_urls(df["url"])
    df["status"] = normalize_status_to_int(df["status"])
    df = df.dropna(subset=["url", "status"]).copy()
    df["status"] = df["status"].astype(int)
    df = df.drop_duplicates(subset=["url"], keep="first").copy()
    return df


def _load_feedback(feedback_path: Path) -> pd.DataFrame:
    if not feedback_path.exists():
        return pd.DataFrame(columns=["url", "status"])

    try:
        fb = pd.read_csv(feedback_path)
    except pd.errors.EmptyDataError:
        return pd.DataFrame(columns=["url", "status"])
    except Exception:
        return pd.DataFrame(columns=["url", "status"])

    if fb.empty:
        return pd.DataFrame(columns=["url", "status"])

    if "status" not in fb.columns and "label" in fb.columns:
        fb = fb.rename(columns={"label": "status"})

    # Handle feedback_type column from new format
    if "status" not in fb.columns and "feedback_type" in fb.columns:
        ft_map = {"incorrect_flag": "0", "missed_threat": "1"}
        fb["status"] = fb["feedback_type"].astype(str).str.strip().str.lower().map(ft_map)

    if "url" not in fb.columns or "status" not in fb.columns:
        return pd.DataFrame(columns=["url", "status"])

    fb = fb[["url", "status"]].copy()
    fb["url"] = normalize_urls(fb["url"])
    fb["status"] = normalize_status_to_int(fb["status"])
    fb = fb.dropna(subset=["url", "status"]).copy()
    fb["status"] = fb["status"].astype(int)
    fb = fb.drop_duplicates(subset=["url"], keep="last").copy()
    return fb


def _merge_feedback(dataset_df: pd.DataFrame, feedback_df: pd.DataFrame) -> pd.DataFrame:
    if feedback_df.empty:
        return dataset_df

    dataset_urls = set(dataset_df["url"].astype(str))
    new_fb = feedback_df[~feedback_df["url"].astype(str).isin(dataset_urls)].copy()

    if new_fb.empty:
        return dataset_df

    cols = list(dataset_df.columns)
    aligned = pd.DataFrame({c: pd.NA for c in cols}, index=range(len(new_fb)))
    aligned["url"] = new_fb["url"].values
    aligned["status"] = new_fb["status"].values

    merged = pd.concat([dataset_df, aligned], ignore_index=True)
    merged = merged.drop_duplicates(subset=["url"], keep="first").copy()
    return merged


def _run_training(backend_dir: Path) -> None:
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

    train_path = backend_dir / "train.py"
    if not train_path.exists():
        print("Backend/train.py missing; cannot retrain.", flush=True)
        return

    runpy.run_path(str(train_path), run_name="__main__")


def main() -> None:
    backend_dir = Path(__file__).resolve().parent
    dataset_path = backend_dir / "dataset.csv"
    feedback_path = backend_dir / "feedback.csv"

    try:
        dataset_df = _load_dataset(dataset_path)
        if dataset_df is None:
            return

        feedback_df = _load_feedback(feedback_path)
        merged_df = _merge_feedback(dataset_df, feedback_df)

        merged_df = merged_df.drop_duplicates(subset=["url"], keep="first").copy()
        merged_df.to_csv(dataset_path, index=False)

        _run_training(backend_dir)
    except Exception as exc:
        print(f"retrain.py error: {exc}", flush=True)


if __name__ == "__main__":
    main()
