# Meeting Room UI & Layout System

This document describes the design philosophy and implementation details of the Meeting Room interface.

## 1. Design Philosophy
The UI follows a **Minimalist Professional** aesthetic (Google Meet style), prioritizing screen real estate for video content while providing a flexible, modular sidebar system.

## 2. Layout Structure
The layout is managed using a `flex-col` container constrained to `h-screen` and `overflow-hidden`.

### 2.1 Component Hierarchy
- **Top Bar:** Displays meeting title, active participant count, and AI Assistant status.
- **Main Workspace (`flex-1`):**
    - **Video Grid:** Automatically scales based on the number of participants.
    - **Modular Sidebar:** A sliding panel for Chat, Participants, or Layout settings.
- **Bottom Control Bar:** Minimalist rounded controls for media and panel toggles.
- **Reserved Space (Future Area):** A `h-[30%]` white area at the very bottom, reserved for future feature integration.

## 3. Modular Sidebar System
Managed by a single `activePanel` state (`'chat' | 'participants' | 'layout' | null`).
- **Extensibility:** Adding a new feature (e.g., Whiteboard) only requires adding a new type to the `activePanel` and a corresponding component in the sidebar switch.
- **Responsiveness:** On mobile, the sidebar becomes an overlay (fixed). On desktop, it is relative and pushes the video grid aside.

## 4. Visual Feedback Systems

### 4.1 Speaking Indicator
When a participant is speaking (`isSpeaking: true`):
- **Video Grid:** A glowing green border (`ring-4 ring-green-500`) appears around the frame.
- **Avatar Mode:** The avatar scales up (`scale-110`).
- **Audio Wave:** If the camera is off, a 3-dot bouncing animation indicates active audio.

### 4.2 Participant Badges
- **Bottom Bar:** The "Users" icon has a dynamic badge showing the count of people currently in the room.
- **Meeting Cards:** Outside the room, cards display "X active / Y total" to provide live status.

## 5. UI Stability Controls
- **Flexbox Fix:** Uses `min-h-0` on nested flex containers to prevent Chat from overflowing and breaking the layout.
- **Viewport Locking:** Uses `h-screen` on the root div to ensure the app is perfectly contained within the browser window without external scrollbars.

## 6. Developer Notes
- **Placeholder Area:** The white space at the bottom is intentional. It uses a percentage-based height (`h-[30%]`) to remain consistent across different monitor sizes.
- **Chat Container:** The `ChatInterface` is wrapped in a `flex-1 overflow-hidden` container to ensure its internal message list scrolls independently.
