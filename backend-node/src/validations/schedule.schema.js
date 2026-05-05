const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Schedule ID');
const dateTimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid date-time value',
});

const scheduleType = z.enum(['available', 'busy', 'tentative']);

const dateRangeRefinement = (data, ctx) => {
  if (data.starttime && data.endtime) {
    const start = new Date(data.starttime);
    const end = new Date(data.endtime);
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endtime'],
        message: 'End time must be after start time',
      });
    }
  }
};

const createScheduleSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    starttime: dateTimeString,
    endtime: dateTimeString,
    type: scheduleType.default('busy'),
  }).superRefine(dateRangeRefinement),
});

const updateScheduleSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    starttime: dateTimeString.optional(),
    endtime: dateTimeString.optional(),
    type: scheduleType.optional(),
  })
    .refine((data) => Object.keys(data).length > 0, 'At least one field is required')
    .superRefine(dateRangeRefinement),
});

const scheduleIdSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

const listSchedulesSchema = z.object({
  query: z.object({
    start: dateTimeString.optional(),
    end: dateTimeString.optional(),
    type: scheduleType.optional(),
    username: z.string().min(3).optional(),
  }).superRefine((data, ctx) => {
    if (data.start && data.end && new Date(data.end) <= new Date(data.start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'End filter must be after start filter',
      });
    }
  }),
});

module.exports = {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleIdSchema,
  listSchedulesSchema,
};
