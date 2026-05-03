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

  const workspaces = [
    {
      name: "Phòng Công tác Sinh viên",
      admin: "admin1",
      members: [
        { username: "admin1", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2313508", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2152392", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2313522", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Nhóm Nghiên cứu AI",
      admin: "2033364",
      members: [
        { username: "2033364", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2115302", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "admin2", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "admin3", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Câu lạc bộ IT",
      admin: "2115302",
      members: [
        { username: "2115302", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2313508", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2033364", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2152392", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Đội Tình nguyện Xung kích",
      admin: "2152392",
      members: [
        { username: "2152392", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2313522", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "admin1", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2313508", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Ban Chấp hành Đoàn khoa",
      admin: "2313522",
      members: [
        { username: "2313522", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2313508", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2115302", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "admin3", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Dự án UniPlatform",
      admin: "admin3",
      members: [
        { username: "admin3", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2033364", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2115302", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "admin1", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
  ];

  const seededWorkspaces = [];

  for (const ws of workspaces) {
    const existing = await prisma.workspace.findFirst({
      where: { name: ws.name }
    });

    let currentWs;
    if (existing) {
      currentWs = await prisma.workspace.update({
        where: { workspaceid: existing.workspaceid },
        data: {
          admin: ws.admin,
          member: {
            set: ws.members
          }
        }
      });
    } else {
      currentWs = await prisma.workspace.create({
        data: {
          name: ws.name,
          admin: ws.admin,
          member: {
            set: ws.members
          }
        }
      });
    }
    seededWorkspaces.push({
      ...currentWs,
      memberUsernames: ws.members.map(m => m.username)
    });
  }

  // Seed Meetings
  console.log("📅 Seeding Meetings...");
  const meetingTitles = [
    "Sprint Planning", "Design Review", "Marketing Sync", 
    "Weekly Sync", "Client Presentation", "Tech Debt Review",
    "Product Brainstorming", "All Hands", "Retrospective"
  ];
  const statuses = ["ongoing", "upcoming", "ended", "upcoming", "ended"];
  
  for (let i = 0; i < 20; i++) {
    const ws = seededWorkspaces[i % seededWorkspaces.length];
    const status = statuses[i % statuses.length];
    
    let starttime = new Date();
    let endtime = new Date();
    
    if (status === "ongoing") {
      starttime.setMinutes(starttime.getMinutes() - 30);
      endtime.setMinutes(endtime.getMinutes() + 30);
    } else if (status === "upcoming") {
      starttime.setDate(starttime.getDate() + (i % 5) + 1);
      endtime = new Date(starttime);
      endtime.setHours(endtime.getHours() + 1);
    } else { // ended
      starttime.setDate(starttime.getDate() - (i % 5) - 1);
      endtime = new Date(starttime);
      endtime.setHours(endtime.getHours() + 1);
    }

    const meetingTitle = `${ws.name} - ${meetingTitles[i % meetingTitles.length]}`;
    
    const meeting = await prisma.meeting.create({
      data: {
        workspaceid: ws.workspaceid,
        title: meetingTitle,
        starttime,
        endtime,
        organizer: ws.admin,
        participants: ws.memberUsernames,
        status: status,
        link: `https://meet.uniplatform.com/${Math.random().toString(36).substring(2, 10)}`,
        bot_status: status === "ongoing" ? "recording" : (status === "ended" ? "completed" : "idle"),
        recording_file: status === "ended" ? "recording_v1.mp4" : null
      }
    });

    if (status === "ended" && i % 2 === 0) {
      await prisma.meetingMinutes.create({
        data: {
          meetingid: meeting.meetingid,
          createby: ws.admin,
          content: "Discussed key deliverables and project timeline.",
          task: ["Update design mockups", "Fix API bug"],
          decisions: ["Approved Q3 budget"],
          summary: "A productive meeting focusing on the next sprint.",
          isbotgenerated: true,
          vectorembedding: []
        }
      });
    }
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
