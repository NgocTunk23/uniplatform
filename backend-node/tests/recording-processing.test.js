const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const mockMeeting = {
  meetingid: 'meeting_1',
  title: 'Sprint Planning / Tuần 1',
  organizer: 'leader',
};

const mockPrisma = {
  meeting: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  meetingMinutes: {
    update: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockDrive = {
  uploadFileFromPath: jest.fn(),
  uploadFileFromPathForUser: jest.fn(),
  downloadFileToPath: jest.fn(),
  getDownloadLink: jest.fn((fileId) => `https://drive.google.com/uc?export=download&id=${fileId}`),
};

const mockTranscription = {
  transcribeAudioFile: jest.fn(),
};

const mockOllama = {
  summarizeMeetingTranscript: jest.fn(),
  correctMeetingTranscript: jest.fn(),
};

jest.mock('../src/config/prisma', () => mockPrisma);
jest.mock('../src/utils/gdrive.util', () => mockDrive);
jest.mock('../src/services/transcription-client.service', () => mockTranscription);
jest.mock('../src/services/ollama.service', () => mockOllama);

const {
  processMeetingRecording,
  reprocessMeetingRecording,
  uploadLocalRecordingToDrive,
} = require('../src/services/recording-processing.service');

describe('recording-processing.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.meeting.findUnique.mockImplementation(async (args) => {
      if (args?.include?.meetingMinute) {
        return {
          ...mockMeeting,
          recording_file: 'drive_recording_1',
          meetingMinute: {
            createby: 'leader',
            raw_transcript: 'Transcript đã có sẵn để tóm tắt lại.',
          },
        };
      }
      return { ...mockMeeting };
    });
    mockPrisma.meeting.update.mockImplementation(async ({ data }) => ({ ...mockMeeting, ...data }));
    mockPrisma.meetingMinutes.update.mockImplementation(async ({ data }) => data);
    mockPrisma.meetingMinutes.upsert.mockResolvedValue({});
    mockDrive.uploadFileFromPath.mockResolvedValue({ id: 'drive_recording_1' });
    mockDrive.uploadFileFromPathForUser.mockResolvedValue({ id: 'drive_recording_1' });
    mockDrive.downloadFileToPath.mockResolvedValue('/tmp/downloaded.wav');
    mockTranscription.transcribeAudioFile.mockResolvedValue({
      text: 'Xin chào nhóm. Hôm nay thống nhất triển khai ghi âm.',
      language: 'vi',
      segments: [
        { id: 1, start: 0, end: 2, text: 'Xin chào nhóm.', uncertain: false, words: [] },
      ],
      metadata: {
        segmentCount: 1,
        uncertainSegmentCount: 0,
        retriedSegmentCount: 0,
      },
    });
    mockOllama.correctMeetingTranscript.mockResolvedValue({
      correctedTranscript: 'Xin chào nhóm. Hôm nay thống nhất triển khai ghi âm.',
      uncertainSegments: [],
      notes: 'Transcript đã được hiệu đính.',
    });
  });

  test('transcribes local recording, creates editable transcript draft, and waits for review without Drive upload', async () => {
    const result = await processMeetingRecording({
      meetingId: mockMeeting.meetingid,
      audioPath: '/tmp/meeting.wav',
      cleanup: [],
      createby: 'leader',
      captureMetadata: {
        trackCount: 1,
        qualityWarnings: ['low_volume'],
        tracks: [{ id: 'socket-track', path: '/tmp/socket-track.wav', speechSeconds: 4, qualityWarnings: ['low_volume'] }],
        mixed: { path: '/tmp/meeting.wav', sampleRate: 16000, channels: 1 },
      },
    });

    expect(mockDrive.uploadFileFromPath).not.toHaveBeenCalled();
    expect(mockTranscription.transcribeAudioFile).toHaveBeenCalledWith('/tmp/meeting.wav');
    expect(mockOllama.correctMeetingTranscript).not.toHaveBeenCalled();
    expect(mockOllama.summarizeMeetingTranscript).not.toHaveBeenCalled();
    expect(mockPrisma.meetingMinutes.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { meetingid: mockMeeting.meetingid },
      create: expect.objectContaining({
        createby: 'leader',
        raw_transcript: 'Xin chào nhóm. Hôm nay thống nhất triển khai ghi âm.',
        corrected_transcript: 'Xin chào nhóm. Hôm nay thống nhất triển khai ghi âm.',
        transcript_review_status: 'draft',
        transcript_correction_notes: null,
        transcript_segments: [
          { id: 1, start: 0, end: 2, text: 'Xin chào nhóm.', uncertain: false, words: [] },
        ],
        transcription_metadata: expect.objectContaining({
          segmentCount: 1,
          uncertainSegmentCount: 0,
        }),
        summary: null,
        summary_draft: null,
        summary_review_status: 'none',
        decisions: [],
        task: [],
        isbotgenerated: true,
      }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bot_status: 'review_required',
        recording_file: null,
        recording_error: null,
        recording_metadata: expect.objectContaining({
          stage: 'review_required',
          asrModel: 'small',
          audioQualityWarnings: ['low_volume'],
          audioTrackCount: 1,
          localRecording: expect.objectContaining({
            status: 'available',
            mixedPath: '/tmp/meeting.wav',
          }),
        }),
      }),
    }));
    expect(result.recordingFileId).toBeNull();
  });

  test('marks meeting failed when transcription fails and keeps local recording metadata', async () => {
    mockTranscription.transcribeAudioFile.mockRejectedValue(new Error('Whisper unavailable'));

    await expect(processMeetingRecording({
      meetingId: mockMeeting.meetingid,
      audioPath: '/tmp/meeting.wav',
      cleanup: [],
      createby: 'leader',
    })).rejects.toThrow('Whisper unavailable');

    expect(mockDrive.uploadFileFromPath).not.toHaveBeenCalled();
    expect(mockPrisma.meeting.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bot_status: 'failed',
        recording_error: 'Whisper unavailable',
        recording_metadata: expect.objectContaining({
          errorStage: 'transcribe',
          localRecording: expect.objectContaining({
            status: 'available',
            mixedPath: '/tmp/meeting.wav',
          }),
        }),
      }),
    }));
    expect(mockPrisma.meetingMinutes.upsert).not.toHaveBeenCalled();
  });

  test('keeps recording local when transcription succeeds', async () => {
    const result = await processMeetingRecording({
      meetingId: mockMeeting.meetingid,
      audioPath: '/tmp/meeting.wav',
      cleanup: [],
      createby: 'leader',
    });

    expect(mockTranscription.transcribeAudioFile).toHaveBeenCalledWith('/tmp/meeting.wav');
    expect(mockPrisma.meetingMinutes.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        createby: 'leader',
        raw_transcript: 'Xin chào nhóm. Hôm nay thống nhất triển khai ghi âm.',
        corrected_transcript: 'Xin chào nhóm. Hôm nay thống nhất triển khai ghi âm.',
        transcript_review_status: 'draft',
      }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bot_status: 'review_required',
        recording_file: null,
        recording_error: null,
        recording_metadata: expect.objectContaining({
          stage: 'review_required',
          localRecording: expect.objectContaining({
            status: 'available',
            mixedPath: '/tmp/meeting.wav',
          }),
        }),
      }),
    }));
    expect(result.recordingFileId).toBeNull();
  });

  test('marks meeting failed when no audio path is provided', async () => {
    await expect(processMeetingRecording({
      meetingId: mockMeeting.meetingid,
      audioPath: null,
      cleanup: [],
      createby: 'leader',
    })).rejects.toThrow('No audio was captured for this meeting');

    expect(mockDrive.uploadFileFromPath).not.toHaveBeenCalled();
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bot_status: 'failed',
        recording_error: 'No audio was captured for this meeting',
        recording_metadata: expect.objectContaining({
          errorStage: 'capture',
        }),
      }),
    }));
  });

  test('reprocesses existing transcript into a corrected draft without downloading recording again', async () => {
    const result = await reprocessMeetingRecording({
      meetingId: mockMeeting.meetingid,
      createby: 'leader',
    });

    expect(mockDrive.downloadFileToPath).not.toHaveBeenCalled();
    expect(mockTranscription.transcribeAudioFile).not.toHaveBeenCalled();
    expect(mockOllama.correctMeetingTranscript).not.toHaveBeenCalled();
    expect(mockPrisma.meetingMinutes.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        raw_transcript: 'Transcript đã có sẵn để tóm tắt lại.',
        corrected_transcript: 'Transcript đã có sẵn để tóm tắt lại.',
        transcript_review_status: 'draft',
        summary_review_status: 'none',
        isbotgenerated: true,
      }),
    }));
    expect(result.recordingFileId).toBe('drive_recording_1');
  });

  test('uploads retained local recording to Drive on explicit request', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recording-upload-test-'));
    const audioPath = path.join(tempDir, 'meeting.wav');
    await fs.writeFile(audioPath, 'audio');

    mockPrisma.meeting.findUnique.mockResolvedValueOnce({
      ...mockMeeting,
      recording_file: null,
      recording_metadata: {
        stage: 'review_required',
        localRecording: {
          status: 'available',
          mixedPath: audioPath,
          cleanupPaths: [tempDir],
          trackPaths: [],
        },
      },
      meetingMinute: {
        transcription_metadata: {
          audioCapture: {
            mixed: { sampleRate: 16000 },
          },
        },
      },
    });

    const result = await uploadLocalRecordingToDrive({ meetingId: mockMeeting.meetingid, refreshToken: 'user-refresh-token' });

    expect(mockDrive.uploadFileFromPathForUser).toHaveBeenCalledWith(audioPath, expect.objectContaining({
      originalname: 'sprint_planning_tu_n_1_meeting_1_recording.wav',
      mimetype: 'audio/wav',
    }), { refreshToken: 'user-refresh-token' });
    expect(mockPrisma.meetingMinutes.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { meetingid: mockMeeting.meetingid },
      data: expect.objectContaining({
        transcription_metadata: expect.objectContaining({
          audioCapture: expect.objectContaining({
            mixed: expect.objectContaining({
              recordingFileId: 'drive_recording_1',
            }),
          }),
        }),
      }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        recording_file: 'drive_recording_1',
        recording_metadata: expect.objectContaining({
          localRecording: expect.objectContaining({
            status: 'uploaded',
            hasLocalFile: false,
          }),
        }),
      }),
    }));
    expect(result.recordingFileId).toBe('drive_recording_1');
  });
});
