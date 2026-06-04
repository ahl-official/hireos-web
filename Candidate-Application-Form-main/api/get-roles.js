const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1DMZetX7yfPUGMJYjRCLVydxcfw-DwWnT1WxxKmRgyCI';

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
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return auth.getClient();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'ICP_Master!A:E', // Getting A to E to ensure we get both roleName and status
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.status(200).json({ roles: [] });
    }

    const headers = rows[0];
    const roleIndex = headers.indexOf('roleName');
    const statusIndex = headers.indexOf('status');

    if (roleIndex === -1 || statusIndex === -1) {
      return res.status(200).json({ roles: [] });
    }

    const activeRoles = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[statusIndex] === 'active' && row[roleIndex]) {
        activeRoles.push(row[roleIndex].trim());
      }
    }

    return res.status(200).json({ roles: activeRoles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return res.status(500).json({ error: 'Failed to fetch roles', details: error.message });
  }
}
