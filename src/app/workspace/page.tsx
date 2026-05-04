import { getSessionAction } from '@/app/actions/auth';
import { getWorkspaceFeedAction } from './actions';
import { getTodayAttendanceAction } from './attendance-actions';
import { queryTable } from '@/egdesk-helpers';
import { redirect } from 'next/navigation';
import { FeedList } from '@/components/workspace/FeedList';
import { DashboardSummary } from '@/components/workspace/DashboardSummary';
import { Suspense } from 'react';

export default async function WorkspacePage() {
    // 세션 확인
    const session = await getSessionAction();
    if (!session) {
        redirect('/login');
    }

    // 데이터 병렬 조회
    const [feeds, attendance] = await Promise.all([
        getWorkspaceFeedAction(),
        getTodayAttendanceAction()
    ]);

    // 실시간 수치 데이터 조회
    const [todoRows, notifRows] = await Promise.all([
        queryTable('action_task', { filters: { assigneeId: String(session.id), status: 'TODO' } }),
        queryTable('notification', { filters: { userId: String(session.id), isRead: '0' } })
    ]);
    
    // queryTable은 배열을 직접 반환하므로 .rows 없이 체크합니다.
    const todoCount = Array.isArray(todoRows) ? todoRows.length : 0;
    
    // [최적화] 알림 수치를 고유 작업 단위로 계산하여 배지 숫자와 일치시킵니다.
    const uniqueNotifKeys = new Set(
        (Array.isArray(notifRows) ? notifRows : []).map((noti: any) => 
            noti.link && noti.link.includes('openItem=') ? noti.link : noti.id
        )
    );
    const notifCount = uniqueNotifKeys.size;

    return (
        <div className="pb-24 pt-1">
            {/* 기획안 디자인이 반영된 요약 대시보드 */}
            <DashboardSummary 
                user={session} 
                attendance={attendance} 
                todoCount={todoCount}
                notifCount={notifCount}
            />

            {/* 최근 업무 피드 섹션 */}
            <div className="px-1 flex items-center justify-between mb-5">
                <h3 className="font-black text-gray-900 border-l-4 border-blue-600 pl-3">최근 업무</h3>
                <span className="text-xs text-gray-400 font-medium hover:text-blue-600 cursor-pointer transition-colors">전체보기</span>
            </div>

            {/* FeedList는 useSearchParams를 사용하므로 Suspense 래핑 필요 */}
            <Suspense fallback={
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="glass rounded-2xl h-28 animate-pulse bg-gray-100/50" />
                    ))}
                </div>
            }>
                <FeedList initialFeeds={feeds} />
            </Suspense>
            
            {/* 패딩용 공간 */}
            <div className="h-4"></div>
        </div>
    );
}
