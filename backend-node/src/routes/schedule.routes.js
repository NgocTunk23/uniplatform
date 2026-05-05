const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { protect } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleIdSchema,
  listSchedulesSchema,
} = require('../validations/schedule.schema');

router.use(protect);

/**
 * @swagger
 * /api/schedules:
 *   get:
 *     summary: List schedules for the current user
 *     tags: [Schedules]
 *   post:
 *     summary: Create a personal schedule entry
 *     tags: [Schedules]
 */
router.get('/', validate(listSchedulesSchema), scheduleController.listSchedules);
router.post('/', validate(createScheduleSchema), scheduleController.createSchedule);

/**
 * @swagger
 * /api/schedules/{id}:
 *   get:
 *     summary: Get one schedule entry
 *     tags: [Schedules]
 *   patch:
 *     summary: Update one schedule entry
 *     tags: [Schedules]
 *   delete:
 *     summary: Delete one schedule entry
 *     tags: [Schedules]
 */
router.get('/:id', validate(scheduleIdSchema), scheduleController.getScheduleById);
router.patch('/:id', validate(updateScheduleSchema), scheduleController.updateSchedule);
router.delete('/:id', validate(scheduleIdSchema), scheduleController.deleteSchedule);

module.exports = router;
