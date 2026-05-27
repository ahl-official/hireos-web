# American Hairline — Candidate Application Portal

A fully-featured candidate application form connected to Google Sheets, built for Vercel deployment.

## Features
- 5-step application form with validation
- Photo upload with auto-compression
- Resume/CV upload
- Automatic Google Sheets logging (sheet: "Candidate Applications")
- Demo data pre-loaded on first run
- Branded with American Hairline theme

---

## Project Structure

```
american-hairline-candidate/
├── api/
│   ├── save-application.js   ← POST endpoint (saves to Google Sheets)
│   └── health.js             ← GET /api/health (status check)
├── public/
│   └── index.html            ← Main application UI
├── .env.example              ← Environment variable template
├── vercel.json               ← Vercel routing config
└── package.json
```

---

## Vercel Deployment

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_ORG/ah-candidate-portal.git
git push -u origin main
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Framework: **Other**

### 3. Set Environment Variables in Vercel Dashboard

Go to **Project → Settings → Environment Variables** and add:

| Key | Value |
|-----|-------|
| `GOOGLE_SHEET_ID` | `1DMZetX7yfPUGMJYjRCLVydxcfw-DwWnT1WxxKmRgyCI` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `hair-app-service@python-477811.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | *(Paste your full private key — Vercel handles newlines automatically)* |

> **Important for GOOGLE_PRIVATE_KEY**: In the Vercel UI, paste the key exactly as-is (with real newlines). Vercel will handle the encoding. Do NOT add `\n` manually.

### 4. Deploy
Vercel will auto-deploy on push. Or trigger manually from the dashboard.

---

## Google Sheets Setup

1. Open your sheet: https://docs.google.com/spreadsheets/d/1DMZetX7yfPUGMJYjRCLVydxcfw-DwWnT1WxxKmRgyCI
2. Share the sheet with the service account email:
   `hair-app-service@python-477811.iam.gserviceaccount.com` — give **Editor** access
3. On first form submission, the API will:
   - Auto-create a sheet named **"Candidate Applications"**
   - Add formatted headers (blue background)
   - Insert 3 demo rows of sample data
   - Freeze the header row

---

## Local Development

```bash
npm install
# Create .env from .env.example and fill in values
node server.js   # or use: npx vercel dev
```

Then open http://localhost:3000

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/save-application` | Save candidate to Google Sheets |

### POST /api/save-application

**Request body (JSON):**
```json
{
  "fullName": "Rahul Sharma",
  "whatsapp": "9876543210",
  "email": "rahul@email.com",
  "city": "Mumbai",
  "positionApplied": "Hair Consultant",
  "experience": "2-3 years",
  "expectedSalary": "₹45,000",
  "images": [{ "data": "data:image/jpeg;base64,...", "viewType": "Professional Photo" }]
}
```

**Response:**
```json
{ "success": true, "message": "Application submitted successfully", "applicantName": "Rahul Sharma" }
```

---

## Google Sheet Columns

The sheet captures 43 fields including:
- Timestamp, Personal Info, Contact Details
- Position Applied, Experience, Education, CTC details
- Hair industry knowledge & preferences
- Interview preferences, Why join, Achievements
- Photo count, Photo views, Status, Assigned To, Follow Up Date

---

## Support
WhatsApp: +91 93249 99527
