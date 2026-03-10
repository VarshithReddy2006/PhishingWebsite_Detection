# Phishing Website Detection

Clean architecture:
- Backend/: Flask API + ML (DistilBERT embeddings + RandomForest)
- WebUI/: Static web interface (served by the backend at /)
- Extension/: Chrome extension (MV3)

## Run (Windows / PowerShell)

### 0) Create a virtual environment (.venv)

From the project root:

```powershell
python -m venv .venv
```

Or run the all-in-one setup script (works even if activation is blocked):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Run the backend (auto-trains if the model is missing):

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

Simplest method (double-click or run once):

```powershell
.\start_backend.cmd
```

### 1) Activate the virtual environment

From the project root:

```powershell
# If activation is blocked, run this once per terminal session:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

./.venv/Scripts/Activate.ps1
```

Confirm you're using the venv Python (path should include `.venv`):

```powershell
python -c "import sys; print(sys.executable)"
```

### 1.5) Install dependencies

```powershell
pip install -r requirements.txt
```

If PowerShell blocks activation scripts on your machine, you can skip activation entirely and use the venv Python directly:

```powershell
python -m venv .venv
./.venv/Scripts/python.exe -m pip install --upgrade pip
./.venv/Scripts/python.exe -m pip install -r requirements.txt
./.venv/Scripts/python.exe Backend/train.py
./.venv/Scripts/python.exe Backend/app.py
```

Optional (activation fix for the current PowerShell session only):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
./.venv/Scripts/Activate.ps1
```

### 2) Train the model

```powershell
python Backend/train.py
```

### 3) Start the backend API

```powershell
python Backend/app.py
```

Server runs at `http://127.0.0.1:5000`.

### 4) Retrain from feedback (optional)

```powershell
python Backend/retrain.py
```

### Chrome extension

- In Chrome: `chrome://extensions` → enable Developer mode
- Load unpacked → select the `Extension/` folder

## Key Features
- Machine learning-based phishing detection to classify URLs as phishing or legitimate
- Real-time URL scanning from the web UI and Chrome extension
- Flask API integration with endpoints like /predict to connect UI and model
- Chrome extension support for active tab analysis and result display
- Web interface for manual URL checks through a browser page
- Confidence score output with each prediction
- Feature extraction module that converts URLs to numerical data
- Feedback system for continuous improvement via /feedback
- Modular architecture separating frontend, backend, and ML components

## Feedback System (Continuous Improvement)
- Users report incorrect predictions
- Feedback is sent to the backend via /feedback
- URLs are stored for retraining
- Model accuracy improves over time

PhishGuard AI integrates transformer-based semantic embeddings from DistilBERT with handcrafted structural URL features. The hybrid architecture improves phishing detection robustness while preserving real-time performance for browser extension deployment.
