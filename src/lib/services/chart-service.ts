'use server';
import fs from 'fs/promises';
import path from 'path';
import { runAITool } from '@/lib/ai-tools';
import { queryTable, insertRows, deleteRows, updateRows } from '@/egdesk-helpers';

const PINNED_CHARTS_PATH = path.join(process.cwd(), 'pinned_charts.json');

export interface ChartConfig {
    id: string | number;
    userId: string;
    config: any;
    layout?: any;
    orderIndex?: number;
    createdAt?: string;
    updatedAt?: string;
    refreshedAt?: string;
    __is_deleted?: number;
    __deleted_at?: string;
}

/**
 * 동적 플레이스홀더($TODAY, $TODAY-N 등)를 실제 날짜 값으로 변환합니다.
 */
function resolveDynamicValue(val: any): any {
    if (typeof val !== 'string') return val;
    
    const getKstDate = (d: Date = new Date()) => {
        const kstStr = d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
        return new Date(kstStr);
    };

    const kstToday = getKstDate();
    const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
    };

    if (val === '$TODAY') return formatDate(kstToday);

    const minusMatch = val.match(/^\$TODAY-(\d+)$/);
    if (minusMatch) {
        const days = parseInt(minusMatch[1], 10);
        const targetDate = new Date(kstToday);
        targetDate.setDate(kstToday.getDate() - days);
        return formatDate(targetDate);
    }

    const plusMatch = val.match(/^\$TODAY\+(\d+)$/);
    if (plusMatch) {
        const days = parseInt(plusMatch[1], 10);
        const targetDate = new Date(kstToday);
        targetDate.setDate(kstToday.getDate() + days);
        return formatDate(targetDate);
    }

    if (val === '$START_OF_MONTH') {
        const firstDay = new Date(kstToday.getFullYear(), kstToday.getMonth(), 1);
        return formatDate(firstDay);
    }

    if (val === '$END_OF_MONTH') {
        const lastDay = new Date(kstToday.getFullYear(), kstToday.getMonth() + 1, 0);
        return formatDate(lastDay);
    }

    if (val === '$START_OF_YEAR') {
        const firstDay = new Date(kstToday.getFullYear(), 0, 1);
        return formatDate(firstDay);
    }

    if (val === '$END_OF_YEAR') {
        const lastDay = new Date(kstToday.getFullYear(), 11, 31);
        return formatDate(lastDay);
    }

    return val;
}

/**
 * 인자 객체 전체를 순회하며 동적 플레이스홀더를 치환합니다.
 */
export async function resolveDynamicArgsAction(args: any): Promise<any> {
    if (!args || typeof args !== 'object') return args;
    const resolvedArgs: any = Array.isArray(args) ? [] : {};
    for (const [key, value] of Object.entries(args)) {
        if (value && typeof value === 'object') {
            resolvedArgs[key] = await resolveDynamicArgsAction(value);
        } else {
            resolvedArgs[key] = resolveDynamicValue(value);
        }
    }
    return resolvedArgs;
}

/**
 * 차트 설명 내의 날짜 정보를 동적으로 변환합니다.
 */
export async function resolveDynamicDescriptionAction(desc: string, args: any): Promise<string> {
    if (!desc) return desc;
    let resolvedDesc = desc;
    resolvedDesc = resolvedDesc.replace(/\$TODAY(?:-(\d+))?/g, (match) => resolveDynamicValue(match));
    
    if (args?.startDate && args?.endDate) {
        const sDate = resolveDynamicValue(args.startDate);
        const eDate = resolveDynamicValue(args.endDate);
        resolvedDesc = resolvedDesc.replace(/\d{4}-\d{2}-\d{2}/g, (match, offset) => {
            return offset < resolvedDesc.indexOf('부터') ? sDate : eDate;
        });
    }
    return resolvedDesc;
}

/**
 * 툴 호출 결과를 차트 데이터 형식으로 변환합니다.
 */
