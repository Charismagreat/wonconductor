import { NextResponse } from 'next/server';
import { getSessionAction } from '@/app/actions/auth';
import { 
    listTables, 
    getOverallStats, 
    listHometaxConnections, 
    listBankProductTables,
    executeSQL 
} from '@/egdesk-helpers';
import { API_RESPONSE_CACHE, API_CACHE_TTL_MS } from '@/lib/utils/dashboard-cache';

/**
 * 대시보드 메인 화면에 필요한 모든 무거운 연산(금융/홈택스/테이블 통계)을 비차단식으로 가져오는 고속 API 엔드포인트입니다.
 */
export async function GET() {
    try {
        // 1. 보안 검증: 현재 세션 사용자 확인
        const user = await getSessionAction();
        if (!user) {
            return NextResponse.json({ success: false, error: '인증되지 않은 사용자입니다.' }, { status: 401 });
        }

        const now = Date.now();

        // 2. 인메모리 캐싱 헬퍼 정의
        const getCachedOrFetch = async (key: string, fetchFn: () => Promise<any>) => {
            const cached = API_RESPONSE_CACHE[key];
            if (cached && (now - cached.timestamp < API_CACHE_TTL_MS)) {
                return cached.data;
            }
            const data = await fetchFn();
            API_RESPONSE_CACHE[key] = { data, timestamp: now };
            return data;
        };

        // 3. 무거운 외부 RTT API 연산 병렬 수행 (기존 캐시 레이어 연동 유지)
        const [tablesRes, statsRes, hometaxRes, productTablesRes] = await Promise.all([
            getCachedOrFetch('listTables', () => listTables().catch(() => null)),
            getCachedOrFetch('getOverallStats', () => getOverallStats().catch(() => null)),
            getCachedOrFetch('listHometaxConnections', () => listHometaxConnections().catch(() => null)),
            getCachedOrFetch('listBankProductTables', () => listBankProductTables().catch(() => ({ tables: [] })))
        ]);

        const systemTables = tablesRes?.tables || [];
        const financeStats = statsRes;
        const hometaxStats = hometaxRes;
        const productTables = Array.isArray(productTablesRes) ? productTablesRes : (productTablesRes?.tables || []);

        // 4. 가상 보고서(dashboard_data)의 각 데이터 행 카운트 일괄 조회 (SQLite 로컬 쿼리)
        const virtualCountsMap: Record<string, number> = {};
        try {
            const rawCounts = await executeSQL(
                `SELECT reportId, COUNT(*) as cnt FROM dashboard_data WHERE isDeleted = '0' GROUP BY reportId`
            ).catch(() => []);
            
            const countRows = Array.isArray(rawCounts) ? rawCounts : (rawCounts?.rows || []);
            countRows.forEach((row: any) => {
                if (row && row.reportId) {
                    virtualCountsMap[row.reportId] = Number(row.cnt || row.COUNT || 0);
                }
            });
        } catch (err) {
            console.error('[API STATS] 가상 리포트 행 개수 일괄 조회 실패:', err);
        }

        // 5. 취합 데이터 응답 반환
        return NextResponse.json({
            success: true,
            systemTables,
            financeStats,
            hometaxStats,
            productTables,
            virtualCountsMap
        });

    } catch (error: any) {
        console.error('[API STATS] 대시보드 통계 처리 예외 발생:', error);
        return NextResponse.json({ success: false, error: '서버 에러가 발생했습니다.' }, { status: 500 });
    }
}
