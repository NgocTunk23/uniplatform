import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChatInterface } from './ChatInterface';
import { io, Socket } from 'socket.io-client';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  Users,
  MessageSquare,
  MoreVertical,
  Settings,
  X,
  Paperclip,
  Download,
  Send,
  Grid3x3,
  Maximize2,
  Bot,
  CircleStop,
  Loader2,
  Radio
} from 'lucide-react';
import { toast } from 'sonner';
import { JOIN_WINDOW_MINUTES } from '../utils/meeting';

interface Participant {
  id: string;
  name: string;
  initials: string;
  isAudioMuted: boolean;
  isVideoOn: boolean;
  isSpeaking: boolean;
  socketId: string;
  stream?: MediaStream;
  isRecordingBot?: boolean;
}

interface MeetingDetails {
  meetingid: string;
  title: string;
  workspaceid: string;
  starttime: string;
  endtime: string;
  status: string;
  organizer: string;
  bot_status?: 'idle' | 'recording' | 'processing' | 'completed' | 'failed' | string | null;
  recording_error?: string | null;
  recording_file?: string | null;
}

interface RecordingStatus {
  bot_status: 'idle' | 'recording' | 'processing' | 'completed' | 'failed' | string;
  recordingDownloadLink?: string | null;
  recording_error?: string | null;
}

interface MicTestResult {
  status: 'good' | 'quiet' | 'clipping' | 'silent' | 'unknown';
  message: string;
  rms: number;
  peak: number;
  speechRatio: number;
}

const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 24, max: 30 },
};

