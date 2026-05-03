const SOCKET_EVENTS = require('../constants/socket-events');

// Keep track of meeting participants in memory
// meetingId -> Map(socketId -> userData)
const meetingRooms = new Map();

const registerMeetingHandlers = (io, socket) => {
  socket.on(SOCKET_EVENTS.JOIN_MEETING, ({ meetingId }) => {
    console.log(`📡 User ${socket.user.username} (socket: ${socket.id}) attempting to join meeting: ${meetingId}`);
    
    socket.join(`meeting:${meetingId}`);
    
    if (!meetingRooms.has(meetingId)) {
      meetingRooms.set(meetingId, new Map());
      console.log(`🏢 Created new room for meeting: ${meetingId}`);
    }
    
    const participants = meetingRooms.get(meetingId);
    participants.set(socket.id, {
      id: socket.user.username,
      name: socket.user.fullname || socket.user.username,
      initials: (socket.user.fullname || socket.user.username).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      socketId: socket.id,
      isAudioMuted: true,
      isVideoOn: false,
      isSpeaking: false
    });
    
    const currentParticipants = Array.from(participants.values());
    console.log(`👥 Room ${meetingId} now has ${currentParticipants.length} participants:`, currentParticipants.map(p => p.id));
    
    // Notify everyone in the room (including sender)
    io.to(`meeting:${meetingId}`).emit(SOCKET_EVENTS.MEETING_PARTICIPANTS_UPDATE, currentParticipants);
    
    // Explicitly notify the sender just in case the room broadcast missed them
    socket.emit(SOCKET_EVENTS.MEETING_PARTICIPANTS_UPDATE, currentParticipants);
  });

  socket.on(SOCKET_EVENTS.LEAVE_MEETING, ({ meetingId }) => {
    console.log(`🏃 User ${socket.user.username} leaving meeting: ${meetingId}`);
    handleUserLeaving(io, socket, meetingId);
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    console.log(`🔥 Socket disconnected: ${socket.id} (${socket.user?.username})`);
    for (const [meetingId, participants] of meetingRooms.entries()) {
      if (participants.has(socket.id)) {
        handleUserLeaving(io, socket, meetingId);
      }
    }
  });

  // WebRTC Signaling
  socket.on(SOCKET_EVENTS.WEBRTC_SIGNAL, ({ targetSocketId, signalData, meetingId }) => {
    console.log(`📶 Signal from ${socket.id} to ${targetSocketId} in room ${meetingId}`);
    io.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_SIGNAL, {
      senderSocketId: socket.id,
      signalData,
      meetingId
    });
  });

  // Sync state (Mute/Unmute, Video On/Off)
  socket.on('sync_meeting_state', ({ meetingId, isAudioMuted, isVideoOn }) => {
    if (meetingRooms.has(meetingId)) {
      const participants = meetingRooms.get(meetingId);
      if (participants.has(socket.id)) {
        const p = participants.get(socket.id);
        p.isAudioMuted = isAudioMuted;
        p.isVideoOn = isVideoOn;
        
        console.log(`🔄 Sync state for ${socket.user.username}: Mic=${!isAudioMuted}, Video=${isVideoOn}`);
        io.to(`meeting:${meetingId}`).emit(SOCKET_EVENTS.MEETING_PARTICIPANTS_UPDATE, Array.from(participants.values()));
      }
    }
  });

  socket.on('sync_speaking_state', ({ meetingId, isSpeaking }) => {
    if (meetingRooms.has(meetingId)) {
      const participants = meetingRooms.get(meetingId);
      if (participants.has(socket.id)) {
        const p = participants.get(socket.id);
        if (p.isSpeaking !== isSpeaking) {
          p.isSpeaking = isSpeaking;
          io.to(`meeting:${meetingId}`).emit(SOCKET_EVENTS.MEETING_PARTICIPANTS_UPDATE, Array.from(participants.values()));
        }
      }
    }
  });

  socket.on('end_meeting', ({ meetingId }) => {
    // Broadcast to everyone that meeting is over
    handleMeetingEnd(io, meetingId);
  });
};

const handleUserLeaving = (io, socket, meetingId) => {
  socket.leave(`meeting:${meetingId}`);
  
  if (meetingRooms.has(meetingId)) {
    const participants = meetingRooms.get(meetingId);
    if (participants.has(socket.id)) {
      participants.delete(socket.id);
      
      const currentParticipants = Array.from(participants.values());
      io.to(`meeting:${meetingId}`).emit(SOCKET_EVENTS.MEETING_PARTICIPANTS_UPDATE, currentParticipants);
      
      console.log(`👋 User ${socket.user.username} left meeting ${meetingId}. Remaining: ${currentParticipants.length}`);
      
      if (currentParticipants.length === 0) {
        meetingRooms.delete(meetingId);
        console.log(`🧹 Room ${meetingId} empty, deleted.`);
      }
    }
  }
};

const handleMeetingEnd = (io, meetingId) => {
  io.to(`meeting:${meetingId}`).emit('meeting_ended', { meetingId });
  console.log(`⏹️ Meeting ${meetingId} ended by authority. Notifying all participants.`);
};

module.exports = { registerMeetingHandlers, meetingRooms };
