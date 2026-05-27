const { google } = require('googleapis');
const { Readable } = require('stream');

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1DMZetX7yfPUGMJYjRCLVydxcfw-DwWnT1WxxKmRgyCI';
const SHEET_NAME = 'Candidate Applications';
const SHARED_DRIVE_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '0AAxGZGK-JKxZUk9PVA'; // Shared Drive root ID

const WAHA_BASE = 'https://waha.amankhan.space';
const WAHA_SESSION = 'processC';
const HR_NUMBER = '918433838505';

// Column headers — order MUST match the row built in the handler below.
const HEADERS = [
  'Timestamp', 'Full Name', 'WhatsApp', 'Email', 'Gender', 'City', 'Area',
  'Date of Birth', 'Source', 'Staying At', 'Living Arrangement',
  'Position Applied For', 'Employment Status', 'Current Role / Responsibilities',
  'Reason For Change', 'Left Last Job (Date)', 'Reason For Leaving', 'Reason For Leaving (Detail)',
  'Experience', 'Education', 'Current Company', 'Current Designation',
  'Current Salary', 'Expected Salary', 'Salary Jump Justification', 'Notice Period', 'Availability',
  'Work History Summary', 'Skills', 'Languages', 'LinkedIn URL', 'Portfolio URL', 'References',
  'Top 3 Strengths', 'Best Strength', 'Strength Proof / Example',
  'Handling Pressure', 'Sales Objection Reply', 'Sales Persistence Reply',
  'Long-Term Intent', 'Tenure Expectation', 'What Makes Them Stay',
  'Why Join', 'Achievements', 'Certifications', 'Additional Notes',
  'Resume File', 'Resume Link', 'Status', 'Assigned To', 'Follow Up Date',
  'Interview ID', 'Interview Score', 'Detailed Summary', 'Green Flags', 'Red Flags', 'Report Link'
];

function parsePrivateKey(raw) {
  if (!raw) throw new Error('GOOGLE_PRIVATE_KEY is not set');
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"')) key = JSON.parse(key);
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';
  const body = key.replace(header, '').replace(footer, '').replace(/\s+/g, '');
  const chunks = body.match(/.{1,64}/g) || [];
  return `${header}\n${chunks.join('\n')}\n${footer}\n`;
}

async function getAuthClient() {
  const privateKey = parsePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  });
  return auth.getClient();
}

async function ensureSheetExists(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = (meta.data.sheets || []).some(s => s.properties.title === SHEET_NAME);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME, gridProperties: { rowCount: 2000, columnCount: HEADERS.length } } } }] }
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW', requestBody: { values: [HEADERS] }
    });
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const newSheet = sheetMeta.data.sheets.find(s => s.properties.title === SHEET_NAME);
    if (newSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [
            { repeatCell: { range: { sheetId: newSheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.055, green: 0.647, blue: 0.914 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 }, horizontalAlignment: 'CENTER' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)' } },
            { updateSheetProperties: { properties: { sheetId: newSheet.properties.sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } }
          ]
        }
      });
    }
  }
  return true;
}

// ── Upload to Shared Drive root ──────────────────────────────────────────────
async function uploadResumeToDrive(drive, applicantName, resumeBase64, resumeFileName, resumeMimeType) {
  try {
    const base64Data = resumeBase64.includes(',') ? resumeBase64.split(',')[1] : resumeBase64;
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = resumeMimeType || 'application/pdf';
    const safeName = applicantName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const timestamp = new Date().toISOString().slice(0, 10);
    const ext = (resumeFileName || 'resume.pdf').split('.').pop();
    const fileName = `${safeName}_${timestamp}.${ext}`;

    const stream = Readable.from(buffer);

    const fileRes = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: fileName,
        parents: [SHARED_DRIVE_ID],
        mimeType: mimeType,
        driveId: SHARED_DRIVE_ID
      },
      media: { mimeType, body: stream },
      fields: 'id, webViewLink'
    });

    const fileId = fileRes.data.id;

    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    const viewLink = `https://drive.google.com/file/d/${fileId}/view`;
    console.log(`Drive: Uploaded ${fileName} → ${viewLink}`);
    return { fileId, viewLink, fileName };

  } catch (err) {
    console.error('Drive upload error (non-fatal):', err.message);
    return null;
  }
}

