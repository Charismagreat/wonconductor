'use client';

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUnreadNotificationsAction } from '@/app/actions/notification';

interface NotificationCenterProps {
    variant?: 'icon' | 'card';
}

/**
 * 🚀 NotificationCenter
 * Standardized Default Export for Absolute Module Resolution
 */
export default function NotificationCenter({ variant = 'icon' }: NotificationCenterProps) {
    const pathname = usePathname();
    const [isMounted, setIsMounted] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchStatus = async () => {
        try {
            const res = await getUnreadNotificationsAction();
            const data = Array.isArray(res) ? res : (res?.rows || []);
            
            if (data.length > 0) {
                const uniqueKeys = new Set(data.map((noti: any) => 
                    noti.link && noti.link.includes('openItem=') ? noti.link : noti.id
                ));
                setUnreadCount(uniqueKeys.size);
            } else {
                setUnreadCount(0);
            }
        } catch (err) {
            console.error('Failed to fetch notification status:', err);
        }
    };

    useEffect(() => {
        setIsMounted(true);
        fetchStatus();
        const timer = setInterval(fetchStatus, 60000);
        const onUpdated = () => {
            fetchStatus();
        };
        const onFocus = () => {
            fetchStatus();
        };
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                fetchStatus();
            }
        };
        window.addEventListener('notification:updated', onUpdated);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            window.removeEventListener('notification:updated', onUpdated);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    useEffect(() => {
        // 라우트 변경 시 배지 카운트를 즉시 동기화
        if (!isMounted) return;
        fetchStatus();
    }, [pathname, isMounted]);

    if (!isMounted) return null;

    const isWorkspace = pathname?.includes('/workspace') || false;
    const targetUrl = (variant === 'card' || !isWorkspace) ? '/notifications' : '/workspace/notifications';
    const isActive = pathname?.endsWith(targetUrl);

    if (variant === 'icon') {
        return (
            <Link 
                href={targetUrl}
                className={`relative p-3 rounded-2xl transition-all duration-300 group ${
                    isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
                }`}
            >
                <Bell size={20} className={unreadCount > 0 ? 'animate-bounce text-blue-400' : ''} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-4 ring-white shadow-lg z-10">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </Link>
        );
    }

    return (
        <Link 
            href={targetUrl}
            className={`w-full text-left p-4 bg-slate-50 rounded-2xl border border-slate-100/50 group transition-all hover:bg-white hover:shadow-lg relative overflow-hidden flex flex-col ${
                isActive ? 'bg-white shadow-xl border-blue-200' : ''
            }`}
        >
            <div className="flex items-center justify-between mb-1">
                <p className={`text-[10px] font-black uppercase tracking-tight ${isActive ? 'text-blue-600' : 'text-slate-800'}`}>
                    Workflow Hub
                </p>
                <div className="relative">
                    <Bell size={12} className={unreadCount > 0 ? 'text-blue-600 fill-blue-600 animate-pulse' : 'text-slate-300'} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                    )}
                </div>
            </div>
            <p className="text-[9px] text-slate-400 font-medium leading-tight">
                {unreadCount > 0 
                    ? `새로운 알림이 ${unreadCount}건 있습니다.` 
                    : '현재 새로운 알림이 없습니다.'}
            </p>
            {unreadCount > 0 && (
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 shadow-sm" />
            )}
        </Link>
    );
}
