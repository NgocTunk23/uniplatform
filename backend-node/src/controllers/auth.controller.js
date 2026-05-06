const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { generateToken } = require('../utils/jwt.util');
const { formatToGMT7 } = require('../utils/timezone.util');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');
const ROLES = require('../constants/roles');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - fullname
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the user
 *         username:
 *           type: string
 *         email:
 *           type: string
 *         fullname:
 *           type: string
 *         role:
 *           type: string
 *           enum: [Admin, Leader, Member]
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - fullname
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               fullname: { type: string }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists
 */
const registerUser = async (req, res, next) => {
  const { username, email, password, fullname } = req.body;

  try {
    const userExists = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (userExists) {
      throw new ApiError(400, 'User already exists', ERROR_CODES.AUTH.USER_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        fullname,
        role: ROLES.SYSTEM.MEMBER,
      },
    });

    res.status(201).json({
      id: user.username,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      createdAt: user.createdat ? formatToGMT7(user.createdat) : null,
      tokenVersion: user.tokenVersion,
      token: generateToken(user.username, user.tokenVersion),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user & get token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier: { type: string, description: "Email or username" }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid identifier or password
 */
const loginUser = async (req, res, next) => {
  const { identifier, password } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier }
        ]
      }
    });

    if (!user) {
      throw new ApiError(401, 'Invalid identifier or password', ERROR_CODES.AUTH.AUTH_INVALID);
    }

    if (user.status === 'locked') {
      throw new ApiError(401, 'Account is locked', ERROR_CODES.AUTH.AUTH_LOCKED);
    }

    // --- LOGIC KIỂM TRA MẬT KHẨU MỚI (Hỗ trợ data mẫu) ---
    let isPasswordValid = false;

    // 1. Kiểm tra so sánh chuỗi trực tiếp (Dành cho data mẫu)
    if (password === user.password) {
      isPasswordValid = true;
    } 
    // 2. Nếu không giống trực tiếp, dùng bcrypt để so sánh (Dành cho user đăng ký mới)
    else {
      try {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } catch (err) {
        // Lỗi xảy ra nếu chuỗi trong DB không phải hash hợp lệ của bcrypt
        isPasswordValid = false; 
      }
    }

    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid identifier or password', ERROR_CODES.AUTH.AUTH_INVALID);
    }

    // --- ĐĂNG NHẬP THÀNH CÔNG ---
    res.json({
      id: user.username,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      tokenVersion: user.tokenVersion,
      token: generateToken(user.username, user.tokenVersion),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile information
 *       404:
 *         description: User not found
 */
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.user.username },
    });
    
    if (user) {
      const { password, ...userData } = user;
      if (userData.createdat) {
        userData.createdAt = formatToGMT7(userData.createdat);
      }
      res.json(userData);
    } else {
      throw new ApiError(404, 'User not found', ERROR_CODES.AUTH.USER_NOT_FOUND);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
const logoutUser = async (req, res, next) => {
  res.json({ message: 'User logged out successfully' });
};

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Gửi email khôi phục mật khẩu
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Đã gửi email (hoặc email không tồn tại nhưng vẫn báo thành công để bảo mật)
 */
const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findFirst({ where: { email } });

    // Bảo mật: Không trả về lỗi 404 nếu không tìm thấy email để tránh bị dò quét tài khoản
    if (!user) {
      return res.status(200).json({ message: 'Nếu email tồn tại, liên kết khôi phục đã được gửi.' });
    }

    // Tạo token ngẫu nhiên
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token để lưu vào DB (Bảo mật hơn việc lưu raw token)
    const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    // Cập nhật vào DB (Yêu cầu: Schema Prisma phải có 2 trường resetToken và resetTokenExpiry)
    await prisma.user.update({
      where: { username: user.username },
      data: { 
        resetToken: resetPasswordToken, 
        resetTokenExpiry: resetPasswordExpire 
      }
    });

    // Cấu hình Nodemailer gửi mail thật (Cần cấu hình SMTP trong file .env)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT == 465, // true for 465, false cho các port khác
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const message = `Bạn nhận được email này vì đã yêu cầu đặt lại mật khẩu. Vui lòng click vào link sau: \n\n ${resetUrl}`;

    await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: user.email,
      subject: 'Yêu cầu đặt lại mật khẩu - UniPlatform',
      text: message,
    });

    res.status(200).json({ message: 'Email khôi phục đã được gửi.' });
  } catch (error) {
    // Nếu gửi mail lỗi, xóa token trong DB
    const user = await prisma.user.findFirst({ where: { email: req.body.email } });
    if (user) {
      await prisma.user.update({
        where: { username: user.username },
        data: { resetToken: null, resetTokenExpiry: null }
      });
    }
    next(new ApiError(500, 'Không thể gửi email', ERROR_CODES.SYSTEM.INTERNAL_ERROR));
  }
};

