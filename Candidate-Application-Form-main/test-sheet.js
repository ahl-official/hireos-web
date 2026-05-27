require('dotenv').config();
const { google } = require('googleapis');

function parsePrivateKey(raw) {
  if (!raw) return '';
  let key = raw.trim();
  if (key.startsWith('"') && key.endsWith('"')) key = JSON.parse(key);
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';
  const body = key.replace(header, '').replace(footer, '').replace(/\s+/g, '');
  const chunks = body.match(/.{1,64}/g) || [];
  return `${header}\n${chunks.join('\n')}\n${footer}\n`;
}

async function run() {
  try {
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;
    const SHEET_NAME = 'Candidate Applications';

    const privateKey = parsePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const row = Array(51).fill('Row 52 Test');
    row[0] = new Date().toLocaleString();
    
    console.log('Appending row to', `${SHEET_NAME}!A:A`);
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A:A`,
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    
    console.log('SUCCESS! Row appended:', result.data.updates.updatedRange);
  } catch (err) {
    console.error('FAILED with error:', err.stack);
  }
}

run();
