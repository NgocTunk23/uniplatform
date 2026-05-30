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

const uploadPerTrackRecordings = async ({ meeting, captureMetadata, refreshToken }) => {
  const tracks = captureMetadata?.tracks || [];
  const uploaded = [];

  for (const track of tracks) {
    if (!track.path) continue;
    const filename = `${meeting.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${meeting.meetingid}_${track.id}.wav`;
    const { path: _path, ...trackMetadata } = track;
    try {
      const driveData = await gdriveUtil.uploadFileFromPathForUser(track.path, {
        originalname: filename,
        mimetype: 'audio/wav',
      }, { refreshToken });
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

const correctTranscriptDraft = async (transcriptText) => {
  const rawTranscript = String(transcriptText || '').trim();
  return {
    correctedTranscript: rawTranscript,
    notes: null,
    uncertainSegments: [],
    fallback: false,
    source: 'raw_transcript_copy',
  };
};

const getLocalRecordingMetadata = ({ audioPath, cleanup, captureMetadata }) => ({
  status: 'available',
  mixedPath: audioPath,
  cleanupPaths: cleanup || [],
  trackPaths: (captureMetadata?.tracks || [])
    .filter(track => track.path)
    .map(track => ({ id: track.id, path: track.path })),
  createdAt: new Date().toISOString(),
});

const getLocalRecordingStatus = (metadata) => {
  const local = metadata?.localRecording;
  if (!local) return null;
  return {
    status: local.status || 'available',
    hasLocalFile: Boolean(local.mixedPath),
    trackCount: Array.isArray(local.trackPaths) ? local.trackPaths.length : 0,
    createdAt: local.createdAt || null,
    uploadedAt: local.uploadedAt || null,
    uploadError: local.uploadError || null,
  };
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

const upsertTranscriptDraft = async ({ meeting, createby, transcriptText, transcript, correction }) => {
  const correctedTranscript = String(correction?.correctedTranscript || transcriptText || '').trim();
  const correctionNotes = correction?.notes || null;

  return await prisma.meetingMinutes.upsert({
    where: { meetingid: meeting.meetingid },
    update: {
      raw_transcript: transcriptText,
      corrected_transcript: correctedTranscript,
      transcript_review_status: 'draft',
      transcript_correction_notes: correctionNotes,
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
      transcript_correction_notes: correctionNotes,
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
      ...(meeting.recording_metadata?.localRecording ? { localRecording: meeting.recording_metadata.localRecording } : {}),
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
  const correction = await correctTranscriptDraft(transcriptText);
  transcript.metadata.correction = {
    source: correction.source,
    fallback: correction.fallback,
    uncertainSegments: correction.uncertainSegments,
  };

  await upsertTranscriptDraft({ meeting, createby, transcriptText, transcript, correction });

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
      ...(meeting.recording_metadata?.localRecording ? { localRecording: meeting.recording_metadata.localRecording } : {}),
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

  const correction = await correctTranscriptDraft(transcriptText);
  await upsertTranscriptDraft({
    meeting,
    createby: meeting.meetingMinute?.createby || createby,
    transcriptText,
    transcript: {
      text: transcriptText,
      language: process.env.WHISPER_LANGUAGE || 'vi',
      metadata: {
        correction: {
          source: correction.source,
          fallback: correction.fallback,
          uncertainSegments: correction.uncertainSegments,
        },
      },
    },
    correction,
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
      ...(meeting.recording_metadata?.localRecording ? { localRecording: meeting.recording_metadata.localRecording } : {}),
    },
  });

  return {
    meeting: updatedMeeting,
    transcript: { text: transcriptText, language: process.env.WHISPER_LANGUAGE || 'vi' },
    recordingFileId: meeting.recording_file || null,
  };
};

const getExistingLocalAudioPath = (meeting) => {
  const local = meeting?.recording_metadata?.localRecording;
  return typeof local?.mixedPath === 'string' && local.mixedPath.trim()
    ? local.mixedPath.trim()
    : null;
};

const assertFileExists = async (filePath) => {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
};

const getRecordingFilename = (meeting) => (
  `${meeting.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${meeting.meetingid}_recording.wav`
);

const uploadLocalRecordingToDrive = async ({ meetingId, refreshToken }) => {
  if (!refreshToken) {
    throw new Error('Google Drive is not connected');
  }
  const meeting = await prisma.meeting.findUnique({
    where: { meetingid: meetingId },
    include: { meetingMinute: true },
  });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const metadata = meeting.recording_metadata || {};
  const localRecording = metadata.localRecording || {};
  const audioPath = getExistingLocalAudioPath(meeting);

  if (!audioPath || !(await assertFileExists(audioPath))) {
    throw new Error('Local recording file is not available for Drive upload');
  }

  await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      recording_error: null,
      recording_metadata: {
        ...metadata,
        localRecording: {
          ...localRecording,
          status: 'uploading',
          uploadError: null,
          uploadStartedAt: new Date().toISOString(),
        },
      },
    },
  });

  try {
    const driveData = await gdriveUtil.uploadFileFromPathForUser(audioPath, {
      originalname: getRecordingFilename(meeting),
      mimetype: 'audio/wav',
    }, { refreshToken });
    const trackFiles = await uploadPerTrackRecordings({
      meeting,
      captureMetadata: {
        tracks: (localRecording.trackPaths || []).map(track => ({ id: track.id, path: track.path })),
      },
      refreshToken,
    });
    const recordingDownloadLink = gdriveUtil.getDownloadLink(driveData.id);
    const existingAudioCapture = meeting.meetingMinute?.transcription_metadata?.audioCapture || {};
    const existingTranscriptionMetadata = meeting.meetingMinute?.transcription_metadata || {};
    const uploadedAudioCapture = {
      ...existingAudioCapture,
      tracks: trackFiles.length > 0 ? trackFiles : existingAudioCapture.tracks,
      mixed: {
        ...(existingAudioCapture.mixed || {}),
        recordingFileId: driveData.id,
        recordingDownloadLink,
      },
      localRecording: {
        status: 'uploaded',
        hasLocalFile: false,
        trackCount: Array.isArray(localRecording.trackPaths) ? localRecording.trackPaths.length : 0,
        uploadedAt: new Date().toISOString(),
      },
    };

    if (meeting.meetingMinute) {
      await prisma.meetingMinutes.update({
        where: { meetingid: meetingId },
        data: {
          transcription_metadata: {
            ...existingTranscriptionMetadata,
            audioCapture: uploadedAudioCapture,
          },
        },
      });
    }

    const updatedMeeting = await prisma.meeting.update({
      where: { meetingid: meetingId },
      data: {
        recording_file: driveData.id,
        recording_error: null,
        recording_metadata: {
          ...metadata,
          stage: metadata.stage || 'review_required',
          recordingFileId: driveData.id,
          localRecording: {
            status: 'uploaded',
            hasLocalFile: false,
            trackCount: Array.isArray(localRecording.trackPaths) ? localRecording.trackPaths.length : 0,
            uploadedAt: new Date().toISOString(),
          },
        },
      },
    });

    await cleanupPaths(localRecording.cleanupPaths || []);
    return { meeting: updatedMeeting, recordingFileId: driveData.id, recordingDownloadLink };
  } catch (error) {
    const uploadError = clampError(error);
    await prisma.meeting.update({
      where: { meetingid: meetingId },
      data: {
        recording_error: `Drive upload failed: ${uploadError}`,
        recording_metadata: {
          ...metadata,
          localRecording: {
            ...localRecording,
            status: 'upload_failed',
            uploadError,
            uploadFailedAt: new Date().toISOString(),
          },
        },
      },
    }).catch(() => undefined);
    throw error;
  }
};

const processMeetingRecording = async ({ meetingId, audioPath, cleanup, createby, captureMetadata }) => {
  let stage = 'capture';
  const startedAt = new Date();
  try {
    const meeting = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    if (!audioPath) {
      throw new Error('No audio was captured for this meeting');
    }

    const localRecording = getLocalRecordingMetadata({ audioPath, cleanup, captureMetadata });
    const storedCaptureMetadata = {
      ...removeLocalPathsFromCaptureMetadata(captureMetadata),
      localRecording: getLocalRecordingStatus({ localRecording }),
    };

    stage = 'transcribe';
    await setProcessingStage(meetingId, {
      stage,
      startedAt,
      data: {
        bot_status: 'processing',
        recording_error: null,
        recording_file: null,
      },
      extra: {
        localRecording,
        audioQualityWarnings: storedCaptureMetadata?.qualityWarnings || [],
        audioTrackCount: storedCaptureMetadata?.trackCount || 0,
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
      audioCapture: storedCaptureMetadata,
    };
    const correction = await correctTranscriptDraft(transcriptText);
    transcript.metadata.correction = {
      source: correction.source,
      fallback: correction.fallback,
      uncertainSegments: correction.uncertainSegments,
    };

    stage = 'review_required';
    await upsertTranscriptDraft({
      meeting: { ...meeting, recording_file: null },
      createby,
      transcriptText,
      transcript,
      correction,
    });

    const endedAt = new Date();
    const updatedMeeting = await setProcessingStage(meetingId, {
      stage: 'review_required',
      startedAt,
      endedAt,
      data: {
        bot_status: 'review_required',
        recording_file: null,
        recording_error: null,
        recording_endedat: endedAt,
      },
      extra: {
        localRecording,
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
      recordingFileId: null,
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
        ...(audioPath ? {
          localRecording: getLocalRecordingMetadata({ audioPath, cleanup, captureMetadata }),
        } : {}),
      },
      data: {
        bot_status: 'failed',
        recording_error: clampError(error),
        recording_endedat: endedAt,
      },
    }).catch(() => undefined);
    throw error;
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
        ...(meeting.recording_metadata?.localRecording ? { localRecording: meeting.recording_metadata.localRecording } : {}),
      },
    });

    if (String(meeting.meetingMinute?.raw_transcript || '').trim()) {
      stage = 'correct_transcript';
      return await createCorrectionFromExistingTranscript({ meeting, createby, startedAt });
    }

    const localAudioPath = getExistingLocalAudioPath(meeting);
    if (localAudioPath && await assertFileExists(localAudioPath)) {
      stage = 'transcribe_local';
      return await transcribeAndCreateCorrection({
        meeting,
        audioPath: localAudioPath,
        createby,
        recordingFileId: meeting.recording_file,
        startedAt,
        captureMetadata: null,
      });
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
  uploadLocalRecordingToDrive,
};
