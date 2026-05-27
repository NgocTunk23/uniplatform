const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { once } = require('events');

const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const sessions = new Map();

const getRecordingsDir = () => process.env.RECORDINGS_DIR || path.join(os.tmpdir(), 'uniplatform-recordings');
const getMaxRecordingDurationMs = () => {
  const minutes = Number(process.env.MAX_RECORDING_MINUTES || 180);
  if (!Number.isFinite(minutes) || minutes <= 0) return 180 * 60 * 1000;
  return minutes * 60 * 1000;
};

const loadSocketClient = () => {
  try {
    return require('socket.io-client').io;
  } catch (error) {
    throw new Error('socket.io-client is required for server-side recording bot');
  }
};

const loadWrtc = () => {
  try {
    return require('@roamhq/wrtc');
  } catch (error) {
    throw new Error('@roamhq/wrtc is required for server-side recording bot. Run npm install in backend-node.');
  }
};

const writeWavHeader = (stream, { sampleRate, channels, bytes }) => {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + bytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(bytes, 40);
  stream.write(header);
};

const toDbfs = (value) => {
  if (!Number.isFinite(value) || value <= 0) return null;
  return 20 * Math.log10(Math.min(1, value));
};

const buildQualityWarnings = ({ rms, peak, speechMs, durationMs, clippingRatio }) => {
  const warnings = [];
  const speechRatio = durationMs > 0 ? speechMs / durationMs : 0;

  if (durationMs <= 0 || speechMs <= 0) {
    warnings.push('no_speech_detected');
  }
  if (rms > 0 && rms < 0.015) {
    warnings.push('low_volume');
  }
  if (peak > 0.98 || clippingRatio > 0.01) {
    warnings.push('audio_clipping');
  }
  if (durationMs > 0 && speechRatio < 0.1) {
    warnings.push('mostly_silence');
  }

  return warnings;
};

class PcmTrackWriter {
  constructor({ dir, id, socketId, trackId, delayMs }) {
    this.id = id;
    this.socketId = socketId;
    this.trackId = trackId;
    this.delayMs = delayMs;
    this.rawPath = path.join(dir, `${id}.pcm`);
    this.wavPath = path.join(dir, `${id}.wav`);
    this.stream = fs.createWriteStream(this.rawPath);
    this.sampleRate = 48000;
    this.channels = 1;
    this.bytes = 0;
    this.closed = false;
    this.sampleCount = 0;
    this.sumSquares = 0;
    this.peak = 0;
    this.clippingSamples = 0;
    this.speechMs = 0;
    this.silenceMs = 0;
  }

  writeAudioData(data) {
    if (this.closed || !data?.samples) return;

    if (data.sampleRate) this.sampleRate = data.sampleRate;
    if (data.channelCount) this.channels = data.channelCount;

    const samples = data.samples;
    const buffer = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
    this.bytes += buffer.length;
    this.stream.write(buffer);

    let chunkSquares = 0;
    let chunkPeak = 0;
    let chunkClipping = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const normalized = samples[index] / 32768;
      const abs = Math.abs(normalized);
      chunkSquares += normalized * normalized;
      if (abs > chunkPeak) chunkPeak = abs;
      if (abs >= 0.999) chunkClipping += 1;
    }

    const chunkRms = samples.length > 0 ? Math.sqrt(chunkSquares / samples.length) : 0;
    const chunkDurationMs = samples.length > 0
      ? (samples.length / Math.max(1, this.sampleRate * this.channels)) * 1000
      : 0;

    this.sampleCount += samples.length;
    this.sumSquares += chunkSquares;
    this.peak = Math.max(this.peak, chunkPeak);
    this.clippingSamples += chunkClipping;
    if (chunkRms >= 0.01) {
      this.speechMs += chunkDurationMs;
    } else {
      this.silenceMs += chunkDurationMs;
    }
  }

  async finalize() {
    if (this.closed) return null;
    this.closed = true;
    this.stream.end();
    await once(this.stream, 'finish');

    if (this.bytes === 0) {
      return null;
    }

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(this.wavPath);
      out.on('error', reject);
      out.on('finish', resolve);
      writeWavHeader(out, {
        sampleRate: this.sampleRate,
        channels: this.channels,
        bytes: this.bytes,
      });
      fs.createReadStream(this.rawPath)
        .on('error', reject)
        .pipe(out, { end: true });
    });

    const durationMs = this.sampleCount > 0
      ? (this.sampleCount / Math.max(1, this.sampleRate * this.channels)) * 1000
      : 0;
    const rms = this.sampleCount > 0 ? Math.sqrt(this.sumSquares / this.sampleCount) : 0;
    const clippingRatio = this.sampleCount > 0 ? this.clippingSamples / this.sampleCount : 0;

    return {
      id: this.id,
      socketId: this.socketId,
      trackId: this.trackId,
      path: this.wavPath,
      delayMs: this.delayMs,
      sampleRate: this.sampleRate,
      channels: this.channels,
      bytes: this.bytes,
      durationSeconds: durationMs / 1000,
      speechSeconds: this.speechMs / 1000,
      silenceSeconds: this.silenceMs / 1000,
      rms,
      rmsDbfs: toDbfs(rms),
      peak: this.peak,
      peakDbfs: toDbfs(this.peak),
      clippingRatio,
      qualityWarnings: buildQualityWarnings({
        rms,
        peak: this.peak,
        speechMs: this.speechMs,
        durationMs,
        clippingRatio,
      }),
    };
  }
}

