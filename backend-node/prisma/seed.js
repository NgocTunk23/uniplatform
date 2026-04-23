const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const ROLES = require('../src/constants/roles');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const admins = [
    { username: 'admin1', email: 'admin1@uniplatform.com', fullname: 'Admin One', role: ROLES.SYSTEM.ADMIN, password: passwordHash },
    { username: 'admin2', email: 'admin2@uniplatform.com', fullname: 'Admin Two', role: ROLES.SYSTEM.ADMIN, password: passwordHash },
    { username: 'admin3', email: 'admin3@uniplatform.com', fullname: 'Admin Three', role: ROLES.SYSTEM.ADMIN, password: passwordHash },
  ];

  for (const admin of admins) {
    await prisma.user.upsert({
      where: { username: admin.username },
      update: {},
      create: admin,
    });
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