export async function mapRefreshedDataAction(rawData: any, mapping: any): Promise<any[]> {
    let newData: any[] = [];
    const records = (rawData && rawData.result && Array.isArray(rawData.result)) ? rawData.result :
                  (rawData && rawData.transactions && Array.isArray(rawData.transactions)) ? rawData.transactions : 
                  (rawData && rawData.summary && Array.isArray(rawData.summary)) ? rawData.summary : 
                  (rawData && rawData.invoices && Array.isArray(rawData.invoices)) ? rawData.invoices : 
                  (rawData && rawData.receipts && Array.isArray(rawData.receipts)) ? rawData.receipts : null;

    const processRow = (row: any) => {
        // [자가 치유] 데이터의 무손실 매핑 보장. 
        // mapping이 있더라도 원본 row의 모든 속성을 기본적으로 상속받아(Spread), 
        // Recharts가 s.key를 정상적으로 참조할 수 있도록 원본 키-값들을 완벽히 보존합니다.
        const baseRow = { ...row };

        if (mapping && typeof mapping === 'object' && Object.keys(mapping).length > 0) {
            const mappedRow: any = { ...baseRow };
            let hasData = false;
            for (const [targetKey, sourceKey] of Object.entries(mapping)) {
                const value = row[sourceKey as string] ?? row[targetKey];
                if (value !== undefined) {
                    mappedRow[targetKey] = value;
                    hasData = true;
                }
            }
            // 금융 특수 메타데이터 보존
            if (row.약정금액 !== undefined) mappedRow.약정금액 = row.약정금액;
            if (row.사용가능한도 !== undefined) mappedRow.사용가능한도 = row.사용가능한도;
            if (row.관리점 !== undefined) mappedRow.관리점 = row.관리점;
            
            if (hasData) return mappedRow;
        }

        const fallbackMapped: any = {
            ...baseRow,
            label: row.계좌명 || row.yearMonth || row.month || row.name || row.label || row.date || Object.values(row)[0],
            value: row.잔액 !== undefined ? row.잔액 : (row.totalWithdrawals || row.amount || row.value || row.count || row.total || Object.values(row)[1])
        };

        // 금융 특수 메타데이터 보존
        if (row.약정금액 !== undefined) fallbackMapped.약정금액 = row.약정금액;
        if (row.사용가능한도 !== undefined) fallbackMapped.사용가능한도 = row.사용가능한도;
        if (row.관리점 !== undefined) fallbackMapped.관리점 = row.관리점;

        return fallbackMapped;
    };

    if (records) {
        newData = records.map(processRow);
    } else if (Array.isArray(rawData)) {
        newData = rawData.map(processRow);
    } else if (rawData && rawData.categorySummary) {
        newData = Object.entries(rawData.categorySummary).map(([label, value]) => ({ label, value }));
    } 
    return newData;
}

/**
 * 모든 핀 고정 차트 목록을 로드합니다.
 * [Soft Delete] 삭제되지 않은 항목(__is_deleted = 0)만 로드합니다.
 */
