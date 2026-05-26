/**
 * 대시보드 메인 화면의 실시간 행 개수(COUNT) 조회에 따른 RTT 홉 병목을 해결하기 위한 고속 캐시 유틸리티입니다.
 */

// 테이블/보고서별 행 개수를 만료시간(TTL)과 함께 보존하는 전역 메모리 맵
export const ROW_COUNT_CACHE: Record<string, { count: number; timestamp: number }> = {};

// 캐시 유효 시간: 30초 (대시보드 진입 시 30초 내에는 초고속 0ms 렌더링 지원)
export const CACHE_TTL_MS = 30000;

// [성능 개선] 무거운 외부 MCP API 호출(금융 집계, 홈택스 커넥션 등) 결과를 보존하는 전역 메모리 캐시 맵
export const API_RESPONSE_CACHE: Record<string, { data: any; timestamp: number }> = {};

// API 캐시 유효 시간: 60초 (1분간 외부 RTT 통신을 생략하여 초고속 리다이렉션을 실현합니다)
export const API_CACHE_TTL_MS = 60000;

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

/**
 * [성능 개선] 외부 API 응답 캐시를 개별 무효화하거나 일괄 무효화합니다.
 */
export function invalidateApiCache(key?: string) {
    if (key) {
        delete API_RESPONSE_CACHE[key];
        console.log(`[Cache Invalidation] Invalidated API cache for key: ${key}`);
    } else {
        for (const k in API_RESPONSE_CACHE) {
            delete API_RESPONSE_CACHE[k];
        }
        console.log('[Cache Invalidation] Invalidated all API response caches.');
    }
}
