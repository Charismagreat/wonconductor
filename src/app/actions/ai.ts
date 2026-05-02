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

        // 본인 회사 키워드 설정
        const SELF_NAMES = ["애월삼춘", "원컨덕터", "이지데스크", "EGDesk"];
        try {
            // [Soft Delete] 삭제되지 않은 블랙리스트만 조회
            const blacklistRecords = await queryTable('system_registration_blacklist', { 
                filters: { __is_deleted: '0' },
                limit: 100 
            });
            if (blacklistRecords) {
                blacklistRecords.forEach((r: any) => {
                    if (r.keyword && !SELF_NAMES.includes(r.keyword)) SELF_NAMES.push(r.keyword);
                });
            }
        } catch (e) {}

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

            // [개선] 모든 컬럼에 대해 시맨틱 메타데이터를 확인하여 마스터 연동 수행
            // reportId가 있으면 해당 리포트의 스키마를 사용하고, 없으면 현재 데이터의 키들로 동적 분석
            const currentKeys = Object.keys(row);
            const columnMeta = reportId 
                ? unifiedColumns 
                : await Promise.all(currentKeys.map(async k => {
                    // SchemaRegistry의 내부 로직을 활용하여 개별 컬럼의 시맨틱 분석 (미래에는 별도 함수로 분리 가능)
                    const { findSchemaStandard } = await import('@/lib/constants/schema-standards');
                    const standard = findSchemaStandard(k);
                    return standard ? { 
                        name: k, 
                        isMasterLinked: true, 
                        masterTable: standard.masterTable, 
                        lookupField: standard.lookupField,
                        nameFields: standard.nameFields,
                        businessNumberFields: standard.businessNumberFields,
                        canonicalName: standard.canonicalName
                    } : { name: k, isMasterLinked: false };
                }));

            const linkedCols = columnMeta.filter((c: any) => c.isMasterLinked);

            for (const col of linkedCols) {
                const idField = col.name;
                const masterTable = col.masterTable;
                const lookupField = col.lookupField || 'name';
                
                // 마스터 연동에 필요한 부속 필드들(상호명, 사업자번호 등) 찾기
                const nameField = col.nameFields?.find((f: string) => row[f]);
                const bizNumField = col.businessNumberFields?.find((f: string) => row[f]) || 
                                   (col.canonicalName === '거래처ID' ? currentKeys.find(k => k.includes('사업자')) : null);
                
                let extractedName = nameField ? row[nameField] : null;
                let extractedBizNum = bizNumField ? row[bizNumField] : null;

                // [보완] 번호 필드는 비어있고 ID 필드에만 번호가 있는 경우
                if (!extractedBizNum && row[idField] && !/[가-힣]/.test(String(row[idField]))) {
                    extractedBizNum = String(row[idField]);
                }

                // [가드레일] 본인 정보 제외
                if (isSelf(extractedName)) {
                    extractedName = null;
                    if (nameField) row[nameField] = null;
                }
                if (isSelf(row[idField])) row[idField] = null;

                // [비즈니스 로직] 마스터 확인 및 자동 등록
                if (extractedBizNum || extractedName) {
                    try {
                        const filter: any = { __is_deleted: '0' };
                        if (extractedBizNum) filter.businessNumber = extractedBizNum;
                        else filter[lookupField] = extractedName;

                        const results = await queryTable(masterTable, { filters: filter, limit: 1 });

                        if (results && results.length > 0) {
                            // 이미 존재함
                            const idCol = col.canonicalName === '거래처ID' ? 'clientId' : 
                                         col.canonicalName === '제품ID' ? 'productId' : 'id';
                            row[idField] = results[0][idCol] || results[0].id;
                        } else if (extractedBizNum) {
                            // 존재하지 않음 -> 신규 자동 등록
                            console.log(`[AI Auto-Register] Creating new master in ${masterTable} for: ${extractedBizNum}`);
                            
                            const now = new Date().toISOString();
                            const sessionUser = await getSessionAction();
                            const creatorId = sessionUser?.id || 'ai-agent';

                            const idCol = col.canonicalName === '거래처ID' ? 'clientId' : 
                                         col.canonicalName === '제품ID' ? 'productId' : 'id';

                            const newRecord: any = { 
                                [lookupField]: extractedName || '미확인 신규 등록',
                                businessNumber: extractedBizNum,
                                [idCol]: extractedBizNum,
                                __created_at: now,
                                __updated_at: now,
                                __creator_id: creatorId,
                                __modifier_id: creatorId,
                                __is_deleted: 0,
                                __deleted_at: null
                            };

                            const insertRes = await insertRows(masterTable, [newRecord]);
                            if (insertRes && !insertRes.error) {
                                row[idField] = extractedBizNum;
                                row._isAutoCreated = true;
                                await HistoryService.recordHistory(extractedBizNum, null, newRecord, 'INSERT', creatorId);
                            }
                        }
                    } catch (e) {
                        console.error(`[AI Master Link Error] ${idField}:`, e);
                    }
                }
            }

            return row;
        };

        // [개선] 지능형 통합 스키마가 있으면 우선 사용, 없으면 프론트엔드 전달 스키마 사용
        const extractionColumns = (unifiedColumns && unifiedColumns.length > 0) ? unifiedColumns : columns;
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
