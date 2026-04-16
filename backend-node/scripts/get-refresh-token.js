const { google } = require('googleapis');
const readline = require('readline');
const dotenv = require('dotenv');

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.error('❌ Error: Missing Google OAuth2 credentials in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Critical for getting a refresh_token
  scope: SCOPES,
  prompt: 'consent' // Forces re-consent to ensure refresh_token is returned
});

console.log('🚀 Authorize this app by visiting this URL:');
console.log('\x1b[36m%s\x1b[0m', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('📋 Enter the code from that page here: ', async (input) => {
  rl.close();
  try {
    // Automatically extract code if the user pastes the full redirect URL
    let code = input;
    if (input.startsWith('http')) {
      const url = new URL(input);
      code = url.searchParams.get('code');
    }

    if (!code) {
      throw new Error('Could not find code in the input provided.');
    }

    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Success! Here is your Refresh Token:');
    console.log('\x1b[32m%s\x1b[0m', tokens.refresh_token);
    console.log('\n👉 Copy this token and paste it into GOOGLE_DRIVE_REFRESH_TOKEN in your .env file.');
  } catch (error) {
    console.error('❌ Error retrieving access token:', error.message);
  }
});
