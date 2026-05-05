import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Search,
  RefreshCw,
  ExternalLink,
  X,
  Trash2,
  Download,
  Eye,
  Star,
  FileText,
  Image,
  StickyNote,
  Layers,
  FolderOpen,
  HardDrive,
  Info,
  File,
  Cloud,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type FileCategory = 'all' | 'documents' | 'images' | 'notes' | 'project files';

interface DriveFile {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  type: string;
  category: FileCategory;
  date: string;
  starred: boolean;
  shared: boolean;
  owner: string;
  workspace?: string;
  downloadLink?: string;
  webViewLink?: string;
}

interface Workspace {
  workspaceid: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const categoryMeta: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  documents:     { icon: <FileText size={14} />,   bg: 'bg-purple-50',  text: 'text-purple-600'  },
  images:        { icon: <Image size={14} />,       bg: 'bg-fuchsia-50', text: 'text-fuchsia-600' },
  notes:         { icon: <StickyNote size={14} />,  bg: 'bg-violet-50',  text: 'text-violet-600'  },
  'project files': { icon: <Layers size={14} />,   bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
};

const typeBadgeColor: Record<string, string> = {
  PDF:  'bg-red-50 text-red-500',
  PNG:  'bg-emerald-50 text-emerald-600',
  JPG:  'bg-green-50 text-green-600',
  MD:   'bg-violet-50 text-violet-600',
  DOCX: 'bg-blue-50 text-blue-600',
  XLSX: 'bg-teal-50 text-teal-600',
};

function getCategoryIcon(cat: string) {
  return categoryMeta[cat]?.icon ?? <File size={14} />;
}
function getCategoryBg(cat: string) {
  return categoryMeta[cat]?.bg ?? 'bg-gray-100';
}
function getCategoryText(cat: string) {
  return categoryMeta[cat]?.text ?? 'text-gray-500';
}

// ─── Google Drive SVG ─────────────────────────────────────────────────────────

function GoogleDriveLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100/80 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, icon, action }: { title: string; icon: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
          {icon}
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

function StorageBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(Math.round((used / total) * 100), 100);
  const color = pct > 85 ? 'from-orange-400 to-red-400' : 'from-purple-400 to-fuchsia-400';
  return (
    <div className="space-y-1.5">
      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 font-medium">
        <span>{used.toFixed(2)} GB used of {total} GB</span>
        <span className={pct > 85 ? 'text-orange-500 font-semibold' : 'text-purple-500 font-semibold'}>{pct}%</span>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

function mimeToType(mime: string): string {
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('png')) return 'PNG';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPG';
  if (mime.includes('markdown') || mime.endsWith('/md')) return 'MD';
  if (mime.includes('word') || mime.includes('docx')) return 'DOCX';
  if (mime.includes('sheet') || mime.includes('xlsx')) return 'XLSX';
  if (mime.includes('image')) return 'IMG';
  return mime.split('/').pop()?.toUpperCase() ?? 'FILE';
}

function mimeToCategory(mime: string): FileCategory {
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('docx') || mime.includes('text/plain')) return 'documents';
  if (mime.includes('image')) return 'images';
  if (mime.includes('markdown') || mime.includes('md')) return 'notes';
  if (mime.includes('sheet') || mime.includes('xlsx') || mime.includes('zip')) return 'project files';
  return 'documents';
}

