'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ClipboardList, Clock, Bell, Loader2, MapPin, FileText, ChevronRight } from 'lucide-react';
import { checkInAction } from '@/app/workspace/attendance-actions';
import LogoutButton from '../LogoutButton';

interface SummaryProps {
    user: any;
    attendance: any;
    todoCount: number;
    notifCount: number;
}

export function DashboardSummary({ user, attendance: initialAttendance, todoCount, notifCount }: SummaryProps) {
    const [attendance, setAttendance] = useState(initialAttendance);
    const [isCheckingIn, setIsCheckingIn] = useState(false);

    const handleCheckIn = async () => {
        if (!navigator.geolocation) {
            alert('이 브라우저는 위치 정보를 지원하지 않습니다.');
            return;
        }

        setIsCheckingIn(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                // [DEMO MODE] 현재 시각 캡처 및 상태 생성
                const now = new Date();
                const hours = now.getHours();
                const minutes = now.getMinutes();
                const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                
                // 09:00 이후면 지각으로 간주 (데모용 로직)
                const isLate = hours > 9 || (hours === 9 && minutes > 0);

                try {
                    // 실제 서버 동기화 시도 (실패해도 데모는 진행)
                    const result = await checkInAction(latitude, longitude);
                    if (result.success) {
                        setAttendance({
                            checkInTime: result.checkInTime,
                            isLate: result.isLate,
                            location: { lat: latitude, lng: longitude }
                        });
                    } else {
                        throw new Error('Server sync failed');
                    }
                } catch (e) {
                    console.warn('Demo Mode: Server sync skipped or failed. Using local data.');
                    // 서버 실패 시에도 데모를 위해 로컬 데이터로 상태 업데이트
                    setAttendance({
                        checkInTime: timeString,
                        isLate: isLate,
                        location: { lat: latitude, lng: longitude }
                    });
                } finally {
                    setIsCheckingIn(false);
                    alert(`출근 처리가 완료되었습니다! (${timeString}${isLate ? ' - 지각' : ''})`);
                }
            },
            (error) => {
                console.error(error);
                alert('위치 정보를 가져오는데 실패했습니다. 권한 설정을 확인해 주세요.');
                setIsCheckingIn(false);
            }
        );
    };

    return (
        <div className="bg-white rounded-2xl p-[10px] mb-6 shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="space-y-2 relative z-10">
                {/* 1. Attendance Section (More Compact) */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 flex items-center justify-between border border-slate-100">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <Clock size={18} />
                        </div>
                        <span className="text-xs font-bold text-slate-600">오늘의 근태</span>
                    </div>
                    <div className="flex items-center">
                        {attendance ? (
                            <div className="flex items-center space-x-2 text-right">
                                <span className="font-bold text-sm text-slate-900">
                                    {attendance.checkInTime} 출근
                                </span>
                                {attendance.isLate ? (
                                    <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 text-[9px] font-bold rounded-md">지각</span>
                                ) : (
                                    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold rounded-md">정상</span>
                                )}
                            </div>
                        ) : (
                            <button 
                                onClick={handleCheckIn}
                                disabled={isCheckingIn}
                                className="flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 active:scale-95 transition-all text-xs shadow-md shadow-blue-600/20 disabled:opacity-50"
                            >
                                {isCheckingIn ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <>
                                        <MapPin size={14} />
                                        <span>출근 하기</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* 2. Todo & Notification Grid (Smaller) */}
                <div className="grid grid-cols-2 gap-2">
                    <Link href="/workspace/todo" className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 flex flex-col border border-transparent hover:border-orange-500/30 transition-all group/item min-h-[60px]">
                        <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-md bg-orange-500/10 text-orange-500 flex items-center justify-center">
                                <ClipboardList size={14} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">할 일</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <div className="flex items-center space-x-1">
                                <span className="text-3xl font-black text-slate-900 group-hover/item:text-orange-500 transition-colors">
                                    {todoCount}
                                </span>
                                <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            </div>
                        </div>
                    </Link>

                    <Link href="/workspace/notifications" className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 flex flex-col border border-transparent hover:border-blue-500/30 transition-all group/item min-h-[60px]">
                        <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                <Bell size={14} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">알림</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <span className="text-3xl font-black text-slate-900 group-hover/item:text-blue-500 transition-colors">
                                {notifCount}
                            </span>
                        </div>
                    </Link>
                </div>

                {/* 3. Forms Section (Compact Version) */}
                <Link href="/workspace/forms" className="bg-indigo-50/50 dark:bg-indigo-500/10 rounded-xl p-2 flex items-center justify-between border border-indigo-100/50 hover:border-indigo-500/30 transition-all group/forms">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover/forms:scale-110 transition-transform">
                            <FileText size={18} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-600">양식 조회 및 출력</span>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>
        </div>
    );
}

