'use client';

import React, { useState, useEffect } from 'react';
import NotificationCenter from './NotificationCenter';
import NavigationSidebar from './NavigationSidebar';

interface DashboardLayoutClientProps {
  user: any;
  microApps: any[];
  children: React.ReactNode;
}

/**
 * 🚀 DashboardLayoutClient
 * Standardized Default Export for Absolute Module Resolution
 */
export default function DashboardLayoutClient({ user, microApps, children }: DashboardLayoutClientProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
    setIsMounted(true);
  }, []);

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  const sidebarWithProps = (
    <NavigationSidebar 
      user={user} 
      microApps={microApps} 
      isCollapsed={isCollapsed} 
      onToggle={handleToggle} 
    />
  );

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {sidebarWithProps}
      <main 
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isMounted ? (isCollapsed ? 'ml-20' : 'ml-72') : 'ml-72'
        }`}
      >
        {/* Global Header for Dashboard: Added for Notification Quick Access */}
        <header className="h-16 flex items-center justify-end px-8 gap-4 z-[90] sticky top-0 bg-[#f8fafc]/80 backdrop-blur-md">
           <NotificationCenter />
        </header>
        
        <div className="flex-1 w-full overflow-hidden flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
