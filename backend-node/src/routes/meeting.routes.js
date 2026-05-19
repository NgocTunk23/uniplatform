const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meeting.controller');
const { protect } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
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
} = require('../validations/meeting.schema');

router.use(protect);

/**
 * @swagger
 * /api/meetings:
 *   get:
 *     summary: Get all meetings for user's workspaces
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of meetings
 */
router.get('/', meetingController.getAllMeetings);

/**
 * @swagger
 * /api/meetings/workspace/{workspaceId}:
 *   get:
 *     summary: Get meetings for a specific workspace
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of meetings
 */
router.get('/workspace/:workspaceId', validate(workspaceMeetingsSchema), meetingController.getMeetingsByWorkspace);

/**
 * @swagger
 * /api/meetings/suggest-slots:
 *   post:
 *     summary: Suggest free slots for selected workspace participants
 *     tags: [Meetings]
 */
router.post('/suggest-slots', validate(suggestMeetingSlotsSchema), meetingController.suggestMeetingSlots);

/**
 * @swagger
 * /api/meetings/{id}/minutes:
 *   get:
 *     summary: Get meeting minutes for a meeting
 *     tags: [Meetings]
 *   put:
 *     summary: Create or update meeting minutes
 *     tags: [Meetings]
 */
router.get('/:id/minutes', validate(meetingIdSchema), meetingController.getMeetingMinutes);
router.put('/:id/minutes', validate(upsertMeetingMinutesSchema), meetingController.upsertMeetingMinutes);

router.post('/:id/transcript/correct', validate(transcriptCorrectionSchema), meetingController.correctTranscript);
router.put('/:id/transcript/review', validate(transcriptReviewSchema), meetingController.reviewTranscript);
router.post('/:id/summary/generate', validate(summaryGenerateSchema), meetingController.generateSummary);
router.post('/:id/summary/evaluate', validate(summaryEvaluateSchema), meetingController.evaluateSummary);

router.post('/:id/recording/start', validate(meetingIdSchema), meetingController.startRecording);
router.post('/:id/recording/stop', validate(meetingIdSchema), meetingController.stopRecording);
router.post('/:id/recording/reprocess', validate(meetingIdSchema), meetingController.reprocessRecording);
router.get('/:id/recording/status', validate(meetingIdSchema), meetingController.getRecordingStatus);

/**
 * @swagger
 * /api/meetings/{id}:
 *   get:
 *     summary: Get meeting details
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/:id', validate(meetingIdSchema), meetingController.getMeetingById);

/**
 * @swagger
 * /api/meetings:
 *   post:
 *     summary: Create a new meeting
 *     tags: [Meetings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [workspaceid, title, starttime, endtime]
 *             properties:
 *               workspaceid: { type: string }
 *               title: { type: string }
 *               starttime: { type: string, format: date-time }
 *               endtime: { type: string, format: date-time }
 */
router.post('/', validate(createMeetingSchema), meetingController.createMeeting);

/**
 * @swagger
 * /api/meetings/{id}:
 *   patch:
 *     summary: Update meeting details
 *     tags: [Meetings]
 */
router.patch('/:id', validate(updateMeetingSchema), meetingController.updateMeeting);

/**
 * @swagger
 * /api/meetings/{id}/status:
 *   put:
 *     summary: Update meeting status
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [upcoming, ongoing, ended] }
 */
router.put('/:id/status', validate(updateMeetingStatusSchema), meetingController.updateMeetingStatus);

/**
 * @swagger
 * /api/meetings/{id}:
 *   delete:
 *     summary: Delete a meeting
 *     tags: [Meetings]
 */
router.delete('/:id', validate(meetingIdSchema), meetingController.deleteMeeting);

module.exports = router;
