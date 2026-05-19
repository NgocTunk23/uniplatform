const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:5173';
const meetingUrl = process.env.E2E_MEETING_URL || '';

const printManualChecklist = () => {
  console.log('Manual recording E2E checklist');
  console.log(`1. Start frontend at ${baseUrl}`);
  console.log('2. Start backend-node, backend-python, MongoDB, Ollama, and ffmpeg preflight');
  console.log('3. Create a meeting, then set E2E_MEETING_URL to the meeting room URL');
  console.log('4. Run this script again to open two fake-media browser windows');
  console.log('5. Start recording as organizer, speak or use fake audio, stop recording, then open Meeting Review');
};

if (!meetingUrl) {
  printManualChecklist();
  process.exit(0);
}

let chromium;
try {
  ({ chromium } = await import('@playwright/test'));
} catch (_error) {
  console.log('Optional Playwright runner is not installed.');
  console.log('Install it with: npm install -D @playwright/test && npx playwright install chromium');
  printManualChecklist();
  process.exit(0);
}

const browser = await chromium.launch({
  headless: false,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ],
});

const contextA = await browser.newContext({
  permissions: ['microphone', 'camera'],
});
const contextB = await browser.newContext({
  permissions: ['microphone', 'camera'],
});

const pageA = await contextA.newPage();
const pageB = await contextB.newPage();

await Promise.all([
  pageA.goto(meetingUrl),
  pageB.goto(meetingUrl),
]);

console.log('Two fake-media browser windows are open.');
console.log('Manual steps: login if needed, join room, start/stop recording, then inspect Meeting Review.');
console.log('Press Ctrl+C when finished.');

process.on('SIGINT', async () => {
  await browser.close();
  process.exit(0);
});

await new Promise(() => {});
