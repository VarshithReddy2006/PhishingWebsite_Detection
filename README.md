# PhishGuard AI — ML-Powered Phishing Website Detection

Advanced phishing website detection system combining DistilBERT embeddings with ensemble ML classifiers, featuring a modern web interface and a real-time Chrome extension.

---

## 🌟 Features

### 🧠 Multi-Layer Detection Engine

- **DistilBERT Embeddings**: Transformer-based URL representation for semantic analysis
- **Ensemble ML Classifiers**: RandomForest + GradientBoosting for robust predictions
- **60+ Structural Features**: URL length, entropy, TLD risk scoring, digit-letter ratios, path depth, and more
- **Domain Reputation Analysis**: High-risk TLD detection, shortener identification, punycode checks
- **Phishing Keyword Detection**: Pattern matching against known phishing vocabulary
- **Feedback-Driven Learning**: User corrections retrain the model for continuous improvement

### 🔍 Intelligent Analysis

- **Real-Time URL Scanning**: Instant classification as Legitimate, Phishing, or Suspicious
- **Confidence Scoring**: Probability-based authenticity scoring with low-confidence safety rules
- **Prediction Caching**: O(1) lookups for previously scanned URLs
- **Feedback Override Cache**: Community-corrected predictions with automatic cache refresh

### 🎨 Modern Web Interface

- **Sleek Dashboard**: Animated hero section with real-time URL scanning
- **Live Results**: Instant phishing/legitimate verdict with confidence percentage
- **Feedback System**: Users can report false positives/negatives to improve the model
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Font Awesome Icons**: Professional iconography throughout the UI

### 🧩 Chrome Extension (Manifest V3)

- **Automatic Scanning**: Every page you visit is silently checked in the background
- **Real-Time Alerts**: Instant popup warnings for detected phishing sites
- **One-Click Feedback**: Report incorrect detections directly from the browser
- **Lightweight**: Minimal resource usage with service worker architecture

### 🔧 Technical Excellence

- **Flask Backend**: RESTful API with comprehensive error handling and CORS support
- **Modular Architecture**: Separate feature extraction, training, and inference modules
- **Auto-Training**: Model trains automatically on first launch if not present
- **Production Logging**: Enterprise-level logging with configurable verbosity
- **Cross-Platform**: Compatible with Windows, macOS, and Linux

---

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- Google Chrome (for the extension)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/VarshithReddy2006/PhishingWebsite_Detection.git
cd PhishingWebsite_Detection
```

**2. Set up the environment**

```powershell
# One-command setup (creates venv + installs dependencies)
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Or manually:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**3. Train the model**

```powershell
python Backend/train.py
```

**4. Start the server**

```powershell
python Backend/app.py
```

Or use the one-click launcher (auto-trains if model is missing):

```powershell
.\start_backend.cmd
```

**5. Access the application**

Open your browser and navigate to **http://127.0.0.1:5000**

### Chrome Extension Setup

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `Extension/` folder
4. The extension will automatically scan every website you visit

---

## 📁 Project Structure

```
PhishingWebsite_Detection/
├── Backend/
│   ├── app.py                 # Flask API server & route handlers
│   ├── features.py            # 60+ URL feature extraction engine
│   ├── train.py               # Model training pipeline (DistilBERT + RF)
│   ├── retrain.py             # Feedback-based model retraining
│   ├── utils.py               # Venv management & dependency helpers
│   ├── dataset.csv            # Training dataset (~5MB)
│   └── feedback.csv           # User-submitted corrections
├── WebUI/
│   ├── index.html             # Main scanning dashboard
│   ├── feedback.html          # Feedback submission page
│   ├── styles.css             # UI styling (dark theme)
│   ├── app.js                 # Main page logic
│   ├── feedback.js            # Feedback page logic
│   └── shared.js              # Shared utilities
├── Extension/
│   ├── manifest.json          # Chrome extension manifest (MV3)
│   ├── background.js          # Service worker for auto-scanning
│   ├── content.js             # Content script injected into pages
│   ├── popup.html             # Extension popup UI
│   └── popup.js               # Popup logic
├── tools/
│   └── bootstrap.py           # Project bootstrapping utilities
├── requirements.txt           # Python dependencies
├── setup.ps1                  # One-command environment setup
├── run.ps1                    # One-command server launcher
└── start_backend.cmd          # Double-click launcher (Windows)
```

---

## 🔧 API Documentation

### `POST /predict`

Analyzes a URL for phishing indicators.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "url": "https://example.com",
  "status_code": 0,
  "result": "Legitimate",
  "confidence": 0.97
}
```

| Field         | Description                                      |
|---------------|--------------------------------------------------|
| `status_code` | `0` = Legitimate, `1` = Phishing/Suspicious      |
| `result`      | `"Legitimate"`, `"Phishing"`, or `"Suspicious"`  |
| `confidence`  | Model confidence (0.0 – 1.0)                     |

### `POST /feedback`

Submit a correction for a URL prediction.

**Request:**
```json
{
  "url": "https://example.com",
  "feedback_type": "incorrect_flag",
  "original_prediction": "Phishing",
  "comment": "This is a safe site"
}
```

### `POST /features`

Returns the extracted feature vector for a URL.

### `GET /health`

Health check endpoint. Returns `{"status": "running"}`.

### `GET /download/feedback`

Download the feedback CSV file.

### `GET /download/dataset`

Download the training dataset CSV file.

---

## 🧪 Testing

**Start the backend server:**

```powershell
python Backend/app.py
```

**Test a URL prediction:**

```powershell
curl -X POST http://127.0.0.1:5000/predict -H "Content-Type: application/json" -d '{"url": "https://google.com"}'
```

**Retrain from feedback:**

```powershell
python Backend/retrain.py
```

---

## 📊 Detection Features

The model analyzes **60+ structural features** from each URL, including:

| Category                | Features                                                        |
|-------------------------|-----------------------------------------------------------------|
| **URL Structure**       | Length, dot count, hyphen count, slash count, path depth         |
| **Domain Analysis**     | Hostname length, subdomain count, entropy score, TLD risk       |
| **Character Ratios**    | Digit-to-letter ratio, special character frequency              |
| **Security Signals**    | HTTPS token presence, IP address usage, punycode detection      |
| **Suspicious Patterns** | Phishing keywords, URL shorteners, abnormal subdomains          |
| **Word Analysis**       | Shortest/longest/average word length in host and path           |

---

## 🛠️ Development

### Adding New Features

1. Add the feature name to `FEATURE_COLUMNS` in [Backend/features.py](Backend/features.py)
2. Implement the extraction logic in `get_structural_features()`
3. Retrain the model: `python Backend/train.py`

### Retraining the Model

The model can be retrained with user feedback to improve accuracy over time:

```powershell
python Backend/retrain.py
```

---

## 🔒 Security Features

- **Input Validation**: URL and JSON payload validation on all endpoints
- **CORS Configuration**: Configurable cross-origin resource sharing
- **Error Handling**: Graceful error handling with sanitized error messages
- **Safe File Processing**: Robust CSV parsing with bad-line skipping
- **Low-Confidence Safety**: URLs with low model confidence are flagged as Suspicious

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Hugging Face Transformers** for DistilBERT embeddings
- **scikit-learn** for ensemble ML classifiers
- **Flask** for the robust backend framework
- **Font Awesome** for the icon library

---

## 📞 Support

For support, email **varshithreddy6147@gmail.com**

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
