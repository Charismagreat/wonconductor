'use client';

import React from 'react';
import { User, Bell, MapPin, Shield, HelpCircle, LogOut, Moon, Clock, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { SettingsItem } from '@/components/workspace/SettingsItem';
import { useTheme } from '@/components/ThemeProvider';
import { getSessionAction, logoutAction } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

export default function SettingsPage() {
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const [user, setUser] = React.useState<any>(null);
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);
    const isDarkMode = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    React.useEffect(() => {
        getSessionAction().then(setUser);
    }, []);

    const handleLogout = () => {
        alert('로그아웃 버튼이 클릭되었습니다! (이벤트 연결 확인)');
        console.log('[DEBUG] Logout button clicked successfully.');
    };

    const handlePurgeSamples = async () => {
        if (!confirm('경고: 모든 샘플 부서, 사원, 그리고 업무 데이터를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며 시스템은 실전(Live) 모드로 전환됩니다.')) {
            return;
        }

        try {
            const { purgeAllSampleDataAction } = await import('@/lib/services/demo-service');
            const res = await purgeAllSampleDataAction();
            if (res.success) {
                alert('모든 샘플 데이터가 성공적으로 삭제되었습니다. 시스템이 실전 모드로 전환되었습니다.');
                router.refresh();
            }
        } catch (err: any) {
            alert('데이터 삭제 중 오류가 발생했습니다: ' + err.message);
        }
    };

    const sections = [
        {
            title: '내 계정 (Account)',
            items: [
                { id: 'profile', icon: <User size={18} />, title: '프로필 수정', subtitle: '이름, 연락처, 부서 정보 변경' },
                { id: 'security', icon: <Shield size={18} />, title: '비밀번호 및 보안', subtitle: '로그인 보안 및 생체 인증 설정' }
            ]
        },
        {
            title: '화면 설정 (Appearance)',
            items: [
                { 
                    id: 'dark-mode',
                    icon: <Moon size={18} />, 
                    title: '다크 모드', 
                    subtitle: '눈이 편안한 어두운 화면 사용', 
                    type: 'toggle', 
                    isOn: isDarkMode,
                    onToggle: () => toggleTheme()
                }
            ]
        },
        {
            title: '알림 설정 (Notifications)',
            items: [
                { id: 'push', icon: <Bell size={18} />, title: '푸시 알림', subtitle: '업무 관련 실시간 알림 받기', type: 'toggle', isOn: true },
                { id: 'work-alarm', icon: <Clock size={18} />, title: '근무 시간 알람', subtitle: '출근/퇴근 10분 전 알림 받기', type: 'toggle', isOn: true }
            ]
        },
        {
            title: '워크 환경 (Workspace)',
            items: [
                { id: 'location', icon: <MapPin size={18} />, title: '기본 출근지 설정', subtitle: '📍 현재: 본사 2층 지원팀', type: 'text', value: '변경' }
            ]
        },
        ...(user?.role === 'ADMIN' ? [
            {
                title: '데모 데이터 관리 (Management)',
                items: [
                    { 
                        id: 'purge-samples', 
                        icon: <Shield size={18} className="text-orange-500" />, 
                        title: '샘플 데이터 일괄 삭제', 
                        subtitle: '실물 데이터만 남기고 모든 데모용 기록을 삭제합니다',
                        type: 'text',
                        value: '실행',
                        onClick: handlePurgeSamples
                    }
                ]
            }
        ] : []),
        {
            title: '기타 (Others)',
            items: [
                { id: 'version', icon: <Smartphone size={18} />, title: '버전 정보', type: 'text', value: 'v2.1.0' },
                { id: 'help', icon: <HelpCircle size={18} />, title: '고객 센터 및 도움말' }
            ]
        }
    ];


    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    const itemVariant = {
        hidden: { y: 10, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <div className="w-full mx-auto px-8 md:px-12 py-8 pb-24">
            <PageHeader 
                title="USER SETTINGS"
                description="개인 프로필 정보와 워크스페이스 환경을 설정합니다."
                icon={User}
                rightElement={
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => router.back()}
                            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => alert('설정이 성공적으로 저장되었습니다.')}
                            className="px-8 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
                        >
                            Save Changes
                        </button>
                    </div>
                }
            />

            {/* Profile Header removed as requested */}

            {/* Settings Sections */}
            <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-6"
            >
                {sections.map((section) => (
                    <div key={section.title} className="px-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">
                            {section.title}
                        </h3>
                        <div className="space-y-2">
                            {section.items.map((item) => (
                                <SettingsItem key={item.id} {...item} />
                            ))}
                        </div>
                    </div>
                ))}
            </motion.div>

            {/* Logout Section */}
            <div className="px-4 mt-8">
                <button 
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full p-4 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center space-x-2 font-bold hover:bg-red-100 transition-all border border-red-100/50 disabled:opacity-50"
                >
                    {isLoggingOut ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                    ) : (
                        <>
                            <LogOut size={18} />
                            <span>원 컨덕터 로그아웃</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
