/**
 * 대시보드 메인 화면의 실시간 행 개수(COUNT) 조회에 따른 RTT 홉 병목을 해결하기 위한 고속 캐시 유틸리티입니다.
 */

// 테이블/보고서별 행 개수를 만료시간(TTL)과 함께 보존하는 전역 메모리 맵
export const ROW_COUNT_CACHE: Record<string, { count: number; timestamp: number }> = {};

// 캐시 유효 시간: 30초 (대시보드 진입 시 30초 내에는 초고속 0ms 렌더링 지원)
export const CACHE_TTL_MS = 30000;

/**
 * 특정 키 또는 전체 행 개수 캐시를 무효화(삭제)합니다.
 * 데이터 추가/수정/삭제 등 상태 변화가 발생했을 때 호출하여 데이터 정합성을 즉각 복원합니다.
 */
export function invalidateRowCountCache(key?: string) {
    if (key) {
        delete ROW_COUNT_CACHE[key];
        console.log(`[Cache Invalidation] Invalidated cache for key: ${key}`);
    } else {
        // 전체 캐시 소멸
        for (const k in ROW_COUNT_CACHE) {
            delete ROW_COUNT_CACHE[k];
        }
        console.log('[Cache Invalidation] Invalidated all row count caches.');
    }
}
