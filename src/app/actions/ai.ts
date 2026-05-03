'use server';

import { revalidatePath } from 'next/cache';
import { 
    queryTable, 
    insertRows, 
    updateRows, 
    deleteRows,
    createTable
} from '@/egdesk-helpers';
import { getSessionAction } from './auth';
import { analyzeExcelImage, extractDataFromImage, analyzeComplexDocument } from '@/lib/ai-vision';
import { getVisualizationRecommendation } from '@/lib/dashboard-ai';
import { runAITool } from '@/lib/ai-tools';
import { 
    loadAllPinnedChartsAction, 
    saveAllPinnedChartsAction, 
    refreshUserChartsAction, 
    refreshSingleChartAction,
    updateChartLayoutAction as updateChartLayoutService
} from '@/lib/services/chart-service';
import { HistoryService } from '@/lib/services/history-service';
import { getUnifiedTableSchema } from './schema-registry';

/**
 * 시각화 추천을 가져옵니다.
 */
export async function getVisualizationRecommendationAction(selectedIds: string[], chatHistory: any[]) {
    const user = await getSessionAction();
    if (!user) return { 
        content: "세션이 만료되었거나 인증 정보가 없습니다. 다시 로그인 후 시도해 주세요.", 
        chartConfigs: [] 
    };

    try {
        return await getVisualizationRecommendation(selectedIds, chatHistory);
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota')) {
            return {
                content: "죄송합니다. 현재 AI 분석 서비스의 허용 한도(Quota)를 초과하여 이용이 일시적으로 제한되었습니다.",
                chartConfigs: []
            };
        }
        return {
            content: `AI 분석 도중 오류가 발생했습니다.`,
            chartConfigs: []
        };
    }
}

/**
 * 엑셀 스크린샷 이미지를 분석합니다.
 */
export async function analyzeExcelScreenshotAction(formData: FormData) {
  const image = formData.get('image') as File;
  if (!image) throw new Error('이미지 파일이 없습니다.');
  const arrayBuffer = await image.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const mimeType = image.type;
  return await analyzeExcelImage(base64, mimeType);
}

/**
 * 이미지 또는 PDF 문서를 정밀 분석하여 스키마와 데이터를 추출합니다.
 */
export async function analyzeDocumentAction(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) throw new Error('파일이 없습니다.');
        if (file.size > 10 * 1024 * 1024) throw new Error('파일 용량이 너무 큽니다.');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = file.type;
        return await analyzeComplexDocument(base64, mimeType);
    } catch (error: any) {
        throw new Error(error.message || '문서 분석 도중 오류가 발생했습니다.');
    }
}

/**
 * 이미지에서 데이터를 추출하고 거래처 마스터와 연동합니다.
 */
export async function analyzeImageAndExtractDataAction(formData: FormData, columnsJson: string, reportId?: string) {
    try {
        const image = formData.get('image') as File;
        if (!image) throw new Error('이미지 파일이 없습니다.');
        const columns = JSON.parse(columnsJson);
        const arrayBuffer = await image.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = image.type;

        // 가드레일 설정 조회 (가드레일 세팅 페이지에서 정의된 정보만 적용)
        const SELF_NAMES: string[] = [];
        try {
            const blacklistRecords = await queryTable('system_registration_blacklist', { 
                filters: { __is_deleted: '0' },
                limit: 200 
            });
            if (blacklistRecords && Array.isArray(blacklistRecords)) {
                blacklistRecords.forEach((r: any) => {
                    if (r.keyword) SELF_NAMES.push(String(r.keyword).trim());
                });
            }
        } catch (e) {
            console.warn(`[AI Guardrail] Failed to load blacklist:`, e);
        }

        // [고도화] 시스템 지식 기반의 컬럼 매핑 정보 가져오기
        const rawUnifiedColumns = reportId ? await getUnifiedTableSchema(reportId) : [];
        const unifiedColumns = Array.isArray(rawUnifiedColumns) ? rawUnifiedColumns : [];
        const masterLinkedColumns = unifiedColumns.filter(c => c.isMasterLinked);

        const processRow = async (row: any) => {
            const isSelf = (text: any) => {
                if (!text) return false;
                const clean = String(text).replace(/\s+/g, '');
                return SELF_NAMES.some(name => clean.includes(name));
            };

            // [가드레일] 모든 필드에 대해 본인 정보(SELF_NAMES)가 포함되어 있으면 제거
            // 특정 필드(상호, 사업자번호 등)에 본인 정보가 잘못 들어가는 것을 방지합니다.
            Object.keys(row).forEach(key => {
                if (isSelf(row[key])) {
                    // 수신처 관련 필드는 본인 정보여도 유지할 수 있지만, 
                    // 가드레일 원칙에 따라 파트너/공급자 필드 위주로 정제하거나 일괄 적용합니다.
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.includes('공급자') || lowerKey.includes('거래처') || lowerKey.includes('상호')) {
                        row[key] = null;
                    }
                }
            });

            return row;
        };

        // [개선] UI에서 전달된 현재 컬럼 리스트를 기반으로 하되, 시스템의 시맨틱 지식(마스터 연동 등)을 결합합니다.
        const uiColumns = JSON.parse(columnsJson);
        const extractionColumns = uiColumns.map((uiCol: any) => {
            const unifiedMatch = unifiedColumns.find(uc => uc.name === uiCol.name);
            return {
                ...uiCol,
                // 마스터 연동 정보 등이 있으면 보강
                isMasterLinked: uiCol.isMasterLinked || unifiedMatch?.isMasterLinked,
                masterTable: uiCol.masterTable || unifiedMatch?.masterTable,
                lookupField: uiCol.lookupField || unifiedMatch?.lookupField
            };
        });
        const extractedData = await extractDataFromImage(base64, mimeType, extractionColumns);
        const processedData = Array.isArray(extractedData) 
            ? await Promise.all(extractedData.map(d => processRow(d)))
            : await processRow(extractedData);

        return { success: true, data: processedData };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * 차트 관련 액션들 (Soft Delete 지원)
 */
export async function savePinnedChartAction(chartId: string, config: any) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증 필요');
    const pinned = await loadAllPinnedChartsAction();
    const existingIndex = pinned.findIndex(p => String(p.id) === String(chartId));
    
    if (existingIndex > -1) {
        const oldData = { ...pinned[existingIndex] };
        pinned[existingIndex] = { ...pinned[existingIndex], config, updatedAt: new Date().toISOString() };
        await HistoryService.recordHistory(String(chartId), oldData, pinned[existingIndex], 'UPDATE', user.id);
    } else {
        const newChart = { id: chartId, userId: user.id, config, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), __is_deleted: 0 };
        pinned.push(newChart);
        await HistoryService.recordHistory(String(chartId), null, newChart, 'INSERT', user.id);
    }
    
    const result = await saveAllPinnedChartsAction(pinned);
    revalidatePath('/dashboard');
    return { success: true, id: result?.newId || chartId };
}

