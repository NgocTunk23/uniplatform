import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Radio,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  Users,
  Video,
} from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';
import { AvatarWithFallback } from './AvatarWithFallback';
import { toast } from 'sonner';

interface WorkspaceMember {
  username: string;
  workspacerole?: string;
}

interface Meeting {
  meetingid: string;
  id?: string;
  title: string;
  starttime: string;
  endtime: string;
  organizer: string;
  participants: string[];
  participantDetails?: { username: string; fullname?: string; imageggid?: string }[];
  organizerDetails?: { username: string; fullname?: string; imageggid?: string };
  status: 'upcoming' | 'ongoing' | 'ended';
  recording_file?: string | null;
  recording_error?: string | null;
  recording_metadata?: Record<string, unknown> | null;
  bot_status?: 'idle' | 'recording' | 'processing' | 'completed' | 'failed' | string | null;
  workspace?: { name?: string; member?: WorkspaceMember[] };
}

interface MinutesFile {
  fileid: string;
  id?: string;
  filename: string;
  typefile?: string | null;
  sizefile?: string | null;
  downloadLink?: string | null;
  webViewLink?: string | null;
}

interface MeetingMinutes {
  meetingminuteid: string;
  id?: string;
  content?: string | null;
  raw_transcript?: string | null;
  corrected_transcript?: string | null;
  transcript_review_status?: 'none' | 'draft' | 'approved' | string | null;
  transcript_correction_notes?: string | null;
  transcript_segments?: TranscriptSegment[] | null;
  transcription_metadata?: Record<string, unknown> | null;
  summary?: string | null;
  summary_draft?: string | null;
  summary_review_status?: 'none' | 'pending' | 'passed' | 'failed' | string | null;
  summary_eval_score?: number | null;
  summary_eval_metadata?: Record<string, unknown> | null;
  decisions?: string[];
  task?: string[];
  isbotgenerated?: boolean | null;
  files?: MinutesFile[];
}

