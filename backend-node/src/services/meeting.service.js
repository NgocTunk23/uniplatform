const prisma = require('../config/prisma');
const ApiError = require('../utils/api-error');
const ROLES = require('../constants/roles');
const ERROR_CODES = require('../constants/error-codes');
const permissionUtil = require('../utils/permission.util');
const calendarConflictService = require('./calendar-conflict.service');
const gdriveUtil = require('../utils/gdrive.util');
const { sanitizeRecordingMetadata } = require('../utils/recording-metadata.util');
const ollamaService = require('./ollama.service');
const summaryEvaluationClient = require('./summary-evaluation-client.service');

const buildMeetingLink = () => `https://meet.uniplatform.com/${Math.random().toString(36).substring(2, 10)}`;

const normalizeParticipants = (participants, workspace, organizer) => {
  if (!workspace) {
    throw new ApiError(404, 'Workspace not found');
  }

  const workspaceMembers = workspace.member || [];
  const allowedUsernames = new Set(workspaceMembers.map((member) => member.username));
  const requestedParticipants = participants && participants.length > 0 ? participants : [organizer];
  const deduped = [...new Set([...requestedParticipants, organizer])];
  const invalidParticipants = deduped.filter((username) => !allowedUsernames.has(username));

  if (invalidParticipants.length > 0) {
    throw new ApiError(400, `Participants must belong to the workspace: ${invalidParticipants.join(', ')}`);
  }

  return deduped;
};

const isPlainObject = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const buildInitialRsvpStatus = (participants, organizer) => (
  participants.reduce((acc, username) => {
    acc[username] = username === organizer ? 'accepted' : 'pending';
    return acc;
  }, {})
);

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();

const roundUpToStep = (date, stepMinutes) => {
  const stepMs = stepMinutes * 60000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
};

const setTimeFromMinutes = (date, minutes) => {
  const copy = new Date(date);
  copy.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return copy;
};

