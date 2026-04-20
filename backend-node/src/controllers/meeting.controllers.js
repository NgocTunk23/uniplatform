const meetingService = require('../services/meeting.service');

const suggestSchedule = async (req, res, next) => {
    try {
        // SỬA LỖI 1: Đổi getWorkspaceId thành workspaceId
        const { workspaceId, usernames, duration_minutes, search_date } = req.body;

        const result = await meetingService.suggestSchedule(
            workspaceId,
            req.user, // Dữ liệu user đang đăng nhập (lấy từ middleware protect)
            usernames,
            duration_minutes,
            search_date
        );

        res.status(200).json({
            success: true,
            message: "Lấy danh sách giờ trống thành công",
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const createSchedule = async (req, res, next) => {
    try {
        const { workspaceId, title, starttime, endtime, participants } = req.body;

        const newSchedule = await meetingService.createSchedule(
            workspaceId,
            req.user,
            title,
            starttime,
            endtime,
            participants
        );

        res.status(201).json({
            success: true,
            message: "Đã tạo lịch họp thành công",
            data: newSchedule
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    suggestSchedule,
    createSchedule
};