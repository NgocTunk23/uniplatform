const mockRecordingService = {
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  getRecordingStatus: jest.fn(),
  reprocessRecording: jest.fn(),
};

jest.mock('../src/services/meeting-recording.service', () => mockRecordingService);
jest.mock('../src/middlewares/auth.middleware', () => ({
  protect: (_req, _res, next) => next(),
}));

const meetingRoutes = require('../src/routes/meeting.routes');
const meetingController = require('../src/controllers/meeting.controller');

const meetingId = '507f1f77bcf86cd799439011';
const user = { username: 'leader', role: 'Member' };

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const hasRoute = (method, path) => meetingRoutes.stack.some((layer) => (
  layer.route?.path === path && layer.route.methods[method]
));

describe('meeting recording route/controller wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordingService.startRecording.mockResolvedValue({ bot_status: 'recording' });
    mockRecordingService.stopRecording.mockResolvedValue({ bot_status: 'processing' });
    mockRecordingService.getRecordingStatus.mockResolvedValue({ bot_status: 'completed' });
    mockRecordingService.reprocessRecording.mockResolvedValue({ bot_status: 'processing' });
  });

  test('registers recording routes', () => {
    expect(hasRoute('post', '/:id/recording/start')).toBe(true);
    expect(hasRoute('post', '/:id/recording/stop')).toBe(true);
    expect(hasRoute('get', '/:id/recording/status')).toBe(true);
    expect(hasRoute('post', '/:id/recording/reprocess')).toBe(true);
  });

  test('registers transcript review and summary gate routes', () => {
    expect(hasRoute('post', '/:id/transcript/correct')).toBe(true);
    expect(hasRoute('put', '/:id/transcript/review')).toBe(true);
    expect(hasRoute('post', '/:id/summary/generate')).toBe(true);
    expect(hasRoute('post', '/:id/summary/evaluate')).toBe(true);
  });

  test('start controller passes bearer token to service', async () => {
    const req = {
      params: { id: meetingId },
      user,
      headers: { authorization: 'Bearer token-123' },
    };
    const res = createResponse();
    const next = jest.fn();

    await meetingController.startRecording(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { bot_status: 'recording' } });
    expect(mockRecordingService.startRecording).toHaveBeenCalledWith(meetingId, user, 'token-123');
  });

  test('stop/status/reprocess controllers call recording service', async () => {
    const baseReq = { params: { id: meetingId }, user, headers: {} };
    const next = jest.fn();

    const stopRes = createResponse();
    await meetingController.stopRecording(baseReq, stopRes, next);
    expect(stopRes.status).toHaveBeenCalledWith(202);
    expect(mockRecordingService.stopRecording).toHaveBeenCalledWith(meetingId, user);

    const statusRes = createResponse();
    await meetingController.getRecordingStatus(baseReq, statusRes, next);
    expect(statusRes.json).toHaveBeenCalledWith({ success: true, data: { bot_status: 'completed' } });
    expect(mockRecordingService.getRecordingStatus).toHaveBeenCalledWith(meetingId, user);

    const reprocessRes = createResponse();
    await meetingController.reprocessRecording(baseReq, reprocessRes, next);
    expect(reprocessRes.status).toHaveBeenCalledWith(202);
    expect(mockRecordingService.reprocessRecording).toHaveBeenCalledWith(meetingId, user);
  });
});
