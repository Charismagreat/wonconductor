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

/**
 * 시각화 추천을 가져옵니다.
 */
export async function getVisualizationRecommendationAction(tableIds: string[], messages: any[]) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');
    try {
        return await getVisualizationRecommendation(tableIds, messages);
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const combinedMessage = errorMessage + " " + (error.stack || '');
        if (combinedMessage.includes('429') || combinedMessage.toLowerCase().includes('quota')) {
            return {
                content: "죄송합니다. 현재 AI 분석 서비스의 허용 한도(Quota)를 초과하여 이용이 일시적으로 제한되었습니다. 시간이 조금 지난 후 다시 시도해 주시거나 결제 및 프로젝트 상태를 점검해 주세요. 😢",
                chartConfigs: []
            };
        }
        return {
            content: `AI 분석 도중 쿼리나 네트워크 관련 오류가 발생했습니다:\n\n\`\`\`\n${errorMessage}\n\`\`\`\n\n잠시 후 다시 대화를 시도해 주시거나, 질문을 조금 더 단순하게 바꿔서 요청해 보세요.`,
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
        
        // 용량 제한 체크 (10MB)
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('파일 용량이 너무 큽니다. (최대 10MB)');
        }

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
 * 이미지에서 데이터를 추출합니다.
 */
export async function analyzeImageAndExtractDataAction(formData: FormData, columnsJson: string) {
    try {
        const image = formData.get('image') as File;
        if (!image) throw new Error('이미지 파일이 없습니다.');
        const columns = JSON.parse(columnsJson);
        const arrayBuffer = await image.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = image.type;
        const extractedData = await extractDataFromImage(base64, mimeType, columns);
        return { success: true, data: extractedData };
    } catch (error: any) {
        let errorMessage = error.message || '이미지를 분석하는 중 오류가 발생했습니다.';
        if (errorMessage.includes('413')) errorMessage = '이미지 용량이 너무 큽니다. 더 작은 이미지를 사용해 주세요.';
        return { success: false, error: errorMessage };
    }
}

/**
 * 차트를 핀 보드에 저장합니다.
 */
export async function savePinnedChartAction(chartId: string, config: any) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');
    
    const pinned = await loadAllPinnedChartsAction();
    const existingIndex = pinned.findIndex(p => String(p.id) === String(chartId));
    
    if (existingIndex > -1) {
        pinned[existingIndex] = { 
            ...pinned[existingIndex], 
            config, 
            updatedAt: new Date().toISOString() 
        };
    } else {
        // 신규 차트 추가 (ID는 DB 저장 시 정수로 변환됨)
        pinned.push({
            id: chartId, // 임시 UUID
            userId: user.id,
            config,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    
    // saveAllPinnedChartsAction에서 ID를 정수로 변환하고 결과를 반환받음
    const result = await saveAllPinnedChartsAction(pinned);
    revalidatePath('/dashboard');
    
    // 신규 추가된 경우 새로 생성된 정수 ID를 반환
    return { 
        success: true, 
        id: result?.newId || chartId 
    };
}

/**
 * 핀 고정된 차트 목록을 가져옵니다. (필요 시 자동 새로고침 포함)
 */
export async function getPinnedChartsAction() {
    const user = await getSessionAction();
    if (!user) return [];
    
    const { charts } = await refreshUserChartsAction(user.id);
    return charts;
}

/**
 * 핀 고정된 차트를 삭제합니다.
 */
export async function deletePinnedChartAction(chartId: string) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');
    
    let pinned = await loadAllPinnedChartsAction();
    const originalLength = pinned.length;
    pinned = pinned.filter(p => p.id !== chartId);
    
    if (pinned.length !== originalLength) {
        await saveAllPinnedChartsAction(pinned);
        revalidatePath('/dashboard');
    }
    return { success: true };
}

/**
 * 개별 차트를 수동으로 새로고침합니다.
 */
export async function refreshIndividualChartAction(chartId: string) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');
    
    const pinned = await loadAllPinnedChartsAction();
    const chartIndex = pinned.findIndex(p => p.id === chartId);
    if (chartIndex === -1) throw new Error('차트를 찾을 수 없습니다.');
    
    const updatedItem = await refreshSingleChartAction(pinned[chartIndex]);
    
    if (updatedItem.refreshedAt) {
        pinned[chartIndex] = updatedItem;
        await saveAllPinnedChartsAction(pinned);
        revalidatePath('/dashboard');
    }
    
    return { success: true, item: updatedItem };
}

/**
 * 차트 레이아웃 설정을 업데이트합니다.
 */
export async function updateChartLayoutAction(chartId: string, layout: any) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');
    
    const pinned = await loadAllPinnedChartsAction();
    const chartIndex = pinned.findIndex(p => p.id === chartId);
    if (chartIndex === -1) throw new Error('차트를 찾을 수 없습니다.');
    
    pinned[chartIndex].layout = layout;
    pinned[chartIndex].updatedAt = new Date().toISOString();
    
    await saveAllPinnedChartsAction(pinned);
    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * 핀 고정된 차트들의 전체 순서를 다시 저장합니다.
 */
export async function reorderPinnedChartsAction(reorderedCharts: any[]) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');
    
    await saveAllPinnedChartsAction(reorderedCharts);
    revalidatePath('/dashboard');
    return { success: true };
}


let isAIStudioSessionTableInitialized = false;

/**
 * AI Studio 세션을 저장합니다.
 */
export async function saveAIStudioSessionAction(data: any) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');
    const tableName = 'ai_studio_session';
    try {
        const sessionData = { userId: user.id, data: JSON.stringify(data), updatedAt: new Date().toISOString() };
        if (!isAIStudioSessionTableInitialized) {
            try {
                await queryTable(tableName, { limit: 1 });
                isAIStudioSessionTableInitialized = true;
            } catch (e) {
                await createTable('AI Studio Session', [
                    { name: 'userId', type: 'TEXT', notNull: true },
                    { name: 'data', type: 'TEXT', notNull: true },
                    { name: 'updatedAt', type: 'TEXT', notNull: true }
                ], { tableName, uniqueKeyColumns: ['userId'] });
                isAIStudioSessionTableInitialized = true;
            }
        }
        const existing = await queryTable(tableName, { filters: { userId: user.id } });
        if (existing && existing.length > 0) {
            await updateRows(tableName, { data: sessionData.data, updatedAt: sessionData.updatedAt }, { filters: { userId: user.id } });
        } else {
            await insertRows(tableName, [sessionData]);
        }
        return { success: true };
    } catch (e) {
        console.error('[Session Save Error Detail]:', e);
        isAIStudioSessionTableInitialized = false;
        return { success: false };
    }
}

/**
 * AI Studio 세션을 가져옵니다.
 */
export async function getAIStudioSessionAction() {
    const user = await getSessionAction();
    if (!user) return null;
    const tableName = 'ai_studio_session';
    try {
        const results = await queryTable(tableName, { filters: { userId: user.id } });
        if (results && results.length > 0) return JSON.parse(results[0].data);
    } catch (e) {}
    return null;
}

/**
 * AI Studio 세션을 삭제합니다.
 */
export async function clearAIStudioSessionAction() {
    const user = await getSessionAction();
    if (!user) return { success: false };
    const tableName = 'ai_studio_session';
    try {
        await deleteRows(tableName, { filters: { userId: user.id } });
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}