export async function getPinnedChartsAction() {
    const user = await getSessionAction();
    if (!user) return [];
    const { charts } = await refreshUserChartsAction(user.id);
    return charts;
}

export async function deletePinnedChartAction(chartId: string) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증 필요');
    
    let pinned = await loadAllPinnedChartsAction();
    const targetChart = pinned.find(p => String(p.id) === String(chartId));
    
    if (targetChart) {
        const newPinned = pinned.filter(p => String(p.id) !== String(chartId));
        await saveAllPinnedChartsAction(newPinned);
        await HistoryService.recordHistory(String(chartId), targetChart, { __is_deleted: 1 }, 'DELETE', user.id);
    }
    
    revalidatePath('/dashboard');
    return { success: true };
}

export async function refreshIndividualChartAction(chartId: string) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증 필요');
    const pinned = await loadAllPinnedChartsAction();
    const chartIndex = pinned.findIndex(p => p.id === chartId);
    if (chartIndex === -1) throw new Error('차트 없음');
    const updatedItem = await refreshSingleChartAction(pinned[chartIndex]);
    if (updatedItem.refreshedAt) {
        pinned[chartIndex] = updatedItem;
        await saveAllPinnedChartsAction(pinned);
        revalidatePath('/dashboard');
    }
    return { success: true, item: updatedItem };
}

export async function updateChartLayoutAction(chartId: string, layout: any) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증 필요');
    const pinned = await loadAllPinnedChartsAction();
    const chartIndex = pinned.findIndex(p => p.id === chartId);
    if (chartIndex === -1) throw new Error('차트 없음');
    pinned[chartIndex].layout = layout;
    pinned[chartIndex].updatedAt = new Date().toISOString();
    await saveAllPinnedChartsAction(pinned);
    revalidatePath('/dashboard');
    return { success: true };
}

export async function reorderPinnedChartsAction(reorderedCharts: any[]) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증 필요');
    await saveAllPinnedChartsAction(reorderedCharts);
    revalidatePath('/dashboard');
    return { success: true };
}

export async function saveAIStudioSessionAction(data: any) {
    const user = await getSessionAction();
    if (!user) return { success: false };
    const tableName = 'ai_studio_sessions';
    const userIdStr = String(user.id);
    try {
        const sessionData = { 
            userId: userIdStr, 
            data: JSON.stringify(data), 
            updatedAt: new Date().toISOString(),
            __is_deleted: 0 
        };
        await createTable('AI Studio Session', [
            { name: 'userId', type: 'TEXT', notNull: true },
            { name: 'data', type: 'TEXT', notNull: true },
            { name: 'updatedAt', type: 'TEXT', notNull: true },
            { name: '__is_deleted', type: 'INTEGER', defaultValue: 0 },
            { name: '__deleted_at', type: 'TEXT' }
        ], { tableName, uniqueKeyColumns: ['userId'], duplicateAction: 'update' });

        const existing = await queryTable(tableName, { filters: { userId: userIdStr, __is_deleted: '0' } });
        if (existing && existing.length > 0) {
            await updateRows(tableName, { data: sessionData.data, updatedAt: sessionData.updatedAt }, { filters: { userId: userIdStr } });
        } else {
            await insertRows(tableName, [sessionData]);
        }
        return { success: true };
    } catch (e) { return { success: false }; }
}

export async function getAIStudioSessionAction() {
    const user = await getSessionAction();
    if (!user) return null;
    try {
        const results = await queryTable('ai_studio_sessions', { filters: { userId: String(user.id), __is_deleted: '0' } });
        if (results && results.length > 0) return JSON.parse(results[0].data);
    } catch (e) {}
    return null;
}

export async function clearAIStudioSessionAction() {
    const user = await getSessionAction();
    if (!user) return { success: false };
    try {
        await updateRows('ai_studio_sessions', { 
            __is_deleted: 1, 
            __deleted_at: new Date().toISOString() 
        }, { filters: { userId: String(user.id) } });
        
        await HistoryService.recordHistory(`ai-session-${user.id}`, 'active', 'deleted', 'DELETE', user.id);
        
        return { success: true };
    } catch (e) { return { success: false }; }
}
