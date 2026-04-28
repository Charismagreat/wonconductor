'use client';

import React from 'react';
import Link from 'next/link';
import { Home, ListTodo, Archive, User, Search } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { AIFAB } from './AI-FAB';
import { usePathname } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MobileLayoutProps {
  children: React.ReactNode;
  user?: any;
  title?: string;
  hideNavigation?: boolean;
  branding?: string;
  headerRightContent?: React.ReactNode;
}

export function MobileLayout({ children, user, title, hideNavigation = false, branding, headerRightContent }: MobileLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { icon: <Home size={22} />, label: '홈', href: '/m' },
    { icon: <ListTodo size={22} />, label: '할일', href: '/m/tasks' },
    { icon: <Archive size={22} />, label: '보관함', href: '/m/archive' },
    { icon: <User size={22} />, label: '내 정보', href: '/m/profile' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 glass border-b px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          {branding !== null && (
            <span className="text-[10px] font-black tracking-widest text-primary uppercase">
              {branding || 'Won Conductor'}
            </span>
          )}
          <h1 className="text-xl font-black tracking-tight">{title || '마이 워크스페이스 2.0'}</h1>
        </div>
        <div className="flex items-center gap-3">
          {headerRightContent}
          <button className="p-2 rounded-xl glass hover:bg-opacity-80 transition-all active:scale-95">
            <Search size={20} className="text-foreground/70" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className={cn("flex-1 overflow-x-hidden overflow-y-auto", !hideNavigation && "pb-24")}>
        {children}
      </main>

      {/* Floating Action Button - Only show when navigation is visible */}
      {!hideNavigation && <AIFAB />}

      {/* Bottom Navigation Tab Bar */}
      {!hideNavigation && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t pb-safe">
          <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-3">
            {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all duration-300 group",
                  isActive ? "text-primary scale-105" : "text-foreground/40 hover:text-foreground/70"
                )}
              >
                <div className={cn(
                  "p-2 rounded-2xl transition-all duration-300",
                  isActive && "bg-primary/10 shadow-inner"
                )}>
                  {item.icon}
                </div>
                <span className={cn(
                  "text-[10px] font-bold tracking-tight",
                  isActive ? "text-primary" : "text-foreground/40"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute top-0 w-12 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      )}
    </div>
  );
}