const buildDailySearchWindows = (searchStart, searchEnd) => {
  const startMinute = minutesOfDay(searchStart);
  const endMinute = minutesOfDay(searchEnd);

  if (endMinute <= startMinute) {
    return [{ start: searchStart, end: searchEnd }];
  }

  const windows = [];
  const cursor = new Date(searchStart);
  cursor.setHours(0, 0, 0, 0);

  const finalDay = new Date(searchEnd);
  finalDay.setHours(0, 0, 0, 0);

  while (cursor <= finalDay) {
    const windowStart = setTimeFromMinutes(cursor, startMinute);
    const windowEnd = setTimeFromMinutes(cursor, endMinute);
    const actualStart = new Date(Math.max(windowStart.getTime(), searchStart.getTime()));
    const actualEnd = new Date(Math.min(windowEnd.getTime(), searchEnd.getTime()));

    if (actualEnd > actualStart) {
      windows.push({ start: actualStart, end: actualEnd });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return windows;
};

const eventOverlaps = (event, starttime, endtime) => {
  const eventStart = new Date(event.starttime);
  const eventEnd = new Date(event.endtime);
  return eventStart < endtime && eventEnd > starttime;
};

const findSlotConflicts = (blockingEvents, starttime, endtime, participants) => {
  const participantSet = new Set(participants);
  return blockingEvents.filter((event) => (
    (event.usernames || []).some((username) => participantSet.has(username)) &&
    eventOverlaps(event, starttime, endtime)
  ));
};

const scoreSlot = (slotStart, searchStart, index) => {
  const daysFromStart = Math.max(0, Math.floor((slotStart.getTime() - searchStart.getTime()) / 86400000));
  return Math.max(65, 100 - daysFromStart * 5 - index * 2);
};

const slotQuality = (score) => {
  if (score >= 90) return 'best';
  if (score >= 75) return 'good';
  return 'low';
};

const buildMinuteFileResponse = (file) => ({
  ...file,
  id: file.fileid,
  downloadLink: gdriveUtil.getDownloadLink(file.ggid),
  webViewLink: `https://drive.google.com/file/d/${file.ggid}/view`,
});

const serializeMeetingMinutes = (minutes) => {
  if (!minutes) return null;
  return {
    ...minutes,
    id: minutes.meetingminuteid,
    files: (minutes.files || []).map(buildMinuteFileResponse),
  };
};

const ensureCanManageMeeting = async (meeting, currentUser) => {
  const membership = await permissionUtil.getWorkspaceMembership(meeting.workspaceid, currentUser);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;
  const isOrganizer = meeting.organizer === currentUser.username;

  if (!isLeader && !isOrganizer) {
    throw new ApiError(403, 'Authority denied. Only Leaders or the Organizer can perform this action.');
  }
};

const normalizeStringList = (items, limit) => (
  Array.isArray(items)
    ? items.map((item) => String(item).trim()).filter(Boolean).slice(0, limit)
    : []
);

const getSummaryScoreThreshold = () => {
  const threshold = Number(process.env.SUMMARY_SCORE_THRESHOLD || 0.55);
  return Number.isFinite(threshold) ? threshold : 0.55;
};

const evaluateSummaryDraft = async ({ correctedTranscript, summary }) => {
  try {
    return await summaryEvaluationClient.evaluateSummarizationScore({
      referenceContexts: [correctedTranscript],
      response: summary,
      coeff: process.env.SUMMARY_SCORE_CONCISENESS_COEFF
        ? Number(process.env.SUMMARY_SCORE_CONCISENESS_COEFF)
        : undefined,
    });
  } catch (error) {
    return {
      score: 0,
      passed: false,
      threshold: getSummaryScoreThreshold(),
      metric: 'ragas_summary_score',
      model: process.env.SUMMARY_SCORE_MODEL || process.env.OLLAMA_MODEL || 'qwen3:1.7b',
      error: error.message,
    };
  }
};

const buildSummaryEvalMetadata = ({ evaluation, source, correctedTranscript, summary }) => ({
  metric: evaluation.metric || 'ragas_summary_score',
  model: evaluation.model || process.env.SUMMARY_SCORE_MODEL || process.env.OLLAMA_MODEL || 'qwen3:1.7b',
  threshold: evaluation.threshold ?? getSummaryScoreThreshold(),
  score: evaluation.score,
  passed: Boolean(evaluation.passed),
  error: evaluation.error || null,
  source,
  referenceLength: correctedTranscript.length,
  responseLength: summary.length,
  evaluatedAt: new Date().toISOString(),
  ...(evaluation.metadata ? { evaluatorMetadata: evaluation.metadata } : {}),
});

const activeSummaryJobs = new Map();

const clampSummaryError = (error) => String(error?.message || error || 'Summary job failed').slice(0, 500);

const getSummaryStage = (minutes) => (
  minutes?.summary_eval_metadata && typeof minutes.summary_eval_metadata === 'object'
    ? minutes.summary_eval_metadata.stage
    : null
);

const buildQueuedSummaryResponse = (minutes, stage = 'generating') => ({
  queued: true,
  status: 'pending',
  stage,
  minutes: serializeMeetingMinutes(minutes),
  published: false,
});

const logSummaryTiming = (label, meetingId, startedAt) => {
  console.info(`${label} meetingId=${meetingId} durationMs=${Date.now() - startedAt}`);
};

const setSummaryJobFailed = async ({ meetingId, source, correctedTranscript, summary = '', error }) => {
  const message = clampSummaryError(error);
  const evaluation = {
    score: 0,
    passed: false,
    threshold: getSummaryScoreThreshold(),
    metric: 'ragas_summary_score',
    model: process.env.SUMMARY_SCORE_MODEL || process.env.OLLAMA_MODEL || 'qwen3:1.7b',
    error: message,
  };

  await prisma.meetingMinutes.update({
    where: { meetingid: meetingId },
    data: {
      summary: null,
      content: null,
      summary_draft: summary || null,
      summary_review_status: 'failed',
      summary_eval_score: 0,
      summary_eval_metadata: {
        ...buildSummaryEvalMetadata({
          evaluation,
          source,
          correctedTranscript,
          summary,
        }),
        stage: 'failed',
      },
      decisions: [],
      task: [],
      isbotgenerated: true,
    },
  }).catch(() => undefined);

  await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: 'summary_review_required',
      recording_error: message,
    },
  }).catch(() => undefined);
};

const getManageableMeetingWithMinutes = async (meetingId, currentUser) => {
  const meeting = await prisma.meeting.findUnique({
    where: { meetingid: meetingId },
    include: { meetingMinute: true },
  });
  if (!meeting) return null;
  await ensureCanManageMeeting(meeting, currentUser);
  return meeting;
};

