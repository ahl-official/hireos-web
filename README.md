# 🧠 HireOS — AI-Powered Recruitment Platform

> A full-stack recruitment automation platform that uses AI to generate personalized technical assessments from candidate CVs, with built-in anti-cheating and automated AI grading.

---

## ✨ Features

### For HR
- 📄 **CV Upload & AI Parsing** — Upload any candidate's PDF resume and extract text automatically
- 🤖 **AI Question Generation** — GPT-4o-mini analyzes the CV and generates 5 personalized technical questions
- 📤 **One-Click WhatsApp Sharing** — Pre-filled professional WhatsApp message with instructions sent directly to the candidate
- 📊 **Results Dashboard** — View all candidates, their status, AI scores, and integrity reports
- 🔍 **Candidate Detail Panel** — Click any candidate to see all questions, expected answers, candidate's answers, score, and cheating flags

### For Candidates
- 📱 **Mobile-First Test Page** — Fully responsive test environment accessible via WhatsApp link
- 🔒 **Anti-Cheating System** — Tab switching detection, disabled right-click, copy, paste, and cut
- ⚠️ **Live Cheating Warning** — Real-time red banner tracking tab switch count, recorded for HR
- 🎯 **AI Auto-Grading** — Answers are graded by AI after submission and score is saved instantly

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| PDF Parsing | pdfjs-dist |
| AI | OpenRouter API (GPT-4o-mini) |
| Backend / Database | Google Apps Script + Google Sheets |
| HTTP Client | Axios |
| Routing | React Router DOM |

---

## 📁 Project Structure

```
HR_test/
├── public/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx      # HR Dashboard (Generate + Results tabs)
│   │   └── TestPage.jsx       # Candidate Assessment Page
│   ├── utils/
│   │   ├── pdfParser.js       # PDF text extraction using pdfjs-dist
│   │   ├── openai.js          # OpenRouter API calls (generate & grade)
│   │   └── googleSheets.js    # Apps Script API calls
│   ├── App.jsx                # Router setup
│   ├── main.jsx               # App entry point
│   └── index.css              # Tailwind CSS imports
├── Code.gs                    # Google Apps Script backend code
├── .env.example               # Template for environment variables
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher) — [Download here](https://nodejs.org)
- A Google account (for Google Sheets + Apps Script)
- An [OpenRouter](https://openrouter.ai) API key

---

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/hireos.git
cd hireos
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
```bash
# Copy the example file
copy .env.example .env
```
Open the `.env` file and fill in your values:
```env
VITE_OPENAI_API_KEY=your_openrouter_api_key_here
VITE_GOOGLE_APP_SCRIPT_URL=your_apps_script_url_here
```

### 4. Set Up Google Apps Script (Backend)

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet named **"HR Candidates"**
2. Click **Extensions → Apps Script**
3. Delete all default code and paste the entire contents of `Code.gs` from this repository
4. Click **Save**, then **Deploy → New Deployment**
5. Set type to **Web App**
6. Set **Execute as**: `Me`
7. Set **Who has access**: `Anyone`
8. Click **Deploy** and copy the Web App URL
9. Paste that URL as your `VITE_GOOGLE_APP_SCRIPT_URL` in `.env`

### 5. Run the App
```bash
npm run dev
```
Open your browser at **`http://localhost:5173`**

---

## 🔄 How It Works

```
HR uploads CV (PDF)
        ↓
pdfjs-dist extracts text
        ↓
OpenRouter AI generates 5 questions + correct answers
        ↓
Data saved to Google Sheets via Apps Script
        ↓
HR gets a unique test link → Shares via WhatsApp
        ↓
Candidate opens link on mobile, completes test
(tab switches tracked, copy-paste blocked)
        ↓
Candidate submits → AI grades answers (0–100%)
        ↓
Score + answers saved to Google Sheets
        ↓
HR views full report in the Results Dashboard
```

---

## 📸 Pages Overview

### HR Dashboard — Generate Tab
- Candidate name + 10-digit mobile (auto-prefixed with +91)
- Optional email field
- CV PDF uploader
- Multi-step loading states (Extracting → AI Generating → Saving)
- Success screen with Copy Link + WhatsApp Share button

### HR Dashboard — Results Tab
- Stats cards (Total, Completed, Pending, Avg Score)
- Candidate table with status badges and score bars
- Click any row to open the **full candidate report panel**

### Candidate Test Page
- Rules instructions displayed before questions
- 5 AI-generated questions with text area answers
- Live tab-switch warning banner
- AI grading on submit

---

## ⚠️ Security Notes

- **API Key Exposure**: The OpenRouter API key is used client-side (in the browser). This is acceptable for internal/trusted HR use. For a public deployment, consider moving API calls to a backend server (e.g. Express.js or Next.js API routes).
- **Never commit `.env`** — it is listed in `.gitignore` and will never be pushed to GitHub.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)

---

<p align="center">Built with ❤️ using React, Tailwind CSS, and OpenRouter AI</p>
