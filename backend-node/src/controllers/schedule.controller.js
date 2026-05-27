const scheduleService = require('../services/schedule.service');

const listSchedules = async (req, res, next) => {
  try {
    const schedules = await scheduleService.listSchedules(req.query, req.user);
    res.json({ success: true, data: schedules });
  } catch (error) {
    next(error);
  }
};

const getScheduleById = async (req, res, next) => {
  try {
    const schedule = await scheduleService.getScheduleById(req.params.id, req.user);
    res.json({ success: true, data: schedule });
  } catch (error) {
    next(error);
  }
};

const createSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.createSchedule(req.body, req.user);
    res.status(201).json({ success: true, data: schedule });
  } catch (error) {
    next(error);
  }
};

const updateSchedule = async (req, res, next) => {
  try {
    const schedule = await scheduleService.updateSchedule(req.params.id, req.body, req.user);
    res.json({ success: true, data: schedule });
  } catch (error) {
    next(error);
  }
};

const deleteSchedule = async (req, res, next) => {
  try {
    await scheduleService.deleteSchedule(req.params.id, req.user);
    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
