const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullname: { type: string }
 *               dateofbirth: { type: string, format: date }
 *               address: { type: string }
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 */
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
    res.json(userData);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/users/change-password:
 *   patch:
 *     summary: Change current user password
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password changed
 */
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
      throw new ApiError(401, 'Invalid current password', ERROR_CODES.USER.PASS_INVALID);
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile,
  changePassword,
};
