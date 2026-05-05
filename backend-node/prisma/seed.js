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
      address: "Hà Nội, Việt Nam",
      phone: "0912345678",
      status: "active",
      tokenVersion: 0,
      dateofbirth: new Date("1990-01-01"),
      imageuser: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "admin2",
      email: "admin2@uniplatform.com",
      fullname: "Admin Two",
      role: ROLES.SYSTEM.ADMIN,
      password: passwordHash,
      address: "Đà Nẵng, Việt Nam",
      phone: "0922345678",
      status: "active",
      tokenVersion: 0,
      dateofbirth: new Date("1992-05-15"),
      imageuser: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "admin3",
      email: "admin3@uniplatform.com",
      fullname: "Admin Three",
      role: ROLES.SYSTEM.ADMIN,
      password: passwordHash,
      address: "TP. Hồ Chí Minh, Việt Nam",
      phone: "0932345678",
      status: "active",
      tokenVersion: 0,
      dateofbirth: new Date("1988-10-20"),
      imageuser: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80",
    },
  ];

  for (const admin of admins) {
    await prisma.user.upsert({
      where: { username: admin.username },
      update: {
        fullname: admin.fullname,
        email: admin.email,
        address: admin.address,
        phone: admin.phone,
        status: admin.status,
        dateofbirth: admin.dateofbirth,
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
      address: "Bình Dương",
      phone: "0944556677",
      status: "active",
      tokenVersion: 0,
      dateofbirth: new Date("2002-03-12"),
      imageuser: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "2152392",
      email: "2152392@student.uniplatform.com",
      fullname: "Nguyễn Võ Minh Anh",
      role: ROLES.SYSTEM.MEMBER,
      password: passwordHash,
      address: "Cần Thơ",
      phone: "0955667788",
      status: "active",
      tokenVersion: 0,
      dateofbirth: new Date("2003-07-25"),
      imageuser: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "2313522",
      email: "2313522@student.uniplatform.com",
      fullname: "Võ Ngọc Thùy Trang",
      role: ROLES.SYSTEM.MEMBER,
      password: passwordHash,
      address: "Đồng Nai",
      phone: "0966778899",
      status: "active",
      tokenVersion: 0,
      dateofbirth: new Date("2002-11-30"),
      imageuser: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "2033364",
      email: "2033364@student.uniplatform.com",
      fullname: "Đào Duy Tùng",
      role: ROLES.SYSTEM.MEMBER,
      password: passwordHash,
      address: "Long An",
      phone: "0977889900",
      status: "active",
      tokenVersion: 0,
      dateofbirth: new Date("2002-09-05"),
      imageuser: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=256&h=256&q=80",
    },
    {
      username: "2115302",
      email: "2115302@student.uniplatform.com",
      fullname: "Nông Thế Vinh",
      role: ROLES.SYSTEM.MEMBER,
      password: passwordHash,
      address: "Vũng Tàu",
      phone: "0988990011",
      status: "active",
      tokenVersion: 0,
      dateofbirth: new Date("2003-01-18"),
      imageuser: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=256&h=256&q=80",
    },
  ];

  for (const member of members) {
    await prisma.user.upsert({
      where: { username: member.username },
      update: {
        fullname: member.fullname,
        email: member.email,
        address: member.address,
        phone: member.phone,
        status: member.status,
        dateofbirth: member.dateofbirth,
        imageuser: member.imageuser,
      },
      create: member,
    });
  }

  const workspaces = [
    {
      name: "Phòng Công tác Sinh viên",
      admin: "admin1",
      member: [
        { username: "admin1", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2313508", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2152392", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2313522", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Nhóm Nghiên cứu AI",
      admin: "2033364",
      member: [
        { username: "2033364", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2115302", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "admin2", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "admin3", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Câu lạc bộ IT",
      admin: "2115302",
      member: [
        { username: "2115302", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2313508", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2033364", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2152392", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Đội Tình nguyện Xung kích",
      admin: "2152392",
      member: [
        { username: "2152392", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2313522", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "admin1", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2313508", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Ban Chấp hành Đoàn khoa",
      admin: "2313522",
      member: [
        { username: "2313522", workspacerole: ROLES.WORKSPACE.LEADER },
        { username: "2313508", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "2115302", workspacerole: ROLES.WORKSPACE.MEMBER },
        { username: "admin3", workspacerole: ROLES.WORKSPACE.VIEWER },
      ],
    },
    {
      name: "Dự án UniPlatform",
      admin: "admin3",
      member: [
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
            set: ws.member
          }
        }
      });
    } else {
      currentWs = await prisma.workspace.create({
        data: {
          name: ws.name,
          admin: ws.admin,
          member: {
            set: ws.member
          }
        }
      });
    }
    seededWorkspaces.push({
      ...currentWs,
      memberUsernames: ws.member.map(m => m.username)
    });
  }

  // Seed Schedules
  console.log("🗓️ Seeding Schedules...");

  const daysFromNow = (days, hour, minute = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const scheduleSeeds = [
    {
      username: "admin1",
      title: "Student Consultation",
      description: "Open time for student support requests.",
      starttime: daysFromNow(7, 9),
      endtime: daysFromNow(7, 11),
      type: "available",
    },
    {
      username: "admin1",
      title: "Department Planning",
      description: "Internal planning block.",
      starttime: daysFromNow(8, 14),
      endtime: daysFromNow(8, 16),
      type: "busy",
    },
    {
      username: "2313508",
      title: "Project Work Block",
      description: "Focus time for UniPlatform project tasks.",
      starttime: daysFromNow(7, 13),
      endtime: daysFromNow(7, 15),
      type: "busy",
    },
    {
      username: "2313508",
      title: "Available for Review",
      description: "Free slot for team review or mentoring.",
      starttime: daysFromNow(9, 10),
      endtime: daysFromNow(9, 12),
      type: "available",
    },
    {
      username: "2152392",
      title: "Research Reading",
      description: "Reserved reading and preparation time.",
      starttime: daysFromNow(8, 9),
      endtime: daysFromNow(8, 10, 30),
      type: "tentative",
    },
    {
      username: "2152392",
      title: "Team Design Review",
      description: "Busy block for design review preparation.",
      starttime: daysFromNow(10, 14),
      endtime: daysFromNow(10, 16),
      type: "busy",
    },
    {
      username: "2313522",
      title: "Club Coordination",
      description: "Time reserved for student club coordination.",
      starttime: daysFromNow(9, 8),
      endtime: daysFromNow(9, 9, 30),
      type: "busy",
    },
    {
      username: "2313522",
      title: "Mentoring Slot",
      description: "Available slot for peer mentoring.",
      starttime: daysFromNow(11, 15),
      endtime: daysFromNow(11, 17),
      type: "available",
    },
    {
      username: "2033364",
      title: "AI Lab Work",
      description: "Focused block for AI lab experiments.",
      starttime: daysFromNow(10, 9),
      endtime: daysFromNow(10, 12),
      type: "busy",
    },
    {
      username: "2033364",
      title: "Office Hours",
      description: "Available for project questions.",
      starttime: daysFromNow(12, 13),
      endtime: daysFromNow(12, 15),
      type: "available",
    },
    {
      username: "2115302",
      title: "Workshop Preparation",
      description: "Preparation time for IT club workshop.",
      starttime: daysFromNow(11, 9),
      endtime: daysFromNow(11, 11),
      type: "busy",
    },
    {
      username: "2115302",
      title: "Flexible Support Time",
      description: "Tentative support block for workspace members.",
      starttime: daysFromNow(12, 16),
      endtime: daysFromNow(12, 17, 30),
      type: "tentative",
    },
  ];

  for (const schedule of scheduleSeeds) {
    const existing = await prisma.schedules.findFirst({
      where: {
        username: schedule.username,
        title: schedule.title,
      },
    });

    if (existing) {
      await prisma.schedules.update({
        where: { scheduleid: existing.scheduleid },
        data: schedule,
      });
    } else {
      await prisma.schedules.create({
        data: schedule,
      });
    }
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
    
    const dayOffset = status === "ended" ? -((i % 5) + 1) : (status === "upcoming" ? (i % 5) + 1 : 0);
    const meetingHour = 9 + (i % 8);
    const starttime = daysFromNow(dayOffset, meetingHour);
    const endtime = daysFromNow(dayOffset, meetingHour + 1);

    const meetingTitle = `${ws.name} - ${meetingTitles[i % meetingTitles.length]}`;

    const meetingData = {
        workspaceid: ws.workspaceid,
        title: meetingTitle,
        starttime,
        endtime,
        organizer: ws.admin,
        participants: ws.memberUsernames,
        status: status,
        link: `https://meet.uniplatform.com/seed-${i.toString().padStart(2, "0")}`,
        bot_status: status === "ongoing" ? "recording" : (status === "ended" ? "completed" : "idle"),
        recording_file: status === "ended" ? "recording_v1.mp4" : null
    };

    const existingMeeting = await prisma.meeting.findFirst({
      where: {
        workspaceid: ws.workspaceid,
        title: meetingTitle,
      },
    });

    const meeting = existingMeeting
      ? await prisma.meeting.update({
          where: { meetingid: existingMeeting.meetingid },
          data: meetingData,
        })
      : await prisma.meeting.create({ data: meetingData });

    if (status === "ended" && i % 2 === 0) {
      await prisma.meetingMinutes.upsert({
        where: { meetingid: meeting.meetingid },
        update: {
          createby: ws.admin,
          content: "Discussed key deliverables and project timeline.",
          task: ["Update design mockups", "Fix API bug"],
          decisions: ["Approved Q3 budget"],
          summary: "A productive meeting focusing on the next sprint.",
          isbotgenerated: true,
          vectorembedding: []
        },
        create: {
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