/**
 * Reset mật khẩu bằng token đã gửi qua email
 */
const resetPassword = async (req, res, next) => {
  const { token, newPassword } = req.body;

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: {
          gte: new Date(),
        },
      },
    });

    if (!user) {
      return next(new ApiError(400, 'Token không hợp lệ hoặc đã hết hạn.', ERROR_CODES.AUTH.AUTH_ERROR));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { username: user.username },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.status(200).json({ message: 'Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (error) {
    next(new ApiError(500, 'Không thể đặt lại mật khẩu.', ERROR_CODES.SYSTEM.INTERNAL_ERROR));
  }
};

/**
 * Xử lý callback từ Google/GitHub sau khi người dùng cấp quyền
 */
const oauthCallback = async (req, res, next) => {
  try {
    // req.user được thư viện Passport.js gán tự động sau khi xác thực thành công với Google/GitHub
    const profile = req.user; 
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!profile || !profile.email) {
      return res.redirect(`${frontendUrl}/login?error=OAuthFailed`);
    }

    // Tìm user theo email
    let user = await prisma.user.findFirst({ 
      where: { email: profile.email } 
    });

    // Nếu chưa có tài khoản, tự động đăng ký
    if (!user) {
      // Tạo username ngẫu nhiên từ email tránh trùng lặp
      let baseUsername = profile.email.split('@')[0];
      let newUsername = baseUsername;
      let counter = 1;
      
      // Đảm bảo username là unique
      while (await prisma.user.findFirst({ where: { username: newUsername } })) {
        newUsername = `${baseUsername}${counter}`;
        counter++;
      }

      user = await prisma.user.create({
        data: {
          username: newUsername,
          email: profile.email,
          fullname: profile.displayName || profile.name || newUsername,
          password: crypto.randomBytes(20).toString('hex'), // Tạo pass ngẫu nhiên vì login bằng OAuth
          role: ROLES.SYSTEM.MEMBER,
        },
      });
    }

    // Tạo JWT Token cho hệ thống nội bộ
    const token = generateToken(user.username, user.tokenVersion);

    // Chuyển hướng về Frontend kèm thông tin
    res.redirect(`${frontendUrl}/chat?token=${token}&username=${user.username}&email=${user.email}&fullname=${encodeURIComponent(user.fullname)}`);

  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.error("OAuth Error: ", error);
    res.redirect(`${frontendUrl}/login?error=ServerError`);
  }
};

/**
 * Google Drive Token Callback - For obtaining refresh token for Google Drive API
 * This is separate from user login OAuth flow
 */
const googleDriveTokenCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code not provided',
        error: 'MISSING_CODE'
      });
    }

    // Exchange code for tokens using Google APIs
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens || !tokens.refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Failed to obtain refresh token. Make sure you grant offline access and use prompt=consent',
        error: 'NO_REFRESH_TOKEN'
      });
    }

    // Return the refresh token to be saved in .env
    res.json({
      success: true,
      message: 'Authorization successful!',
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresIn: tokens.expiry_date,
      instructions: 'Add this to your .env file: GOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token
    });

  } catch (error) {
    console.error('Google Drive Token Error:', error);
    res.status(500).json({
      success: false,
      message: 'Token exchange failed: ' + error.message,
      error: error.code || 'TOKEN_EXCHANGE_FAILED'
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
  forgotPassword,
  resetPassword,
  oauthCallback,
  googleDriveTokenCallback
};