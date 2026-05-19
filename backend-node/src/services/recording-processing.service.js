const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const prisma = require('../config/prisma');
const gdriveUtil = require('../utils/gdrive.util');
const transcriptionClient = require('./transcription-client.service');

const clampError = (error) => String(error?.message || error || 'Recording processing failed').slice(0, 500);

const getProcessingMetadata = (overrides = {}) => ({
  asrModel: process.env.WHISPER_MODEL_SIZE || 'small',
  asrDevice: process.env.WHISPER_DEVICE || 'cpu',
  asrComputeType: process.env.WHISPER_COMPUTE_TYPE || 'int8',
  asrLanguage: process.env.WHISPER_LANGUAGE || 'vi',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen3:1.7b',
  ...overrides,
});

const cleanupPaths = async (paths) => {
  for (const targetPath of paths || []) {
    if (!targetPath) continue;
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Recording cleanup failed:', error.message);
    }
  }
};

const removeLocalPathsFromCaptureMetadata = (captureMetadata) => {
  if (!captureMetadata) return null;
  const tracks = (captureMetadata.tracks || []).map(({ path: _path, ...track }) => track);
  const mixed = captureMetadata.mixed
    ? (({ path: _path, ...mixedData }) => mixedData)(captureMetadata.mixed)
    : undefined;

  return {
    ...captureMetadata,
    tracks,
    ...(mixed ? { mixed } : {}),
  };
};

const uploadPerTrackRecordings = async ({ meeting, captureMetadata }) => {
  const tracks = captureMetadata?.tracks || [];
  const uploaded = [];

  for (const track of tracks) {
    if (!track.path) continue;
    const filename = `${meeting.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${meeting.meetingid}_${track.id}.wav`;
    const { path: _path, ...trackMetadata } = track;
    try {
      const driveData = await gdriveUtil.uploadFileFromPath(track.path, {
        originalname: filename,
        mimetype: 'audio/wav',
      });
      uploaded.push({
        ...trackMetadata,
        recordingFileId: driveData.id,
        recordingDownloadLink: gdriveUtil.getDownloadLink(driveData.id),
      });
    } catch (error) {
      console.warn('Per-track recording upload failed:', error.message);
      uploaded.push({
        ...trackMetadata,
        uploadError: String(error.message || error).slice(0, 300),
      });
    }
  }

  return uploaded;
};

const setProcessingStage = async (meetingId, { stage, startedAt, endedAt, errorStage = null, extra = {}, data = {} }) => {
  return await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      ...data,
      recording_metadata: getProcessingMetadata({
        stage,
        errorStage,
        processingStartedAt: startedAt ? startedAt.toISOString() : undefined,
        processingEndedAt: endedAt ? endedAt.toISOString() : undefined,
        ...extra,
      }),
    },
  });
};

const upsertTranscriptDraft = async ({ meeting, createby, transcriptText, transcript }) => {
  const correctedTranscript = String(transcriptText || '').trim();

  return await prisma.meetingMinutes.upsert({
    where: { meetingid: meeting.meetingid },
    update: {
      raw_transcript: transcriptText,
      corrected_transcript: correctedTranscript,
      transcript_review_status: 'draft',
      transcript_correction_notes: null,
      transcript_segments: transcript?.segments,
      transcription_metadata: transcript?.metadata,
      summary: null,
      content: null,
      summary_draft: null,
      summary_review_status: 'none',
      summary_eval_score: null,
      summary_eval_metadata: {
        stage: 'not_evaluated',
      },
      decisions: [],
      task: [],
      isbotgenerated: true,
      vectorembedding: [],
    },
    create: {
      meetingid: meeting.meetingid,
      createby,
      raw_transcript: transcriptText,
      corrected_transcript: correctedTranscript,
      transcript_review_status: 'draft',
      transcript_correction_notes: null,
      transcript_segments: transcript?.segments || [],
      transcription_metadata: transcript?.metadata || {},
      summary: null,
      content: null,
      summary_draft: null,
      summary_review_status: 'none',
      summary_eval_score: null,
      summary_eval_metadata: {
        stage: 'not_evaluated',
      },
      decisions: [],
      task: [],
      isbotgenerated: true,
      vectorembedding: [],
    },
  });
};

