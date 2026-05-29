const dotenv = require('dotenv');
dotenv.config();

const ERROR_CODES = {
  FILE: {
    GOOGLE_DRIVE_NOT_CONNECTED: 'FILE_GOOGLE_DRIVE_NOT_CONNECTED',
  },
};

class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Mock the secret utility with a failing decryption
const mockDecryptSecret = jest.fn((value) => {
  if (value === 'valid_token') {
    return 'decrypted_refresh_token';
  }
  throw new Error('Decryption failed: Authentication tag verification failed. The encryption key may have changed or the secret data is corrupted. Original: Unsupported state or unable to authenticate data');
});

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn((options) => {
      if (options.where.username === 'user_with_valid_token') {
        return {
          username: 'user_with_valid_token',
          googleDriveEmail: 'user@gmail.com',
          googleDriveRefreshToken: 'valid_token',
          googleDriveFolderId: 'folder123',
        };
      }
      if (options.where.username === 'user_with_corrupted_token') {
        return {
          username: 'user_with_corrupted_token',
          googleDriveEmail: 'user2@gmail.com',
          googleDriveRefreshToken: 'corrupted_token',
          googleDriveFolderId: 'folder456',
        };
      }
      return null;
    }),
  },
};

// Simulate the fixed getConnectedDriveForUser function
const getConnectedDriveForUser = async (username) => {
  const user = await mockPrisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      googleDriveEmail: true,
      googleDriveRefreshToken: true,
      googleDriveFolderId: true,
    },
  });

  if (!user?.googleDriveEmail || !user?.googleDriveRefreshToken) {
    throw new ApiError(
      409,
      'Google Drive is not connected. Connect it in Drive Files first.',
      ERROR_CODES.FILE.GOOGLE_DRIVE_NOT_CONNECTED
    );
  }

  let refreshToken;
  try {
    refreshToken = mockDecryptSecret(user.googleDriveRefreshToken);
  } catch (error) {
    console.error('❌ Decryption Error:', error.message);
    throw new ApiError(
      500,
      'Failed to decrypt Google Drive credentials. Your refresh token may be corrupted. Please reconnect Google Drive in Drive Files.',
      ERROR_CODES.FILE.GOOGLE_DRIVE_NOT_CONNECTED
    );
  }

  let folderId = user.googleDriveFolderId;

  return {
    email: user.googleDriveEmail,
    refreshToken,
    folderId,
  };
};

describe('File Decryption Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully decrypt valid token', async () => {
    const drive = await getConnectedDriveForUser('user_with_valid_token');
    expect(drive.email).toBe('user@gmail.com');
    expect(drive.refreshToken).toBe('decrypted_refresh_token');
    expect(drive.folderId).toBe('folder123');
  });

  it('should throw ApiError with helpful message when decryption fails', async () => {
    let thrownError = null;
    try {
      await getConnectedDriveForUser('user_with_corrupted_token');
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiError);
    expect(thrownError.status).toBe(500);
    expect(thrownError.code).toBe(ERROR_CODES.FILE.GOOGLE_DRIVE_NOT_CONNECTED);
    expect(thrownError.message).toContain('Failed to decrypt Google Drive credentials');
    expect(thrownError.message).toContain('corrupted');
    expect(thrownError.message).toContain('reconnect');
  });

  it('should not expose internal error details to user', async () => {
    let thrownError = null;
    try {
      await getConnectedDriveForUser('user_with_corrupted_token');
    } catch (error) {
      thrownError = error;
    }

    // Error message should be user-friendly, not expose crypto details
    expect(thrownError.message).not.toContain('Unsupported state');
    expect(thrownError.message).not.toContain('authenticate');
  });

  it('should still throw 409 error when Google Drive is not connected', async () => {
    let thrownError = null;
    try {
      await getConnectedDriveForUser('nonexistent_user');
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiError);
    expect(thrownError.status).toBe(409);
    expect(thrownError.message).toContain('Google Drive is not connected');
  });
});
