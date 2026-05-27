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
    console.log('Testing Google Drive Connection...');
    const privateKey = parsePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey
      },
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });
    
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '0AAxGZGK-JKxZUk9PVA';
    
    // Check if we can get the folder
    const fileRes = await drive.files.get({
      fileId: folderId,
      supportsAllDrives: true
    });
    
    console.log('SUCCESS! Found drive folder:', fileRes.data.name);
  } catch (err) {
    console.error('FAILED with error:', err.message);
  }
}

run();
