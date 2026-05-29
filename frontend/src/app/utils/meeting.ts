// How early (in minutes) participants may enter a meeting before its start time.
export const JOIN_WINDOW_MINUTES = 15;

interface JoinableMeeting {
  starttime: string | Date;
  endtime: string | Date;
}

/**
 * A meeting can be joined from JOIN_WINDOW_MINUTES before its start time until
 * it ends. Returns false for far-future and already-ended meetings.
 */
export function canJoinMeeting(meeting: JoinableMeeting, now: number = Date.now()): boolean {
  const start = new Date(meeting.starttime).getTime();
  const end = new Date(meeting.endtime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start - JOIN_WINDOW_MINUTES * 60_000 && now < end;
}
