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
    summary: z.string().trim().max(10000).optional().nullable(),
    decisions: z.array(z.string().trim().max(1000)).max(50).optional(),
    task: z.array(z.string().trim().max(1000)).max(100).optional(),
    isbotgenerated: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, 'At least one field is required'),
});

module.exports = {
  createMeetingSchema,
  updateMeetingSchema,
  suggestMeetingSlotsSchema,
  meetingIdSchema,
  workspaceMeetingsSchema,
  updateMeetingStatusSchema,
  upsertMeetingMinutesSchema,
};