// ── WhatsApp via Waha ────────────────────────────────────────────────────────
async function sendNotificationViaWaha(data, driveLink, resumeBase64, resumeFileName, resumeMimeType) {
  try {
    const chatId = `${HR_NUMBER}@c.us`;
    const applicantName = data.fullName;
    const position = data.positionApplied;

    const notifyMsg = [
      `📋 *New Candidate Application*`, ``,
      `👤 *Name:* ${applicantName}`,
      `💼 *Position:* ${position || 'Not specified'}`,
      `📞 *WhatsApp:* ${data.whatsapp || '-'}`,
      `📍 *City:* ${data.city || '-'}`,
      `🧭 *Status:* ${data.employmentStatus || '-'}`,
      `💰 *Expected CTC:* ${data.expectedSalary || '-'}`,
      ``,
      `🎯 *Top 3 strengths:*`,
      `${data.topStrengths || '-'}`,
      `⭐ *Best at:* ${data.bestStrength || '-'}`,
      `🔥 *Under pressure:* ${data.pressureHandling || '-'}`,
      data.salesObjection ? `🤝 *"Too expensive" reply:* ${data.salesObjection}` : '',
      `🌱 *Intent:* ${data.intent || '-'} | *Sees self staying:* ${data.tenureExpectation || '-'}`,
      ``,
      driveLink ? `📁 *Resume:* ${driveLink}` : ''
    ].filter(Boolean).join('\n');

    await fetch(`${WAHA_BASE}/api/sendText`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: WAHA_SESSION, chatId, text: notifyMsg })
    });

    if (resumeBase64) {
      const base64Data = resumeBase64.includes(',') ? resumeBase64.split(',')[1] : resumeBase64;
      const mimeType = resumeMimeType || 'application/pdf';
      const fileName = resumeFileName || `${applicantName.replace(/\s+/g, '_')}_resume.pdf`;
      await fetch(`${WAHA_BASE}/api/sendFile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: WAHA_SESSION, chatId, file: { mimetype: mimeType, filename: fileName, data: base64Data }, caption: `Resume — ${applicantName} (${position || 'Candidate'})` })
      });
    }
    return true;
  } catch (err) {
    console.error('Waha error (non-fatal):', err.message);
    return false;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const data = req.body;
    if (!data || !data.fullName || !data.whatsapp)
      return res.status(400).json({ success: false, message: 'Missing required fields' });

    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const drive = google.drive({ version: 'v3', auth: authClient });

    await ensureSheetExists(sheets);

    // 1. Upload to Shared Drive
    let driveResult = null;
    if (data.resume && data.resume.data) {
      driveResult = await uploadResumeToDrive(drive, data.fullName, data.resume.data, data.resume.name, data.resume.type);
    }

    const resumeFileName = data.resume ? data.resume.name : '';
    const resumeLink = driveResult ? driveResult.viewLink : '';

    // The row will be appended after the interview generation is complete

    // 3. Trigger HireOS Backend for AI Test Generation (ONLY if 100% complete)
    const requiredFields = ['fullName', 'city', 'positionApplied', 'experience', 'expectedSalary', 'topStrengths', 'strengthProof', 'pressureHandling', 'tenureExpectation', 'whyJoin', 'skills'];
    const filledCount = requiredFields.filter(f => data[f] && data[f].toString().trim()).length;
    const hasResume = (data.resume && data.resume.data && data.resume.type === 'application/pdf') ? 1 : 0;
    const isComplete = (filledCount === requiredFields.length) && (hasResume === 1);

    let extractedText = '';
    let interviewId = null;
    if (isComplete) {
      try {
        const pdf = require('pdf-parse');
        let base64Data = data.resume.data;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        const buffer = Buffer.from(base64Data, 'base64');
        const pdfData = await pdf(buffer);
        extractedText = pdfData.text;

        // Make POST request to HireOS Web App
        // using the URL defined in .env (VITE_GOOGLE_APP_SCRIPT_URL)
        const appsScriptUrl = process.env.VITE_GOOGLE_APP_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxHKQek4oF4YXgeuppoC_it59AeaemYJ-YYJ5iVX03tI5QruMhuWKjZBwJ8r2YjBXI/exec';

        const cleanHrData = { ...data };
        delete cleanHrData.resume;

        const hireosRes = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generateCandidateTest',
            role: data.positionApplied,
            name: data.fullName,
            resumeText: extractedText,
            hrData: cleanHrData
          })
        });

        const hireosJson = await hireosRes.json();
        if (hireosJson.status === 'success') {
          interviewId = hireosJson.id;
        }
      } catch (err) {
        console.error('Failed to parse PDF or trigger HireOS:', err);
      }
    }

    // 4. Append to sheet — order MUST match HEADERS above.
    const row = [
      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      data.fullName || '', data.whatsapp || '', data.email || '',
      data.gender || '', data.city || '', data.town || '', data.dob || '',
      data.source || '', data.stayingPlace || '', data.livingArrangement || '',
      data.positionApplied || '', data.employmentStatus || '', data.currentRole || '',
      data.reasonChange || '', data.leftDate || '', data.leaveReason || '', data.leaveReasonDetail || '',
      data.experience || '', data.education || '', data.currentCompany || '', data.currentDesignation || '',
      data.currentSalary || '', data.expectedSalary || '', data.salaryJustification || '',
      data.noticePeriod || '', data.availability || '',
      data.workHistory || '', data.skills || '', data.languages || '',
      data.linkedinUrl || '', data.portfolioUrl || '', data.references || '',
      data.topStrengths || '', data.bestStrength || '', data.strengthProof || '',
      data.pressureHandling || '', data.salesObjection || '', data.salesPersistence || '',
      data.intent || '', data.tenureExpectation || '', data.stayReason || '',
      data.whyJoin || '', data.achievements || '', data.certifications || '', data.notes || '',
      resumeFileName, resumeLink, 'New Lead', '', '',
      interviewId || '', // Interview ID
      `=IFERROR(VLOOKUP(INDIRECT("AZ"&ROW()), 'Interview'!A:Z, 11, FALSE), "Pending")`, // Interview Score Formula
      `=IFERROR(VLOOKUP(INDIRECT("AZ"&ROW()), 'Interview'!A:Z, 19, FALSE), "Pending")`, // Detailed Summary Formula
      `=IFERROR(REGEXREPLACE(REGEXEXTRACT(VLOOKUP(INDIRECT("AZ"&ROW()), 'Interview'!A:Z, 19, FALSE), """greenFlags""\\s*:\\s*\\[(.*?)\\]"), "[\\""{}]", ""), "Pending")`, // Green Flags
      `=IFERROR(REGEXREPLACE(REGEXEXTRACT(VLOOKUP(INDIRECT("AZ"&ROW()), 'Interview'!A:Z, 19, FALSE), """redFlags""\\s*:\\s*\\[(.*?)\\]"), "[\\""{}]", ""), "Pending")`, // Red Flags
      interviewId ? `https://hireos-web.vercel.app/report/${interviewId}` : '' // Report Link (Standalone Page)
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });

    // 4. WhatsApp (Disabled for now per user request)
    // if (data.resume && data.resume.data) {
    //   await sendNotificationViaWaha(data, resumeLink, data.resume.data, data.resume.name, data.resume.type)
    //     .catch(err => console.error('Waha async error:', err.message));
    // }

    return res.status(200).json({ success: true, message: 'Application submitted successfully', applicantName: data.fullName, resumeLink: resumeLink || null, interviewId: interviewId });

  } catch (error) {
    console.error('Save error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save application: ' + error.message });
  }
};

// Convert a 1-based column index to its A1 letter (1 -> A, 27 -> AA, etc.)
function columnLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
