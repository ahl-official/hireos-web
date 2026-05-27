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
    const SHEET_ID = '19esdOQWb_MiE4txT3bZdALzuju2PwKoZeM';
    const SHEET_NAME = 'Interview';

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

    console.log('Fetching Interview sheet for ID:', SHEET_ID);
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:Z`
    });
    
    const rows = result.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in Interview tab.');
      return;
    }
    
    // Print the last row
    const lastRow = rows[rows.length - 1];
    console.log('Last row in Interview tab:');
    console.log('ID:', lastRow[0]);
    console.log('Name:', lastRow[1]);
    console.log('Questions:', lastRow[4]);
    
  } catch (err) {
    console.error('FAILED with error:', err.message);
  }
}

run();