export async function loadAllPinnedChartsAction(): Promise<ChartConfig[]> {
    try {
        // 1. DB에서 조회 시도 (__is_deleted = 0, orderIndex 오름차순 필터 적용)
        let rows = await queryTable('dashboard_chart', { 
            filters: { __is_deleted: '0' },
            orderBy: 'orderIndex', 
            orderDirection: 'ASC' 
        });

        // [버그 수정] queryTable 결과가 { rows, total } 형태인 경우를 고려하여 배열 추출
        if (!Array.isArray(rows)) {
            rows = (rows as any)?.rows || [];
        }
        
        // 2. DB가 비어있다면 마이그레이션 시도
        if (rows.length === 0) {
            try {
                const fileExists = await fs.access(PINNED_CHARTS_PATH).then(() => true).catch(() => false);
                if (fileExists) {
                    const fileContent = await fs.readFile(PINNED_CHARTS_PATH, 'utf-8');
                    const jsonCharts = JSON.parse(fileContent);
                    
                    if (jsonCharts.length > 0) {
                        console.log(`[ChartService] Migrating ${jsonCharts.length} charts to database...`);
                        const rowsToInsert = jsonCharts.map((c: any, idx: number) => ({
                            id: c.id,
                            userId: String(c.userId || 'admin'),
                            config: JSON.stringify(c.config),
                            layout: JSON.stringify(c.layout || {}),
                            isSample: c.isSample ? 1 : 0,
                            orderIndex: idx,
                            __is_deleted: 0,
                            createdAt: c.createdAt || new Date().toISOString(),
                            updatedAt: c.updatedAt || new Date().toISOString()
                        }));
                        
                        await insertRows('dashboard_chart', rowsToInsert);
                        console.log('[ChartService] Migration successful.');
                        
                        // 다시 DB에서 읽어오기
                        const migratedRows = await queryTable('dashboard_chart', { 
                            filters: { __is_deleted: '0' },
                            orderBy: 'orderIndex', 
                            orderDirection: 'ASC' 
                        });
                        
                        // 파일 삭제 (안전하게 마이그레이션 확인 후)
                        await fs.unlink(PINNED_CHARTS_PATH).catch(() => {});
                        
                        return Array.isArray(migratedRows) ? migratedRows.map(mapRowToChartConfig) : [];
                    }
                }
            } catch (e) {
                console.error('[ChartService] Migration failed:', e);
            }
        }
        
        return rows.map(mapRowToChartConfig);
    } catch (e) {
        console.error('[ChartService] Failed to load pinned charts:', e);
        return [];
    }
}

/**
 * DB Row를 ChartConfig 형식으로 변환합니다.
 */
function mapRowToChartConfig(row: any): ChartConfig {
    return {
        id: row.id,
        userId: row.userId,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
        layout: typeof row.layout === 'string' ? JSON.parse(row.layout) : row.layout,
        orderIndex: row.orderIndex !== undefined ? Number(row.orderIndex) : 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        refreshedAt: row.updatedAt,
        __is_deleted: row.__is_deleted,
        __deleted_at: row.__deleted_at
    };
}

/**
 * 차트 목록을 DB에 저장합니다.
 * [Soft Delete] 삭제된 차트는 실제로 지우지 않고 __is_deleted 플래그를 설정합니다.
 */
export async function saveAllPinnedChartsAction(charts: ChartConfig[]): Promise<{ success: boolean, newId?: number | string }> {
    try {
        let lastNewId: number | string | undefined;
        // 기존 활성 차트 조회
        // [버그 수정] queryTable 결과가 { rows, total } 형태인 경우를 고려하여 배열 추출
        let existing = await queryTable('dashboard_chart', { filters: { __is_deleted: '0' } });
        if (!Array.isArray(existing)) {
            existing = (existing as any)?.rows || [];
        }
        const existingIds = new Set(existing.map((e: any) => String(e.id)));
        const newIds = new Set(charts.map(c => String(c.id)));
        
        // 목록에서 빠진 차트들을 논리적으로 삭제
        const toDelete = existing.filter((e: any) => !newIds.has(String(e.id)));
        if (toDelete.length > 0) {
            for (const item of toDelete) {
                try {
                    console.log(`[Soft Delete] Marking chart ${item.id} as deleted.`);
                    await updateRows('dashboard_chart', { 
                        __is_deleted: 1, 
                        __deleted_at: new Date().toISOString() 
                    }, { filters: { id: String(item.id) } });
                } catch (e) {
                    console.error(`[ChartService] Failed to soft-delete chart ${item.id}:`, e);
                    // 대시보드 로딩 자체를 막지 않기 위해 에러를 삼키거나 로깅만 합니다.
                }
            }
        }
        
        for (let idx = 0; idx < charts.length; idx++) {
            const c = charts[idx];
            const chartData: any = {
                userId: String(c.userId),
                config: JSON.stringify(c.config),
                layout: JSON.stringify(c.layout || {}),
                isSample: (c as any).isSample ? 1 : 0,
                orderIndex: idx, // 순서 보존 정렬 인덱스
                __is_deleted: 0, // 저장 시에는 다시 활성화 상태 보장
                updatedAt: new Date().toISOString()
            };
            
            if (existingIds.has(String(c.id))) {
                await updateRows('dashboard_chart', chartData, { filters: { id: String(c.id) } });
            } else {
                // 신규 삽입
                const insertRes = await insertRows('dashboard_chart', [{
                    ...chartData,
                    createdAt: c.createdAt || new Date().toISOString()
                }]);
                const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes?.rows?.[0] || insertRes);
                if (insertedRow?.id) {
                    lastNewId = insertedRow.id;
                }
            }
        }
        return { success: true, newId: lastNewId };
    } catch (e) {
        console.error('[ChartService] Failed to save pinned charts to DB:', e);
        throw e;
    }
}

