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
        // 1. DB에서 조회 시도 (__is_deleted = 0 필터 추가)
        let rows = await queryTable('dashboard_chart', { 
            filters: { __is_deleted: '0' },
            orderBy: 'createdAt', 
            orderDirection: 'DESC' 
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
                        const rowsToInsert = jsonCharts.map((c: any) => ({
                            id: c.id,
                            userId: String(c.userId || 'admin'),
                            config: JSON.stringify(c.config),
                            layout: JSON.stringify(c.layout || {}),
                            isSample: c.isSample ? 1 : 0,
                            __is_deleted: 0,
                            createdAt: c.createdAt || new Date().toISOString(),
                            updatedAt: c.updatedAt || new Date().toISOString()
                        }));
                        
                        await insertRows('dashboard_chart', rowsToInsert);
                        console.log('[ChartService] Migration successful.');
                        
                        // 다시 DB에서 읽어오기
                        const migratedRows = await queryTable('dashboard_chart', { 
                            filters: { __is_deleted: '0' },
                            orderBy: 'createdAt', 
                            orderDirection: 'DESC' 
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
        
        for (const c of charts) {
            const chartData: any = {
                userId: String(c.userId),
                config: JSON.stringify(c.config),
                layout: JSON.stringify(c.layout || {}),
                isSample: (c as any).isSample ? 1 : 0,
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
    const allCharts = await loadAllPinnedChartsAction();
    const userCharts = allCharts.filter(p => String(p.userId) === String(userId));
    let hasChanges = false;

    const refreshedCharts = await Promise.all(userCharts.map(async (item) => {
        if (item.config.refreshMetadata) {
            const refreshedItem = await refreshSingleChartAction(item);
            if (refreshedItem.refreshedAt) hasChanges = true;
            return refreshedItem;
        }
        return item;
    }));

    if (hasChanges) {
        const updatedAll = allCharts.map(p => refreshedCharts.find(rc => rc.id === p.id) || p);
        await saveAllPinnedChartsAction(updatedAll);
    }

    return { charts: refreshedCharts, hasChanges };
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
        const newData = await mapRefreshedDataAction(rawData, mapping);
        
        if (newData.length > 0) {
            return {
                ...item,
                config: { ...item.config, data: newData },
                refreshedAt: new Date().toISOString()
            };
        }
    } catch (e) {
        console.error(`[ChartService] Refresh error for ${item.id}:`, e);
    }
    return item;
}