const runFfmpeg = async (args) => {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderr = [];
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg failed (${code}): ${Buffer.concat(stderr).toString('utf8').slice(0, 500)}`));
    });
  });
};

const mixWavFiles = async (inputs, outputPath) => {
  if (inputs.length === 0) {
    throw new Error('No audio tracks were captured');
  }

  const args = ['-y'];
  inputs.forEach((input) => args.push('-i', input.path));

  if (inputs.length === 1) {
    const delay = Math.max(0, Math.round(inputs[0].delayMs || 0));
    if (delay > 0) {
      args.push('-filter_complex', `adelay=${delay}:all=1,aresample=16000`, '-ac', '1', outputPath);
    } else {
      args.push('-ac', '1', '-ar', '16000', outputPath);
    }
  } else {
    const filters = inputs.map((input, index) => {
      const delay = Math.max(0, Math.round(input.delayMs || 0));
      return `[${index}:a]adelay=${delay}:all=1[a${index}]`;
    });
    const labels = inputs.map((_, index) => `[a${index}]`).join('');
    filters.push(`${labels}amix=inputs=${inputs.length}:duration=longest:normalize=0,aresample=16000[aout]`);
    args.push('-filter_complex', filters.join(';'), '-map', '[aout]', '-ac', '1', outputPath);
  }

  await runFfmpeg(args);
  return outputPath;
};

class RecordingSession {
  constructor({ meeting, authToken, serverUrl, maxDurationMs, onMaxDuration }) {
    this.meeting = meeting;
    this.meetingId = meeting.meetingid;
    this.authToken = authToken;
    this.serverUrl = serverUrl;
    this.maxDurationMs = maxDurationMs || getMaxRecordingDurationMs();
    this.onMaxDuration = onMaxDuration;
    this.startedAt = Date.now();
    this.dir = path.join(getRecordingsDir(), `${this.meetingId}-${this.startedAt}`);
    this.peers = new Map();
    this.sinks = new Map();
    this.writers = new Map();
    this.socket = null;
    this.wrtc = null;
    this.maxDurationTimer = null;
    this.maxDurationHandled = false;
  }

  async start() {
    await fsp.mkdir(this.dir, { recursive: true });
    const io = loadSocketClient();
    this.wrtc = loadWrtc();

    this.socket = io(this.serverUrl, {
      auth: {
        token: this.authToken,
        recordingBot: true,
      },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Recording bot socket connection timed out')), 10000);
      this.socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.once('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    this.socket.on('meeting_participants_update', (participants) => {
      this.syncParticipants(participants).catch((error) => {
        console.error('Recording bot participant sync failed:', error.message);
      });
    });

    this.socket.on('webrtc_signal', (payload) => {
      this.handleSignal(payload).catch((error) => {
        console.error('Recording bot signal handling failed:', error.message);
      });
    });

    this.socket.emit('join_meeting', { meetingId: this.meetingId, isRecordingBot: true });
    this.armMaxDurationTimer();
  }

  armMaxDurationTimer() {
    if (!this.maxDurationMs) return;

    this.maxDurationTimer = setTimeout(() => {
      if (this.maxDurationHandled) return;
      this.maxDurationHandled = true;
      Promise.resolve(this.onMaxDuration?.(this.meetingId))
        .catch((error) => {
          console.error('Recording max-duration handler failed:', error.message);
        });
    }, this.maxDurationMs);

    this.maxDurationTimer.unref?.();
  }

  async syncParticipants(participants) {
    for (const participant of participants || []) {
      if (!participant?.socketId || participant.socketId === this.socket.id || participant.isRecordingBot) {
        continue;
      }

      if (!this.peers.has(participant.socketId)) {
        await this.createPeer(participant.socketId, true);
      }
    }

    const participantIds = new Set((participants || []).map((participant) => participant.socketId));
    for (const [socketId, peer] of this.peers.entries()) {
      if (!participantIds.has(socketId)) {
        peer.close();
        this.peers.delete(socketId);
      }
    }
  }

  async createPeer(targetSocketId, shouldOffer) {
    const peer = new this.wrtc.RTCPeerConnection(PEER_CONFIG);
    this.peers.set(targetSocketId, peer);

    peer.addTransceiver('audio', { direction: 'recvonly' });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc_signal', {
          targetSocketId,
          signalData: event.candidate,
          meetingId: this.meetingId,
        });
      }
    };

    peer.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        this.attachAudioSink(event.track, targetSocketId);
      }
    };

    peer.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) {
        console.warn(`Recording bot peer ${targetSocketId} state: ${peer.connectionState}`);
      }
    };

    if (shouldOffer) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.socket.emit('webrtc_signal', {
        targetSocketId,
        signalData: peer.localDescription,
        meetingId: this.meetingId,
      });
    }

    return peer;
  }

  attachAudioSink(track, targetSocketId) {
    const RTCAudioSink = this.wrtc.nonstandard?.RTCAudioSink;
    if (!RTCAudioSink) {
      throw new Error('@roamhq/wrtc does not expose RTCAudioSink');
    }

    const sink = new RTCAudioSink(track);
    const writerId = `${targetSocketId}-${track.id}`.replace(/[^a-z0-9_-]/gi, '_');
    const writer = new PcmTrackWriter({
      dir: this.dir,
      id: writerId,
      socketId: targetSocketId,
      trackId: track.id,
      delayMs: Date.now() - this.startedAt,
    });

    sink.ondata = (data) => writer.writeAudioData(data);
    this.sinks.set(writerId, sink);
    this.writers.set(writerId, writer);
  }

  async handleSignal({ senderSocketId, signalData }) {
    if (!senderSocketId || !signalData) return;
    const peer = this.peers.get(senderSocketId) || await this.createPeer(senderSocketId, false);

    if (signalData.type) {
      await peer.setRemoteDescription(new this.wrtc.RTCSessionDescription(signalData));
      if (signalData.type === 'offer') {
        await peer.setLocalDescription(await peer.createAnswer());
        this.socket.emit('webrtc_signal', {
          targetSocketId: senderSocketId,
          signalData: peer.localDescription,
          meetingId: this.meetingId,
        });
      }
      return;
    }

    if (signalData.candidate) {
      await peer.addIceCandidate(new this.wrtc.RTCIceCandidate(signalData));
    }
  }

  async stop() {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    for (const sink of this.sinks.values()) {
      sink.stop();
    }
    this.sinks.clear();

    for (const peer of this.peers.values()) {
      peer.close();
    }
    this.peers.clear();

    if (this.socket) {
      this.socket.emit('leave_meeting', { meetingId: this.meetingId });
      this.socket.disconnect();
    }

    const finalized = [];
    for (const writer of this.writers.values()) {
      const wav = await writer.finalize();
      if (wav) finalized.push(wav);
    }

    if (finalized.length === 0) {
      return {
        audioPath: null,
        cleanup: [this.dir],
        startedAt: new Date(this.startedAt),
        endedAt: new Date(),
        captureMetadata: {
          startedAt: new Date(this.startedAt).toISOString(),
          endedAt: new Date().toISOString(),
          trackCount: 0,
          tracks: [],
          qualityWarnings: ['no_audio_tracks'],
        },
      };
    }

    const outputPath = path.join(this.dir, `${this.meetingId}-mixed.wav`);
    await mixWavFiles(finalized, outputPath);
    const endedAt = new Date();
    const aggregateWarnings = [...new Set(finalized.flatMap((track) => track.qualityWarnings || []))];

    return {
      audioPath: outputPath,
      cleanup: [this.dir],
      startedAt: new Date(this.startedAt),
      endedAt,
      captureMetadata: {
        startedAt: new Date(this.startedAt).toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds: (endedAt.getTime() - this.startedAt) / 1000,
        trackCount: finalized.length,
        tracks: finalized,
        mixed: {
          path: outputPath,
          sampleRate: 16000,
          channels: 1,
        },
        qualityWarnings: aggregateWarnings,
      },
    };
  }
}

const startRecording = async ({ meeting, authToken, serverUrl, maxDurationMs, onMaxDuration }) => {
  if (sessions.has(meeting.meetingid)) {
    throw new Error('Recording is already active for this meeting');
  }

  const session = new RecordingSession({ meeting, authToken, serverUrl, maxDurationMs, onMaxDuration });
  sessions.set(meeting.meetingid, session);

  try {
    await session.start();
    return { startedAt: new Date(session.startedAt) };
  } catch (error) {
    sessions.delete(meeting.meetingid);
    throw error;
  }
};

const stopRecording = async (meetingId) => {
  const session = sessions.get(meetingId);
  if (!session) {
    throw new Error('No active recording session found');
  }

  sessions.delete(meetingId);
  return await session.stop();
};

const hasActiveSession = (meetingId) => sessions.has(meetingId);

module.exports = {
  startRecording,
  stopRecording,
  hasActiveSession,
};