const enrichMeetingParticipants = async (meetings) => {
  if (!meetings) return null;
  const isArray = Array.isArray(meetings);
  const meetingsList = isArray ? meetings : [meetings];

  if (meetingsList.length === 0) return isArray ? [] : null;

  // Collect all unique usernames
  const usernames = new Set();
  meetingsList.forEach(m => {
    (m.participants || []).forEach(u => usernames.add(u));
    if (m.organizer) usernames.add(m.organizer);
  });

  // Fetch user details
  const users = await prisma.user.findMany({
    where: { username: { in: Array.from(usernames) } },
    select: { username: true, fullname: true, imageggid: true }
  });

  const userMap = users.reduce((acc, user) => {
    acc[user.username] = user;
    return acc;
  }, {});

  // Map details back to meetings
  const enriched = meetingsList.map(m => ({
    ...m,
    participantDetails: (m.participants || []).map(u => userMap[u] || { username: u, fullname: u }),
    organizerDetails: userMap[m.organizer] || { username: m.organizer, fullname: m.organizer }
  }));

  return isArray ? enriched : enriched[0];
};

const getAllMeetings = async (currentUser) => {
  if (currentUser.role === ROLES.SYSTEM.ADMIN) {
    return await prisma.meeting.findMany({
      include: {
        workspace: { select: { name: true } },
        meetingMinute: true
      },
      orderBy: { starttime: 'desc' }
    });
  }

  // Get all workspaces the user is a member of
  const workspaces = await prisma.workspace.findMany({
    where: {
      member: {
        some: { username: currentUser.username }
      }
    },
    select: { workspaceid: true, member: true }
  });

  const leaderWorkspaceIds = workspaces
    .filter(w => w.member.some(m => m.username === currentUser.username && m.workspacerole === ROLES.WORKSPACE.LEADER))
    .map(w => w.workspaceid);

  const participantWorkspaceIds = workspaces
    .filter(w => !leaderWorkspaceIds.includes(w.workspaceid))
    .map(w => w.workspaceid);

  const query = {
    OR: [
      { workspaceid: { in: leaderWorkspaceIds } },
      {
        AND: [
          { workspaceid: { in: participantWorkspaceIds } },
          { participants: { has: currentUser.username } }
        ]
      }
    ]
  };

  const meetings = await prisma.meeting.findMany({
    where: query,
    include: {
      workspace: { select: { name: true } },
      meetingMinute: true
    },
    orderBy: { starttime: 'desc' }
  });

  return await enrichMeetingParticipants(meetings);
};

const getMeetingsByWorkspace = async (workspaceId, currentUser) => {
  const membership = await permissionUtil.getWorkspaceMembership(workspaceId, currentUser);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;

  const query = { workspaceid: workspaceId };
  if (!isLeader) {
    query.participants = { has: currentUser.username };
  }

  const meetings = await prisma.meeting.findMany({
    where: query,
    include: {
      meetingMinute: true
    },
    orderBy: { starttime: 'desc' }
  });

  return await enrichMeetingParticipants(meetings);
};

const getMeetingById = async (meetingId, currentUser) => {
  const meeting = await prisma.meeting.findUnique({
    where: { meetingid: meetingId },
    include: {
      workspace: true,
      meetingMinute: true
    }
  });

  if (!meeting) return null;

  // Check if user is member of the workspace
  const membership = await permissionUtil.getWorkspaceMembership(meeting.workspaceid, currentUser);
  const isLeader = membership.isSystemAdmin || membership.workspacerole === ROLES.WORKSPACE.LEADER;

  // If not leader and not a participant, deny access
  if (!isLeader && !meeting.participants.includes(currentUser.username)) {
    throw new ApiError(403, 'Access denied. You are not a participant in this meeting.', ERROR_CODES.AUTH.AUTH_ERROR);
  }

  return await enrichMeetingParticipants(meeting);
};

const createMeeting = async (meetingData, currentUser) => {
  await permissionUtil.ensureCanWrite(meetingData.workspaceid, currentUser);
  const workspace = await prisma.workspace.findUnique({
    where: { workspaceid: meetingData.workspaceid },
    select: { member: true }
  });

  const participants = normalizeParticipants(meetingData.participants, workspace, currentUser.username);
  const starttime = new Date(meetingData.starttime);
  const endtime = new Date(meetingData.endtime);

  if (!meetingData.force) {
    await calendarConflictService.assertNoCalendarConflicts({
      usernames: participants,
      starttime,
      endtime,
    });
  }

  return await prisma.meeting.create({
    data: {
      workspaceid: meetingData.workspaceid,
      title: meetingData.title,
      starttime,
      endtime,
      organizer: currentUser.username,
      participants,
      rsvpStatus: buildInitialRsvpStatus(participants, currentUser.username),
      rsvpDetails: {},
      status: 'upcoming',
      link: meetingData.link || buildMeetingLink(),
      place: meetingData.place,
      bot_status: 'idle'
    }
  });
};

