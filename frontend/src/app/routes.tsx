import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { DashboardLayout } from './components/DashboardLayout';
import { MeetingsSchedule } from './components/MeetingsSchedule';
import { MeetingReview } from './components/MeetingReview';
import { AIAssistant } from './components/AIAssistant';
import { MeetingRoom } from "./components/MeetingRoom";
import { UserProfile } from "./components/UserProfile";
import { PersonalSchedule } from "./components/PersonalSchedule";
import { TeamCoordination } from "./components/TeamCoordination";
import { DriveFiles } from "./components/DriveFiles";



export const router = createBrowserRouter([
  {
    path: "/",
    Component: DashboardLayout,
    children: [
      // { index: true, element: <Navigate to="/chat" replace /> },
      // {
      //   path: "chat",
      //   element: (
      //     <>
      //       <main className="flex-1 flex flex-col min-w-0 bg-white border-r border-gray-100">
      //         <ChatInterface />
      //       </main>
      //       <aside className="hidden lg:flex w-[340px] flex-col h-full bg-white overflow-y-auto shrink-0">
      //         <RightPanel />
      //       </aside>
      //     </>
      //   )
      // },
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
      {
        path: "profile",
        element: (
          <main className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
            <UserProfile />
          </main>
        )
      },
      {
        path: "schedule",
        element: (
          <main className="flex-1 flex flex-col min-w-0 bg-gray-50/40">
            <PersonalSchedule />
          </main>
        )
      },
      // {
      //   path: "team-schedule",
      //   element: (
      //     <main className="flex-1 flex flex-col min-w-0 bg-gray-50/40">
      //       <TeamCoordination />
      //     </main>
      //   )
      // },
      {
        path: "files",
        element: (
          <main className="flex-1 flex flex-col min-w-0 bg-gray-50/50">
            <DriveFiles />
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