interface TranscriptSegment {
  id?: number | string | null;
  start?: number | null;
  end?: number | null;
  text?: string;
  originalText?: string;
  uncertain?: boolean;
  retried?: boolean;
  avgLogprob?: number | null;
  noSpeechProb?: number | null;
  words?: { word?: string; start?: number | null; end?: number | null; probability?: number | null }[];
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(starttime: string, endtime: string) {
  const minutes = Math.max(0, Math.round((new Date(endtime).getTime() - new Date(starttime).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatSize(bytes?: string | null) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return 'Unknown size';
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function splitLines(value: string) {
  return value.split('\n').map(item => item.trim()).filter(Boolean);
}

function joinLines(value?: string[]) {
  return (value || []).join('\n');
}

function formatTimecode(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--:--';
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

function getNestedRecord(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getStringList(value: unknown) {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
}

function getFileId(file: MinutesFile) {
  return file.fileid || file.id || '';
}

export function MeetingReview() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('uniplatform_user_token') || '';
  const currentUsername = localStorage.getItem('uniplatform_username') || '';
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [rawTranscript, setRawTranscript] = useState('');
  const [correctedTranscript, setCorrectedTranscript] = useState('');
  const [transcriptCorrectionNotes, setTranscriptCorrectionNotes] = useState('');
  const [decisionsText, setDecisionsText] = useState('');
  const [tasksText, setTasksText] = useState('');
  const [recordingDownloadLink, setRecordingDownloadLink] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [recordingUploadBusy, setRecordingUploadBusy] = useState(false);
  const [reviewAction, setReviewAction] = useState<string | null>(null);

  const fetchJson = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || 'Request failed');
    }
    return data;
  };

  const applyMinutes = (nextMinutes: MeetingMinutes | null) => {
    setMinutes(nextMinutes);
    setSummary(nextMinutes?.summary || nextMinutes?.summary_draft || '');
    setContent(nextMinutes?.content || '');
    setRawTranscript(nextMinutes?.raw_transcript || '');
    setCorrectedTranscript(nextMinutes?.corrected_transcript || '');
    setTranscriptCorrectionNotes(nextMinutes?.transcript_correction_notes || '');
    setDecisionsText(joinLines(nextMinutes?.decisions));
    setTasksText(joinLines(nextMinutes?.task));
  };

  const loadReview = async (showLoader = true) => {
    if (!meetingId) return;

    if (showLoader) setLoading(true);
    try {
      const data = await fetchJson(`${apiUrl}/api/meetings/${meetingId}/minutes`);
      setMeeting(data.data?.meeting || null);
      setRecordingDownloadLink(data.data?.recordingDownloadLink || null);
      applyMinutes(data.data?.minutes || null);
    } catch (error) {
      console.error('Load meeting review error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load meeting review');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    loadReview();
  }, [meetingId]);

  useEffect(() => {
    const stage = typeof minutes?.summary_eval_metadata?.stage === 'string' ? minutes.summary_eval_metadata.stage : '';
    const summaryInProgress = ['generating', 'evaluating', 'scoring'].includes(stage);
    const isSummaryPending = (minutes?.summary_review_status === 'pending' && summaryInProgress) || meeting?.bot_status === 'summary_generating';
    if (!meetingId || (!['recording', 'processing'].includes(meeting?.bot_status || '') && !isSummaryPending)) return;
    const timer = window.setInterval(() => loadReview(false), 5000);
    return () => window.clearInterval(timer);
  }, [meetingId, meeting?.bot_status, minutes?.summary_review_status, minutes?.summary_eval_metadata?.stage]);

  const saveMinutes = async (showToast = true) => {
    if (!meetingId) return null;

    setSaving(true);
    try {
      const data = await fetchJson(`${apiUrl}/api/meetings/${meetingId}/minutes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: summary.trim() || null,
          content: content.trim() || null,
          raw_transcript: rawTranscript.trim() || null,
          corrected_transcript: correctedTranscript.trim() || null,
          transcript_review_status: minutes?.transcript_review_status || undefined,
          transcript_correction_notes: transcriptCorrectionNotes.trim() || null,
          transcript_segments: minutes?.transcript_segments || undefined,
          transcription_metadata: minutes?.transcription_metadata || undefined,
          decisions: splitLines(decisionsText),
          task: splitLines(tasksText),
          isbotgenerated: minutes?.isbotgenerated || false,
        }),
      });
      applyMinutes(data.data);
      if (showToast) toast.success('Meeting minutes saved');
      return data.data as MeetingMinutes;
    } catch (error) {
      console.error('Save meeting minutes error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save meeting minutes');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !meetingId) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File exceeds 50MB');
      return;
    }

    const savedMinutes = minutes?.meetingminuteid || minutes?.id ? minutes : await saveMinutes(false);
    const minuteId = savedMinutes?.meetingminuteid || savedMinutes?.id;
    if (!minuteId) {
      toast.error('Save meeting minutes before attaching files');
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('meetingminuteid', minuteId);

    setUploading(true);
    try {
      await fetchJson(`${apiUrl}/api/files/upload`, {
        method: 'POST',
        body: form,
      });
      toast.success('Attachment uploaded');
      await loadReview();
    } catch (error) {
      console.error('Upload meeting attachment error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (file: MinutesFile) => {
    const fileId = getFileId(file);
    if (!fileId || !window.confirm('Delete this attachment?')) return;

    try {
      await fetchJson(`${apiUrl}/api/files/${fileId}`, { method: 'DELETE' });
      toast.success('Attachment deleted');
      await loadReview();
    } catch (error) {
      console.error('Delete meeting attachment error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete attachment');
    }
  };

  const handleApproveTranscript = async () => {
    if (!meetingId || !canEdit) return;

    setReviewAction('approve');
    try {
      const data = await fetchJson(`${apiUrl}/api/meetings/${meetingId}/transcript/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrected_transcript: correctedTranscript.trim(),
          approve: true,
        }),
      });
      applyMinutes(data.data);
      toast.success('Transcript approved');
      await loadReview(false);
    } catch (error) {
      console.error('Approve transcript error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve transcript');
    } finally {
      setReviewAction(null);
    }
  };