const suggestMeetingSlots = async (suggestData, currentUser) => {
  await permissionUtil.ensureCanWrite(suggestData.workspaceid, currentUser);

  const workspace = await prisma.workspace.findUnique({
    where: { workspaceid: suggestData.workspaceid },
    select: { member: true }
  });

  const participants = normalizeParticipants(suggestData.participants, workspace, currentUser.username);
  const searchStart = new Date(suggestData.searchStart);
  const searchEnd = new Date(suggestData.searchEnd);
  const durationMinutes = suggestData.durationMinutes;
  const stepMinutes = suggestData.stepMinutes || 30;
  const durationMs = durationMinutes * 60000;

  const blockingEvents = await calendarConflictService.listBlockingCalendarEvents({
    usernames: participants,
    starttime: searchStart,
    endtime: searchEnd,
  });

  const slots = [];
  const windows = buildDailySearchWindows(searchStart, searchEnd);

  for (const window of windows) {
    let slotStart = roundUpToStep(window.start, stepMinutes);

    while (slotStart.getTime() + durationMs <= window.end.getTime()) {
      const slotEnd = addMinutes(slotStart, durationMinutes);
      const conflicts = findSlotConflicts(blockingEvents, slotStart, slotEnd, participants);

      if (conflicts.length === 0) {
        const score = scoreSlot(slotStart, searchStart, slots.length);
        slots.push({
          id: `${slotStart.toISOString()}_${slotEnd.toISOString()}`,
          starttime: slotStart,
          endtime: slotEnd,
          durationMinutes,
          score,
          quality: slotQuality(score),
          freeCount: participants.length,
          conflicts: [],
        });
      }

      if (slots.length >= 10) break;
      slotStart = addMinutes(slotStart, stepMinutes);
    }

    if (slots.length >= 10) break;
  }

  return {
    participants,
    searchStart,
    searchEnd,
    durationMinutes,
    slots,
    busyEvents: blockingEvents,
  };
};

const updateMeetingStatus = async (meetingId, updateData, currentUser) => {
  const meeting = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
  if (!meeting) return null;

  await ensureCanManageMeeting(meeting, currentUser);

  const data = { ...updateData };
  if (data.starttime) data.starttime = new Date(data.starttime);
  if (data.endtime) data.endtime = new Date(data.endtime);

  return await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: data
  });
};

const updateMeeting = async (meetingId, updateData, currentUser) => {
  const meeting = await prisma.meeting.findUnique({ where: { meetingid: meetingId } });
  if (!meeting) return null;

  await ensureCanManageMeeting(meeting, currentUser);

  const data = { ...updateData };
  const starttime = data.starttime ? new Date(data.starttime) : meeting.starttime;
  const endtime = data.endtime ? new Date(data.endtime) : meeting.endtime;

  if (endtime <= starttime) {
    throw new ApiError(400, 'End time must be after start time');
  }

  const targetWorkspaceId = data.workspaceid || meeting.workspaceid;
  if (data.workspaceid && data.workspaceid !== meeting.workspaceid) {
    await permissionUtil.ensureCanWrite(data.workspaceid, currentUser);
  }

  if (data.participants) {
    const workspace = await prisma.workspace.findUnique({
      where: { workspaceid: targetWorkspaceId },
      select: { member: true }
    });
    data.participants = normalizeParticipants(data.participants, workspace, meeting.organizer);
  }

  await calendarConflictService.assertNoCalendarConflicts({
    usernames: [...new Set([...(data.participants || meeting.participants), meeting.organizer])],
    starttime,
    endtime,
    excludeMeetingId: meetingId,
  });

  if (data.starttime) data.starttime = starttime;
  if (data.endtime) data.endtime = endtime;
  if (data.link === '') data.link = buildMeetingLink();

  return await prisma.meeting.update({
    where: { meetingid: meetingId },
    data,
    include: {
      workspace: {
        select: { name: true }
      },
      meetingMinute: true
    }
  });
};

const getMeetingMinutes = async (meetingId, currentUser) => {
  const meeting = await getMeetingById(meetingId, currentUser);
  if (!meeting) return null;

  const minutes = await prisma.meetingMinutes.findUnique({
    where: { meetingid: meetingId },
    include: { files: true },
  });

  return {
    meeting: {
      ...meeting,
      id: meeting.meetingid,
      recording_metadata: sanitizeRecordingMetadata(meeting.recording_metadata),
    },
    minutes: serializeMeetingMinutes(minutes),
    recordingDownloadLink: meeting.recording_file ? gdriveUtil.getDownloadLink(meeting.recording_file) : null,
  };
};

