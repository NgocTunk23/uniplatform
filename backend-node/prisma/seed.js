const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const ROLES = require("../src/constants/roles");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const admins = [
    {
      username: "admin1",
      email: "admin1@uniplatform.com",
      fullname: "Admin One",
      role: ROLES.SYSTEM.ADMIN,
      password: passwordHash,
      imageuser: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "admin2",
      email: "admin2@uniplatform.com",
      fullname: "Admin Two",
      role: ROLES.SYSTEM.ADMIN,
      password: passwordHash,
      imageuser: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "admin3",
      email: "admin3@uniplatform.com",
      fullname: "Admin Three",
      role: ROLES.SYSTEM.ADMIN,
      password: passwordHash,
      address: "TP. Hồ Chí Minh",
      imageuser: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80",
    },
  ];

  for (const admin of admins) {
    await prisma.user.upsert({
      where: { username: admin.username },
      update: {
        fullname: admin.fullname,
        email: admin.email,
        imageuser: admin.imageuser,
      },
      create: admin,
    });
  }

  const members = [
    {
      username: "2313508",
      email: "2313508@student.uniplatform.com",
      fullname: "Nguyễn Ngọc Tôn",
      role: ROLES.SYSTEM.MEMBER,
      password: passwordHash,
      imageuser: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "2152392",
      email: "2152392@student.uniplatform.com",
      fullname: "Nguyễn Võ Minh Anh",
      role: ROLES.SYSTEM.MEMBER,
      password: passwordHash,
      imageuser: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "2313522",
      email: "2313522@student.uniplatform.com",
      fullname: "Võ Ngọc Thùy Trang",
      role: ROLES.SYSTEM.MEMBER,
      password: passwordHash,
      imageuser: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "2033364",
      email: "2033364@student.uniplatform.com",
      fullname: "Đào Duy Tùng",
      role: ROLES.SYSTEM.MEMBER,
      password: passwordHash,
      imageuser: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "2115302",
      email: "2115302@student.uniplatform.com",
      fullname: "Nông Thế Vinh",
      role: ROLES.SYSTEM.MEMBER,
      password: passwordHash,
      imageuser: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=256&h=256&q=80",
    },
  ];

  for (const member of members) {
    await prisma.user.upsert({
      where: { username: member.username },
      update: {
        fullname: member.fullname,
        email: member.email,
        imageuser: member.imageuser,
      },
      create: member,
    });
  }

  console.log("✅ Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
