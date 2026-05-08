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

    res.json({ data: userData });
  } catch (error) {
    console.error("🔴 LỖI LẤY THÔNG TIN PROFILE:", error);
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullname, dateofbirth, address, phone, password, imageggid } = req.body;
    
    // 1. Lấy thông tin user hiện tại từ DB để giữ lại ID của ảnh cũ
    const currentUser = await prisma.user.findUnique({
      where: { username: req.user.username },
    });

    if (!currentUser) {
      throw new ApiError(404, 'User not found', ERROR_CODES.USER?.NOT_FOUND || 'USER_NOT_FOUND');
    }

    const updateData = {
      fullname,
      address,
      phone,
      dateofbirth: dateofbirth ? new Date(dateofbirth) : undefined,
    };

    // 2. Xử lý ảnh đại diện
    if (imageggid !== undefined) {
      if (imageggid && imageggid.startsWith('data:image/')) {
        // Có ảnh mới (base64) -> Upload lên Drive
        const base64Data = imageggid.split(',')[1];
        const mimeType = imageggid.split(';')[0].split(':')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `avatar_${req.user.username}_${Date.now()}.${mimeType.split('/')[1]}`;
        
        const stream = Readable.from(buffer);

        const mockFile = {
          buffer,
          stream,
          originalname: filename,
          mimetype: mimeType,
          size: buffer.length
        };
        
        const driveData = await gdriveUtil.uploadFile(mockFile);
        updateData.imageggid = driveData.id;

        // XÓA ẢNH CŨ (Nếu user đã có ảnh trước đó)
        if (currentUser.imageggid) {
          try {
            await gdriveUtil.deleteFile(currentUser.imageggid);
          } catch (delErr) {
            console.error('⚠️ Bỏ qua lỗi xóa ảnh cũ trên Drive:', delErr.message);
          }
        }

      } else if (imageggid === '') {
        // User muốn gỡ ảnh đại diện
        updateData.imageggid = null;

        // XÓA ẢNH CŨ
        if (currentUser.imageggid) {
          try {
            await gdriveUtil.deleteFile(currentUser.imageggid);
          } catch (delErr) {
            console.error('⚠️ Bỏ qua lỗi xóa ảnh cũ trên Drive:', delErr.message);
          }
        }
      }
    }

    // 3. Xử lý đổi mật khẩu (nếu có)
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // 4. Cập nhật vào Database
    const updatedUser = await prisma.user.update({
      where: { username: req.user.username },
      data: updateData,
    });

    const { password: _, ...userResponse } = updatedUser;
    if (userResponse.createdat) {
      userResponse.createdAt = formatToGMT7(userResponse.createdat);
    }

    res.json({ data: userResponse });
  } catch (error) {
    console.error("🔴 LỖI CẬP NHẬT PROFILE:", error);
    next(error); // Chuyển lỗi xuống error handler chung
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