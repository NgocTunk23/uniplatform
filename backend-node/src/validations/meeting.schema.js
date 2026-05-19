const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Object ID');
const dateTimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid date-time value',
});

const meetingStatus = z.enum(['upcoming', 'ongoing', 'ended']);

const dateRangeRefinement = (data, ctx) => {
  if (data.starttime && data.endtime && new Date(data.endtime) <= new Date(data.starttime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endtime'],
      message: 'End time must be after start time',
    });
  }
};

const createMeetingSchema = z.object({
  body: z.object({
    workspaceid: objectId,
    title: z.string().trim().min(1).max(180),
    starttime: dateTimeString,
    endtime: dateTimeString,
    participants: z.array(z.string().min(3)).optional(),
    link: z.string().trim().url().optional().or(z.literal('')),
    place: z.string().trim().max(200).optional().nullable(),
    force: z.boolean().optional(),
  }).superRefine(dateRangeRefinement),
});

const suggestMeetingSlotsSchema = z.object({
  body: z.object({
    workspaceid: objectId,
    participants: z.array(z.string().min(3)).min(1),
    durationMinutes: z.number().int().min(15).max(480),
    searchStart: dateTimeString,
    searchEnd: dateTimeString,
    stepMinutes: z.number().int().min(5).max(120).optional(),
  }).superRefine((data, ctx) => {
    if (new Date(data.searchEnd) <= new Date(data.searchStart)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['searchEnd'],
        message: 'Search end must be after search start',
      });
    }
  }),
});

const updateMeetingSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    title: z.string().trim().min(1).max(180).optional(),
    starttime: dateTimeString.optional(),
    endtime: dateTimeString.optional(),
    participants: z.array(z.string().min(3)).optional(),
    status: meetingStatus.optional(),
    link: z.string().trim().url().optional().or(z.literal('')),
    place: z.string().trim().max(200).optional().nullable(),
    bot_status: z.string().trim().max(80).optional().nullable(),
    recording_file: z.string().trim().max(500).optional().nullable(),
  })
    .refine((data) => Object.keys(data).length > 0, 'At least one field is required')
    .superRefine(dateRangeRefinement),
});

const meetingIdSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

const workspaceMeetingsSchema = z.object({
  params: z.object({
    workspaceId: objectId,
  }),
});

const updateMeetingStatusSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    status: meetingStatus,
  }),
});

const upsertMeetingMinutesSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    content: z.string().trim().max(20000).optional().nullable(),
    raw_transcript: z.string().trim().max(50000).optional().nullable(),
    corrected_transcript: z.string().trim().max(100000).optional().nullable(),
    transcript_review_status: z.enum(['none', 'draft', 'approved']).optional().nullable(),
    transcript_correction_notes: z.string().trim().max(20000).optional().nullable(),
    transcript_segments: z.array(z.record(z.string(), z.unknown())).max(5000).optional().nullable(),
    transcription_metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    summary: z.string().trim().max(10000).optional().nullable(),
    summary_draft: z.string().trim().max(10000).optional().nullable(),
    summary_review_status: z.enum(['none', 'pending', 'passed', 'failed']).optional().nullable(),
    summary_eval_score: z.number().min(0).max(1).optional().nullable(),
    summary_eval_metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    decisions: z.array(z.string().trim().max(1000)).max(50).optional(),
    task: z.array(z.string().trim().max(1000)).max(100).optional(),
    isbotgenerated: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, 'At least one field is required'),
});

const transcriptCorrectionSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    raw_transcript: z.string().trim().max(100000).optional(),
  }).optional().default({}),
});

const transcriptReviewSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    corrected_transcript: z.string().trim().min(1).max(100000),
    approve: z.boolean().optional(),
  }),
});

const summaryGenerateSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

const summaryEvaluateSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    summary: z.string().trim().min(1).max(10000),
    content: z.string().trim().max(20000).optional().nullable(),
    decisions: z.array(z.string().trim().max(1000)).max(50).optional(),
    task: z.array(z.string().trim().max(1000)).max(100).optional(),
  }),
});

module.exports = {
  createMeetingSchema,
  updateMeetingSchema,
  suggestMeetingSlotsSchema,
  meetingIdSchema,
  workspaceMeetingsSchema,
  updateMeetingStatusSchema,
  upsertMeetingMinutesSchema,
  transcriptCorrectionSchema,
  transcriptReviewSchema,
  summaryGenerateSchema,
  summaryEvaluateSchema,
};
