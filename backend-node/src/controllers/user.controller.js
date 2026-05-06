const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { formatToGMT7 } = require('../utils/timezone.util');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');
const gdriveUtil = require('../utils/gdrive.util');
const { Readable } = require('stream');

const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.user.username },
    });

    if (!user) {
      throw new ApiError(404, 'User not found', ERROR_CODES.USER?.NOT_FOUND || 'USER_NOT_FOUND');
    }

    const { password: _, ...userData } = user;
    if (userData.createdat) {
      userData.createdAt = formatToGMT7(userData.createdat);
    }
    if (userData.imageggid) {
      if (userData.imageggid.startsWith('data:image/')) {
        userData.imageuser = userData.imageggid; // Legacy base64
      } else {
        // CHỈ TRẢ VỀ ID ĐỂ FRONTEND TỰ XỬ LÝ (Không dùng getDownloadLink nữa)
        userData.imageuser = userData.imageggid; 
      }
    }
    
    res.json({ data: userData });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullname, dateofbirth, address, phone, password, imageuser } = req.body;
    
    const updateData = {
      fullname,
      address,
      phone,
      dateofbirth: dateofbirth ? new Date(dateofbirth) : undefined,
    };

    if (imageuser !== undefined) {
      if (imageuser && imageuser.startsWith('data:image/')) {
        // It's a base64 image, upload to Drive
        const base64Data = imageuser.split(',')[1];
        const mimeType = imageuser.split(';')[0].split(':')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `avatar_${req.user.username}_${Date.now()}.${mimeType.split('/')[1]}`;
        
        // THÊM DÒNG NÀY ĐỂ BIẾN BUFFER THÀNH STREAM:
        const stream = Readable.from(buffer);

        const mockFile = {
          buffer,
          stream, // <--- Nhét stream vào đây để gdriveUtil xài
          originalname: filename,
          mimetype: mimeType,
          size: buffer.length
        };
        
        const driveData = await gdriveUtil.uploadFile(mockFile);
        updateData.imageggid = driveData.id;
      } else if (imageuser === '') {
        // Remove avatar
        updateData.imageggid = null;
      }
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { username: req.user.username },
      data: updateData,
    });

    const { password: _, ...userResponse } = updatedUser;
    if (userResponse.createdat) {
      userResponse.createdAt = formatToGMT7(userResponse.createdat);
    }
    
    if (userResponse.imageggid) {
      if (userResponse.imageggid.startsWith('data:image/')) {
        userResponse.imageuser = userResponse.imageggid; 
      } else {
        // SỬA NỐT CHỖ NÀY: Không dùng getDownloadLink nữa
        userResponse.imageuser = userResponse.imageggid;
      }
    }

    res.json({ data: userResponse });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({
      where: { username: req.user.username },
    });

    if (user && (await bcrypt.compare(currentPassword, user.password))) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { username: req.user.username },
        data: { password: hashedPassword },
      });
      res.json({ message: 'Password updated successfully' });
    } else {
      throw new ApiError(401, 'Invalid current password', ERROR_CODES.USER?.PASS_INVALID || 'INVALID_PASSWORD');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
};