const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meeting.controller');
const { protect } = require('../middlewares/auth.middleware');

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
router.get('/workspace/:workspaceId', meetingController.getMeetingsByWorkspace);

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
router.get('/:id', meetingController.getMeetingById);

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
router.post('/', meetingController.createMeeting);

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
router.put('/:id/status', meetingController.updateMeetingStatus);

module.exports = router;
