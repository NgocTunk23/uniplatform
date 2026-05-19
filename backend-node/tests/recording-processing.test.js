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
    upsert: jest.fn(),
  },
};

const mockDrive = {
  uploadFileFromPath: jest.fn(),
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
    mockPrisma.meetingMinutes.upsert.mockResolvedValue({});
    mockDrive.uploadFileFromPath.mockResolvedValue({ id: 'drive_recording_1' });
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

  test('uploads recording, transcribes, creates corrected transcript draft, and waits for review', async () => {
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

    expect(mockDrive.uploadFileFromPath).toHaveBeenCalledWith('/tmp/meeting.wav', expect.objectContaining({
      originalname: 'sprint_planning_tu_n_1_meeting_1_recording.wav',
      mimetype: 'audio/wav',
    }));
    expect(mockDrive.uploadFileFromPath).toHaveBeenCalledWith('/tmp/socket-track.wav', expect.objectContaining({
      originalname: expect.stringContaining('socket-track.wav'),
      mimetype: 'audio/wav',
    }));
    expect(mockTranscription.transcribeAudioFile).toHaveBeenCalledWith('/tmp/meeting.wav');
    expect(mockOllama.correctMeetingTranscript).toHaveBeenCalledWith(
      'Xin chào nhóm. Hôm nay thống nhất triển khai ghi âm.',
      mockMeeting.title
    );
    expect(mockOllama.summarizeMeetingTranscript).not.toHaveBeenCalled();
    expect(mockPrisma.meetingMinutes.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { meetingid: mockMeeting.meetingid },
      create: expect.objectContaining({
        createby: 'leader',
        raw_transcript: 'Xin chào nhóm. Hôm nay thống nhất triển khai ghi âm.',
        corrected_transcript: 'Xin chào nhóm. Hôm nay thống nhất triển khai ghi âm.',
        transcript_review_status: 'draft',
        transcript_correction_notes: 'Transcript đã được hiệu đính.',
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
        recording_file: 'drive_recording_1',
        recording_error: null,
        recording_metadata: expect.objectContaining({
          stage: 'review_required',
          asrModel: 'small',
          ollamaModel: 'qwen3:1.7b',
          audioQualityWarnings: ['low_volume'],
          audioTrackCount: 1,
        }),
      }),
    }));
    expect(result.recordingFileId).toBe('drive_recording_1');
  });

  test('marks meeting failed when transcription fails after recording upload', async () => {
    mockTranscription.transcribeAudioFile.mockRejectedValue(new Error('Whisper unavailable'));

    await expect(processMeetingRecording({
      meetingId: mockMeeting.meetingid,
      audioPath: '/tmp/meeting.wav',
      cleanup: [],
      createby: 'leader',
    })).rejects.toThrow('Whisper unavailable');

    expect(mockDrive.uploadFileFromPath).toHaveBeenCalled();
    expect(mockPrisma.meeting.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ recording_file: 'drive_recording_1' }),
    }));
    expect(mockPrisma.meeting.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bot_status: 'failed',
        recording_error: 'Whisper unavailable',
        recording_metadata: expect.objectContaining({
          errorStage: 'transcribe',
        }),
      }),
    }));
    expect(mockPrisma.meetingMinutes.upsert).not.toHaveBeenCalled();
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
    expect(mockOllama.correctMeetingTranscript).toHaveBeenCalledWith(
      'Transcript đã có sẵn để tóm tắt lại.',
      mockMeeting.title
    );
    expect(mockPrisma.meetingMinutes.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        raw_transcript: 'Transcript đã có sẵn để tóm tắt lại.',
        transcript_review_status: 'draft',
        summary_review_status: 'none',
        isbotgenerated: true,
      }),
    }));
    expect(result.recordingFileId).toBe('drive_recording_1');
  });
});