// Separate component for remote video to manage stream attachment
const RemoteVideo = ({ stream, participant, isLocal, localVideoOn }: { stream: MediaStream | null, participant: Participant, isLocal: boolean, localVideoOn?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // SỬA LỖI ĐỨNG HÌNH: Chỉ tin tưởng state từ Socket làm nguồn chân lý (Source of Truth).
  const effectivelyVideoOn = isLocal ? localVideoOn : participant.isVideoOn;

  useEffect(() => {
    if (videoRef.current) {
      // Nếu có stream và trạng thái đang bật camera
      if (stream && effectivelyVideoOn) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.play().catch(e => {
          console.warn("Autoplay blocked, attempting muted play:", e);
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(err => console.error("Still cannot play:", err));
          }
        });
      } else {
        // QUAN TRỌNG: Xóa hẳn stream khỏi thẻ video khi tắt cam để tránh kẹt frame (đứng hình)
        videoRef.current.srcObject = null;
      }
    }
  }, [stream, effectivelyVideoOn]);

  return (
    <div className={`relative w-full h-full bg-gray-900 overflow-hidden transition-all duration-300 ${participant.isSpeaking ? 'ring-4 ring-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] z-10' : 'ring-0'}`}>
      {/* Avatar Fallback */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950 transition-opacity duration-500 ${effectivelyVideoOn ? 'opacity-0 z-0' : 'opacity-100 z-10'}`}>
        <div className={`w-20 h-20 md:w-32 md:h-32 rounded-full flex items-center justify-center text-white text-3xl md:text-5xl font-black mb-4 shadow-2xl transition-transform duration-300 ${participant.isSpeaking ? 'scale-110' : 'scale-100'} ${isLocal ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-gray-800 border-4 border-white/5'}`}>
          {participant.initials}
        </div>
        <p className="text-white/60 text-sm font-medium">{isLocal ? 'You (Camera Off)' : participant.name}</p>
        {participant.isSpeaking && (
          <div className="mt-4 flex gap-1 items-center">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" />
          </div>
        )}
      </div>

      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-500 ${effectivelyVideoOn ? 'opacity-100 z-20' : 'opacity-0 z-0'} ${isLocal ? 'scale-x-[-1]' : ''}`}
      />
    </div>
  );
};

export function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [activePanel, setActivePanel] = useState<'chat' | 'participants' | 'layout' | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  
  // New Meeting Management States
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [isOvertime, setIsOvertime] = useState(false);
  const [userWorkspaceRole, setUserWorkspaceRole] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>({ bot_status: 'idle' });
  const [recordingAction, setRecordingAction] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micTestRunning, setMicTestRunning] = useState(false);
  const [micTestResult, setMicTestResult] = useState<MicTestResult | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const participantsRef = useRef<Participant[]>([]);
  const joinTimeRef = useRef<number>(Date.now());

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  const token = localStorage.getItem('uniplatform_user_token');
  const currentUser = localStorage.getItem('uniplatform_username') || '';

  const PEER_CONFIG: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  };

  useEffect(() => {
    if (meetingId) {
      fetchMeetingDetails();
      initSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_meeting', { meetingId });
        socketRef.current.disconnect();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      peersRef.current.forEach(peer => peer.close());
      peersRef.current.clear();
    };
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) return;
    const timer = window.setInterval(fetchRecordingStatus, 5000);
    return () => window.clearInterval(timer);
  }, [meetingId]);

  // Speaking Detection logic using Web Audio API
  useEffect(() => {
    if (!localStream || !isMicOn) {
      setMicLevel(0);
      if (socketRef.current && meetingId) {
        socketRef.current.emit('sync_speaking_state', { meetingId, isSpeaking: false });
      }
      return;
    }

    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;
    let animationFrame: number;
    let isCurrentlySpeaking = false;
    let silenceStartTime = Date.now();

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicLevel(Math.min(1, average / 80));
        const speaking = average > 25; // Sensitivity threshold

        if (speaking) {
          silenceStartTime = Date.now();
          if (!isCurrentlySpeaking) {
            isCurrentlySpeaking = true;
            socketRef.current?.emit('sync_speaking_state', { meetingId, isSpeaking: true });
          }
        } else {
          // Add a small delay (400ms) before turning off speaking state to avoid flickering
          if (isCurrentlySpeaking && Date.now() - silenceStartTime > 400) {
            isCurrentlySpeaking = false;
            socketRef.current?.emit('sync_speaking_state', { meetingId, isSpeaking: false });
          }
        }

        animationFrame = requestAnimationFrame(checkAudio);
      };

      checkAudio();
    } catch (err) {
      console.error("Audio activity detection error:", err);
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (audioContext) audioContext.close();
      setMicLevel(0);
    };
  }, [localStream, isMicOn, meetingId]);

  const initSocket = () => {
    const socket = io(apiUrl, {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('sync_speaking_state', ({ isSpeaking, socketId }) => {
      setParticipants(prev => prev.map(p => p.socketId === socketId ? { ...p, isSpeaking } : p));
    });

    socket.on('meeting_ended', () => {
      toast.info("The meeting has been ended by the organizer.");
      setTimeout(() => navigate('/meetings'), 2000);
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected, emitting join_meeting for:', meetingId);
      socket.emit('join_meeting', { meetingId });
    });

    if (socket.connected) {
      console.log('✅ Socket already connected, joining meeting...');
      socket.emit('join_meeting', { meetingId });
    }

    socket.on('meeting_participants_update', async (updatedParticipants: Participant[]) => {
      try {
        console.log('👥 Participants updated:', updatedParticipants.length, updatedParticipants.map(p => p.id));

        const prevCount = participantsRef.current.length;
        if (updatedParticipants.length > prevCount && updatedParticipants.length > 1) {
          toast.success(`Connected with ${updatedParticipants.length - 1} other(s)`);
        }

        updatedParticipants.forEach(async (p) => {
          if (p.isRecordingBot) return;
          if (p.socketId !== socket.id && !peersRef.current.has(p.socketId)) {
            // The peer with the lexicographically smaller socketId will initiate the connection
            if (socket.id! < p.socketId) {
              console.log('🔗 I am the initiator for:', p.socketId);
              const peer = await createPeer(p.socketId);

              // Initiator adds tracks immediately
              addLocalTracksToPeer(peer);

              // Ensure we always negotiate audio and video m-lines as the initiator
              // By calling addTransceiver, onnegotiationneeded WILL BE FIRED automatically!
              // This guarantees the offer will create exactly 1 audio and 1 video transceiver
              // on the Responder side when setRemoteDescription is called.
              const currentLocalStream = localStreamRef.current;
              const hasAudio = currentLocalStream && currentLocalStream.getAudioTracks().length > 0;
              const hasVideo = currentLocalStream && currentLocalStream.getVideoTracks().length > 0;

              if (!hasAudio) peer.addTransceiver('audio', { direction: 'recvonly' });
              if (!hasVideo) peer.addTransceiver('video', { direction: 'recvonly' });
            }
          }
        });

        const updatedSocketIds = new Set(updatedParticipants.map(p => p.socketId));
        peersRef.current.forEach((peer, socketId) => {
          if (!updatedSocketIds.has(socketId)) {
            console.log('✂️ Cleaning up disconnected peer:', socketId);
            peer.close();
            peersRef.current.delete(socketId);
          }
        });

        participantsRef.current = updatedParticipants;
        setParticipants(updatedParticipants);
      } catch (updateErr) {
        console.error('❌ Error in meeting_participants_update handler:', updateErr);
      }
    });

    socket.on('webrtc_signal', async ({ senderSocketId, signalData }: any) => {
      try {
        let peer = peersRef.current.get(senderSocketId);
        if (!peer) {
          console.log('➕ Creating peer for incoming signal:', senderSocketId);
          peer = await createPeer(senderSocketId);

          // QUAN TRỌNG: Thêm local tracks NGAY KHI TẠO PEER để chuẩn bị cho Answer
          addLocalTracksToPeer(peer);
        }

        const isPolite = socket.id! > senderSocketId;
        const offerCollision = (signalData.type === 'offer') &&
          (peer.signalingState !== 'stable' || (peer as any).makingOffer);

        if (offerCollision) {
          if (!isPolite) return;
          console.log('🤝 Resolving offer collision (I am polite)');
        }

        // Signaling Queue to prevent race conditions
        (peer as any).signalingQueue = ((peer as any).signalingQueue || Promise.resolve())
          .then(async () => {
            if (signalData.type) {
              await peer.setRemoteDescription(new RTCSessionDescription(signalData));
              if (signalData.type === 'offer') {
                await peer.setLocalDescription();
                socket.emit('webrtc_signal', {
                  targetSocketId: senderSocketId,
                  signalData: peer.localDescription,
                  meetingId
                });
              }
            } else if (signalData.candidate) {
              try {
                await peer.addIceCandidate(new RTCIceCandidate(signalData));
              } catch (err) {
                if (!offerCollision) console.error('❌ ICE error:', err);
              }
            }
          })
          .catch((err: any) => console.error('❌ Signaling queue error:', err));
      } catch (signalErr) {
        console.error('❌ Error in webrtc_signal handler:', signalErr);
      }
    });

    socket.on('disconnect', () => console.log('❌ Socket disconnected'));
  };

  const handleToggleRecording = async () => {
    if (!meetingId || recordingAction) return;
    const isRecording = recordingStatus.bot_status === 'recording';
    const endpoint = isRecording ? 'stop' : 'start';

    setRecordingAction(true);
    try {
      if (!isRecording) {
        if (!isMicOn) {
          toast.warning('Your microphone is muted. Recording can continue if other participants are speaking.');
        } else if (micTestResult && micTestResult.status !== 'good') {
          toast.warning(micTestResult.message);
        }
      }

      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/recording/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || `Failed to ${endpoint} recording`);
      }
      setRecordingStatus(data.data || { bot_status: isRecording ? 'processing' : 'recording' });
      toast.success(isRecording ? 'Recording stopped. AI is processing the transcript.' : 'Recording started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recording action failed');
      await fetchRecordingStatus();
    } finally {
      setRecordingAction(false);
    }
  };

  const stopRecordingBeforeEnd = async () => {
    if (recordingStatus.bot_status !== 'recording') return;

    const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/recording/stop`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || 'Failed to stop recording');
    }
    setRecordingStatus(data.data || { bot_status: 'processing' });
  };

  const handleEndMeeting = async () => {
    if (!window.confirm("Are you sure you want to end this meeting for everyone?")) return;

    try {
      try {
        await stopRecordingBeforeEnd();
      } catch (recordingErr) {
        toast.error(recordingErr instanceof Error ? recordingErr.message : 'Failed to stop recording before ending meeting');
      }

      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'ended' })
      });

      if (res.ok) {
        socketRef.current?.emit('end_meeting', { meetingId });
        navigate('/meetings');
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to end meeting");
      }
    } catch (err) {
      toast.error("An error occurred while ending the meeting");
    }
  };

  const setupPeerEvents = (peer: RTCPeerConnection, targetSocketId: string) => {
    peer.onnegotiationneeded = async () => {
      try {
        console.log('🔄 Negotiation needed for:', targetSocketId);
        (peer as any).makingOffer = true;
        await peer.setLocalDescription();
        socketRef.current?.emit('webrtc_signal', {
          targetSocketId,
          signalData: peer.localDescription,
          meetingId
        });
      } catch (err) {
        console.error('❌ Negotiation error:', err);
      } finally {
        (peer as any).makingOffer = false;
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc_signal', {
          targetSocketId,
          signalData: event.candidate,
          meetingId
        });
      }
    };

    peer.ontrack = (event) => {
      console.log('🎬 Received remote track from:', targetSocketId, event.track.kind);
      setRemoteStreams(prev => {
        const next = new Map(prev);
        const existingStream = next.get(targetSocketId);

        // CRITICAL FIX: Always create a NEW MediaStream reference. 
        // If we mutate the existing stream, React won't trigger the useEffect in RemoteVideo, leaving the screen black.
        const newStream = new MediaStream(existingStream ? existingStream.getTracks() : []);

        if (!newStream.getTracks().some(t => t.id === event.track.id)) {
          newStream.addTrack(event.track);
        }

        next.set(targetSocketId, newStream);
        return next;
      });
    };

    peer.onconnectionstatechange = () => {
      console.log(`📡 Connection state with ${targetSocketId}:`, peer.connectionState);
      if (peer.connectionState === 'failed') {
        console.log('♻️ Restarting ICE for:', targetSocketId);
        peer.restartIce();
      }
    };
  };

  const addLocalTracksToPeer = (peer: RTCPeerConnection) => {
    const currentLocalStream = localStreamRef.current;
    if (currentLocalStream) {
      currentLocalStream.getTracks().forEach(track => {
        const senderExists = peer.getSenders().some(s => s.track === track);
        if (!senderExists) {
          peer.addTrack(track, currentLocalStream);
        }
      });
    }
  };

  const createPeer = async (targetSocketId: string) => {
    console.log('🏗️ Initializing peer for:', targetSocketId);
    const peer = new RTCPeerConnection(PEER_CONFIG);
    peersRef.current.set(targetSocketId, peer);
    (peer as any).signalingQueue = Promise.resolve();

    setupPeerEvents(peer, targetSocketId);
    return peer;
  };


  const fetchMeetingDetails = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();

        // Block joining a meeting earlier than JOIN_WINDOW_MINUTES before it starts.
        const startMs = new Date(data.starttime).getTime();
        if (data.status !== 'ended' && Number.isFinite(startMs) && Date.now() < startMs - JOIN_WINDOW_MINUTES * 60_000) {
          toast.error(`This meeting opens ${JOIN_WINDOW_MINUTES} minutes before it starts`);
          navigate('/meetings');
          return;
        }

        setMeeting(data);

        // Auto-update status to ongoing if it was upcoming
        if (data.status === 'upcoming') {
          const now = new Date();
          const plannedStart = new Date(data.starttime).getTime();
          const plannedEnd = new Date(data.endtime).getTime();
          const isEarlyJoin = now.getTime() < plannedStart;

          let newStartISO = data.starttime;
          let newEndISO = data.endtime;

          if (isEarlyJoin) {
            // Only shift time if joining early to ensure timer starts immediately
            const duration = plannedEnd - plannedStart;
            newStartISO = now.toISOString();
            newEndISO = new Date(now.getTime() + duration).toISOString();
          }

          fetch(`${apiUrl}/api/meetings/${meetingId}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              status: 'ongoing',
              starttime: newStartISO,
              endtime: newEndISO
            })
          }).then(updateRes => {
            if (updateRes.ok) {
              setMeeting({ ...data, status: 'ongoing', starttime: newStartISO, endtime: newEndISO });
            }
          });
        }

        // Fetch user role in this workspace for permissions
        const wsRes = await fetch(`${apiUrl}/api/workspaces/${data.workspaceid}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          const members: any[] = wsData.members || wsData.member || [];
          const me = members.find((m: any) => m.username === currentUser);
          setUserWorkspaceRole(me?.workspacerole || null);
        }

        await fetchRecordingStatus();
      } else if (res.status === 403) {
        toast.error('You do not have access to this meeting');
        navigate('/meetings');
      } else if (res.status === 404) {
        toast.error('Meeting not found');
        navigate('/meetings');
      }
    } catch (err) {
      console.error("Fetch meeting error", err);
    }
  };

  const fetchRecordingStatus = async () => {
    if (!meetingId) return;
    try {
      const res = await fetch(`${apiUrl}/api/meetings/${meetingId}/recording/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setRecordingStatus(data.data || { bot_status: 'idle' });
    } catch (err) {
      console.error("Fetch recording status error", err);
    }
  };

  const analyzeMicStream = async (stream: MediaStream, durationMs = 5000): Promise<MicTestResult> => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const dataArray = new Float32Array(analyser.fftSize);
    let frameCount = 0;
    let sumRms = 0;
    let peak = 0;
    let speechFrames = 0;
    let clippingFrames = 0;
    const startedAt = performance.now();

    return await new Promise((resolve) => {
      const tick = () => {
        analyser.getFloatTimeDomainData(dataArray);
        let sumSquares = 0;
        let framePeak = 0;
        for (let index = 0; index < dataArray.length; index += 1) {
          const sample = dataArray[index];
          const abs = Math.abs(sample);
          sumSquares += sample * sample;
          if (abs > framePeak) framePeak = abs;
        }

        const rms = Math.sqrt(sumSquares / dataArray.length);
        frameCount += 1;
        sumRms += rms;
        peak = Math.max(peak, framePeak);
        if (rms > 0.015) speechFrames += 1;
        if (framePeak > 0.98) clippingFrames += 1;
        setMicLevel(Math.min(1, rms * 12));

        if (performance.now() - startedAt < durationMs) {
          requestAnimationFrame(tick);
          return;
        }

        const averageRms = frameCount > 0 ? sumRms / frameCount : 0;
        const speechRatio = frameCount > 0 ? speechFrames / frameCount : 0;
        const clippingRatio = frameCount > 0 ? clippingFrames / frameCount : 0;
        let status: MicTestResult['status'] = 'good';
        let message = 'Mic sounds usable for recording.';

        if (speechRatio < 0.08 || peak < 0.02) {
          status = 'silent';
          message = 'No clear speech detected. Check mic permission, input device, or speak closer.';
        } else if (averageRms < 0.02) {
          status = 'quiet';
          message = 'Mic is too quiet. Move closer or increase input volume.';
        } else if (peak > 0.98 || clippingRatio > 0.01) {
          status = 'clipping';
          message = 'Mic is clipping. Lower input volume or move slightly away.';
        }

        audioContext.close();
        resolve({ status, message, rms: averageRms, peak, speechRatio });
      };

      tick();
    });
  };

  const handleMicTest = async () => {
    if (micTestRunning) return;

    setMicTestRunning(true);
    let temporaryStream: MediaStream | null = null;
    try {
      const stream = localStreamRef.current?.getAudioTracks().length
        ? localStreamRef.current
        : await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
      if (stream !== localStreamRef.current) temporaryStream = stream;

      toast.info('Testing microphone for 5 seconds. Speak normally.');
      const result = await analyzeMicStream(stream);
      setMicTestResult(result);

      if (result.status === 'good') {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }
    } catch (err) {
      console.error('Mic test failed:', err);
      setMicTestResult({
        status: 'unknown',
        message: 'Could not test microphone. Check browser permission.',
        rms: 0,
        peak: 0,
        speechRatio: 0,
      });
      toast.error('Could not test microphone. Check browser permission.');
    } finally {
      temporaryStream?.getTracks().forEach(track => track.stop());
      setMicTestRunning(false);
      if (!isMicOn) setMicLevel(0);
    }
  };

  // Timer logic to track duration and overtime
  useEffect(() => {
    if (!meeting) return;

    const timer = setInterval(() => {
      // Ensure starttime is parsed correctly regardless of format
      const startStr = meeting.starttime.includes('T') ? meeting.starttime : meeting.starttime.replace(' ', 'T');
      const start = new Date(startStr).getTime();
      const end = new Date(meeting.endtime).getTime();
      const now = new Date().getTime();

      let diff = now - start;
      
      // Strict calculation from starttime as requested
      const displayDiff = Math.max(0, diff);

      const hours = Math.floor(displayDiff / 3600000);
      const minutes = Math.floor((displayDiff % 3600000) / 60000);
      const seconds = Math.floor((displayDiff % 60000) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );

      setIsOvertime(now > end);
    }, 1000);

    return () => clearInterval(timer);
  }, [meeting]);

  const toggleMedia = async (type: 'audio' | 'video') => {
    try {
      // Xác định trạng thái chuẩn bị chuyển đổi: Bật hay Tắt?
      const isTurningOn = type === 'video' ? !isVideoOn : !isMicOn;

      if (isTurningOn) {
        // --- 1. XỬ LÝ BẬT ---
        const constraints: MediaStreamConstraints = type === 'video'
          ? { video: VIDEO_CONSTRAINTS }
          : { audio: AUDIO_CONSTRAINTS };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newTrack = type === 'video' ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];

        // Cập nhật Local Stream cho UI của bạn
        let updatedStream = localStream;
        if (updatedStream) {
          updatedStream.addTrack(newTrack);
          updatedStream = new MediaStream(updatedStream.getTracks());
        } else {
          updatedStream = newStream;
        }
        setLocalStream(updatedStream);
        localStreamRef.current = updatedStream; // Cập nhật ref ngay lập tức để đồng bộ

        // Cập nhật lên WebRTC bằng replaceTrack (Không phá vỡ kết nối P2P)
        peersRef.current.forEach(peer => {
          // Tìm "đường ống" (transceiver) đang quản lý loại track này
          const transceiver = peer.getTransceivers().find(t =>
            (t.sender.track && t.sender.track.kind === type) ||
            (t.receiver.track && t.receiver.track.kind === type)
          );

          if (transceiver && transceiver.sender) {
            // Thay thế track rỗng bằng track thực tế
            transceiver.sender.replaceTrack(newTrack);
            // Mở hướng truyền tải nếu trước đó đang là recvonly (chỉ xảy ra lần bật đầu tiên)
            if (transceiver.direction === 'recvonly') {
              transceiver.direction = 'sendrecv';
            }
          } else {
            // Fallback: Lần đầu tiên join phòng mà chưa có đường ống
            peer.addTrack(newTrack, updatedStream!);
          }
        });

        if (type === 'video') setIsVideoOn(true);
        else setIsMicOn(true);

      } else {
        // --- 2. XỬ LÝ TẮT ---
        if (localStream) {
          const tracksToStop = type === 'video' ? localStream.getVideoTracks() : localStream.getAudioTracks();

          // Tắt phần cứng (tắt đèn camera / ngắt mic)
          tracksToStop.forEach(track => {
            track.stop();
            localStream.removeTrack(track);
          });

          const updatedStream = new MediaStream(localStream.getTracks());
          setLocalStream(updatedStream);
          localStreamRef.current = updatedStream;

          // Thay thế track gửi đi bằng NULL (đối phương sẽ nhận được khung hình đen / im lặng)
          peersRef.current.forEach(peer => {
            const transceiver = peer.getTransceivers().find(t => t.sender.track?.kind === type);
            if (transceiver && transceiver.sender) {
              transceiver.sender.replaceTrack(null);
            }
          });
        }

        if (type === 'video') setIsVideoOn(false);
        else setIsMicOn(false);
      }

      // --- 3. Báo cáo trạng thái mới cho toàn phòng qua Socket ---
      if (socketRef.current) {
        socketRef.current.emit('sync_meeting_state', {
          meetingId,
          isAudioMuted: type === 'audio' ? !isTurningOn : !isMicOn,
          isVideoOn: type === 'video' ? isTurningOn : isVideoOn
        });
      }
    } catch (err) {
      toast.error(`Could not access ${type}. Please check permissions.`);
      console.error(err);
    }
  };

  const handleLeaveMeeting = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave_meeting', { meetingId });
    }
    navigate('/meetings');
  };

  if (!meeting) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white font-medium overflow-hidden">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        Preparing secure connection...
      </div>
    </div>;
  }

  const visibleParticipants = participants.filter(participant => !participant.isRecordingBot);
  const canManageRecording = meeting.organizer === currentUser || userWorkspaceRole === 'Leader';
  const isRecording = recordingStatus.bot_status === 'recording';
  const isProcessingRecording = recordingStatus.bot_status === 'processing';

  return (
    <div className="flex flex-col h-screen bg-gray-950 font-sans selection:bg-purple-500/30 overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 md:px-8 py-4 bg-gray-900/80 backdrop-blur-md border-b border-white/5 z-10 shadow-xl">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="flex items-center gap-3 min-w-0 group">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-50" />
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-white font-bold text-lg md:text-xl truncate tracking-tight">{meeting.title}</h1>
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                <Users size={12} className="text-gray-400" />
                <span className="text-gray-300 text-[11px] font-bold">{visibleParticipants.length}</span>
              </div>
            </div>
          </div>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <span className={`text-sm font-mono hidden sm:block px-2 py-0.5 rounded tracking-widest transition-colors duration-500 ${isOvertime ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-white/5 text-gray-400'}`}>
            {elapsedTime}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${isRecording ? 'bg-red-500/15 border-red-500/25' : isProcessingRecording ? 'bg-amber-500/15 border-amber-500/25' : 'bg-purple-500/15 border-purple-500/20'}`}>
            {isProcessingRecording ? <Loader2 size={16} className="text-amber-300 animate-spin" /> : <Bot size={16} className={isRecording ? 'text-red-300' : 'text-purple-400'} />}
            <span className={`text-xs font-bold uppercase tracking-wider ${isRecording ? 'text-red-300' : isProcessingRecording ? 'text-amber-300' : 'text-purple-300'}`}>
              {isRecording ? 'Recording' : isProcessingRecording ? 'AI Processing' : 'AI Recorder'}
            </span>
          </div>
          <button className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-white">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {(isRecording || isProcessingRecording) && (
        <div className={`px-4 md:px-8 py-3 border-b z-10 ${isRecording ? 'bg-red-950/95 border-red-500/30 text-red-50' : 'bg-amber-950/95 border-amber-500/30 text-amber-50'}`}>
          <div className="max-w-[1600px] mx-auto flex items-center gap-3 text-sm font-semibold">
            {isProcessingRecording ? <Loader2 size={18} className="animate-spin shrink-0" /> : <Radio size={18} className="shrink-0" />}
            <span>{isRecording ? 'Recording in progress. Everyone in this room is being recorded.' : 'Recording stopped. AI transcript and summary are being generated.'}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Video Grid */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 max-w-[1600px] mx-auto">
            {visibleParticipants.map((participant) => (
              <div
                key={participant.socketId}
                className={`group relative bg-gray-900 rounded-2xl md:rounded-3xl overflow-hidden aspect-video w-full transition-all duration-500 border border-white/5 shadow-2xl ${participant.isSpeaking ? 'ring-4 ring-purple-500/50 scale-[1.02] z-10' : 'hover:border-white/20'
                  }`}
              >
                <RemoteVideo
                  stream={participant.socketId === socketRef.current?.id ? localStream : (remoteStreams.get(participant.socketId) || null)}
                  participant={participant}
                  isLocal={participant.socketId === socketRef.current?.id}
                  localVideoOn={isVideoOn}
                />

                {/* Participant Info Overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 md:p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-white text-sm md:text-base font-bold truncate tracking-tight">{participant.name}</span>
                      {participant.socketId === socketRef.current?.id && <span className="text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Host (You)</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {(participant.socketId === socketRef.current?.id ? !isMicOn : participant.isAudioMuted) ? (
                        <div className="p-2 bg-red-500/90 rounded-xl backdrop-blur-md shadow-lg">
                          <MicOff size={14} className="text-white" />
                        </div>
                      ) : (
                        <div className={`p-2 ${participant.isSpeaking ? 'bg-purple-500' : 'bg-white/10'} rounded-xl backdrop-blur-md shadow-lg transition-colors`}>
                          <Mic size={14} className="text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* If only 1 person, show a call to action or waiting message */}
            {visibleParticipants.length === 1 && (
              <div className="aspect-video rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-center p-8 opacity-40 hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Users size={24} className="text-white" />
                </div>
                <h4 className="text-white font-bold mb-1">Waiting for others...</h4>
                <p className="text-gray-400 text-xs">Share the meeting link with your team</p>
              </div>
            )}
          </div>
        </div>

        {/* Flexible Sidebar Area - Modular structure for future expansion */}
        {activePanel && (
          <div className="fixed md:relative right-0 top-0 bottom-0 w-full max-w-sm md:w-[400px] bg-white flex flex-col z-50 shadow-2xl transition-all animate-in slide-in-from-right duration-300 border-l border-gray-100">
            {activePanel === 'chat' && (
              <>
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                  <h3 className="font-black text-gray-900 uppercase tracking-widest text-sm">Workspace Sync</h3>
                  <button onClick={() => setActivePanel(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  <ChatInterface workspaceId={meeting.workspaceid} hideHeader={true} />
                </div>
              </>
            )}

            {activePanel === 'participants' && (
              <>
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                  <h3 className="font-black text-gray-900 uppercase tracking-widest text-sm">Attendance ({visibleParticipants.length})</h3>
                  <button onClick={() => setActivePanel(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-0">
                  {participants.map((participant) => (
                    <div key={participant.socketId} className="flex items-center gap-4 p-3 hover:bg-purple-50 rounded-2xl transition-all group">
                      <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-700 text-sm font-black shadow-sm group-hover:scale-110 transition-transform">
                        {participant.isRecordingBot ? <Bot size={18} /> : participant.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{participant.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{participant.isRecordingBot ? 'Recording' : participant.socketId === socketRef.current?.id ? 'You' : 'Member'}</p>
                      </div>
                      <div className="flex gap-2">
                        {participant.isRecordingBot ? (
                          <Radio size={16} className={isRecording ? 'text-red-500' : 'text-gray-300'} />
                        ) : (
                          <>
                            {(participant.socketId === socketRef.current?.id ? !isMicOn : participant.isAudioMuted) ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} className="text-purple-500" />}
                            {!(participant.socketId === socketRef.current?.id ? isVideoOn : participant.isVideoOn) && <VideoOff size={16} className="text-gray-300" />}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activePanel === 'layout' && (
              <>
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
                  <h3 className="font-black text-gray-900 uppercase tracking-widest text-sm">Layout Options</h3>
                  <button onClick={() => setActivePanel(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X size={20} className="text-gray-500" />
                  </button>
                </div>
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center text-gray-400">
                  <Grid3x3 size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-medium">Layout features placeholder</p>
                  <p className="text-xs mt-2 italic">Space reserved for future developers</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Control Bar - Updated to match minimal design */}
      <div className="px-6 py-4 bg-gray-900/98 backdrop-blur-xl border-t border-white/5 z-20">
        <div className="flex items-center justify-between w-full h-14">
          {/* Left: Meeting ID */}
          <div className="flex-1 hidden md:flex items-center gap-3 min-w-0">
            <span className="text-white/40 text-[11px] font-medium tracking-tight truncate">Meeting ID: <span className="text-white/70 font-mono tracking-wider uppercase ml-1.5">{meetingId}</span></span>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-20 h-2 rounded-full bg-white/10 overflow-hidden" title="Microphone input level">
                <div
                  className={`h-full transition-all ${micLevel > 0.85 ? 'bg-red-400' : micLevel > 0.2 ? 'bg-green-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
              <button
                onClick={handleMicTest}
                disabled={micTestRunning}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors disabled:opacity-60 ${
                  micTestResult?.status === 'good'
                    ? 'bg-green-500/10 text-green-300 border-green-500/20'
                    : micTestResult && micTestResult.status !== 'unknown'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                }`}
                title={micTestResult?.message || 'Test microphone for recording quality'}
              >
                {micTestRunning ? 'Testing' : 'Test Mic'}
              </button>
            </div>
          </div>

          {/* Center: Controls */}
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => toggleMedia('audio')}
              className={`p-3 rounded-full transition-all duration-300 ${isMicOn ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button
              onClick={() => toggleMedia('video')}
              className={`p-3 rounded-full transition-all duration-300 ${isVideoOn ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            <button 
              onClick={() => navigate('/meetings')}
              className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl transition-all group"
              title="Leave Room"
            >
              <PhoneOff size={24} />
            </button>

            {canManageRecording && (
              <button
                onClick={handleToggleRecording}
                disabled={recordingAction || isProcessingRecording}
                className={`px-4 py-3 rounded-2xl transition-all font-bold text-xs uppercase tracking-wider border flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${isRecording ? 'bg-red-500 text-white border-red-400' : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10'}`}
                title={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {recordingAction || isProcessingRecording ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isRecording ? (
                  <CircleStop size={18} />
                ) : (
                  <Radio size={18} />
                )}
                <span className="hidden md:inline">{isRecording ? 'Stop Rec' : isProcessingRecording ? 'Processing' : 'Record'}</span>
              </button>
            )}

            {(meeting?.organizer === currentUser || userWorkspaceRole === 'Leader') && (
              <button 
                onClick={handleEndMeeting}
                className="px-4 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all font-bold text-xs uppercase tracking-wider border border-red-500/20 flex items-center gap-2"
                title="End Meeting for Everyone"
              >
                <X size={18} />
                <span className="hidden md:inline">End Meeting</span>
              </button>
            )}
          </div>

          {/* Right: Feature Toggles */}
          <div className="flex-1 flex items-center justify-end gap-2">
            <button
              onClick={() => setActivePanel(activePanel === 'participants' ? null : 'participants')}
              className={`relative p-2.5 rounded-2xl transition-all ${activePanel === 'participants' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Users size={20} />
              {visibleParticipants.length > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full text-[10px] font-black flex items-center justify-center text-white border-2 border-gray-900 shadow-lg">
                  {visibleParticipants.length}
                </div>
              )}
            </button>

            <button
              onClick={() => setActivePanel(activePanel === 'chat' ? null : 'chat')}
              className={`p-2.5 rounded-2xl transition-all ${activePanel === 'chat' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <MessageSquare size={20} />
            </button>

            <button
              onClick={() => setActivePanel(activePanel === 'layout' ? null : 'layout')}
              className={`p-2.5 rounded-2xl transition-all ${activePanel === 'layout' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Grid3x3 size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* RESERVED SPACE FOR FUTURE FEATURES - Percentage-based height for responsiveness */}
      <div className="h-[30%] bg-white border-t border-gray-200 flex items-center justify-center shrink-0">
        <div className="flex flex-col items-center gap-1 opacity-20">
          <div className="flex gap-2">
            <div className="w-8 h-2 bg-gray-300 rounded-full" />
            <div className="w-12 h-2 bg-gray-300 rounded-full" />
            <div className="w-8 h-2 bg-gray-300 rounded-full" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">Future Feature Area</span>
        </div>
      </div>
    </div>
  );
}
