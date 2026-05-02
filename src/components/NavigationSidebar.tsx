'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// 📦 EXPLICIT NAMED IMPORTS: Absolute stability for icons
import { 
  LayoutDashboard, 
  Compass, 
  Star, 
  LogOut, 
  User as UserIcon, 
  Layers,
  ChevronRight,
  Database,
  Archive,
  Zap,
  Bell,
  Users,
  ShieldCheck,
  Loader2,
  Calendar,
  Rocket,
  Wallet,
  Layout,
  Settings,
  LayoutTemplate
} from 'lucide-react';
// 🚀 DEFAULT IMPORTS: New consistency standard
import LogoutButton from './LogoutButton';
import NotificationCenter from './NotificationCenter';
import { useBranding } from '@/components/providers/BrandingProvider';

interface NavigationSidebarProps {
  user: any;
  isCollapsed?: boolean;
  onToggle?: () => void;
  microApps?: any[];
}

/**
 * 🚀 NavigationSidebar
 * Standardized Default Export for Absolute Module Resolution
 */
export default function NavigationSidebar({ user, isCollapsed = false, onToggle, microApps = [] }: NavigationSidebarProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  const pathname = usePathname();
  const { companyName, themeColor } = useBranding();

  React.useEffect(() => {
    setIsMounted(true);
    console.log('[DIAGNOSTIC] NavigationSidebar mounted');
  }, []);

  // Safe Rendering Guard
  if (!isMounted) return null;

  const menuItems = [
    {
      name: 'DASHBOARD',
      href: '/dashboard',
      icon: Star,
      active: pathname === '/dashboard',
      desc: '주요 리포트 한눈에 보기'
    },
    {
      name: 'WORKFLOW HUB',
      href: '/notifications',
      icon: Bell,
      active: pathname === '/notifications',
      desc: '업무 관련 알림 통합 관리'
    },
    {
      name: 'STEERING HUB',
      href: '/workflow/steering',
      icon: Zap,
      active: pathname.startsWith('/workflow/steering'),
      desc: 'AI 지능형 조치 및 지휘'
    },
    {
      name: 'APP STUDIO',
      href: '/publishing',
      icon: Rocket,
      active: pathname.startsWith('/publishing'),
      desc: 'AI 마이크로앱 조립 및 스튜디오'
    },
    {
      name: 'CHART STUDIO',
      href: '/dashboard/studio',
      icon: Compass,
      active: pathname === '/dashboard/studio',
      desc: 'AI 기반 데이터 시각화'
    },
    {
      name: 'FORM STUDIO',
      href: '/dashboard/form-studio',
      icon: LayoutTemplate,
      active: pathname.startsWith('/dashboard/form-studio'),
      desc: '문서 자동화 양식 빌더'
    },
    {
      name: 'SYSTEM CALENDAR',
      href: '/dashboard/calendar',
      icon: Calendar,
      active: pathname === '/dashboard/calendar',
      desc: '전사 일정 및 공지 관리'
    },
    {
      name: 'ORGANIZATION',
      href: '/admin/organization',
      icon: Users,
      active: pathname.startsWith('/admin/organization'),
      desc: '부서 및 인사 조직 관리'
    },
    {
      name: 'GUARDRAIL SETTINGS',
      href: '/admin/guardrails',
      icon: ShieldCheck,
      active: pathname.startsWith('/admin/guardrails'),
      desc: '입력 조건 및 검증 규칙 설정'
    },
    {
      name: 'MY DB',
      href: '/',
      icon: Database,
      active: pathname === '/',
      desc: '데이터 소스 및 테이블 관리'
    },
    {
      name: 'ARCHIVE',
      href: '/archive',
      icon: Archive,
      active: pathname === '/archive',
      desc: '삭제된 테이블 관리'
    },
    {
      name: 'SYSTEM SETTINGS',
      href: '/admin/settings',
      icon: Settings,
      active: pathname.startsWith('/admin/settings'),
      desc: '회사 정보 및 브랜드 설정'
    },
  ];

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-white border-r border-slate-100 flex flex-col z-[100] shadow-2xl shadow-slate-200/50 transition-all duration-300 ease-in-out overflow-hidden ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Toggle Button - Corrected Visual Volume (48px) */}
      {onToggle && (
        <button
          onClick={onToggle}
          className={`absolute -right-6 top-24 w-12 h-12 flex items-center justify-center rounded-full z-[110] transition-all duration-500 border-[6px] border-white shadow-2xl group hover:scale-110 active:scale-95 ${
            isCollapsed 
            ? 'bg-gradient-to-tr from-blue-600 to-blue-400 text-white' 
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-slate-100/50'
          }`}
          title={isCollapsed ? "펼치기" : "접기"}
        >
          {/* Subtle Pulse Effect - Always active slightly to maintain presence */}
          {isCollapsed && (
            <div className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping -z-10" />
          )}
          
          <div className={`transition-transform duration-500 ${isCollapsed ? '' : 'rotate-180'}`}>
            <ChevronRight size={24} strokeWidth={3} />
          </div>
        </button>
      )}

      {/* Logo Section */}
      <div className={`p-8 pb-4 ${isCollapsed ? 'px-4 flex justify-center' : ''}`}>
        <Link href="/" className="flex items-center gap-3 group">
          <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-xl shadow-blue-500/30 group-hover:scale-110 transition-transform duration-500">
            <Layers size={24} strokeWidth={2.5} />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 animate-in fade-in slide-in-from-left-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase whitespace-nowrap">CEO DASHBOARD</h1>
              <p 
                className="text-[11px] font-black uppercase tracking-[0.2em] mt-1.5 opacity-80 whitespace-nowrap"
                style={{ color: themeColor }}
              >
                {companyName}
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 px-4 space-y-1 overflow-y-auto pt-4 custom-scrollbar ${isCollapsed ? 'px-2' : ''}`}>
        {!isCollapsed && <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Main Navigation</p>}
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={isCollapsed ? item.name : ""}
            className={`flex items-center gap-4 py-2 rounded-2xl transition-all duration-300 group relative ${
              isCollapsed ? 'px-0 justify-center' : 'px-4'
            } ${
              item.active 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
              : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className={`p-2 rounded-xl transition-colors ${
              item.active ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'
            }`}>
              <item.icon size={18} />
            </div>
            {!isCollapsed && (
              <div className="flex-1 animate-in fade-in slide-in-from-left-2">
                <p className="text-xs font-black uppercase tracking-tight">{item.name}</p>
                <p className={`text-[9px] font-medium opacity-60 ${
                  item.active ? 'text-blue-100' : 'text-slate-400'
                }`}>
                  {item.desc}
                </p>
              </div>
            )}
            {item.active && !isCollapsed && (
              <div className="absolute right-4 animate-in fade-in slide-in-from-left-2">
                 <ChevronRight size={14} />
              </div>
            )}
          </Link>
        ))}

        {/* Dynamic Micro Apps Section */}
        {microApps.length > 0 && (
          <div className="pt-6 pb-2">
            {!isCollapsed && <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">My Micro Apps</p>}
            <div className="space-y-1">
              {microApps.map((app, index) => (
                <Link
                  key={`${app.id}-${index}`}
                  href={`/m/${app.id}`}
                  target="_blank"
                  title={isCollapsed ? app.name : ""}
                  className={`flex items-center gap-4 py-2 rounded-2xl transition-all duration-300 group relative ${
                    isCollapsed ? 'px-0 justify-center' : 'px-4'
                  } ${
                    pathname === `/m/${app.id}` 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                    : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-colors ${
                    pathname === `/m/${app.id}` ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'
                  }`}>
                    {app.templateId === 'cash-report' ? <Wallet size={18} /> : <Layout size={18} />}
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 animate-in fade-in slide-in-from-left-2">
                      <p className="text-xs font-black uppercase tracking-tight truncate">{app.name}</p>
                      <p className="text-[9px] font-medium opacity-60">
                        {new Date(app.updatedAt || app.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        }).replace(/\. /g, '.').replace(/\.$/, '')} 업데이트
                      </p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}


      </nav>

      {/* User Support / Misc */}
      <div className={`px-6 py-6 space-y-4 border-t border-slate-50 ${isCollapsed ? 'px-2' : ''}`}>
          {isCollapsed ? (
              <div className="flex flex-col items-center gap-4">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl">
                    <Compass size={18} />
                  </div>
              </div>
          ) : (
              <>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 group cursor-help transition-all hover:bg-white hover:shadow-lg flex flex-col">
                     <p className="text-[10px] font-black text-slate-800 uppercase mb-1">AI Help Center</p>
                     <p className="text-[9px] text-slate-400 font-medium leading-tight">데이터 분석이 어렵다면 언제든 AI에게 물어보세요.</p>
                 </div>
              </>
          )}
      </div>

      {/* User Profile Section */}
      <div className={`p-6 bg-slate-50/50 ${isCollapsed ? 'p-2' : ''}`}>
        <div className={`flex items-center bg-white rounded-[24px] border border-slate-100 shadow-sm transition-all duration-300 ${
          isCollapsed ? 'justify-center p-2' : 'gap-4 px-4 py-4'
        }`}>
          <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
            <UserIcon size={20} />
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 overflow-hidden animate-in fade-in slide-in-from-left-2">
                <p className="text-xs font-black text-slate-900 truncate uppercase">{user?.username || 'GUEST'}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{user?.role || 'USER'}</p>
              </div>
              <LogoutButton className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all border-none" />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
