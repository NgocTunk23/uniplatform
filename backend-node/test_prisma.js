const prisma = require('./src/config/prisma');

async function test() {
  try {
    console.log("Prisma model keys:", Object.keys(prisma).filter(k => !k.startsWith('_')));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