const transcribeAndCreateCorrection = async ({ meeting, audioPath, createby, recordingFileId, startedAt, captureMetadata }) => {
  if (!audioPath) {
    throw new Error('No audio was captured for this meeting');
  }

  await setProcessingStage(meeting.meetingid, {
    stage: 'transcribe',
    startedAt,
    data: {
      bot_status: 'processing',
      recording_error: null,
    },
    extra: {
      recordingFileId: recordingFileId || meeting.recording_file || null,
    },
  });

  let transcript;
  try {
    transcript = await transcriptionClient.transcribeAudioFile(audioPath);
  } catch (error) {
    error.recordingStage = 'transcribe';
    throw error;
  }
  const transcriptText = String(transcript.text || '').trim();
  transcript.metadata = {
    ...(transcript.metadata || {}),
    audioCapture: removeLocalPathsFromCaptureMetadata(captureMetadata),
  };

  await upsertTranscriptDraft({ meeting, createby, transcriptText, transcript });

  const endedAt = new Date();
  const updatedMeeting = await setProcessingStage(meeting.meetingid, {
    stage: 'review_required',
    startedAt,
    endedAt,
    data: {
      bot_status: 'review_required',
      recording_file: recordingFileId || meeting.recording_file || null,
      recording_error: null,
      recording_endedat: endedAt,
    },
    extra: {
      recordingFileId: recordingFileId || meeting.recording_file || null,
      transcriptLength: transcriptText.length,
      transcriptLanguage: transcript.language || null,
      transcriptDurationSeconds: transcript.durationSeconds || null,
      uncertainSegmentCount: transcript.metadata?.uncertainSegmentCount || 0,
      retriedSegmentCount: transcript.metadata?.retriedSegmentCount || 0,
      audioQualityWarnings: captureMetadata?.qualityWarnings || [],
      audioTrackCount: captureMetadata?.trackCount || 0,
    },
  });

  return {
    meeting: updatedMeeting,
    transcript,
    recordingFileId: recordingFileId || meeting.recording_file || null,
  };
};

const createCorrectionFromExistingTranscript = async ({ meeting, createby, startedAt }) => {
  const transcriptText = String(meeting.meetingMinute?.raw_transcript || '').trim();
  if (!transcriptText) {
    throw new Error('No transcript is available to reprocess');
  }

  await upsertTranscriptDraft({
    meeting,
    createby: meeting.meetingMinute?.createby || createby,
    transcriptText,
  });

  const endedAt = new Date();
  const updatedMeeting = await setProcessingStage(meeting.meetingid, {
    stage: 'review_required',
    startedAt,
    endedAt,
    data: {
      bot_status: 'review_required',
      recording_error: null,
      recording_endedat: endedAt,
    },
    extra: {
      recordingFileId: meeting.recording_file || null,
      transcriptLength: transcriptText.length,
      reprocessSource: 'transcript',
    },
  });

  return {
    meeting: updatedMeeting,
    transcript: { text: transcriptText, language: process.env.WHISPER_LANGUAGE || 'vi' },
    recordingFileId: meeting.recording_file || null,
  };
};