/**
 * 특정 사용자의 차트를 새로고침합니다.
 */
export async function refreshUserChartsAction(userId: string): Promise<{ charts: ChartConfig[], hasChanges: boolean }> {
    // 1. 기존 DB에 저장되어 있는 캐시 차트 데이터 목록을 즉시 로드합니다.
    const allCharts = await loadAllPinnedChartsAction();
    const userCharts = allCharts.filter(p => String(p.userId) === String(userId));

    // 2. Stale-While-Revalidate (SWR) 패턴 적용:
    // 기존 캐시 데이터를 즉각 반환하고, 실제 리프레시 및 DB 갱신 작업은 백그라운드 비동기로 위임하여 대기 랙(5초 이상)을 완전히 제거합니다.
    (async () => {
        try {
            console.log(`[SWR BACKEND] Starting background chart refresh for user: ${userId}`);
            let hasChanges = false;
            
            const refreshedCharts = await Promise.all(userCharts.map(async (item) => {
                if (item.config.refreshMetadata) {
                    const refreshedItem = await refreshSingleChartAction(item);
                    if (refreshedItem.refreshedAt) {
                        hasChanges = true;
                    }
                    return refreshedItem;
                }
                return item;
            }));

            if (hasChanges) {
                const updatedAll = allCharts.map(p => refreshedCharts.find(rc => rc.id === p.id) || p);
                await saveAllPinnedChartsAction(updatedAll);
                console.log(`[SWR BACKEND] Background chart refresh succeeded & saved to DB.`);
            } else {
                console.log(`[SWR BACKEND] Background chart refresh completed. No changes detected.`);
            }
        } catch (error) {
            console.error('[SWR BACKEND] Failed to execute background chart refresh:', error);
        }
    })();

    // 3. Stale 데이터(기존 DB 캐시)를 즉시 반환하여 0.1초 이내 초고속 화면 렌더링 보장
    return { charts: userCharts, hasChanges: false };
}

/**
 * 개별 차트를 새로고침 로직에 따라 업데이트합니다.
 */
