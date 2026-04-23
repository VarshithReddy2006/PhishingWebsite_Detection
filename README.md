# PhishGuard AI — Real-Time Phishing Website Detection System

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![ML](https://img.shields.io/badge/Model-GradientBoosting-green)

## Short Summary

Real-time phishing URL detection using **57 engineered features** and **Gradient Boosting** (scikit-learn).<br>
Deployable system: **Web UI + Flask backend + Chrome Extension (Manifest V3)**.<br>
Designed for **zero-day phishing URL detection** with a **local-first architecture** (no blacklist dependency; no external ML inference APIs).

## Overview

PhishGuard AI classifies URLs as **Legitimate**, **Suspicious**, or **Phishing** by extracting a fixed feature vector from URL structure and running inference with a scikit-learn Gradient Boosting model.

For safety, the system can return **Suspicious** when a URL is predicted **Legitimate** with low confidence.

The system is intended for real-world usage: fast predictions, consistent feature extraction, and a local-first deployment model.

## Problem Statement

Phishing attacks remain one of the most common cybersecurity threats, frequently abusing lookalike domains and deceptive URL patterns.

Blacklist-driven approaches can lag behind newly created or previously unseen phishing URLs.

PhishGuard AI focuses on:
- URL structure analysis instead of external databases
- Pattern-based detection to support **zero-day phishing URL detection**
- Real-time predictions integrated into the browser workflow

## Key Capabilities

- Extracts **57 engineered URL features** deterministically for every prediction
- Produces real-time classifications: **Legitimate / Suspicious / Phishing**
- Runs without external ML inference APIs (local-first deployment)
- Flags low-confidence outcomes as **Suspicious** to reduce risk
- Captures user feedback and supports retraining from corrections
- Ships with both a Web UI and a Chrome Extension (Manifest V3)

## What Makes It Different

- **Zero-day oriented:** targets URL-based phishing patterns rather than known-url lists
- **Local-first by design:** prediction does not require third-party services or external ML endpoints
- **Operationally simple:** feature extraction + Gradient Boosting inference for low-latency classification

## System Architecture

```text
┌──────────────┐     HTTP      ┌─────────────────┐
│  Web UI      │ ───────────▶  │ Flask Backend    │
│  (WebUI/)    │               │ (Backend/app.py) │
└──────────────┘               └────────┬─────────┘
                                        │
                                        │ feature extraction (57)
                                        │ + model inference
                                        ▼
                               ┌─────────────────┐
                               │ scikit-learn     │
                               │ Gradient Boosting│
                               └─────────────────┘

┌───────────────────────────────┐
│ Chrome Extension (Manifest V3) │
│ (Extension/)                   │
└───────────────┬───────────────┘
                │
                └── sends URL to backend for prediction
```

## Workflow

1. A URL is submitted (Web UI or Chrome Extension).
2. The backend extracts 57 structural features from the URL.
3. The model runs inference and returns a classification with confidence.
   - Low-confidence **Legitimate** outcomes may be returned as **Suspicious**.
4. Optional: the user submits feedback if the prediction is incorrect.
5. Feedback can be used to retrain the model.

## Use Cases

- Detect phishing websites in real time
- Improve browser safety with a local-first, model-based URL analyzer
- Support security education and ML prototyping for URL-based threat detection
- Provide a baseline system for deploying URL-focused security tooling

## Model Performance

| Metric | Value |
|--------|-------|
| Accuracy | 96.4% |
| Precision | 95.8% |
| Recall | 97.1% |
| F1 Score | 96.3% |
| AUC-ROC | 0.993 |
| False Positive Rate | 4.4% |

Gradient Boosting was selected as the final model based on validation performance.

## Tech Stack

- Python (Flask backend)
- scikit-learn (Gradient Boosting)
- NumPy, Pandas
- JavaScript (Web UI + Extension)
- Chrome Extension (Manifest V3)

## Quick Start

### Prerequisites

- Python 3.10+
- Google Chrome (for the extension)

### Installation

```bash
git clone https://github.com/VarshithReddy2006/PhishingWebsite_Detection.git
cd PhishingWebsite_Detection
```

### Setup

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

### Train and Run

```powershell
python Backend/train.py
python Backend/app.py
```

Access the Web UI at **http://127.0.0.1:5000**

## Chrome Extension Setup

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Select **Load unpacked** and choose `Extension/`

## Project Structure

```text
PhishingWebsite_Detection/
├── Backend/
│   ├── app.py           # Flask API server
│   ├── features.py      # 57-feature extraction
│   ├── train.py         # Model training
│   ├── retrain.py       # Feedback-based retraining
│   ├── utils.py         # Environment helpers
│   ├── dataset.csv      # Training data
│   └── feedback.csv     # User corrections
├── WebUI/
│   ├── index.html       # Dashboard
│   ├── feedback.html    # Feedback page
│   ├── styles.css       # UI styling
│   ├── app.js           # Dashboard logic
│   ├── feedback.js      # Feedback logic
│   └── shared.js        # Utilities
├── Extension/
│   ├── manifest.json    # Manifest V3
│   ├── background.js    # Service worker
│   ├── content.js       # Content script
│   ├── popup.html       # Popup UI
│   ├── popup.js         # Popup logic
│   └── shared.js        # Shared utilities
├── tools/
│   └── bootstrap.py
├── requirements.txt
├── setup.ps1
├── run.ps1
└── start_backend.cmd
```

## API Endpoints

| Method | Endpoint             | Description                  |
|--------|----------------------|------------------------------|
| POST   | `/predict`           | Analyze URL for phishing     |
| POST   | `/feedback`          | Submit prediction correction |
| POST   | `/features`          | Get 57-feature vector        |
| GET    | `/health`            | Health check                 |
| GET    | `/download/feedback` | Download feedback CSV        |
| GET    | `/download/dataset`  | Download training dataset    |

### Example: `/predict`

**Request**

```json
{ "url": "https://example.com" }
```

**Response**

```json
{
  "url": "https://example.com",
  "status_code": 0,
  "result": "Legitimate",
  "confidence": 0.97
}
```

## Feature Categories

- **URL structure:** length, dot/hyphen/slash counts, path depth
- **Domain analysis:** hostname length, subdomain count, entropy, TLD risk
- **Character ratios:** digit-to-letter ratio, special character frequency
- **Security signals:** HTTPS token, IP usage, punycode detection
- **Suspicious patterns:** phishing keywords, shorteners, abnormal subdomains
- **Word statistics:** min/max/avg word length in host and path

## Privacy & Deployment

- **Local-first architecture:** the system is designed to run locally without external ML inference APIs.
- **No blacklist dependency:** predictions are derived from feature extraction and model inference.
- **Feedback storage:** user corrections are stored locally (e.g., `Backend/feedback.csv`) for retraining workflows.

## Limitations

- URL-only signals: the model operates on engineered URL features and does not analyze page content.
- Dataset and feature bias: performance depends on how representative training data is of current threats.
- Adversarial adaptation: attackers may change URL patterns to evade heuristic and feature-based detection.

## Future Work

- Improve monitoring and evaluation over time as threat patterns evolve
- Expand feature engineering and retraining workflows based on user feedback
- Enhance decision thresholds and confidence handling for high-risk classifications

## Testing

```powershell
# Start backend
python Backend/app.py

# Test URL
$body = @{ url = "https://google.com" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5000/predict" -ContentType "application/json" -Body $body

# Retrain from feedback
python Backend/retrain.py
```

## Development

**Add new features**

1. Add the feature name to `FEATURE_COLUMNS` in `Backend/features.py`
2. Implement extraction in `get_structural_features()`
3. Retrain: `python Backend/train.py`

**Retrain model**

```powershell
python Backend/retrain.py
```

## Security

- Input validation on all endpoints
- CORS configuration
- Sanitized error messages
- Robust CSV parsing
- Low-confidence predictions flagged as Suspicious

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add YourFeature'`)
4. Push (`git push origin feature/YourFeature`)
5. Open a Pull Request

## License

MIT License

## Acknowledgments

- scikit-learn — ML classifiers
- Flask — Backend framework
- Font Awesome — Icons

## Support / Contact

varshithreddy6147@gmail.com
bodakarthiknetha@gmail.com