const upsertMeetingMinutes = async (meetingId, minutesData, currentUser) => {
  const meeting = await prisma.meeting.findUnique({
    where: { meetingid: meetingId },
  });

  if (!meeting) return null;

  await ensureCanManageMeeting(meeting, currentUser);

  const data = {
    content: minutesData.content,
    raw_transcript: minutesData.raw_transcript,
    corrected_transcript: minutesData.corrected_transcript,
    transcript_review_status: minutesData.transcript_review_status,
    transcript_correction_notes: minutesData.transcript_correction_notes,
    transcript_segments: minutesData.transcript_segments,
    transcription_metadata: minutesData.transcription_metadata,
    summary: minutesData.summary,
    summary_draft: minutesData.summary_draft,
    summary_review_status: minutesData.summary_review_status,
    summary_eval_score: minutesData.summary_eval_score,
    summary_eval_metadata: minutesData.summary_eval_metadata,
    decisions: minutesData.decisions || [],
    task: minutesData.task || [],
    isbotgenerated: minutesData.isbotgenerated ?? false,
    vectorembedding: [],
  };

  const minutes = await prisma.meetingMinutes.upsert({
    where: { meetingid: meetingId },
    update: data,
    create: {
      meetingid: meetingId,
      createby: currentUser.username,
      ...data,
    },
    include: { files: true },
  });

  return serializeMeetingMinutes(minutes);
};

const correctMeetingTranscript = async (meetingId, correctionData = {}, currentUser) => {
  const meeting = await getManageableMeetingWithMinutes(meetingId, currentUser);
  if (!meeting) return null;

  const rawTranscript = String(
    correctionData.raw_transcript ??
    meeting.meetingMinute?.raw_transcript ??
    ''
  ).trim();
  if (!rawTranscript) {
    throw new ApiError(400, 'Raw transcript is required before correction.');
  }

  const correctedTranscript = rawTranscript;
  const data = {
    raw_transcript: rawTranscript,
    corrected_transcript: correctedTranscript,
    transcript_review_status: 'draft',
    transcript_correction_notes: null,
    summary: null,
    content: null,
    summary_draft: null,
    summary_review_status: 'none',
    summary_eval_score: null,
    summary_eval_metadata: {
      stage: 'not_evaluated',
    },
    decisions: [],
    task: [],
    isbotgenerated: true,
    vectorembedding: [],
  };

  const minutes = await prisma.meetingMinutes.upsert({
    where: { meetingid: meetingId },
    update: data,
    create: {
      meetingid: meetingId,
      createby: meeting.meetingMinute?.createby || currentUser.username,
      ...data,
    },
    include: { files: true },
  });

  await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: 'review_required',
      recording_error: null,
    },
  });

  return serializeMeetingMinutes(minutes);
};

const reviewMeetingTranscript = async (meetingId, reviewData, currentUser) => {
  const meeting = await getManageableMeetingWithMinutes(meetingId, currentUser);
  if (!meeting) return null;
  if (!meeting.meetingMinute) {
    throw new ApiError(404, 'Meeting minutes not found.');
  }

  const correctedTranscript = String(reviewData.corrected_transcript || '').trim();
  if (!correctedTranscript) {
    throw new ApiError(400, 'Corrected transcript is required.');
  }

  const approved = reviewData.approve !== false;
  const minutes = await prisma.meetingMinutes.update({
    where: { meetingid: meetingId },
    data: {
      corrected_transcript: correctedTranscript,
      transcript_review_status: approved ? 'approved' : 'draft',
      summary: null,
      content: null,
      summary_draft: null,
      // 'none' means "not generated yet" — the user must click Generate. Do NOT
      // use 'pending' here: the UI treats 'pending' as "generation in progress"
      // and would spin forever on the disabled Generate button.
      summary_review_status: 'none',
      summary_eval_score: null,
      summary_eval_metadata: {
        stage: approved ? 'pending_generation' : 'not_evaluated',
        transcriptReviewedAt: new Date().toISOString(),
        transcriptReviewedBy: currentUser.username,
      },
      decisions: [],
      task: [],
      isbotgenerated: true,
    },
    include: { files: true },
  });

  await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: 'review_required',
      recording_error: null,
    },
  });

  return serializeMeetingMinutes(minutes);
};

