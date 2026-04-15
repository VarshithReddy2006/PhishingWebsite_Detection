# PhishGuard AI — ML-Powered Phishing Website Detection

Browser extension and web interface for real-time phishing detection using ensemble ML classifiers and 58 structural URL features.

---

## 🌟 Features

- **58 Structural Features** — URL length, entropy, TLD risk, character ratios, path depth
- **Ensemble Classifiers** — Random Forest + Gradient Boosting
- **Real-Time Scanning** — Web UI and Chrome extension (Manifest V3)
- **Feedback-Driven Learning** — User corrections improve model accuracy
- **Auto-Retraining** — Model updates from user feedback

---

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
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
