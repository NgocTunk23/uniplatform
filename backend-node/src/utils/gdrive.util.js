const { google } = require('googleapis');
const stream = require('stream');
const dotenv = require('dotenv');

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  'https://developers.google.com/oauthplayground' // Redirect URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client
});

/**
 * Uploads a file to Google Drive
 * @param {Object} fileObject - Multer file object
 */
const uploadFile = async (fileObject) => {
  try {
    // If placeholders, mock the response
    if (CLIENT_ID === 'your_client_id_placeholder' || !CLIENT_ID) {
      console.log('⚠️ Google Drive API info missing, mocking upload...');
      return {
        id: `mock_id_${Date.now()}`,
        name: fileObject.originalname,
        webViewLink: `https://drive.google.com/mock/${fileObject.originalname}`
      };
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileObject.originalname,
        mimeType: fileObject.mimetype,
      },
      media: {
        mimeType: fileObject.mimetype,
        body: bufferStream,
      },
      fields: 'id, name, webViewLink',
    });

    // Make the file public (or specific permissions)
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return response.data;
  } catch (error) {
    console.error('❌ Google Drive Upload Error:', error.message);
    throw error;
  }
};

const deleteFile = async (fileId) => {
  try {
    if (CLIENT_ID === 'your_client_id_placeholder' || !CLIENT_ID) {
      console.log('⚠️ Mocking delete for:', fileId);
      return true;
    }
    await drive.files.delete({ fileId });
    return true;
  } catch (error) {
    console.error('❌ Google Drive Delete Error:', error.message);
    throw error;
  }
};

module.exports = {
  uploadFile,
  deleteFile
};