const persistSummaryEvaluationResult = async ({
  meetingId,
  correctedTranscript,
  summaryText,
  source,
  content,
  decisions,
  tasks,
  evaluation,
}) => {
  const evalMetadata = buildSummaryEvalMetadata({
    evaluation,
    source,
    correctedTranscript,
    summary: summaryText,
  });
  const passed = Boolean(evaluation.passed);

  const data = passed
    ? {
      summary: summaryText,
      content: content ?? summaryText,
      summary_draft: null,
      summary_review_status: 'passed',
      summary_eval_score: evaluation.score,
      summary_eval_metadata: {
        ...evalMetadata,
        stage: 'passed',
      },
      decisions,
      task: tasks,
      isbotgenerated: true,
    }
    : {
      summary: null,
      content: null,
      summary_draft: summaryText,
      summary_review_status: 'failed',
      summary_eval_score: evaluation.score,
      summary_eval_metadata: {
        ...evalMetadata,
        stage: 'failed',
      },
      decisions: [],
      task: [],
      isbotgenerated: true,
    };

  const updatedMinutes = await prisma.meetingMinutes.update({
    where: { meetingid: meetingId },
    data,
    include: { files: true },
  });

  await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: passed ? 'completed' : 'summary_review_required',
      recording_error: evaluation.error || null,
    },
  });

  return {
    minutes: serializeMeetingMinutes(updatedMinutes),
    evaluation,
    published: passed,
  };
};

// Publish the generated summary as completed immediately, before RAGAS runs.
// RAGAS scoring is advisory (see recordAdvisorySummaryScore) and must never
// block or demote the published summary.
const publishGeneratedSummary = async ({
  meetingId,
  summaryText,
  content,
  decisions,
  tasks,
}) => {
  await prisma.meetingMinutes.update({
    where: { meetingid: meetingId },
    data: {
      summary: summaryText,
      content: content ?? summaryText,
      summary_draft: null,
      decisions,
      task: tasks,
      summary_review_status: 'passed',
      summary_eval_score: null,
      summary_eval_metadata: {
        stage: 'scoring',
        generatedAt: new Date().toISOString(),
      },
      isbotgenerated: true,
    },
  });

  await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: 'completed',
      recording_error: null,
    },
  });
};

// Advisory-only: record the RAGAS score/metadata without touching the already
// published summary, its content, or the meeting status. A failed/timed-out
// evaluation just annotates metadata; the summary stays completed.
const recordAdvisorySummaryScore = async ({
  meetingId,
  evaluation,
  correctedTranscript,
  summaryText,
  failed = false,
}) => {
  const evalMetadata = buildSummaryEvalMetadata({
    evaluation,
    source: 'generated',
    correctedTranscript,
    summary: summaryText,
  });

  await prisma.meetingMinutes.update({
    where: { meetingid: meetingId },
    data: {
      summary_eval_score: evaluation.score,
      summary_eval_metadata: {
        ...evalMetadata,
        advisory: true,
        stage: failed ? 'score_failed' : 'scored',
      },
    },
  });
};

const runGenerateSummaryJob = async ({ meetingId, meetingTitle, correctedTranscript }) => {
  const totalStartedAt = Date.now();
  let summaryText = '';
  try {
    const ollamaStartedAt = Date.now();
    const summaryPayload = await ollamaService.summarizeMeetingTranscript(correctedTranscript, meetingTitle);
    logSummaryTiming('summary.generate.ollama_ms', meetingId, ollamaStartedAt);

    summaryText = String(summaryPayload.summary || '').trim();
    const content = summaryPayload.notes || summaryText;
    const decisions = normalizeStringList(summaryPayload.decisions, 50);
    const tasks = normalizeStringList(summaryPayload.tasks, 100);

    // Publish immediately — the summary is usable right after generation.
    await publishGeneratedSummary({
      meetingId,
      summaryText,
      content,
      decisions,
      tasks,
    });

    // RAGAS runs in the background as advisory scoring only; it never blocks or
    // demotes the published summary, even on timeout/error.
    try {
      const evalStartedAt = Date.now();
      const evaluation = await evaluateSummaryDraft({
        correctedTranscript,
        summary: summaryText,
      });
      logSummaryTiming('summary.evaluate.ragas_ms', meetingId, evalStartedAt);
      await recordAdvisorySummaryScore({
        meetingId,
        evaluation,
        correctedTranscript,
        summaryText,
        failed: Boolean(evaluation.error),
      });
    } catch (evalError) {
      console.error(`summary.advisory.failed meetingId=${meetingId} error=${clampSummaryError(evalError)}`);
      await recordAdvisorySummaryScore({
        meetingId,
        evaluation: {
          score: null,
          passed: false,
          error: clampSummaryError(evalError),
        },
        correctedTranscript,
        summaryText,
        failed: true,
      });
    }
  } catch (error) {
    console.error(`summary.job.failed meetingId=${meetingId} error=${clampSummaryError(error)}`);
    await setSummaryJobFailed({
      meetingId,
      source: 'generated',
      correctedTranscript,
      summary: summaryText,
      error,
    });
  } finally {
    logSummaryTiming('summary.job.total_ms', meetingId, totalStartedAt);
  }
};

