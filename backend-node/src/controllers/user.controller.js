const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');

const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw new ApiError(404, 'User not found', ERROR_CODES.USER?.NOT_FOUND || 'USER_NOT_FOUND');
    }

    const { password: _, ...userData } = user;
    
    res.json({ data: userData });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { fullname, dateofbirth, address, phone, password } = req.body;
    
    const updateData = {
      fullname,
      address,
      phone,
      dateofbirth: dateofbirth ? new Date(dateofbirth) : undefined,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
    });

    const { password: _, ...userData } = updatedUser;
    res.json({ data: userData, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (user && (await bcrypt.compare(currentPassword, user.password))) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: req.user.id },
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