import { createBrowserRouter, Navigate } from "react-router";
import { DashboardLayout } from "./components/DashboardLayout";
import { ChatInterface } from "./components/ChatInterface";
import { AIAssistant } from "./components/AIAssistant";
import { RightPanel } from "./components/RightPanel";
import { MeetingsSchedule } from "./components/MeetingsSchedule";
import { MeetingRoom } from "./components/MeetingRoom";
import { MeetingReview } from "./components/MeetingReview";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: DashboardLayout,
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      {
        path: "chat",
        element: (
          <>
            <main className="flex-1 flex flex-col min-w-0 bg-white border-r border-gray-100">
              <ChatInterface />
            </main>
            <aside className="hidden lg:flex w-[340px] flex-col h-full bg-white overflow-y-auto shrink-0">
              <RightPanel />
            </aside>
          </>
        )
      },
      {
        path: "ai-assistant",
        element: (
          <main className="flex-1 flex flex-col min-w-0 bg-white">
            <AIAssistant />
          </main>
        )
      },
      {
        path: "meetings",
        element: (
          <main className="flex-1 flex flex-col min-w-0 bg-white">
            <MeetingsSchedule />
          </main>
        )
      },
      {
        path: "meetings/:meetingId/review",
        element: (
          <main className="flex-1 flex flex-col min-w-0 bg-white">
            <MeetingReview />
          </main>
        )
      },
      // Fallback for other routes
      {
        path: "*",
        element: (
          <main className="flex-1 flex flex-col items-center justify-center min-w-0 bg-white p-8">
            <div className="text-gray-400 font-medium">Coming soon</div>
          </main>
        )
      }
    ],
  },
  // Meeting room is outside the dashboard layout for full-screen experience
  {
    path: "/meetings/:meetingId",
    Component: MeetingRoom,
  },
]);