const runEvaluateSummaryJob = async ({
  meetingId,
  correctedTranscript,
  summaryText,
  content,
  decisions,
  tasks,
}) => {
  const totalStartedAt = Date.now();
  try {
    const evalStartedAt = Date.now();
    const evaluation = await evaluateSummaryDraft({
      correctedTranscript,
      summary: summaryText,
    });
    logSummaryTiming('summary.evaluate.ragas_ms', meetingId, evalStartedAt);

    await persistSummaryEvaluationResult({
      meetingId,
      correctedTranscript,
      summaryText,
      source: 'manual_review',
      content,
      decisions,
      tasks,
      evaluation,
    });
  } catch (error) {
    console.error(`summary.job.failed meetingId=${meetingId} error=${clampSummaryError(error)}`);
    await setSummaryJobFailed({
      meetingId,
      source: 'manual_review',
      correctedTranscript,
      summary: summaryText,
      error,
    });
  } finally {
    logSummaryTiming('summary.job.total_ms', meetingId, totalStartedAt);
  }
};

const enqueueSummaryJob = ({ meetingId, stage, run }) => {
  const existingJob = activeSummaryJobs.get(meetingId);
  if (existingJob) return existingJob;

  const job = Promise.resolve()
    .then(run)
    .catch((error) => {
      console.error(`summary.job.unhandled meetingId=${meetingId} stage=${stage} error=${clampSummaryError(error)}`);
    })
    .finally(() => {
      if (activeSummaryJobs.get(meetingId) === job) {
        activeSummaryJobs.delete(meetingId);
      }
    });

  activeSummaryJobs.set(meetingId, job);
  return job;
};

const generateMeetingSummary = async (meetingId, currentUser) => {
  const meeting = await getManageableMeetingWithMinutes(meetingId, currentUser);
  if (!meeting) return null;
  const minutes = meeting.meetingMinute;
  if (!minutes) {
    throw new ApiError(404, 'Meeting minutes not found.');
  }
  if (minutes.transcript_review_status !== 'approved') {
    throw new ApiError(409, 'Approve the corrected transcript before generating a summary.');
  }

  const correctedTranscript = String(minutes.corrected_transcript || '').trim();
  if (!correctedTranscript) {
    throw new ApiError(400, 'Corrected transcript is required before summary generation.');
  }

  if (activeSummaryJobs.has(meetingId)) {
    return buildQueuedSummaryResponse(minutes, getSummaryStage(minutes) || 'generating');
  }

  const updatedMinutes = await prisma.meetingMinutes.update({
    where: { meetingid: meetingId },
    data: {
      summary_review_status: 'pending',
      summary_eval_score: null,
      summary_eval_metadata: {
        stage: 'generating',
        queuedAt: new Date().toISOString(),
        queuedBy: currentUser.username,
      },
      isbotgenerated: true,
    },
    include: { files: true },
  });

  await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: 'summary_generating',
      recording_error: null,
    },
  });

  enqueueSummaryJob({
    meetingId,
    stage: 'generating',
    run: () => runGenerateSummaryJob({
      meetingId,
      meetingTitle: meeting.title,
      correctedTranscript,
    }),
  });

  return buildQueuedSummaryResponse(updatedMinutes, 'generating');
};