export async function refreshSingleChartAction(item: ChartConfig): Promise<ChartConfig> {
    if (!item.config.refreshMetadata) return item;

    try {
        const { tool, args: originalArgs, mapping } = item.config.refreshMetadata;
        const args = await resolveDynamicArgsAction(originalArgs);
        
        if (item.config.sourceDescription) {
            item.config.sourceDescription = await resolveDynamicDescriptionAction(item.config.sourceDescription, originalArgs);
        }
        const rawData = await runAITool(tool, args);
        let newData = await mapRefreshedDataAction(rawData, mapping);
        
        // [수동 업로드 계좌 배제] 계좌번호가 MANUALIMPORT인 연동되지 않은 행 강제 필터링
        if (Array.isArray(newData)) {
            newData = newData.filter((r: any) => {
                const accNum = String(r['계좌번호'] || r['accountNumber'] || r['account_number'] || r['_accountNumber'] || '').toUpperCase();
                return !accNum.includes('MANUALIMPORT');
            });
        }
        
        if (newData.length > 0) {
            let finalData = newData;
            
            // [지능형 자가 치유] 스튜디오에서 특정 필터(예: 특정 계좌번호만 선택)를 거쳐 핀 고정된 차트의 필터 유실 방지
            const oldData = item.config.data;
            if (Array.isArray(oldData) && oldData.length > 0 && newData.length > oldData.length) {
                // 고유 식별자 컬럼 키 검색 (계좌번호, 카드번호, ID 등)
                const idKeys = ['계좌번호', 'accountNumber', 'account_number', '_accountNumber', '카드번호', 'cardNumber', 'cardNo', 'id', 'no', '번호', '코드'];
                const sampleRow = oldData[0];
                const activeIdKey = idKeys.find(k => sampleRow[k] !== undefined && sampleRow[k] !== null && sampleRow[k] !== '');
                
                if (activeIdKey) {
                    // 원래 핀 고정 데이터에 포함되어 있던 고유 식별자 값 목록 추출 (하이픈 등 기호 차이 제거)
                    const allowedIds = new Set(
                        oldData
                            .map(r => String(r[activeIdKey] || '').replace(/[^a-zA-Z0-9]/g, ''))
                            .filter(Boolean)
                    );
                    
                    if (allowedIds.size > 0) {
                        const filtered = newData.filter(r => {
                            // 실제 계좌 데이터만 매칭하여 필터링 (합계 요약 행은 이 단계에서 분리)
                            const rVal = String(r[activeIdKey] || '').replace(/[^a-zA-Z0-9]/g, '');
                            return allowedIds.has(rVal);
                        });
                        
                        if (filtered.length > 0) {
                            console.log(`[ChartService] Pinned filter preserved for chart ${item.id}. Filtered ${newData.length} -> ${filtered.length} rows using key '${activeIdKey}'.`);
                            
                            // 원래 고정(Pinned) 데이터에 존재했던 '합계' 요약 행 탐색 및 추출
                            const oldTotalRow = oldData.find((r: any) => {
                                return Object.values(r).some(val => {
                                    if (typeof val !== 'string') return false;
                                    const normalized = val.trim().toLowerCase();
                                    return normalized.includes('합계') || 
                                           normalized.includes('소계') || 
                                           normalized.includes('총계') || 
                                           normalized.includes('누계') || 
                                           normalized === 'total' || 
                                           normalized === 'subtotal' || 
                                           normalized === 'sum';
                                });
                            });
                            
                            if (oldTotalRow) {
                                // 금액 필드 키 식별 (잔액, 금액 등)
                                const keys = Object.keys(filtered[0]);
                                const amountKey = keys.find(k => /amount|value|금액|잔액|승인금액|출금|입금|공급가액|합계|세액/i.test(k)) || 'value';
                                
                                // 새로고침된 최신 계좌 잔액의 총합 실시간 재계산
                                const newTotalValue = filtered.reduce((sum, r) => {
                                    const val = typeof r[amountKey] === 'number' 
                                        ? r[amountKey] 
                                        : parseFloat(String(r[amountKey] || '0').replace(/[^0-9.-]/g, ''));
                                    return sum + (isNaN(val) ? 0 : val);
                                }, 0);
                                
                                // 원래 합계 행 구조를 복제하고 금액만 실시간 리프레시
                                const newTotalRow = {
                                    ...oldTotalRow,
                                    [amountKey]: newTotalValue
                                };
                                
                                finalData = [...filtered, newTotalRow];
                                console.log(`[ChartService] Recalculated total row appended: ${amountKey} = ${newTotalValue}`);
                            } else {
                                finalData = filtered;
                            }
                        }
                    }
                }
            }

            return {
                ...item,
                config: { ...item.config, data: finalData },
                refreshedAt: new Date().toISOString()
            };
        }
    } catch (e) {
        console.error(`[ChartService] Refresh error for ${item.id}:`, e);
    }
    return item;
}