  const handleGenerateSummary = async () => {
    if (!meetingId || !canEdit) return;

    setReviewAction('generate');
    try {
      const data = await fetchJson(`${apiUrl}/api/meetings/${meetingId}/summary/generate`, {
        method: 'POST',
      });
      applyMinutes(data.data?.minutes || null);
      setMeeting(prev => prev ? { ...prev, bot_status: 'summary_generating', recording_error: null } : prev);
      toast.success(data.data?.queued ? 'Summary generation started' : (data.data?.published ? 'Summary published successfully' : 'Summary needs review before publishing'));
      await loadReview(false);
    } catch (error) {
      console.error('Generate summary error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setReviewAction(null);
    }
  };

  const handleEvaluateSummary = async () => {
    if (!meetingId || !canEdit) return;

    setReviewAction('evaluate');
    try {
      const data = await fetchJson(`${apiUrl}/api/meetings/${meetingId}/summary/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: summary.trim(),
          content: content.trim() || null,
          decisions: splitLines(decisionsText),
          task: splitLines(tasksText),
        }),
      });
      applyMinutes(data.data?.minutes || null);
      setMeeting(prev => prev ? { ...prev, bot_status: 'summary_generating', recording_error: null } : prev);
      toast.success(data.data?.queued ? 'Summary evaluation started' : (data.data?.published ? 'Summary published successfully' : 'Summary still needs review'));
      await loadReview(false);
    } catch (error) {
      console.error('Evaluate summary error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to evaluate summary');
    } finally {
      setReviewAction(null);
    }
  };


  const handleDownloadMinutes = () => {
    if (!meeting) return;
    const text = [
      meeting.title,
      `${formatDate(meeting.starttime)} ${formatTime(meeting.starttime)} - ${formatTime(meeting.endtime)}`,
      '',
      'Summary',
      summary || '(empty)',
      '',
      'Decisions',
      decisionsText || '(empty)',
      '',
      'Tasks',
      tasksText || '(empty)',
      '',
      'Notes',
      content || '(empty)',
      '',
      'Transcript',
      rawTranscript || '(empty)',
      '',
      'Corrected Transcript',
      correctedTranscript || '(empty)',
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${meeting.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_minutes.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReprocessRecording = async () => {
    if (!meetingId) return;

    setReprocessing(true);
    try {
      await fetchJson(`${apiUrl}/api/meetings/${meetingId}/recording/reprocess`, { method: 'POST' });
      toast.success('Recording reprocess started');
      await loadReview();
    } catch (error) {
      console.error('Reprocess recording error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reprocess recording');
    } finally {
      setReprocessing(false);
    }
  };

  const handleUploadRecordingToDrive = async () => {
    if (!meetingId || !canEdit) return;

    setRecordingUploadBusy(true);
    try {
      const data = await fetchJson(`${apiUrl}/api/meetings/${meetingId}/recording/upload-drive`, { method: 'POST' });
      setMeeting(prev => prev ? {
        ...prev,
        bot_status: data.data?.bot_status || prev.bot_status,
        recording_file: data.data?.recording_file || prev.recording_file,
        recording_error: data.data?.recording_error || null,
        recording_metadata: data.data?.recording_metadata || prev.recording_metadata,
      } : prev);
      setRecordingDownloadLink(data.data?.recordingDownloadLink || null);
      toast.success('Recording uploaded to Drive');
      await loadReview(false);
    } catch (error) {
      console.error('Upload recording to Drive error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload recording to Drive');
      await loadReview(false);
    } finally {
      setRecordingUploadBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white">
        <Loader2 size={26} className="animate-spin mb-3" />
        <p className="text-sm">Loading meeting review...</p>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white">
        <p className="text-sm font-medium">Meeting not found</p>
        <button onClick={() => navigate('/meetings')} className="mt-3 text-sm text-purple-600 font-semibold">Back to meetings</button>
      </div>
    );
  }

  const attachments = minutes?.files || [];
  const hasAiDraft = Boolean(minutes?.isbotgenerated || rawTranscript || correctedTranscript || summary || content);
  const recordingStatus = meeting.bot_status || 'idle';
  const isRecordingProcessing = recordingStatus === 'recording' || recordingStatus === 'processing';
  const hasNoAudioError = recordingStatus === 'failed' && /no audio/i.test(meeting.recording_error || '');
  const canEdit = Boolean(meeting) && (
    meeting.organizer === currentUsername ||
    (meeting.workspace?.member ?? []).some(m => m.username === currentUsername && m.workspacerole === 'Leader')
  );
  const transcriptReviewStatus = minutes?.transcript_review_status || 'none';
  const isTranscriptApproved = transcriptReviewStatus === 'approved';
  const isReviewBusy = Boolean(reviewAction);
  const canEditFinalMinutes = canEdit;
  const transcriptSegments = Array.isArray(minutes?.transcript_segments) ? minutes.transcript_segments : [];
  const uncertainSegments = transcriptSegments.filter(segment => segment?.uncertain);
  const retriedSegments = transcriptSegments.filter(segment => segment?.retried);
  const summaryReviewStatus = minutes?.summary_review_status || 'none';
  const summaryEvalStage = typeof minutes?.summary_eval_metadata?.stage === 'string'
    ? minutes.summary_eval_metadata.stage
    : null;
  // 'pending' is only "in progress" while a generate/evaluate/score stage is
  // active. After transcript approval the status can be 'pending'/'pending_generation'
  // (idle, awaiting the user to click Generate) — that must NOT show a spinner.
  const summaryInProgress = ['generating', 'evaluating', 'scoring'].includes(summaryEvalStage || '');
  const isSummaryPending = (summaryReviewStatus === 'pending' && summaryInProgress) || recordingStatus === 'summary_generating';
  const summaryNeedsReview = summaryReviewStatus === 'failed' || recordingStatus === 'summary_review_required';
  const summaryEvalError = typeof minutes?.summary_eval_metadata?.error === 'string'
    ? minutes.summary_eval_metadata.error
    : null;
  const summaryEvalScore = typeof minutes?.summary_eval_score === 'number' ? minutes.summary_eval_score : null;
  const audioCapture = getNestedRecord(minutes?.transcription_metadata, 'audioCapture') ||
    getNestedRecord(meeting.recording_metadata, 'captureMetadata');
  const audioWarnings = getStringList(audioCapture?.qualityWarnings);
  const audioTracks = Array.isArray(audioCapture?.tracks) ? audioCapture.tracks as Record<string, unknown>[] : [];
  const localRecording = getNestedRecord(meeting.recording_metadata, 'localRecording') ||
    getNestedRecord(audioCapture, 'localRecording');
  const localRecordingStatus = typeof localRecording?.status === 'string' ? localRecording.status : null;
  const hasLocalRecording = Boolean(localRecording?.hasLocalFile) && !recordingDownloadLink;
  const canUploadRecordingToDrive = canEdit && hasLocalRecording && !isRecordingProcessing;
  const isRecordingUploading = localRecordingStatus === 'uploading' || recordingUploadBusy;
  const recordingUploadError = typeof localRecording?.uploadError === 'string' ? localRecording.uploadError : null;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-8 py-6 border-b border-gray-100">
        <button
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Meetings</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">{meeting.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><Calendar size={16} className="text-gray-400" />{formatDate(meeting.starttime)}</span>
              <span className="flex items-center gap-1.5"><Clock size={16} className="text-gray-400" />{formatTime(meeting.starttime)} - {formatDuration(meeting.starttime, meeting.endtime)}</span>
              <span className="flex items-center gap-1.5"><Users size={16} className="text-gray-400" />{meeting.participants.length} participants</span>
              <span className="flex items-center gap-1.5"><Video size={16} className="text-gray-400" />{meeting.workspace?.name || meeting.organizer}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadMinutes}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-2 text-sm font-semibold"
            >
              <Download size={16} />
              Export
            </button>
            {canEdit && (
              <button
                onClick={() => saveMinutes(true)}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white transition-colors flex items-center gap-2 text-sm font-semibold"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl space-y-8">
          {!canEdit && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              You are viewing these minutes in read-only mode. Only the organizer or team lead can edit them.
            </div>
          )}

          {!hasAiDraft && !isRecordingProcessing && recordingStatus !== 'failed' && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              No AI-generated minutes yet. You can fill in the form below manually and save.
            </div>
          )}

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recording</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  {recordingStatus === 'processing' ? (
                    <Loader2 size={24} className="text-amber-600 animate-spin" />
                  ) : recordingStatus === 'recording' ? (
                    <Radio size={24} className="text-red-600" />
                  ) : (
                    <Mic size={24} className="text-purple-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Meeting Recording</h3>
                  <p className="text-sm text-gray-500">
                    {recordingStatus === 'recording' && 'Recording in progress'}
                    {recordingStatus === 'processing' && 'AI is transcribing this meeting'}
                    {recordingStatus === 'review_required' && (isTranscriptApproved ? 'Transcript approved. Upload the recording to Drive when ready.' : 'Transcript is ready for review. Recording is stored locally.')}
                    {recordingStatus === 'summary_generating' && (summaryEvalStage === 'evaluating' ? 'Evaluating summary...' : 'Generating summary...')}
                    {recordingStatus === 'summary_review_required' && 'Summary draft needs review before publishing'}
                    {recordingStatus === 'completed' && (recordingDownloadLink ? 'Recording uploaded to Drive' : 'Recording processing complete. Recording is stored locally.')}
                    {recordingStatus === 'failed' && (hasNoAudioError ? 'No audio captured. Check microphone access and join the meeting again before recording.' : (meeting.recording_error || 'Recording processing failed'))}
                    {!['recording', 'processing', 'review_required', 'summary_generating', 'summary_review_required', 'completed', 'failed'].includes(recordingStatus) && (meeting.recording_file || 'No recording file linked yet')}
                  </p>
                  {hasLocalRecording && (
                    <p className="text-xs text-amber-600 mt-1">
                      Local recording is available. Upload to Drive to enable download sharing.
                    </p>
                  )}
                  {recordingUploadError && (
                    <p className="text-xs text-red-600 mt-1">
                      Drive upload failed: {recordingUploadError}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadReview()}
                  className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 transition-colors flex items-center gap-2 text-sm font-semibold"
                >
                  <RefreshCw size={15} />
                  Refresh
                </button>
                {recordingDownloadLink && (
                  <button
                    onClick={() => window.open(recordingDownloadLink, '_blank', 'noopener,noreferrer')}
                    className="px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors flex items-center gap-2 text-sm font-semibold"
                  >
                    <Download size={15} />
                    Recording
                  </button>
                )}
                {canUploadRecordingToDrive && (
                  <button
                    onClick={handleUploadRecordingToDrive}
                    disabled={isRecordingUploading}
                    className="px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white transition-colors flex items-center gap-2 text-sm font-semibold"
                  >
                    {isRecordingUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    Upload Drive
                  </button>
                )}
                {canEdit && ['failed', 'completed'].includes(recordingStatus) && (
                  <button
                    onClick={handleReprocessRecording}
                    disabled={reprocessing}
                    className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white transition-colors flex items-center gap-2 text-sm font-semibold"
                  >
                    {reprocessing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    Reprocess
                  </button>
                )}
              </div>
            </div>
            {(audioWarnings.length > 0 || audioTracks.length > 0) && (
              <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-gray-700">Audio quality</span>
                  {audioTracks.length > 0 && (
                    <span className="rounded-full bg-purple-50 px-2 py-1 font-semibold text-purple-700">
                      {audioTracks.length} separate track{audioTracks.length > 1 ? 's' : ''} retained
                    </span>
                  )}
                  {audioWarnings.length === 0 ? (
                    <span className="rounded-full bg-green-50 px-2 py-1 font-semibold text-green-700">No capture warnings</span>
                  ) : audioWarnings.map(warning => (
                    <span key={warning} className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                      {warning.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                {audioTracks.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {audioTracks.slice(0, 6).map((track, index) => (
                      <div key={String(track.id || index)} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <div className="font-semibold text-gray-800 truncate">{String(track.id || `Track ${index + 1}`)}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span>Speech {Number(track.speechSeconds || 0).toFixed(1)}s</span>
                          <span>Peak {formatPercent(typeof track.peak === 'number' ? track.peak : null)}</span>
                          {track.recordingDownloadLink && (
                            <button
                              onClick={() => window.open(String(track.recordingDownloadLink), '_blank', 'noopener,noreferrer')}
                              className="font-semibold text-purple-600 hover:text-purple-700"
                            >
                              Download track
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Transcript Review</h2>
                <p className="text-sm text-gray-500">Review and edit the transcript before generating minutes.</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold w-fit ${
                isTranscriptApproved ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {isTranscriptApproved ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                {isTranscriptApproved ? 'Approved' : 'Needs review'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">Raw transcript</h3>
                  <span className="text-xs text-gray-400">Read-only</span>
                </div>
                <textarea
                  value={rawTranscript}
                  readOnly
                  rows={12}
                  placeholder="Raw transcript from Whisper..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none resize-none bg-gray-100 text-gray-600 cursor-default"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">Corrected transcript</h3>
                  <span className="text-xs text-gray-400">Editable</span>
                </div>
                <textarea
                  value={correctedTranscript}
                  onChange={event => setCorrectedTranscript(event.target.value)}
                  readOnly={!canEdit}
                  rows={12}
                  placeholder="Edit the transcript before approving..."
                  className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none resize-none ${canEdit ? 'bg-gray-50 focus:ring-2 focus:ring-purple-300' : 'bg-gray-100 text-gray-600 cursor-default'}`}
                />
              </div>
            </div>

            {transcriptSegments.length > 0 && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-white">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Segment review</h3>
                    <p className="text-xs text-gray-500">
                      {transcriptSegments.length} segments, {uncertainSegments.length} uncertain, {retriedSegments.length} retried.
                    </p>
                  </div>
                  {uncertainSegments.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 w-fit">
                      <AlertTriangle size={14} />
                      Review highlighted segments
                    </span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {transcriptSegments.map((segment, index) => (
                    <div key={`${segment.id ?? index}-${segment.start ?? index}`} className={`px-4 py-3 text-sm ${segment.uncertain ? 'bg-amber-50/70' : 'bg-white'}`}>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-gray-500">
                          {formatTimecode(segment.start)} - {formatTimecode(segment.end)}
                        </span>
                        {segment.uncertain && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">uncertain</span>
                        )}
                        {segment.retried && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">retried</span>
                        )}
                        {typeof segment.avgLogprob === 'number' && (
                          <span className="text-[11px] text-gray-400">logprob {segment.avgLogprob.toFixed(2)}</span>
                        )}
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{segment.text}</p>
                      {segment.originalText && segment.originalText !== segment.text && (
                        <p className="mt-1 text-xs text-gray-500 line-through decoration-amber-500">{segment.originalText}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canEdit && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleApproveTranscript}
                  disabled={isReviewBusy || !correctedTranscript.trim()}
                  className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white transition-colors flex items-center gap-2 text-sm font-semibold"
                >
                  {reviewAction === 'approve' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Approve transcript
                </button>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    {summaryNeedsReview && (
                      <button
                        onClick={handleEvaluateSummary}
                        disabled={isReviewBusy || isSummaryPending || !isTranscriptApproved || !summary.trim()}
                        className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white transition-colors flex items-center gap-1.5 text-sm font-semibold"
                      >
                        {reviewAction === 'evaluate' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Evaluate
                      </button>
                    )}
                    <button
                      onClick={handleGenerateSummary}
                      disabled={isReviewBusy || isSummaryPending || !isTranscriptApproved}
                      className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white transition-colors flex items-center gap-1.5 text-sm font-semibold"
                    >
                      {(reviewAction === 'generate' || isSummaryPending) ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      {isSummaryPending ? 'Generating' : 'Generate'}
                    </button>
                  </div>
                )}
              </div>
              {isSummaryPending && (
                <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 flex items-start gap-2">
                  <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
                  <span>{summaryEvalStage === 'evaluating' ? 'Evaluating summary...' : 'Generating summary...'}</span>
                </div>
              )}
              {summaryNeedsReview && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Summary evaluation did not pass{summaryEvalScore !== null ? ` (${formatPercent(summaryEvalScore)})` : ''}.
                    {summaryEvalError ? ` ${summaryEvalError}` : ' Edit the draft and evaluate again.'}
                  </span>
                </div>
              )}
              <textarea
                value={summary}
                onChange={event => setSummary(event.target.value)}
                readOnly={!canEdit}
                rows={8}
                placeholder="Summary — generate from transcript or write manually..."
                className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none resize-none ${canEdit ? 'bg-gray-50 focus:ring-2 focus:ring-purple-300' : 'bg-gray-100 text-gray-600 cursor-default'}`}
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <textarea
                value={content}
                onChange={event => setContent(event.target.value)}
                readOnly={!canEdit}
                rows={8}
                placeholder="Additional notes..."
                className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none resize-none ${canEdit ? 'bg-gray-50 focus:ring-2 focus:ring-purple-300' : 'bg-gray-100 text-gray-600 cursor-default'}`}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Decisions</h2>
              <textarea
                value={decisionsText}
                onChange={event => setDecisionsText(event.target.value)}
                readOnly={!canEditFinalMinutes}
                rows={6}
                placeholder="One decision per line"
                className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none resize-none ${canEditFinalMinutes ? 'bg-gray-50 focus:ring-2 focus:ring-purple-300' : 'bg-gray-100 text-gray-600 cursor-default'}`}
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasks</h2>
              <textarea
                value={tasksText}
                onChange={event => setTasksText(event.target.value)}
                readOnly={!canEditFinalMinutes}
                rows={6}
                placeholder="One task per line"
                className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none resize-none ${canEditFinalMinutes ? 'bg-gray-50 focus:ring-2 focus:ring-purple-300' : 'bg-gray-100 text-gray-600 cursor-default'}`}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Attached Files</h2>
              {canEdit && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Attach File
                </button>
              )}
            </div>

            {attachments.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-xl py-10 text-center text-gray-400">
                <Paperclip size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No files attached to these minutes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attachments.map(file => (
                  <div key={getFileId(file)} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                          <FileText size={20} className="text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm truncate">{file.filename}</h4>
                          <p className="text-xs text-gray-500">{formatSize(file.sizefile)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => file.downloadLink && window.open(file.downloadLink, '_blank', 'noopener,noreferrer')}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download size={18} className="text-gray-600" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleDeleteFile(file)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} className="text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Participants ({meeting.participants.length})</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(meeting.participantDetails || meeting.participants.map(p => ({ username: p, fullname: p }))).map(participant => (
                  <div key={participant.username} className="flex items-center gap-2">
                    <AvatarWithFallback 
                      url={getAvatarUrl(participant.imageggid)} 
                      name={participant.fullname || participant.username} 
                    />
                    <span className="text-sm text-gray-700 truncate" title={participant.fullname || participant.username}>
                      {participant.fullname || participant.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
    </div>
  );
}
