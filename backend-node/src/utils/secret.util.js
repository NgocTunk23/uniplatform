const crypto = require('crypto');

const getEncryptionKey = () => {
  const secret = process.env.DRIVE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing DRIVE_TOKEN_ENCRYPTION_KEY or JWT_SECRET');
  }

  return crypto.createHash('sha256').update(secret).digest();
};

const encryptSecret = (value) => {
  if (!value) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
};

const decryptSecret = (value) => {
  if (!value) return null;

  try {
    const [version, iv, tag, ciphertext] = String(value).split(':');
    if (version !== 'v1' || !iv || !tag || !ciphertext) {
      throw new Error('Invalid encrypted secret format');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(iv, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('Unsupported state') || errorMsg.includes('authenticate')) {
      throw new Error(`Decryption failed: Authentication tag verification failed. The encryption key may have changed or the secret data is corrupted. Original: ${errorMsg}`);
    }
    throw error;
  }
};

module.exports = {
  encryptSecret,
  decryptSecret,
};
