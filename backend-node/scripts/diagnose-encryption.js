const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

/**
 * Diagnostic utility for Google Drive encryption key issues
 * 
 * Usage:
 *   node scripts/diagnose-encryption.js
 *   node scripts/diagnose-encryption.js --repair
 */

const getEncryptionKey = () => {
  const key = process.env.DRIVE_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) {
    throw new Error('DRIVE_TOKEN_ENCRYPTION_KEY or JWT_SECRET not set in environment');
  }
  return crypto.createHash('sha256').update(key).digest();
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
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

const encryptSecret = (value) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
};

const diagnoseEncryption = (encryptedToken) => {
  console.log('🔍 Diagnostic Report');
  console.log('==================\n');

  // Check environment
  const hasKey = !!process.env.DRIVE_TOKEN_ENCRYPTION_KEY;
  const hasJWT = !!process.env.JWT_SECRET;
  console.log(`✓ Environment:
  - DRIVE_TOKEN_ENCRYPTION_KEY: ${hasKey ? '✅ set' : '❌ not set'}
  - JWT_SECRET: ${hasJWT ? '✅ set' : '❌ not set'}
  - Active key: ${hasKey ? 'DRIVE_TOKEN_ENCRYPTION_KEY' : 'JWT_SECRET'}\n`);

  // Check format
  const parts = String(encryptedToken).split(':');
  console.log(`✓ Token Format:
  - Version: ${parts[0]}
  - Has IV: ${parts[1] ? '✅' : '❌'}
  - Has Tag: ${parts[2] ? '✅' : '❌'}
  - Has Ciphertext: ${parts[3] ? '✅' : '❌'}
  - Total parts: ${parts.length} (expected 4)\n`);

  // Try to decrypt
  console.log('✓ Decryption Attempt:');
  try {
    const decrypted = decryptSecret(encryptedToken);
    console.log(`  ✅ SUCCESS - Token decrypted\n`);
    return { success: true, value: decrypted };
  } catch (error) {
    console.log(`  ❌ FAILED - ${error.message}\n`);
    return { success: false, error: error.message };
  }
};

const main = () => {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(`
File Decryption Diagnostic Utility
===================================

USAGE:
  node scripts/diagnose-encryption.js [TOKEN] [OPTIONS]

OPTIONS:
  --help           Show this help message
  --encrypt TEXT   Encrypt a new refresh token and display the encrypted value

EXAMPLE:
  # Diagnose an existing encrypted token
  node scripts/diagnose-encryption.js "v1:abc123:def456:ghi789"

  # Encrypt a new refresh token
  node scripts/diagnose-encryption.js --encrypt "1//0gXXXXXX..."

TROUBLESHOOTING:
  If decryption fails, check:
  1. DRIVE_TOKEN_ENCRYPTION_KEY environment variable matches what was used for encryption
  2. Stored token format is correct (v1:iv:tag:ciphertext)
  3. Token data hasn't been corrupted in the database
    `);
    return;
  }

  // Handle encryption mode
  if (args.includes('--encrypt')) {
    const idx = args.indexOf('--encrypt');
    const textToEncrypt = args[idx + 1];
    
    if (!textToEncrypt) {
      console.error('❌ Error: No text provided to encrypt');
      return;
    }

    console.log('🔐 Encrypting token...\n');
    const encrypted = encryptSecret(textToEncrypt);
    console.log('✅ Encrypted value (ready for database):\n');
    console.log(encrypted);
    console.log('\n✓ This token can be decrypted with current DRIVE_TOKEN_ENCRYPTION_KEY');
    return;
  }

  // Handle diagnostic mode
  const token = args[0];
  if (!token) {
    console.error('❌ Error: Please provide an encrypted token');
    return;
  }

  const result = diagnoseEncryption(token);

  if (result.success) {
    console.log(`Decrypted value (first 50 chars): ${result.value.substring(0, 50)}...`);
  } else {
    console.log(`\n💡 Possible solutions:
1. Verify DRIVE_TOKEN_ENCRYPTION_KEY environment variable hasn't changed
2. If key is correct, the stored token may be corrupted
3. Consider re-encrypting by:
   - Disconnecting and reconnecting Google Drive in the app
   - Or manually updating with: node scripts/diagnose-encryption.js --encrypt [refresh_token]`);
  }
};

module.exports = { encryptSecret, decryptSecret, diagnoseEncryption };

// Run if executed directly
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}
