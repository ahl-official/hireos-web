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
    console.log('Testing Google Sheets Connection...');
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
    
    const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID });
    console.log('SUCCESS! Found sheet title:', meta.data.properties.title);
  } catch (err) {
    console.error('FAILED with error:', err.message);
  }
}

run();