const processMeetingRecording = async ({ meetingId, audioPath, cleanup, createby, captureMetadata }) => {
  let stage = 'capture';
  let driveFileId = null;
  const startedAt = new Date();
  try {
    const meeting = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    if (!audioPath) {
      throw new Error('No audio was captured for this meeting');
    }

    stage = 'upload';
    await setProcessingStage(meetingId, {
      stage,
      startedAt,
      data: {
        bot_status: 'processing',
        recording_error: null,
      },
    });

    const filename = `${meeting.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${meetingId}_recording.wav`;

    // Upload to Drive and transcribe in parallel to reduce end-to-end latency.
    // driveFileId is tracked eagerly so the catch block can persist it even if transcription fails.
    const [driveData, trackFiles, transcript] = await Promise.all([
      gdriveUtil.uploadFileFromPath(audioPath, {
        originalname: filename,
        mimetype: 'audio/wav',
      }).then((data) => { driveFileId = data.id; return data; }),
      uploadPerTrackRecordings({ meeting, captureMetadata }),
      transcriptionClient.transcribeAudioFile(audioPath).catch((error) => {
        error.recordingStage = 'transcribe';
        throw error;
      }),
    ]);

    const storedCaptureMetadata = {
      ...removeLocalPathsFromCaptureMetadata(captureMetadata),
      tracks: trackFiles.length > 0
        ? trackFiles
        : (removeLocalPathsFromCaptureMetadata(captureMetadata)?.tracks || []),
      mixed: {
        ...(removeLocalPathsFromCaptureMetadata(captureMetadata)?.mixed || {}),
        recordingFileId: driveData.id,
        recordingDownloadLink: gdriveUtil.getDownloadLink(driveData.id),
      },
    };

    const transcriptText = String(transcript.text || '').trim();
    transcript.metadata = {
      ...(transcript.metadata || {}),
      audioCapture: storedCaptureMetadata,
    };

    stage = 'review_required';
    await upsertTranscriptDraft({
      meeting: { ...meeting, recording_file: driveData.id },
      createby,
      transcriptText,
      transcript,
    });

    const endedAt = new Date();
    const updatedMeeting = await setProcessingStage(meetingId, {
      stage: 'review_required',
      startedAt,
      endedAt,
      data: {
        bot_status: 'review_required',
        recording_file: driveData.id,
        recording_error: null,
        recording_endedat: endedAt,
      },
      extra: {
        recordingFileId: driveData.id,
        transcriptLength: transcriptText.length,
        transcriptLanguage: transcript.language || null,
        transcriptDurationSeconds: transcript.durationSeconds || null,
        uncertainSegmentCount: transcript.metadata?.uncertainSegmentCount || 0,
        retriedSegmentCount: transcript.metadata?.retriedSegmentCount || 0,
        audioQualityWarnings: storedCaptureMetadata?.qualityWarnings || [],
        audioTrackCount: storedCaptureMetadata?.trackCount || 0,
      },
    });

    return {
      meeting: updatedMeeting,
      transcript,
      recordingFileId: driveData.id,
    };
  } catch (error) {
    const endedAt = new Date();
    await setProcessingStage(meetingId, {
      stage: 'failed',
      startedAt,
      endedAt,
      errorStage: error.recordingStage || stage,
      extra: {
        captureMetadata: removeLocalPathsFromCaptureMetadata(captureMetadata),
        ...(driveFileId ? { recordingFileId: driveFileId } : {}),
      },
      data: {
        bot_status: 'failed',
        recording_error: clampError(error),
        recording_endedat: endedAt,
        ...(driveFileId ? { recording_file: driveFileId } : {}),
      },
    }).catch(() => undefined);
    throw error;
  } finally {
    await cleanupPaths(cleanup);
  }
};

const reprocessMeetingRecording = async ({ meetingId, createby }) => {
  let stage = 'load';
  const startedAt = new Date();
  let tempDir = null;

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { meetingid: meetingId },
      include: { meetingMinute: true },
    });
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    await setProcessingStage(meetingId, {
      stage: 'reprocess',
      startedAt,
      data: {
        bot_status: 'processing',
        recording_error: null,
      },
      extra: {
        recordingFileId: meeting.recording_file || null,
      },
    });

    if (String(meeting.meetingMinute?.raw_transcript || '').trim()) {
      stage = 'correct_transcript';
      return await createCorrectionFromExistingTranscript({ meeting, createby, startedAt });
    }

    if (!meeting.recording_file) {
      throw new Error('No recording file or transcript is available to reprocess');
    }

    stage = 'upload';
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uniplatform-recording-reprocess-'));
    const audioPath = path.join(tempDir, `${meetingId}.wav`);

    await setProcessingStage(meetingId, {
      stage: 'download',
      startedAt,
      extra: {
        recordingFileId: meeting.recording_file,
        reprocessSource: 'recording_file',
      },
    });
    await gdriveUtil.downloadFileToPath(meeting.recording_file, audioPath);

    return await transcribeAndCreateCorrection({
      meeting,
      audioPath,
      createby,
      recordingFileId: meeting.recording_file,
      startedAt,
      captureMetadata: null,
    });
  } catch (error) {
    const endedAt = new Date();
    await setProcessingStage(meetingId, {
      stage: 'failed',
      startedAt,
      endedAt,
      errorStage: error.recordingStage || stage,
      data: {
        bot_status: 'failed',
        recording_error: clampError(error),
        recording_endedat: endedAt,
      },
    }).catch(() => undefined);
    throw error;
  } finally {
    await cleanupPaths(tempDir ? [tempDir] : []);
  }
};

module.exports = {
  processMeetingRecording,
  reprocessMeetingRecording,
};
