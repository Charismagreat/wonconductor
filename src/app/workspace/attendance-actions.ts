'use server';

import { getSessionAction } from '@/app/actions/auth';
import { addRowAction } from '@/app/actions/row';
import { executeSQL, queryTable } from '@/egdesk-helpers';

/**
 * 오늘 날짜의 출근 기록을 조회합니다.
 */
export async function getTodayAttendanceAction() {
    const user = await getSessionAction();
    if (!user) return null;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        // [Soft Delete] 삭제되지 않은 데이터만 조회
        const rows = await queryTable('dashboard_data', { 
            filters: { isDeleted: '0' },
            limit: 100 // 최근 데이터 위주로 조회
        });
        
        if (rows && rows.length > 0) {
            // 오늘 날짜의 해당 사용자가 작성한 '출근' 타입 행 찾기
            const attendanceRow = rows.find((row: any) => {
                const isMyRow = String(row.creatorId) === String(user.id);
                const isToday = row.createdAt?.startsWith(today);
                if (!isMyRow || !isToday) return false;

                try {
                    const data = JSON.parse(row.data);
                    return data.type === '출근';
                } catch (e) {
                    return false;
                }
            });

            if (attendanceRow) {
                const data = JSON.parse(attendanceRow.data);
                return {
                    checkInTime: data.time,
                    isLate: data.isLate === 1,
                    location: { lat: data.lat, lng: data.lng }
                };
            }
        }
        return null;
    } catch (e) {
        console.error("Failed to get attendance:", e);
        return null;
    }
}

/**
 * 출근 기록을 저장합니다.
 */
export async function checkInAction(lat: number, lng: number) {
    const user = await getSessionAction();
    if (!user) throw new Error("인증이 필요합니다.");

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    
    // 지각 판단 (08:00 기준)
    const isLate = now.getHours() >= 8 && (now.getHours() > 8 || now.getMinutes() > 0);

    // '근태 보고'라는 이름의 보고서 ID를 찾거나 하나를 지정해야 합니다.
    // 여기서는 시스템용 고정 ID를 사용하거나 이름을 통해 동적으로 찾습니다.
    let reportId = 'system-attendance'; 

    const attendanceData = {
        type: '출근',
        time: timeStr,
        lat: lat,
        lng: lng,
        isLate: isLate ? 1 : 0
    };

    try {
        // report 테이블에 '근태 보고'가 있는지 확인하고 없으면 임의로 하나 사용 (또는 생성)
        // 실제 운영 환경에선 사전에 등록된 reportId를 사용해야 함
        await addRowAction(reportId, attendanceData);
        
        return {
            success: true,
            checkInTime: timeStr,
            isLate
        };
    } catch (e: any) {
        console.error("Check-in failed:", e);
        // 만약 reportId가 없어서 실패한다면, 우선 데이터만이라도 저장 시도할 수 있음
        throw new Error(e.message || "출근 처리 중 오류가 발생했습니다.");
    }
}
