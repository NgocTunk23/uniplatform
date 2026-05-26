const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const escapeMultipartValue = (value) => String(value).replace(/"/g, '%22').replace(/\r?\n/g, ' ');

const getPythonApiUrl = () => {
  const configured = process.env.PYTHON_API_URL || process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
  return configured.replace(/\/$/, '');
};

const collectJsonResponse = (res, resolve, reject) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    let payload = null;

    try {
      payload = body ? JSON.parse(body) : null;
    } catch (error) {
      return reject(new Error(`Transcription service returned invalid JSON: ${body.slice(0, 200)}`));
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      return reject(new Error(payload?.detail || payload?.message || `Transcription service failed with ${res.statusCode}`));
    }

    if (!payload || typeof payload.text !== 'string') {
      return reject(new Error('Transcription service response is missing text'));
    }

    resolve(payload);
  });
};

const transcribeAudioFile = async (filePath) => {
  const stats = await fs.promises.stat(filePath);
  if (!stats.isFile() || stats.size === 0) {
    throw new Error('Recording audio file is empty');
  }

  const endpoint = new URL('/api/transcription/transcribe', getPythonApiUrl());
  const boundary = `uniplatform-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const filename = escapeMultipartValue(path.basename(filePath));
  const language = process.env.WHISPER_LANGUAGE || 'vi';
  const wordTimestamps = process.env.WHISPER_WORD_TIMESTAMPS === 'true';
  const retryUncertainSegments = process.env.WHISPER_RETRY_UNCERTAIN_SEGMENTS !== 'false';
  const fileHeader = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="language"\r\n\r\n` +
    `${language}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="word_timestamps"\r\n\r\n` +
    `${wordTimestamps}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="retry_uncertain_segments"\r\n\r\n` +
    `${retryUncertainSegments}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: audio/wav\r\n\r\n`
  );
  const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`);

  const transport = endpoint.protocol === 'https:' ? https : http;
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': fileHeader.length + stats.size + fileFooter.length,
    },
    timeout: Number(process.env.TRANSCRIPTION_TIMEOUT_MS || 30 * 60 * 1000),
  };

  return await new Promise((resolve, reject) => {
    const req = transport.request(endpoint, requestOptions, (res) => collectJsonResponse(res, resolve, reject));
    const stream = fs.createReadStream(filePath);

    req.on('timeout', () => {
      req.destroy(new Error('Transcription service timed out'));
    });
    req.on('error', reject);
    stream.on('error', (error) => req.destroy(error));
    stream.on('end', () => req.end(fileFooter));

    req.write(fileHeader);
    stream.pipe(req, { end: false });
  });
};

module.exports = {
  transcribeAudioFile,
};
