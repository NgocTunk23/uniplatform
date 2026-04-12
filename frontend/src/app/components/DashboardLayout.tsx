import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';
import { Outlet } from 'react-router';

export function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-gray-900 font-sans">
      {/* Mobile Header (visible only on small screens) */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-100 bg-white absolute top-0 w-full z-20">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">UniPlatform</h1>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -mr-2 text-gray-600 hover:bg-gray-50 rounded-lg"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Main Sidebar (Desktop fixed, Mobile overlay) */}
      <div 
        className={`
          fixed md:relative md:flex z-10 w-72 h-full flex-col bg-white border-r border-gray-100 transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Padding-top on mobile to account for the mobile header */}
        <div className="md:hidden h-[73px] flex-shrink-0" />
        <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main Content Area (Dynamic based on route) */}
      <div className="flex flex-1 flex-col md:flex-row h-full overflow-hidden mt-[73px] md:mt-0 relative">
        <Outlet />
      </div>
      
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/20 z-0 md:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
