const meetingService = require('../services/meeting.service');
const ApiError = require('../utils/api-error');

/**
 * @swagger
 * components:
 *   schemas:
 *     Meeting:
 *       type: object
 *       properties:
 *         meetingid: { type: string }
 *         workspaceid: { type: string }
 *         title: { type: string }
 *         starttime: { type: string, format: date-time }
 *         endtime: { type: string, format: date-time }
 *         organizer: { type: string }
 *         participants: { type: array, items: { type: string } }
 *         status: { type: string, enum: [upcoming, ongoing, ended] }
 *         link: { type: string }
 *         place: { type: string }
 *         bot_status: { type: string }
 */

const getAllMeetings = async (req, res, next) => {
  try {
    const meetings = await meetingService.getAllMeetings(req.user);
    res.json(meetings);
  } catch (error) {
    next(error);
  }
};

const getMeetingsByWorkspace = async (req, res, next) => {
  try {
    const meetings = await meetingService.getMeetingsByWorkspace(req.params.workspaceId, req.user);
    res.json(meetings);
  } catch (error) {
    next(error);
  }
};

const getMeetingById = async (req, res, next) => {
  try {
    const meeting = await meetingService.getMeetingById(req.params.id, req.user);
    if (!meeting) throw new ApiError(404, 'Meeting not found');
    res.json(meeting);
  } catch (error) {
    next(error);
  }
};

const createMeeting = async (req, res, next) => {
  try {
    const meeting = await meetingService.createMeeting(req.body, req.user);
    res.status(201).json(meeting);
  } catch (error) {
    next(error);
  }
};

const updateMeetingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const meeting = await meetingService.updateMeetingStatus(req.params.id, status, req.user);
    if (!meeting) throw new ApiError(404, 'Meeting not found');
    res.json(meeting);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllMeetings,
  getMeetingsByWorkspace,
  getMeetingById,
  createMeeting,
  updateMeetingStatus
};
