const fs = require('fs');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { google } = require('googleapis');
const dotenv = require('dotenv');

dotenv.config();

const getDriveConfig = () => {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    mockMode: process.env.GOOGLE_DRIVE_MOCK === 'true'
  };
};

const isPlaceholderValue = (value) => !value || value.startsWith('your_');

let driveInstance = null;
let lastConfigHash = '';

const getDriveClient = () => {
  const config = getDriveConfig();
  const configHash = JSON.stringify(config);

  if (driveInstance && configHash === lastConfigHash) {
    return driveInstance;
  }

  if (
    config.mockMode ||
    isPlaceholderValue(config.clientId) ||
    isPlaceholderValue(config.clientSecret) ||
    isPlaceholderValue(config.refreshToken)
  ) {
    driveInstance = null;
    lastConfigHash = configHash;
    return null;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    oauth2Client.setCredentials({ refresh_token: config.refreshToken });
    driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
    lastConfigHash = configHash;
    console.log('🛡️ Google Drive Client initialized (REAL mode)');
    return driveInstance;
  } catch (err) {
    console.error('❌ Failed to initialize Google Drive Client:', err.message);
    return null;
  }
};

/**
 * Uploads a file to Google Drive
 * @param {Object} fileObject - Multer file object
 */
const uploadFile = async (fileObject) => {
  const drive = getDriveClient();
  const config = getDriveConfig();

  try {
    if (!drive) {
      console.log('🛡️ Mocking upload for:', fileObject.originalname);
      return {
        id: `mock_drive_id_${Date.now()}`,
        name: fileObject.originalname,
        webViewLink: `https://drive.google.com/mock/${fileObject.originalname}`
      };
    }

    const response = await drive.files.create({
      requestBody: {
        name: fileObject.originalname,
        mimeType: fileObject.mimetype,
        parents: config.folderId ? [config.folderId] : [],
      },
      media: {
        mimeType: fileObject.mimetype,
        body: Readable.from(fileObject.buffer),
      },
      fields: 'id, name, webViewLink',
    }, {
      // Configuration for gaxios to prevent socket hang up
      timeout: 60000, 
      retry: true
    });

    // Make the file public (Anyone with link can view)
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    console.log('📦 Drive create response:', response ? 'exists' : 'null');
    if (response) console.log('📦 Response data:', response.data ? 'exists' : 'null');
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('❌ Google Drive Upload Error Details:', JSON.stringify(error.response.data));
    }
    console.error('❌ Google Drive Upload Error:', error.message);
    throw error;
  }
};

const uploadFileFromPath = async (filePath, fileObject) => {
  const drive = getDriveClient();
  const config = getDriveConfig();
  const originalname = fileObject.originalname;
  const mimetype = fileObject.mimetype || 'application/octet-stream';

  try {
    if (!drive) {
      console.log('🛡️ Mocking upload for:', originalname);
      return {
        id: `mock_drive_id_${Date.now()}`,
        name: originalname,
        webViewLink: `https://drive.google.com/mock/${originalname}`
      };
    }

    const response = await drive.files.create({
      requestBody: {
        name: originalname,
        mimeType: mimetype,
        parents: config.folderId ? [config.folderId] : [],
      },
      media: {
        mimeType: mimetype,
        body: fs.createReadStream(filePath),
      },
      fields: 'id, name, webViewLink',
    }, {
      timeout: 120000,
      retry: true
    });

    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('❌ Google Drive Upload Error Details:', JSON.stringify(error.response.data));
    }
    console.error('❌ Google Drive Upload Error:', error.message);
    throw error;
  }
};

const downloadFileToPath = async (fileId, destinationPath) => {
  const drive = getDriveClient();

  if (!fileId) {
    throw new Error('Missing Google Drive file id');
  }

  if (!drive || fileId.startsWith('mock_')) {
    throw new Error('Recording file download is not available in Google Drive mock mode');
  }

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream', timeout: 120000, retry: true }
  );

  await pipeline(response.data, fs.createWriteStream(destinationPath));
  return destinationPath;
};

/**
 * Deletes a file from Google Drive
 * @param {string} fileId 
 */
const deleteFile = async (fileId) => {
  const drive = getDriveClient();
  try {
    if (!drive || fileId.startsWith('mock_')) {
      console.log('🛡️ Mocking delete for Drive ID:', fileId);
      return true;
    }
    await drive.files.delete({ fileId });
    return true;
  } catch (error) {
    console.error('❌ Google Drive Delete Error:', error.message);
    throw error;
  }
};

/**
 * Generates a direct download link for a file
 * @param {string} fileId 
 */
const getDownloadLink = (fileId) => {
  if (!fileId) return null;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

/**
 * Get Google Drive storage quota info
 * @returns {Promise<Object>} Quota info (total, used, remaining)
 */
const getStorageQuota = async () => {
  try {
    const drive = getDriveClient();
    if (!drive) return null;

    const response = await drive.about.get({
      fields: 'storageQuota',
    });
    
    const quota = response.data.storageQuota;
    return {
      limit: parseInt(quota.limit),
      usage: parseInt(quota.usage),
      usageInDrive: parseInt(quota.usageInDrive),
      remaining: parseInt(quota.limit) - parseInt(quota.usage)
    };
  } catch (error) {
    console.error('Error fetching Drive quota:', error);
    return null;
  }
};

module.exports = {
  uploadFile,
  uploadFileFromPath,
  downloadFileToPath,
  deleteFile,
  getDownloadLink,
  getStorageQuota
};
