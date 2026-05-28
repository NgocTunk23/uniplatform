#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..', '..');
const rootEnv = path.join(repoRoot, '.env');
const backendEnv = path.join(__dirname, '..', '.env');

if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, quiet: true });
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv, quiet: true });

const strict = process.argv.includes('--strict');
const failures = [];
const warnings = [];

const status = {
  pass(label, detail) {
    console.log(`[PASS] ${label}${detail ? ` - ${detail}` : ''}`);
  },
  warn(label, detail) {
    const message = `${label}${detail ? ` - ${detail}` : ''}`;
    warnings.push(message);
    console.warn(`[WARN] ${message}`);
  },
  fail(label, detail) {
    const message = `${label}${detail ? ` - ${detail}` : ''}`;
    failures.push(message);
    console.error(`[FAIL] ${message}`);
  },
};

const run = (command, args, options = {}) => spawnSync(command, args, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  ...options,
});

const checkFfmpeg = () => {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const result = run(ffmpeg, ['-version']);
  if (result.status === 0) {
    const versionLine = String(result.stdout || '').split('\n')[0];
    status.pass('ffmpeg', versionLine || ffmpeg);
  } else {
    status.fail('ffmpeg', `not executable (${ffmpeg}). Install with: brew install ffmpeg`);
  }
};

const checkPythonWhisper = () => {
  const pythonBin = process.env.PYTHON_BIN || path.join(repoRoot, 'backend-python', 'venv', 'Scripts', 'python.exe');
  if (!fs.existsSync(pythonBin)) {
    status.fail('Python venv', `${pythonBin} not found`);
    return;
  }

  const script = [
    'from faster_whisper import WhisperModel',
    'import os',
    'model=os.getenv("WHISPER_MODEL_SIZE","small")',
    'device=os.getenv("WHISPER_DEVICE","cpu")',
    'compute=os.getenv("WHISPER_COMPUTE_TYPE","int8")',
    'WhisperModel(model, device=device, compute_type=compute, local_files_only=True)',
    'print(f"{model} {device} {compute}")',
  ].join('; ');

  const result = run(pythonBin, ['-c', script], {
    env: {
      ...process.env,
      WHISPER_MODEL_SIZE: process.env.WHISPER_MODEL_SIZE || 'small',
      WHISPER_DEVICE: process.env.WHISPER_DEVICE || 'cpu',
      WHISPER_COMPUTE_TYPE: process.env.WHISPER_COMPUTE_TYPE || 'int8',
    },
  });

  if (result.status === 0) {
    status.pass('faster-whisper cache', String(result.stdout || '').trim());
  } else {
    status.warn(
      'faster-whisper cache',
      'model is not cached locally yet; start backend-python once or run a first transcription to download it'
    );
  }
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.PREFLIGHT_TIMEOUT_MS || 3000));
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
};

const checkOllama = async () => {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'qwen3:1.7b';

  try {
    const response = await fetchJson(`${baseUrl}/api/tags`);
    if (!response.ok) {
      status[strict ? 'fail' : 'warn']('Ollama daemon', `GET /api/tags returned ${response.status}`);
      return;
    }

    const models = Array.isArray(response.payload?.models)
      ? response.payload.models.map((item) => item.name)
      : [];
    if (models.includes(model)) {
      status.pass('Ollama model', model);
    } else {
      status[strict ? 'fail' : 'warn']('Ollama model', `${model} not found. Run: ollama pull ${model}`);
    }
  } catch (error) {
    status[strict ? 'fail' : 'warn']('Ollama daemon', `${baseUrl} is not reachable (${error.message})`);
  }
};

const checkPythonApi = async () => {
  const baseUrl = (process.env.PYTHON_API_URL || process.env.PYTHON_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
  try {
    const response = await fetchJson(`${baseUrl}/`);
    if (response.ok) {
      status.pass('Python API', baseUrl);
    } else {
      status[strict ? 'fail' : 'warn']('Python API', `${baseUrl} returned ${response.status}`);
    }
  } catch (error) {
    status[strict ? 'fail' : 'warn']('Python API', `${baseUrl} is not reachable (${error.message})`);
  }
};

const main = async () => {
  console.log(`Recording preflight (${strict ? 'strict' : 'advisory'})`);
  checkFfmpeg();
  checkPythonWhisper();
  await checkOllama();
  await checkPythonApi();

  if (warnings.length) {
    console.warn(`\nWarnings: ${warnings.length}`);
  }
  if (failures.length) {
    console.error(`Failures: ${failures.length}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(`[FAIL] preflight crashed - ${error.stack || error.message}`);
  process.exit(1);
});
