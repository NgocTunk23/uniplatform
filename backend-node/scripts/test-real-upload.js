const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Force REAL mode for this test
process.env.GOOGLE_DRIVE_MOCK = 'false';

const gdriveUtil = require('../src/utils/gdrive.util');

async function testRealUpload() {
  console.log('🚀 Starting REAL Google Drive upload test...');
  console.log('📂 Target Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID);
  
  if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN === 'your_refresh_token_here' || !process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    console.error('❌ Error: Please get a real Refresh Token first using node scripts/get-refresh-token.js');
    process.exit(1);
  }
  const testFile = {
    originalname: `real_test_${Date.now()}.txt`,
    mimetype: 'text/plain',
    buffer: Buffer.from('This is a real test upload content from UniPlatform backend at ' + new Date().toISOString()),
    size: 100
  };

  try {
    const result = await gdriveUtil.uploadFile(testFile);
    console.log('✅ Upload SUCCESS!');
    console.log('📄 File ID:', result.id);
    console.log('🔗 Web View Link:', result.webViewLink);
    console.log('📥 Download Link:', gdriveUtil.getDownloadLink(result.id));
    
    // Cleanup: try to delete the test file
    // console.log('🧹 Cleaning up test file...');
    // await gdriveUtil.deleteFile(result.id);
    // console.log('✨ Cleanup complete.');
  } catch (error) {
    console.error('❌ Real Upload Test FAILED');
    if (error.response) {
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('Message:', error.message);
    process.exit(1);
  }
}

testRealUpload();
