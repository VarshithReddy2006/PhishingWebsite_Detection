"""Shared utilities for PhishGuard backend scripts.

Functions here are used by app.py, train.py, and retrain.py to avoid
code duplication.  Module-level imports are stdlib-only so that
``relaunch_in_venv_if_needed`` and ``ensure_dependencies`` can run
before any pip-installed packages are available.
"""

from __future__ import annotations

import importlib
import subprocess
import sys
from pathlib import Path


def relaunch_in_venv_if_needed() -> None:
    """If running with the system Python, re-exec with .venv Python automatically."""
    venv_py = Path(__file__).resolve().parents[1] / ".venv" / "Scripts" / "python.exe"
    current = Path(sys.executable).resolve()

    if current == venv_py.resolve():
        return  # already in venv

    if not venv_py.exists():
        return  # no venv to relaunch into; fall through to dep check

    print(f"[PhishGuard] Auto-switching to venv Python: {venv_py}")
    result = subprocess.run([str(venv_py)] + sys.argv)
    raise SystemExit(result.returncode)


def ensure_dependencies(required: list[tuple[str, str]], script_name: str) -> None:
    """Fail fast with a clear message when required deps are missing."""
    missing: list[str] = []
    failures: list[str] = []
    for module_name, pip_name in required:
        try:
            importlib.import_module(module_name)
        except ImportError:
            missing.append(pip_name)
        except Exception as exc:
            failures.append(f"- {pip_name} (import failed: {type(exc).__name__}: {exc})")

    if missing or failures:
        root_dir = Path(__file__).resolve().parents[1]
        expected_venv_py = root_dir / ".venv" / "Scripts" / "python.exe"
        missing_list = "\n".join(f"- {name}" for name in missing)
        failures_list = "\n".join(failures)
        details = "\n".join([s for s in [missing_list, failures_list] if s]).strip()
        raise RuntimeError(
            "Missing required Python dependencies:\n"
            f"{details}\n\n"
            f"You are running: {sys.executable}\n\n"
            "Fix:\n"
            "1) Create a virtual environment:  python -m venv .venv\n"
            "2) Install deps into the venv (no activation needed):\n"
            "   .\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt\n"
            "3) Run script using the venv Python:\n"
            f"   .\\.venv\\Scripts\\python.exe {script_name}\n"
            f"\nExpected venv python path: {expected_venv_py}\n"
        )


def read_csv_robust(path: Path):
    """Load CSV with best-effort delimiter detection and error handling."""
    import pandas as pd

    try:
        df = pd.read_csv(path, sep=None, engine="python")
    except Exception:
        df = pd.read_csv(path, sep=None, engine="python", on_bad_lines="skip")

    if len(df.columns) == 1 and "\t" in str(df.columns[0]):
        df = pd.read_csv(path, sep="\t", engine="python", on_bad_lines="skip")
    return df


def normalize_urls(series):
    """Normalize URL series for consistent processing."""
    import pandas as pd

    s = series.astype(str).str.strip()
    s = s.replace({"": pd.NA, "nan": pd.NA, "None": pd.NA})
    return s


def normalize_status_to_int(series):
    """Normalize status/label column to integer {0,1}."""
    import pandas as pd

    s = series.copy()

    if s.dtype == bool:
        s = s.astype(int)

    s = s.astype(str).str.strip().str.lower()
    s = s.replace({
        "legitimate": "0", "phishing": "1",
        "false": "0", "true": "1",
    })

    numeric = pd.to_numeric(s, errors="coerce")
    numeric = numeric.where(numeric.isin([0, 1]), other=pd.NA)
    return numeric.astype("Int64")
