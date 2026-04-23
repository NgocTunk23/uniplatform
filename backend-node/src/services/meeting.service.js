const axios = require('axios');
const prisma = require('../config/prisma');

const suggestSchedule = async (usernames, duration, date) => {
    const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';
    const response = await axios.post(`${pythonUrl}/suggest-free-slots`, {
        usernames,
        duration_minutes: duration,
        search_date: date
    });

    return response.data;
};

const createSchedule = async (title, username, starttime, endtime) => {
    const newSchedule = await prisma.schedule.create({
        data: {
            scheduleid: 'SCH' + Date.now(),
            username: username,
            title: title,
            starttime: new Date(starttime),
            endtime: new Date(endtime),
            type: 'Lịch họp'
        }
    });

    return newSchedule;
};

module.exports = {
    suggestSchedule,
    createSchedule
};