function formatSize(bytes: string | number): string {
  const n = Number(bytes);
  if (isNaN(n)) return String(bytes);
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function apiFileToLocal(f: any, currentUsername: string): DriveFile {
  const created = f.createdat ?? f.createdAt;
  const workspaceName = f.workspace?.name || f.workspace?.title;
  const sizeBytes = Number(f.sizefile ?? 0);

  return {
    id: f.id ?? f.fileid,
    name: f.filename,
    size: formatSize(sizeBytes),
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
    type: mimeToType(f.typefile || ''),
    category: mimeToCategory(f.typefile || ''),
    date: created ? new Date(created).toISOString().split('T')[0] : '',
    starred: false,
    shared: !!f.messageid || !!f.meetingminuteid || !!workspaceName,
    owner: f.uploader === currentUsername ? 'You' : f.uploader,
    workspace: workspaceName,
    downloadLink: f.downloadLink,
    webViewLink: f.webViewLink,
  };
}

export function DriveFiles() {
  const [driveConnected, setDriveConnected] = useState(() => localStorage.getItem('uniplatform_drive_visible') !== 'false');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('just now');
  const [uploading, setUploading] = useState(false);

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FileCategory>('all');
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('uniplatform_starred_files') || '[]'));
    } catch {
      return new Set();
    }
  });

  const [driveQuota, setDriveQuota] = useState<{ usedGb: number; totalGb: number }>({ usedGb: 0, totalGb: 15 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUsername = localStorage.getItem('uniplatform_username') || '';
  const token = localStorage.getItem('uniplatform_user_token') || '';

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const query = workspaceFilter === 'all' ? '' : `?workspaceid=${encodeURIComponent(workspaceFilter)}`;
      const res = await fetch(`${apiUrl}/api/files${query}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFiles((data.data ?? []).map((f: any) => {
          const item = apiFileToLocal(f, currentUsername);
          return { ...item, starred: starredIds.has(item.id) };
        }));
        setLastSync('just now');
      } else {
        const error = await res.json().catch(() => null);
        toast.error(error?.message || 'Failed to load files');
      }
    } catch (err) {
      console.error('Fetch files error', err);
      toast.error('Network error while loading files');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/workspaces`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch (err) {
      console.error('Fetch workspaces error', err);
    }
  };

  const fetchQuota = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/files/quota`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.usage != null && data.limit != null && data.limit > 0) {
          setDriveQuota({
            usedGb: data.usage / 1024 / 1024 / 1024,
            totalGb: data.limit / 1024 / 1024 / 1024,
          });
        }
      }
    } catch (err) {
      console.error('Fetch quota error', err);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
    fetchQuota();
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [workspaceFilter]);

  const handleSync = async () => {
    setSyncing(true);
    await fetchFiles();
    setSyncing(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error('File exceeds 50MB');
      return;
    }

    const form = new FormData();
    form.append('file', file);
    setUploading(true);
    try {
      const res = await fetch(`${apiUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        if (workspaceFilter !== 'all') {
          setWorkspaceFilter('all');
        } else {
          await fetchFiles();
        }
        toast.success('Personal file uploaded');
      } else {
        const error = await res.json().catch(() => null);
        toast.error(error?.message || 'Failed to upload file');
      }
    } catch (err) {
      console.error('Upload error', err);
      toast.error('Network error while uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this file?')) return;

    try {
      const res = await fetch(`${apiUrl}/api/files/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        toast.error(error?.message || 'Failed to delete file');
        return;
      }
      setFiles(prev => prev.filter(f => f.id !== id));
      toast.success('File deleted');
    } catch (err) {
      console.error('Delete error', err);
      toast.error('Network error while deleting file');
    }
  };

  const handleToggleStar = (id: string) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      const isStarred = next.has(id);
      if (isStarred) {
        next.delete(id);
      } else {
        next.add(id);
      }

      localStorage.setItem('uniplatform_starred_files', JSON.stringify([...next]));
      toast.success(isStarred ? 'Removed from starred files' : 'Added to starred files');
      return next;
    });

    setFiles(prev => prev.map(f => f.id === id ? { ...f, starred: !f.starred } : f));
  };

  const setDriveVisibility = (visible: boolean) => {
    localStorage.setItem('uniplatform_drive_visible', String(visible));
    setDriveConnected(visible);
    toast.success(visible ? 'Drive files shown' : 'Drive files hidden');
    if (visible) fetchFiles();
  };

  const openStorageUpgrade = () => {
    window.open('https://one.google.com/storage', '_blank', 'noopener,noreferrer');
  };

  const openFileDownload = (file: DriveFile) => {
    if (!file.downloadLink) {
      toast.error('Download link unavailable');
      return;
    }
    window.open(file.downloadLink, '_blank', 'noopener,noreferrer');
  };

  const openFileInDrive = (file: DriveFile) => {
    if (!file.webViewLink) {
      toast.error('Drive link unavailable');
      return;
    }
    window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
  };

  const tabs: { key: FileCategory; label: string }[] = [
    { key: 'all',           label: 'All Files'     },
    { key: 'documents',     label: 'Documents'     },
    { key: 'images',        label: 'Images'        },
    { key: 'notes',         label: 'Notes'         },
    { key: 'project files', label: 'Project Files' },
  ];

  const filtered = files.filter(f => {
    const matchCat = activeTab === 'all' || f.category === activeTab;
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const tabCounts: Record<FileCategory, number> = {
    all: files.length,
    documents: files.filter(f => f.category === 'documents').length,
    images: files.filter(f => f.category === 'images').length,
    notes: files.filter(f => f.category === 'notes').length,
    'project files': files.filter(f => f.category === 'project files').length,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 min-h-full">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 pb-24">

        {/* ── 1. Page Header ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                <FolderOpen size={18} className="text-purple-500" />
              </div>
              Drive Files
            </h1>
            <p className="text-sm text-gray-500 mt-1 ml-0.5">
              Manage personal uploads and workspace attachments through your backend-managed Google Drive account.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleSync}
              disabled={syncing || !driveConnected}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin text-purple-500' : ''} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!driveConnected || uploading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors shadow-sm disabled:opacity-50"
            >
              {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading...' : 'Upload Personal File'}
            </button>
          </div>
        </div>

        {/* ── 2. Drive Connection Card ──────────────────────────── */}
        <SectionCard>
          <CardHeader title="Google Drive" icon={<Cloud size={15} />} />
          <div className="p-6">
            {driveConnected ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                {/* Drive info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0">
                    <GoogleDriveLogo size={30} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold text-gray-900">Google Drive</p>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 border border-green-100 text-green-600 text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Connected
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">
                      {currentUsername ? `@${currentUsername}` : 'Backend managed Drive'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Last synced {lastSync}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <a
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors shadow-sm"
                  >
                    <ExternalLink size={13} />
                    Open Google Drive
                  </a>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-60"
                  >
                    <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                  <button
                    onClick={() => setDriveVisibility(false)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-100 bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors"
                  >
                    <X size={13} />
                    Hide Drive
                  </button>
                </div>
              </div>
            ) : (
              /* Not connected state */
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 py-2">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 opacity-50">
                    <GoogleDriveLogo size={30} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-900">Google Drive</p>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        Not Connected
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Show your backend-managed Google Drive files in this workspace.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDriveVisibility(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors shadow-sm shrink-0"
                >
                  <ExternalLink size={14} />
                  Show Drive Files
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── 3. Storage Overview ───────────────────────────────── */}
        {driveConnected && (
          <SectionCard>
            <CardHeader title="Storage Overview" icon={<HardDrive size={15} />} />
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Bar */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">Drive Storage</span>
                    <span className="text-sm font-bold text-purple-600">{driveQuota.usedGb.toFixed(2)} GB / {driveQuota.totalGb.toFixed(2)} GB</span>
                  </div>
                  <StorageBar used={driveQuota.usedGb} total={driveQuota.totalGb} />
                  <p className="text-xs text-gray-400 mt-2">
                    {Math.max(driveQuota.totalGb - driveQuota.usedGb, 0).toFixed(2)} GB remaining ·{' '}
                    <button onClick={openStorageUpgrade} className="text-purple-500 font-medium hover:underline">
                      Upgrade storage
                    </button>
                  </p>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
                  {[
                    { label: 'Total Files', value: files.length, color: 'text-gray-900' },
                    { label: 'Shared Files', value: files.filter(f => f.shared).length, color: 'text-purple-600' },
                  ].map((stat, i) => (
                    <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category breakdown */}
              <div className="mt-5 pt-5 border-t border-gray-50 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['documents', 'images', 'notes', 'project files'] as FileCategory[]).map(cat => (
                  <div
                    key={cat}
                    className={`flex items-center gap-2.5 p-3 rounded-xl ${getCategoryBg(cat)} border border-gray-100 cursor-pointer hover:shadow-sm transition-all`}
                    onClick={() => setActiveTab(cat)}
                  >
                    <div className={`${getCategoryText(cat)}`}>{getCategoryIcon(cat)}</div>
                    <div>
                      <p className="text-xs font-bold text-gray-800 capitalize">{cat === 'project files' ? 'Projects' : cat}</p>
                      <p className="text-[10px] text-gray-400">{tabCounts[cat]} files</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── 4. File Management ────────────────────────────────── */}
        <SectionCard>
          <CardHeader
            title="Files"
            icon={<FolderOpen size={15} />}
            action={
              <span className="text-xs text-gray-400 font-medium">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
            }
          />
          <div className="p-6">

            {/* Search + Tabs row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search files…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all"
                />
              </div>

              <select
                value={workspaceFilter}
                onChange={e => setWorkspaceFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent"
              >
                <option value="all">All accessible files</option>
                {workspaces.map(workspace => (
                  <option key={workspace.workspaceid} value={workspace.workspaceid}>{workspace.name}</option>
                ))}
              </select>

              {/* Category tabs */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto shrink-0">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === tab.key
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === tab.key ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-400'
                    }`}>
                      {tabCounts[tab.key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* File List */}
            {loading ? (
              <div className="py-16 flex flex-col items-center text-center">
                <RefreshCw size={24} className="text-gray-300 animate-spin mb-3" />
                <p className="text-sm text-gray-400">Loading files…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                  <FolderOpen size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">No files found</p>
                <p className="text-xs text-gray-300 mt-1">
                  {search ? `No results for "${search}"` : 'Upload a personal file or choose All accessible files'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50">
                  <span>Name</span>
                  <span className="w-16 text-center">Type</span>
                  <span className="w-20 text-right">Size</span>
                  <span className="w-24 text-right">Date</span>
                  <span className="w-20 text-right">Actions</span>
                </div>

                {filtered.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-purple-100 hover:bg-purple-50/30 transition-all group cursor-default"
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getCategoryBg(file.category)} ${getCategoryText(file.category)}`}>
                      {getCategoryIcon(file.category)}
                    </div>

                    {/* Name + owner */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        {file.starred && (
                          <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />
                        )}
                        {file.shared && (
                          <span className="hidden sm:inline text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">Shared</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {file.workspace
                          ? `${file.owner === 'You' ? 'Owned by you' : `Shared by ${file.owner}`} - ${file.workspace}`
                          : file.owner === 'You' ? 'Owned by you' : `Shared by ${file.owner}`}
                      </p>
                    </div>

                    {/* Type badge */}
                    <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md w-14 items-center justify-center ${typeBadgeColor[file.type] ?? 'bg-gray-100 text-gray-500'}`}>
                      {file.type}
                    </span>

                    {/* Size */}
                    <span className="hidden sm:block text-xs text-gray-400 font-medium w-16 text-right shrink-0">{file.size}</span>

                    {/* Date */}
                    <span className="hidden sm:block text-xs text-gray-400 w-24 text-right shrink-0">{file.date}</span>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleToggleStar(file.id)}
                        className={`p-1.5 rounded-lg transition-colors ${file.starred ? 'text-amber-400' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}
                        title="Star"
                      >
                        <Star size={13} fill={file.starred ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-purple-500 hover:bg-purple-50 transition-colors"
                        title="Details"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => openFileDownload(file)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-purple-500 hover:bg-purple-50 transition-colors"
                        title="Download"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── 5. Helper Info ────────────────────────────────────── */}
        <div className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-purple-100 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
            <Info size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Drive Files is your central document hub</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Personal uploads from this page and project files attached from chat or meeting minutes are managed through the backend Drive integration, keeping everything accessible in one place.
            </p>
          </div>
        </div>

      </div>

      {/* ── Hidden file input ─────────────────────────────────── */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />

      {/* ── File Preview Modal ────────────────────────────────── */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${getCategoryBg(previewFile.category)} ${getCategoryText(previewFile.category)}`}>
              {getCategoryIcon(previewFile.category)}
            </div>

            <h3 className="font-bold text-gray-900 mb-0.5 truncate">{previewFile.name}</h3>
            <p className="text-xs text-gray-400 mb-5">
              {previewFile.size} · {previewFile.date} · {previewFile.owner === 'You' ? 'Owned by you' : `Shared by ${previewFile.owner}`}
            </p>

            <div className="space-y-2 mb-6">
              {[
                { label: 'Type',     value: previewFile.type },
                { label: 'Category', value: previewFile.category },
                { label: 'Shared',   value: previewFile.shared ? 'Yes' : 'No' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-xs text-gray-400 font-medium">{row.label}</span>
                  <span className="text-xs text-gray-700 font-semibold capitalize">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => openFileDownload(previewFile)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
              >
                <Download size={14} />Download
              </button>
              <button
                onClick={() => openFileInDrive(previewFile)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 text-purple-600 text-sm font-semibold hover:bg-purple-100 transition-colors"
              >
                <ExternalLink size={14} />Open
              </button>
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
