# WebRTC & Meeting Architecture

This document outlines the technical implementation of the real-time meeting system in UniPlatform, including WebRTC signaling, synchronization, and stabilization techniques.

## 1. Overview
UniPlatform uses a **Mesh P2P Topology** for video conferencing. Every participant establishes a direct `RTCPeerConnection` with every other participant. This is suitable for small to medium-sized groups (up to 8-10 participants).

## 2. Signaling Mechanism
Signaling is handled via **Socket.io** to exchange session descriptions (Offer/Answer) and ICE candidates.

### Socket Events
- `join_meeting`: User enters a room and triggers signaling with existing members.
- `webrtc_signal`: Relays SDP and ICE data between peers.
- `meeting_participants_update`: Broadcasts the current list of active users, including their media states.
- `sync_meeting_state`: Synchronizes Mic/Camera toggles.
- `sync_speaking_state`: Synchronizes real-time audio activity (Speaking Detection).

## 3. Stabilization Techniques

### 3.1 Seamless Media Toggling (`replaceTrack`)
Instead of destroying and recreating PeerConnections (which is expensive and causes flickering), we use `RTCRtpSender.replaceTrack()`.
- **Action:** When a user toggles their camera/mic, we find the corresponding `RTCRtpTransceiver` and swap the track.
- **Benefit:** No P2P renegotiation is required, resulting in instant toggling and 100% connection stability.

### 3.2 Frozen Frame Prevention
To prevent "frozen frames" when a remote user turns off their camera:
- The receiver listens for the `isVideoOn: false` state via socket.
- The `RemoteVideo` component explicitly sets `videoRef.current.srcObject = null` when the camera is off.
- This ensures the browser clears the last rendered frame instead of sticking on it.

## 4. Live Participant Tracking
The backend maintains an in-memory `meetingRooms` Map in the socket server.
- This data is used to augment REST API responses (`activeParticipantsCount`).
- Allows the frontend to display "X active / Y total" participants on meeting cards before joining.

## 5. Speaking Detection
Implemented using the **Web Audio API** on the client side.
- **Analysis:** An `AnalyserNode` monitors the local audio stream's frequency data.
- **Threshold:** If the average volume exceeds a specific threshold (default: 25), `isSpeaking` is set to `true`.
- **Hysteresis:** A 400ms delay is added before setting `isSpeaking` to `false` to prevent flickering during natural speech pauses.

## 6. Future Recommendations
- **Transition to SFU:** For scaling beyond 10 participants, consider implementing an SFU (Selective Forwarding Unit) like LiveKit or Mediasoup.
- **TURN Servers:** Deploy dedicated TURN servers (Coturn) for users behind restrictive firewalls/NAT.