const evaluateMeetingSummary = async (meetingId, summaryData, currentUser) => {
  const meeting = await getManageableMeetingWithMinutes(meetingId, currentUser);
  if (!meeting) return null;
  const minutes = meeting.meetingMinute;
  if (!minutes) {
    throw new ApiError(404, 'Meeting minutes not found.');
  }
  if (minutes.transcript_review_status !== 'approved') {
    throw new ApiError(409, 'Approve the corrected transcript before evaluating a summary.');
  }

  const correctedTranscript = String(minutes.corrected_transcript || '').trim();
  const summaryText = String(summaryData.summary || '').trim();
  if (!correctedTranscript || !summaryText) {
    throw new ApiError(400, 'Corrected transcript and summary are required for evaluation.');
  }

  if (activeSummaryJobs.has(meetingId)) {
    return buildQueuedSummaryResponse(minutes, getSummaryStage(minutes) || 'evaluating');
  }

  const decisions = normalizeStringList(summaryData.decisions ?? minutes.decisions, 50);
  const tasks = normalizeStringList(summaryData.task ?? minutes.task, 100);
  const content = summaryData.content ?? minutes.content ?? summaryText;
  const updatedMinutes = await prisma.meetingMinutes.update({
    where: { meetingid: meetingId },
    data: {
      summary: null,
      content: null,
      summary_draft: summaryText,
      summary_review_status: 'pending',
      summary_eval_score: null,
      summary_eval_metadata: {
        stage: 'evaluating',
        queuedAt: new Date().toISOString(),
        queuedBy: currentUser.username,
      },
      decisions,
      task: tasks,
      isbotgenerated: true,
    },
    include: { files: true },
  });

  await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      bot_status: 'summary_generating',
      recording_error: null,
    },
  });

  enqueueSummaryJob({
    meetingId,
    stage: 'evaluating',
    run: () => runEvaluateSummaryJob({
      meetingId,
      correctedTranscript,
      summaryText,
      content,
      decisions,
      tasks,
    }),
  });

  return buildQueuedSummaryResponse(updatedMinutes, 'evaluating');
};

const deleteMeeting = async (meetingId, currentUser) => {
  const meeting = await prisma.meeting.findUnique({
    where: { meetingid: meetingId },
    include: { meetingMinute: true }
  });

  if (!meeting) {
    throw new ApiError(404, 'Meeting not found');
  }

  await ensureCanManageMeeting(meeting, currentUser);

  if (meeting.meetingMinute) {
    await prisma.files.updateMany({
      where: { meetingminuteid: meeting.meetingMinute.meetingminuteid },
      data: { meetingminuteid: null }
    });

    await prisma.meetingMinutes.delete({
      where: { meetingminuteid: meeting.meetingMinute.meetingminuteid }
    });
  }

  await prisma.meeting.delete({
    where: { meetingid: meetingId }
  });
};

// ================= HÀM XỬ LÝ RSVP (CHẤP NHẬN / TỪ CHỐI) =================
const updateRSVP = async (meetingId, rsvpData, currentUser) => {
  const { status, reason, attachment } = rsvpData;

  // 1. Tìm meeting trong DB
  const meeting = await prisma.meeting.findUnique({
    where: { meetingid: meetingId }
  });

  if (!meeting) return null;

  const hasEnded = meeting.status === 'ended' || new Date(meeting.endtime).getTime() < Date.now();
  if (hasEnded) {
    throw new ApiError(400, 'Cannot RSVP to a past meeting.', ERROR_CODES.VALIDATION.VALIDATION_ERROR);
  }

  const isOrganizer = meeting.organizer === currentUser.username;
  const isParticipant = (meeting.participants || []).includes(currentUser.username);

  if (!isOrganizer && !isParticipant) {
    throw new ApiError(403, 'Only meeting participants can RSVP.', ERROR_CODES.AUTH.AUTH_ERROR);
  }

  // 2. Lấy dữ liệu rsvp hiện tại (đảm bảo là dạng object)
  const currentRsvpStatus = isPlainObject(meeting.rsvpStatus) ? { ...meeting.rsvpStatus } : {};
  const currentRsvpDetails = isPlainObject(meeting.rsvpDetails) ? { ...meeting.rsvpDetails } : {};

  // 3. Cập nhật trạng thái cho user đang thao tác
  currentRsvpStatus[currentUser.username] = status;

  if (status === 'accepted') {
    delete currentRsvpDetails[currentUser.username];
  } else if (reason || attachment) {
    currentRsvpDetails[currentUser.username] = {
      ...(currentRsvpDetails[currentUser.username] || {}),
      reason: reason || undefined,
      attachment: attachment || undefined
    };
  }

  // 4. Lưu lại vào DB
  const updatedMeeting = await prisma.meeting.update({
    where: { meetingid: meetingId },
    data: {
      rsvpStatus: currentRsvpStatus,
      rsvpDetails: currentRsvpDetails
    },
    include: {
      workspace: { select: { name: true } },
      meetingMinute: true
    }
  });

  // 5. Trả về data đã được "làm giàu" thêm thông tin user
  return await enrichMeetingParticipants(updatedMeeting);
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
  correctMeetingTranscript,
  reviewMeetingTranscript,
  generateMeetingSummary,
  evaluateMeetingSummary,
  deleteMeeting,
  updateRSVP,
  _private: {
    activeSummaryJobs,
  },
};
