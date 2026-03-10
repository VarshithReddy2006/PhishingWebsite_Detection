"""PhishGuard environment bootstrapper.

Creates a local virtual environment (.venv) and installs requirements without
needing PowerShell script activation (avoids ExecutionPolicy issues).

Usage:
  python tools/bootstrap.py            # create .venv + install deps
  python tools/bootstrap.py --train    # then run Backend/train.py
  python tools/bootstrap.py --app      # then run Backend/app.py

Notes:
- Uses the venv's python directly: .venv\Scripts\python.exe (Windows)
- Leaves your shell environment unchanged (activation is optional)
"""

from __future__ import annotations

import os
import subprocess
import sys
import venv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VENV_DIR = ROOT / ".venv"


def venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def run(cmd: list[str], *, env: dict[str, str] | None = None) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.check_call(cmd, cwd=str(ROOT), env=env)


def ensure_venv() -> None:
    if venv_python().exists():
        return

    print(f"Creating virtual environment at {VENV_DIR} ...", flush=True)
    builder = venv.EnvBuilder(with_pip=True)
    builder.create(str(VENV_DIR))


def ensure_deps() -> None:
    py = str(venv_python())
    env = os.environ.copy()
    env.setdefault("TOKENIZERS_PARALLELISM", "false")

    run([py, "-m", "pip", "install", "--upgrade", "pip"], env=env)
    run([py, "-m", "pip", "install", "-r", "requirements.txt"], env=env)


def main() -> int:
    args = set(sys.argv[1:])

    ensure_venv()
    ensure_deps()

    py = str(venv_python())

    if "--train" in args:
        run([py, str(ROOT / "Backend" / "train.py")])

    if "--app" in args:
        run([py, str(ROOT / "Backend" / "app.py")])

    if not args:
        print("\nDone. Next commands (no activation needed):", flush=True)
        if os.name == "nt":
            print(r"  .\.venv\Scripts\python.exe Backend\train.py")
            print(r"  .\.venv\Scripts\python.exe Backend\app.py")
        else:
            print("  ./.venv/bin/python Backend/train.py")
            print("  ./.venv/bin/python Backend/app.py")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
