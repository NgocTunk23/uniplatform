const meetingService = require('../services/meeting.service');
const ApiError = require('../utils/api-error');
const { meetingRooms } = require('../socket/meeting.socket');

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
    
    // Add live participant count
    const meetingsWithLiveCount = meetings.map(meeting => {
      const room = meetingRooms.get(meeting.meetingid);
      return {
        ...meeting,
        id: meeting.meetingid,
        activeParticipantsCount: room ? room.size : 0
      };
    });
    
    res.json(meetingsWithLiveCount);
  } catch (error) {
    next(error);
  }
};

const getMeetingsByWorkspace = async (req, res, next) => {
  try {
    const meetings = await meetingService.getMeetingsByWorkspace(req.params.workspaceId, req.user);
    
    // Add live participant count
    const meetingsWithLiveCount = meetings.map(meeting => {
      const room = meetingRooms.get(meeting.meetingid);
      return {
        ...meeting,
        id: meeting.meetingid,
        activeParticipantsCount: room ? room.size : 0
      };
    });
    
    res.json(meetingsWithLiveCount);
  } catch (error) {
    next(error);
  }
};

const getMeetingById = async (req, res, next) => {
  try {
    const meeting = await meetingService.getMeetingById(req.params.id, req.user);
    if (!meeting) throw new ApiError(404, 'Meeting not found');
    res.json({ ...meeting, id: meeting.meetingid });
  } catch (error) {
    next(error);
  }
};

const createMeeting = async (req, res, next) => {
  try {
    const meeting = await meetingService.createMeeting(req.body, req.user);
    res.status(201).json({ ...meeting, id: meeting.meetingid });
  } catch (error) {
    next(error);
  }
};

const suggestMeetingSlots = async (req, res, next) => {
  try {
    const suggestions = await meetingService.suggestMeetingSlots(req.body, req.user);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
};

const updateMeetingStatus = async (req, res, next) => {
  try {
    const meeting = await meetingService.updateMeetingStatus(req.params.id, req.body, req.user);
    if (!meeting) throw new ApiError(404, 'Meeting not found');
    res.json({ ...meeting, id: meeting.meetingid });
  } catch (error) {
    next(error);
  }
};

const updateMeeting = async (req, res, next) => {
  try {
    const meeting = await meetingService.updateMeeting(req.params.id, req.body, req.user);
    if (!meeting) throw new ApiError(404, 'Meeting not found');
    res.json({ ...meeting, id: meeting.meetingid });
  } catch (error) {
    next(error);
  }
};

const getMeetingMinutes = async (req, res, next) => {
  try {
    const result = await meetingService.getMeetingMinutes(req.params.id, req.user);
    if (!result) throw new ApiError(404, 'Meeting not found');
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const upsertMeetingMinutes = async (req, res, next) => {
  try {
    const minutes = await meetingService.upsertMeetingMinutes(req.params.id, req.body, req.user);
    if (!minutes) throw new ApiError(404, 'Meeting not found');
    res.json({ success: true, data: minutes });
  } catch (error) {
    next(error);
  }
};

const deleteMeeting = async (req, res, next) => {
  try {
    await meetingService.deleteMeeting(req.params.id, req.user);
    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllMeetings,
  getMeetingsByWorkspace,
  getMeetingById,
  createMeeting,
  suggestMeetingSlots,
  updateMeetingStatus,
  updateMeeting,
  getMeetingMinutes,
  upsertMeetingMinutes,
  deleteMeeting
};
