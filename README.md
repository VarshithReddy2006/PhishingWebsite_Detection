# 🛡️ PhishGuard AI — Real-Time Phishing Website Detection System
![Python](https://img.shields.io/badge/Python-3.10+-blue)
![ML](https://img.shields.io/badge/Model-GradientBoosting-green)

An end-to-end phishing detection system for cybersecurity applications analyzes URLs using **58 engineered features** and **ensemble machine learning models** to classify websites as **Legitimate, Suspicious, or Phishing** in real time.

> Designed with a focus on **accuracy, speed, and real-world usability** through a Web UI and Chrome Extension.

> 🚀 Achieves **~90% accuracy** using lightweight feature-based ML without relying on external blacklists.

---

## ❗ Problem Statement

Phishing attacks remain one of the most common cybersecurity threats, often deceiving users through visually similar but malicious websites.

Traditional detection methods rely on blacklists, which fail to detect newly created phishing URLs.

PhishGuard addresses this by:
- Analyzing URL structure instead of relying on external databases
- Detecting patterns commonly used in phishing attacks
- Providing fast and accurate real-time predictions

---

## 🌟 Features

- **58 Engineered URL Features** — URL length, entropy, TLD risk, character ratios, path depth
- **Real-Time URL Scanning** — Web UI and Chrome extension (Manifest V3)
- **Feedback-Driven Learning** — User corrections improve model accuracy
- **Auto-Retraining** — Model updates from user feedback

---

## 🧰 Tech Stack

- Python (Flask backend)
- scikit-learn (ML models)
- NumPy, Pandas
- JavaScript (Web UI + Extension)
- Chrome Extension (Manifest V3)

---

## 📈 Model Performance

- Accuracy: ~90.8%
- Precision: ~90.7%
- Recall: ~90.9%
- F1 Score: ~90.8%

> Gradient Boosting was selected as the final model based on validation performance.

---

## ⚙️ How It Works

1. User submits a URL
2. System extracts 58 structural features
3. Features are passed to trained ML model
4. Model predicts:
   - Legitimate
   - Suspicious
   - Phishing
5. User feedback is stored and used for retraining

---

## 🎯 Use Cases

- Detect phishing websites in real time
- Enhance browser security with lightweight ML
- Educational project for cybersecurity and ML
- Base system for deploying security tools

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Google Chrome (for extension)

### Installation

```bash
git clone https://github.com/VarshithReddy2006/PhishingWebsite_Detection.git
cd PhishingWebsite_Detection
```

**Setup environment:**

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
# Or manually:
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Train and run:**

```powershell
python Backend/train.py
python Backend/app.py
```

Access at **http://127.0.0.1:5000**

### Chrome Extension

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `Extension/`

---

## 📁 Project Structure

```
PhishingWebsite_Detection/
├── Backend/
│   ├── app.py           # Flask API server
│   ├── features.py      # 58-feature extraction
│   ├── train.py         # Model training
│   ├── retrain.py       # Feedback-based retraining
│   ├── utils.py         # Environment helpers
│   ├── dataset.csv      # Training data
│   └── feedback.csv     # User corrections
├── WebUI/
│   ├── index.html       # Dashboard
│   ├── feedback.html    # Feedback page
│   ├── styles.css       # Dark theme
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

---

## 🔧 API Endpoints

| Method | Endpoint           | Description                    |
|--------|--------------------|--------------------------------|
| POST   | `/predict`         | Analyze URL for phishing       |
| POST   | `/feedback`        | Submit prediction correction   |
| POST   | `/features`        | Get 58-feature vector          |
| GET    | `/health`          | Health check                   |
| GET    | `/download/feedback` | Download feedback CSV        |
| GET    | `/download/dataset`  | Download training dataset    |

### Example: `/predict`

**Request:**
```json
{ "url": "https://example.com" }
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

---

## 📊 Detection Features

| Category            | Features                                          |
|---------------------|---------------------------------------------------|
| URL Structure       | Length, dot/hyphen/slash count, path depth        |
| Domain Analysis     | Hostname length, subdomain count, entropy, TLD risk |
| Character Ratios    | Digit-to-letter ratio, special character frequency |
| Security Signals    | HTTPS token, IP usage, punycode detection         |
| Suspicious Patterns | Phishing keywords, shorteners, abnormal subdomains |
| Word Analysis       | Min/max/avg word length in host and path          |

---

## 🧪 Testing

```powershell
# Start backend
python Backend/app.py

# Test URL
curl -X POST http://127.0.0.1:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'

# Retrain from feedback
python Backend/retrain.py
```

---

## 🛠️ Development

**Add new features:**

1. Add feature name to `FEATURE_COLUMNS` in `Backend/features.py`
2. Implement extraction in `get_structural_features()`
3. Retrain: `python Backend/train.py`

**Retrain model:**

```powershell
python Backend/retrain.py
```

---

## 🔒 Security

- Input validation on all endpoints
- CORS configuration
- Sanitized error messages
- Robust CSV parsing
- Low-confidence predictions flagged as Suspicious

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add YourFeature'`)
4. Push (`git push origin feature/YourFeature`)
5. Open Pull Request

---

## 📄 License

MIT License

---

## 🙏 Acknowledgments

- **Hugging Face Transformers** — DistilBERT
- **scikit-learn** — ML classifiers
- **Flask** — Backend framework
- **Font Awesome** — Icons

---

## 📞 Support

varshithreddy6147@gmail.com
