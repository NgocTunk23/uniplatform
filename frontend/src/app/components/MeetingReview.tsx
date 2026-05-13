import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Save,
  Trash2,
  Upload,
  Users,
  Video,
} from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';
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
  summary?: string | null;
  decisions?: string[];
  task?: string[];
  isbotgenerated?: boolean | null;
  files?: MinutesFile[];
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
  const [decisionsText, setDecisionsText] = useState('');
  const [tasksText, setTasksText] = useState('');

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
    setSummary(nextMinutes?.summary || '');
    setContent(nextMinutes?.content || '');
    setRawTranscript(nextMinutes?.raw_transcript || '');
    setDecisionsText(joinLines(nextMinutes?.decisions));
    setTasksText(joinLines(nextMinutes?.task));
  };

  const loadReview = async () => {
    if (!meetingId) return;

    setLoading(true);
    try {
      const data = await fetchJson(`${apiUrl}/api/meetings/${meetingId}/minutes`);
      setMeeting(data.data?.meeting || null);
      applyMinutes(data.data?.minutes || null);
    } catch (error) {
      console.error('Load meeting review error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load meeting review');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReview();
  }, [meetingId]);

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
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${meeting.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_minutes.txt`;
    link.click();
    URL.revokeObjectURL(url);
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
  const hasAiDraft = Boolean(minutes?.isbotgenerated || rawTranscript || summary || content);
  const canEdit = !meeting || meeting.organizer === currentUsername ||
    (meeting.workspace?.member ?? []).some(m => m.username === currentUsername && m.workspacerole === 'Leader');

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
              Bạn đang xem biên bản ở chế độ chỉ đọc. Chỉ người tổ chức hoặc trưởng nhóm mới có thể chỉnh sửa.
            </div>
          )}

          {!hasAiDraft && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              AI could not automatically create minutes yet. A blank manual form is ready for review and saving.
            </div>
          )}

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recording</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Mic size={24} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Meeting Recording</h3>
                  <p className="text-sm text-gray-500">{meeting.recording_file || 'No recording file linked yet'}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
              <textarea
                value={summary}
                onChange={event => setSummary(event.target.value)}
                readOnly={!canEdit}
                rows={8}
                placeholder="Write the meeting summary..."
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
                placeholder="Detailed minutes or discussion notes..."
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
                readOnly={!canEdit}
                rows={6}
                placeholder="One decision per line"
                className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none resize-none ${canEdit ? 'bg-gray-50 focus:ring-2 focus:ring-purple-300' : 'bg-gray-100 text-gray-600 cursor-default'}`}
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasks</h2>
              <textarea
                value={tasksText}
                onChange={event => setTasksText(event.target.value)}
                readOnly={!canEdit}
                rows={6}
                placeholder="One task per line"
                className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none resize-none ${canEdit ? 'bg-gray-50 focus:ring-2 focus:ring-purple-300' : 'bg-gray-100 text-gray-600 cursor-default'}`}
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Transcript</h2>
            <textarea
              value={rawTranscript}
              onChange={event => setRawTranscript(event.target.value)}
              readOnly={!canEdit}
              rows={10}
              placeholder="Raw transcript..."
              className={`w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none resize-none ${canEdit ? 'bg-gray-50 focus:ring-2 focus:ring-purple-300' : 'bg-gray-100 text-gray-600 cursor-default'}`}
            />
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
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-semibold overflow-hidden">
                      {participant.imageggid ? (
                        <img 
                          src={getAvatarUrl(participant.imageggid)} 
                          alt={participant.fullname || participant.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (participant.fullname || participant.username).slice(0, 2).toUpperCase()
                      )}
                    </div>
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
