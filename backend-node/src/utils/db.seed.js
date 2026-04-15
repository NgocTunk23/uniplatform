const User = require('../models/user.model');

const seedUsers = async () => {
  try {
    const adminCount = await User.countDocuments({ role: 'Admin' });

    if (adminCount === 0) {
      const admins = [
        {
          username: 'admin1',
          password: 'password123',
          fullname: 'System Admin One',
          email: 'admin1@uniplatform.com',
          role: 'Admin',
        },
        {
          username: 'admin2',
          password: 'password123',
          fullname: 'System Admin Two',
          email: 'admin2@uniplatform.com',
          role: 'Admin',
        },
        {
          username: 'admin3',
          password: 'password123',
          fullname: 'System Admin Three',
          email: 'admin3@uniplatform.com',
          role: 'Admin',
        },
      ];

      await User.create(admins);
      console.log('✅ Default Admin accounts seeded successfully');
    } else {
      console.log('ℹ️ Admin accounts already exist, skipping seed');
    }
  } catch (error) {
    console.error(`❌ Seeding error: ${error.message}`);
  }
};

module.exports = seedUsers;
