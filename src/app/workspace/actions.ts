'use server';

import { getSessionAction } from '@/app/actions/auth';
import { addRowAction } from '@/app/actions/row';
import { uploadFileAction } from '@/app/actions/file';
import { queryTable, executeSQL, insertRows, updateRows, deleteRows } from '@/egdesk-helpers';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import path from 'path';
import {
    createInAppNotification,
    notifyAdmins,
    notifyAdminsUpsert,
    upsertInAppNotificationByLink,
    workspaceOpenItemLink
} from '@/lib/notifications';
import { GuardrailService } from '@/lib/services/guardrail-service';
import { WORKSPACE_STATUS } from '@/lib/constants/workspace-status';

// 워크스페이스 전용 ID 생성기 (표준 규격)
// ID 자동 부여



/**
 * 워크스페이스 메인 피드 데이터를 가져옵니다.
 * SQL 엔진 500 에러를 회피하기 위해 애플리케이션 레벨에서 조인 및 필터링을 수행합니다.
 */
export async function getWorkspaceFeedAction() {
    const user = await getSessionAction();
    if (!user) return [];

    try {
        const creatorId = String(user.id || 'system');
        
        // 1. 각 테이블의 원천 데이터를 별도로 조회
        // 보안 필터: executeSQL 내 'isDeleted' 텍스트 사용 시 500 에러 발생하므로 queryTable로 대체
        let rawRows: any[] = [];
        let workspaceItems: any[] = [];
        let reports: any[] = [];
        let users: any[] = [];

        try {
            // 1) 기존 dashboard_data 테이블의 항목 조회 (이전 report_row 대응)
            const rawRowsResult = await queryTable('dashboard_data', { 
                limit: 50,
                orderBy: 'createdAt',
                orderDirection: 'DESC'
            });
            const allRows = (rawRowsResult?.rows || rawRowsResult || []) as any[];
            rawRows = allRows.filter(row => 
                String(row.creatorId) === creatorId && 
                Number(row.isDeleted) === 0 &&
                row.reportId === 'system-unclassified'
            );
        } catch (e) {
            console.error("[Feed Debug] dashboard_data query failed:", e);
        }

        try {
            const workspaceResult = await queryTable('workspace_item', { 
                limit: 50,
                orderBy: 'createdAt',
                orderDirection: 'DESC'
            });
            const allItems = (workspaceResult?.rows || workspaceResult || []) as any[];
            // [수정] 삭제되지 않은 항목만 피드에 노출합니다. (관리자 삭제 피드백 반영)
            workspaceItems = allItems.filter(item => 
                String(item.creatorId) === creatorId &&
                item.status !== WORKSPACE_STATUS.DELETED
            );
        } catch (e) {
            console.error("[Feed Debug] workspace_item query failed:", e);
        }

        try {
            const reportsResult = await queryTable('dashboard_master', { filters: { isDeleted: '0' } });
            reports = (reportsResult?.rows || reportsResult || []) as any[];
        } catch (e) {
            console.error("[Feed Debug] report query failed:", e);
        }

        try {
            const usersResult = await queryTable('user', { filters: { isActive: '1' } });
            users = (usersResult?.rows || usersResult || []) as any[];
        } catch (e) {
            console.error("[Feed Debug] user query failed:", e);
        }

        const reportMap = new Map((reports as any[]).map((r: any) => [String(r.id), r]));
        const userMap = new Map((users as any[]).map((u: any) => [String(u.id), u]));

        // 미분류 항목을 위한 가상 보고서 정의
        const systemUnclassifiedReport = {
            id: 'system-unclassified',
            name: '분류되지 않은 항목',
            type: 'UNCLASSIFIED'
        };
        reportMap.set(systemUnclassifiedReport.id, systemUnclassifiedReport);

        // 2. 신규 workspace_item 데이터를 피형 형식으로 변환
        const basePath = process.env.NEXT_PUBLIC_EGDESK_BASE_PATH || '';
        const formattedWorkspaceItems = workspaceItems.map((item: any) => {
            let imageUrl = item.imageUrl || '';
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith(basePath)) {
                imageUrl = `${basePath}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
            }

            const isAnalyzing = (item.status === 'pending' && (!item.suggestedTitle || item.suggestedTitle.includes('분석 중...')));
            const report = item.reportId ? reportMap.get(String(item.reportId)) : null;
            
            // 사원 관점의 데이터 요약문 생성 (날짜 -> 상호 -> 금액 순서)
            let dataSummary = item.suggestedSummary || '';
            if (item.aiData) {
                try {
                    const aiData = JSON.parse(item.aiData);
                    // 다양한 키 이름 대응 (날짜, 상호, 금액)
                    const date = aiData['승인일시'] || aiData['거래일시'] || aiData['날짜'] || '';
                    const merchant = aiData['가맹점명'] || aiData['상호'] || aiData['가맹점'] || '';
                    const amount = aiData['사용금액'] || aiData['금액'] || aiData['합계'] || '';
                    
                    if (date || merchant || amount) {
                        // 금액 형식화 (숫자인 경우 천단위 콤마 추가)
                        const formattedAmount = typeof amount === 'number' ? amount.toLocaleString() : amount;
                        dataSummary = `${date} ${merchant} ${formattedAmount}`.trim().replace(/\s+/g, ' ');
                    }
                } catch (e) {}
            }

            return {
                id: item.id,
                type: 'UNCLASSIFIED' as const,
                title: report?.name || '분류되지 않은 항목', // 제목에 테이블명 표시
                content: isAnalyzing ? '이미지를 분석하고 있습니다...' : (dataSummary || '요약된 데이터 정보가 없습니다.'), // 본문에 데이터 내용 표시
                imageUrl: imageUrl,
                timestamp: formatRelativeTime(item.createdAt),
                createdAt: new Date(item.createdAt).getTime(),
                creator: userMap.get(String(item.creatorId))?.fullName || '사용자',
                originalText: item.originalText,
                isWorkspaceItem: true,
                status: item.status || 'pending',
                isAnalyzing, 
                isCompleted: item.status === 'completed',
                isDeleted: item.status === 'deleted', locationName: item.location_name
            };
        });

        // 3. 기존 dashboard_data 데이터를 피드 형식으로 변환 (하위 호환성 유지)
        const formattedReportRows = rawRows
            .map((row: any) => {
                const report = reportMap.get(String(row.reportId));
                if (!report && row.reportId !== 'system-unclassified') return null;

                let parsedData: any = {};
                try {
                    parsedData = JSON.parse(row.data);
                } catch (e) {
                    parsedData = { content: row.data };
                }

                const isUnclassified = row.reportId === 'system-unclassified';
                const reportName = isUnclassified ? '분류 필요 항목' : report?.name || '기타 보고서';

                // 데이터 요약 생성
                const keys = Object.keys(parsedData);
                const dataSummary = isUnclassified 
                    ? (parsedData.suggestedSummary || '분류가 필요한 데이터입니다.') 
                    : (keys.length > 1 ? `${parsedData[keys[0]] || ''} ${parsedData[keys[1]] || ''}`.trim() : JSON.stringify(parsedData));

                const type: 'TASK' | 'NOTICE' | 'ACTIVITY' | 'UNCLASSIFIED' = 
                    isUnclassified ? 'UNCLASSIFIED' :
                    (report?.name || '').includes('공지') ? 'NOTICE' : 
                    (report?.name || '').includes('할 일') || (report?.name || '').includes('보고') ? 'TASK' : 'ACTIVITY';

                // 이미지 경로에 베이스 경로 적용
                const bPath = process.env.NEXT_PUBLIC_EGDESK_BASE_PATH || '';
                let imageUrl = parsedData.영수증사진 || parsedData.imageUrl || '';
                if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith(bPath)) {
                    imageUrl = `${bPath}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
                }

                return {
                    id: row.id,
                    type,
                    title: reportName, // 제목에 테이블명 표시
                    content: dataSummary, // 본문에 데이터 내용 표시
                    author: isUnclassified ? 'AI 분석기' : '시스템',
                    timestamp: formatRelativeTime(row.createdAt),
                    createdAt: new Date(row.createdAt).getTime(), // 정렬용
                    isCompleted: !isUnclassified, // 미분류가 아닌 경우(이미 분류됨) 완료로 표시
                    likes: isUnclassified ? 0 : Math.floor(Math.random() * 5),
                    comments: 0,
                    imageUrl: imageUrl,
                    unclassifiedReason: parsedData.unclassifiedReason
                };
            })
            .filter(Boolean) as any[];

        // 4. 통합 및 정렬
        const allFeeds = [...formattedWorkspaceItems, ...formattedReportRows]
            .sort((a: any, b: any) => b.createdAt - a.createdAt)
            .slice(0, 50);

        return allFeeds;
    } catch (err) {
        console.error("Failed to fetch workspace feed (JS fallback):", err);
        return [];
    }
}

/**
 * 상대 시간을 문자열로 변환하는 헬퍼 함수
 */
function formatRelativeTime(dateStr: string) {
    if (!dateStr) return '알 수 없음';
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
}

export async function submitWorkspaceDataAction(formData: FormData) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');

    const text = formData.get('text') as string;
    const images = formData.getAll('image') as File[];
    const validImages = images.filter(img => img && img.size > 0);
    const lat = formData.get('lat') ? parseFloat(formData.get('lat') as string) : undefined;
    const lng = formData.get('lng') ? parseFloat(formData.get('lng') as string) : undefined;
    let locationName = '';

    console.log(`[Workspace AI Input] Text: "${text}" | Images: ${validImages.length} | Loc: ${lat}, ${lng}`);

    try {
        if (lat && lng) {
            locationName = await getAddressFromCoords(lat, lng);
        }

        // 1. 이미지가 여러 장인 경우: 선 저장 후 순차/수동 분류 유도
        if (validImages.length > 1) {
            console.log(`[Batch Upload] Processing ${validImages.length} images...`);
            
            const results = await Promise.all(validImages.map(async (image) => {
                try {
                    // 일단 서버에 저장
                    const uploadFormData = new FormData();
                    uploadFormData.append('file', image);
                    const uploadResult = await uploadFileAction(uploadFormData);
                    const imageUrl = uploadResult.url;

                    // 전용 테이블(workspace_item)에 저장 (id 생략 -> 서버 자동 부여)
                    const insertRes = await insertRows('workspace_item', [{
                        
                        creatorId: user.id || 'system',
                        imageUrl: imageUrl, // 이미지 전용 컬럼 활용
                        originalText: text,
                        suggestedTitle: `${image.name} (일괄 등록)`,
                        suggestedSummary: "여러 장의 사진을 한꺼번에 올렸습니다. 피드에서 개별적으로 분류해 주세요.",
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        location_lat: lat,
                        location_lng: lng,
                        location_name: locationName
                    }]);

                    const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
                    const itemId = String(insertedRow.id);

                    // 개별 항목 배경 분석 트리거
                    analyzeWorkspaceItemAction(itemId).catch(err => {
                        console.error(`[Batch Background Analysis Error] Item ${itemId}:`, err);
                    });

                    return { success: true };
                } catch (e) {
                    console.error("Batch upload item failed:", e);
                    return { success: false };
                }
            }));

            const successCount = results.filter(r => r.success).length;

            return {
                success: true,
                isBatch: true,
                message: `${successCount}장의 사진이 등록되었습니다. 워크스페이스 피드에서 각 항목을 눌러 분류를 진행해 주세요.`
            };
        }

        // 2. 단일 이미지/텍스트 업로드: 대기 중단 및 피드 즉시 등록 (비동기 처리 지향)
        const image = validImages[0] || null;
        let imageUrl: string | undefined;

        if (image) {
            try {
                const uploadFormData = new FormData();
                uploadFormData.append('file', image);
                const uploadResult = await uploadFileAction(uploadFormData);
                imageUrl = uploadResult.url;
            } catch (e) {
                console.error("Single image upload failed:", e);
            }
        }

        // 전용 테이블(workspace_item)에 즉시 등록 (id 생략 -> 서버 자동 부여)
        const insertRes = await insertRows('workspace_item', [{
            
            creatorId: user.id || 'system',
            imageUrl: imageUrl,
            originalText: text,
            suggestedTitle: image ? `${image.name} (분석 중...)` : "텍스트 분석 중...",
            suggestedSummary: "", // 안내 문구 제거
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            location_lat: lat,
            location_lng: lng,
            location_name: locationName
        }]);

        const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
        const itemId = String(insertedRow.id);

        // [핵심] 배경 분석 트리거 (await 하지 않음 - 사용자 응답 속도 최우선)
        // 분석 시작 (백그라운드)
        analyzeWorkspaceItemAction(itemId).catch(err => {
            console.error(`[Background Analysis Error] Item ${itemId}:`, err);
        });

        // 피드 갱신 강제
        revalidatePath('/workspace');

        return {
            success: true,
            isUnclassified: true,
            message: "등록이 시작되었습니다. 피드에서 분류 결과를 확인해 주세요."
        };

    } catch (err: any) {
        console.error("Workspace AI processing failed:", err);
        return {
            success: false,
            message: err.message || "AI 분석 중 오류가 발생했습니다."
        };
    }
}

/**
 * 특정 워크스페이스 항목의 상세 분석 데이터를 조회합니다.
 */
export async function getWorkspaceItemDataAction(itemId: string) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');

    try {
        const creatorId = String(user.id || 'system');
        const basePath = process.env.NEXT_PUBLIC_EGDESK_BASE_PATH || '';

        console.log(`[Workspace Item Detail] Requested ID: ${itemId}`);
        
        // workspace_item 테이블 먼저 조회
        const items = await queryTable('workspace_item', { filters: { id: itemId } });
        const item = Array.isArray(items) ? items[0] : (items.rows?.[0]);

        if (item) {
            console.log(`[Workspace Item Detail] Found in [workspace_item]. ID: ${item.id}, Status: ${item.status}`);
            // 이미지 경로에 베이스 경로 적용 (중복 적용 방지)
            let imageUrl = item.imageUrl || '';
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith(basePath)) {
                imageUrl = `${basePath}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
            }

            let aiData = {};
            if (item.aiData) {
                try {
                    aiData = JSON.parse(item.aiData);
                } catch (e) {
                    console.error("Failed to parse aiData:", e);
                }
            }

            let reportName = null;
            let columns = [];

            if (item.reportId) {
                try {
                    const reportRes = await queryTable('dashboard_master', { filters: { id: String(item.reportId) } });
                    const report = Array.isArray(reportRes) ? reportRes[0] : (reportRes.rows?.[0]);
                    if (report) {
                        reportName = report.name;
                        columns = JSON.parse(report.columns || '[]');
                    }
                } catch (e) {
                    console.error("Failed to fetch report info for item:", e);
                }
            }

            return {
                success: true,
                data: {
                    id: item.id,
                    imageUrl,
                    originalText: item.originalText,
                    suggestedTitle: item.suggestedTitle,
                    suggestedSummary: item.suggestedSummary,
                    aiData,
                    reportId: item.reportId,
                    reportName,
                    columns,
                    status: item.status || 'pending', // 상세 조회 시 보정
                    isWorkspaceItem: true
                }
            };
        }

        // 만약 workspace_item이 아니라 dashboard_data(기존 미분류)인 경우
        console.log(`[Workspace Item Detail] Not found in workspace_item. Checking dashboard_data for ID: ${itemId}`);
        const rows = await queryTable('dashboard_data', { filters: { id: itemId } });
        const row = Array.isArray(rows) ? rows[0] : (rows.rows?.[0]);

        if (row) {
            console.log(`[Workspace Item Detail] Found in [dashboard_data]. ID: ${row.id}, Report: ${row.reportId}`);
            let parsedData: any = {};
            try {
                parsedData = JSON.parse(row.data);
            } catch (e) {
                parsedData = { content: row.data };
            }

            let imageUrl = parsedData.imageUrl || parsedData.영수증사진 || '';
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith(basePath)) {
                imageUrl = `${basePath}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
            }

            let reportName = null;
            let columns = [];
            if (row.reportId && row.reportId !== 'system-unclassified') {
                try {
                    const reportRes = await queryTable('dashboard_master', { filters: { id: String(row.reportId) } });
                    const report = Array.isArray(reportRes) ? reportRes[0] : (reportRes.rows?.[0]);
                    if (report) {
                        reportName = report.name;
                        columns = JSON.parse(report.columns || '[]');
                    }
                } catch (e) {}
            }

            return {
                success: true,
                data: {
                    id: row.id,
                    imageUrl,
                    originalText: parsedData.originalText,
                    suggestedTitle: parsedData.suggestedTitle,
                    suggestedSummary: parsedData.suggestedSummary,
                    reportId: row.reportId === 'system-unclassified' ? null : row.reportId,
                    reportName,
                    columns,
                    aiData: parsedData,
                    status: Number(row.isDeleted) === 1 ? 'deleted' : (row.reportId === 'system-unclassified' ? 'pending' : 'completed'),
                    isWorkspaceItem: false
                }
            };
        }

        return { success: false, message: "항목을 찾을 수 없습니다." };
    } catch (err: any) {
        console.error("Failed to fetch item data:", err);
        return { success: false, message: err.message };
    }
}

/**
 * 사용자가 수정한 최종 데이터를 DB에 저장합니다.
 */
export async function confirmWorkspaceDataAction(
    reportId: string,
    rowData: Record<string, any>,
    workspaceItemId?: string,
    prevalidation?: import('@/lib/services/guardrail-service').ValidationResult
) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');

    try {
        console.log(`[Workspace Final Save] Report: ${reportId} | WorkspaceItem: ${workspaceItemId} | Data:`, rowData);
        
        // 1. 가드레일 검증 (prevalidation이 전달된 경우 재검증 생략 — 중복 DB 쿼리 방지)
        const reports = await queryTable('dashboard_master', { filters: { id: reportId } });
        const report = Array.isArray(reports) ? reports[0] : (reports.rows?.[0]);
        const tableName = report?.tableName;

        const validation = prevalidation ?? await GuardrailService.validateRow(reportId, rowData, tableName);
        
        if (validation.isBlocked) {
            // 가드레일 BLOCK: 업로더 + 관리자 모두에게 알림 발송
            const failedRule = validation.failedRules[0];

            // 업로더 알림
            await createInAppNotification({
                userId: String(user.id),
                title: '🔴 입력 정책 위반 (차단됨)',
                message: `${failedRule.errorMessage} (정책: ${failedRule.ruleType})`,
                type: 'ALERT',
                link: workspaceItemId ? `/workspace` : `/report/${reportId}`
            });

            // 관리자 알림 (adminAdvice 활용)
            await notifyAdmins({
                title: '⚠️ 입력 차단 발생 — 검토 필요',
                message: `[${user.fullName || user.username}] ${failedRule.errorMessage}\n📋 조치 안내: ${failedRule.adminAdvice || '데이터 및 정책 규칙을 검토해 주세요.'}`,
                type: 'ALERT',
                link: '/notifications'
            });

            // workspace_item status를 'blocked'로 명시적 업데이트
            if (workspaceItemId) {
                await updateRows('workspace_item', {
                    status: WORKSPACE_STATUS.BLOCKED,
                    updatedAt: new Date().toISOString()
                }, { filters: { id: workspaceItemId } });
            }

            return { 
                success: false, 
                message: failedRule.errorMessage,
                failedRules: validation.failedRules 
            };
        }

        // WARN 규칙 처리 — 저장은 허용하되 경고 알림 발송
        const warnRules = validation.failedRules.filter(r => r.severity === 'WARN');
        if (warnRules.length > 0) {
            const warnRule = warnRules[0];
            await createInAppNotification({
                userId: String(user.id),
                title: '⚠️ 입력 경고',
                message: `${warnRule.errorMessage} (저장은 완료됩니다.)`,
                type: 'WARNING',
                link: workspaceItemId ? `/workspace` : `/report/${reportId}`
            });
            await notifyAdmins({
                title: 'ℹ️ 경고 항목 저장됨',
                message: `[${user.fullName || user.username}] ${warnRule.errorMessage}\n📋 조치 안내: ${warnRule.adminAdvice || '경고 항목이 저장되었습니다. 검토를 권장합니다.'}`,
                type: 'WARNING',
                link: '/notifications'
            });
        }

        // 2. 기존 addRowAction을 호출하여 물리+가상 테이블 동기화
        const result = await addRowAction(reportId, rowData);
        
        // 3. 신규 테이블(workspace_item) 상태 업데이트
        if (workspaceItemId) {
            await updateRows('workspace_item', { 
                status: 'completed',
                reportId: reportId,
                updatedAt: new Date().toISOString()
            }, { filters: { id: workspaceItemId } });
        }
        
        // 알림 생성: 기록 완료
        await createInAppNotification({
            userId: String(user.id),
            title: '데이터 기록 완료',
            message: `${reportId} 테이블에 새로운 데이터가 기록되었습니다.`,
            type: 'INFO',
            link: `/report/${reportId}`
        });

        revalidatePath('/workspace');
        return { 
            success: true, 
            message: "데이터가 성공적으로 저장되었습니다." 
        };
    } catch (err: any) {
        console.error("Workspace final save failed:", err);
        return {
            success: false,
            message: err.message || "데이터 저장 중 오류가 발생했습니다."
        };
    }
}

/**
 * [내부 액션] 배경에서 AI 분석을 수행하고 결과를 업데이트합니다.
 */
async function analyzeWorkspaceItemAction(itemId: string) {
    const { processWorkspaceInput } = await import('@/lib/workspace-ai');
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
        // 1. 항목 및 업로더 정보 조회
        const items = await queryTable('workspace_item', { filters: { id: itemId } });
        const item = Array.isArray(items) ? items[0] : (items.rows?.[0]);
        if (!item) return;

        const users = await queryTable('user', { filters: { id: String(item.creatorId) } });
        const creatorUser = Array.isArray(users) ? users[0] : (users.rows?.[0]);

        // [추가] Audit Trail의 시작점: 분석 시작 알림 생성
        const startLink = workspaceOpenItemLink(itemId);
        const startTitle = '🔍 분석 단계 시작';
        const locationCoords = (item.location_lat && item.location_lng) ? ` [geo:${item.location_lat},${item.location_lng}]` : '';
        const locationInfo = item.location_name ? `\n📍 위치: ${item.location_name}${locationCoords}` : '';
        const startMessage = `[${creatorUser?.fullName || '사원'}]님이 업로드한 항목의 분석을 시작합니다.${locationInfo}`;
        
        await upsertInAppNotificationByLink({
            userId: String(item.creatorId),
            link: startLink,
            title: startTitle,
            message: startMessage,
            type: 'INFO'
        });

        // 관리자에게도 동일한 내용으로 알림 (제목/메시지가 같아야 UI에서 하나로 병합됨)
        await notifyAdminsUpsert({
            title: startTitle,
            message: startMessage,
            type: 'INFO',
            link: startLink,
            excludeUserIds: [String(item.creatorId)]
        });

        let base64Image: string | undefined;
        let mimeType: string | undefined;

        // 2. 이미지 파일 처리 (있을 경우)
        if (item.imageUrl) {
            try {
                const publicPath = path.join(process.cwd(), 'public', item.imageUrl);
                const buffer = await fs.readFile(publicPath);
                base64Image = buffer.toString('base64');
                const ext = path.extname(publicPath).toLowerCase();
                mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            } catch (e) {
                console.warn(`[AI Background] Failed to read image file: ${item.imageUrl}`, e);
            }
        }

        // 3. AI 분석 수행
        const aiResult = await processWorkspaceInput(item.originalText || "", base64Image, mimeType);

        // 4. 분석 결과 업데이트
        const updateData: any = {
            suggestedTitle: aiResult.suggestedTitle || (aiResult.reportName ? `${aiResult.reportName} 항목` : '분류 필요 항목'),
            suggestedSummary: aiResult.suggestedSummary || aiResult.message || '분류 준비가 완료되었습니다.',
            reportId: aiResult.reportId || undefined,
            aiData: JSON.stringify({
                ...(aiResult.extractedData || {}),
                // 미분류 시 AI 추천 정보를 aiData 메타 필드로 저장
                ...(aiResult._recommendation ? { _recommendation: aiResult._recommendation } : {})
            }),
            updatedAt: new Date().toISOString()
        };

        // 미분류 (reportId === null) 시 status = 'unresolved'로 명시
        if (!aiResult.reportId) {
            updateData.status = WORKSPACE_STATUS.UNRESOLVED;
        }

        // 5. 자동 분류 (Auto-Confirm): 신뢰도가 0.9 이상이고 분석 데이터가 있는 경우
        let isAutoConfirmed = false;
        if (aiResult.reportId && aiResult.extractedData && (aiResult.confidence || 0) >= 0.9) {
            console.log(`[AI Background] Auto-confirming item ${itemId} (Confidence: ${aiResult.confidence}) for report ${aiResult.reportId}`);
            try {
                // extractedData의 각 필드가 유효한지 최종 점검 (빈 객체면 제외)
                if (Object.keys(aiResult.extractedData).length > 0) {
                    // 가드레일 검증 수행 (1회만 — confirmWorkspaceDataAction 내부 재검증 생략)
                    const validation = await GuardrailService.validateRow(
                        aiResult.reportId,
                        aiResult.extractedData,
                        (aiResult as any).tableName
                    );
                    
                    if (!validation.isBlocked) {
                        // prevalidation 결과 전달하여 내부 중복 검증 방지
                        const confirmResult = await confirmWorkspaceDataAction(
                            aiResult.reportId, 
                            aiResult.extractedData, 
                            itemId,
                            validation  // 검증 결과 전달
                        );
                        if (confirmResult.success) {
                            isAutoConfirmed = true;
                            updateData.status = WORKSPACE_STATUS.COMPLETED;
                            console.log(`[AI Background] Item ${itemId} auto-confirmed successfully.`);
                        } else {
                            console.warn(`[AI Background] Auto-confirm failed for ${itemId}: ${confirmResult.message}`);
                        }
                    } else {
                        console.log(`[AI Background] Auto-confirm BLOCKED by guardrail for item ${itemId}.`);
                        updateData.suggestedSummary = `[정책 위반] ${validation.failedRules[0].errorMessage}`;
                        updateData.status = WORKSPACE_STATUS.BLOCKED; // 차단 시 명시적 상태
                    }
                }
            } catch (confirmErr: any) {
                console.error(`[AI Background] Auto-confirmation exception for item ${itemId}: ${confirmErr.message}`);
            }
        }

        // 6. 최종 요약문 결정 (실제 저장 여부에 따라 보정)
        if (isAutoConfirmed) {
            updateData.suggestedSummary = aiResult.reportName ? `[${aiResult.reportName}]에 데이터를 기록했습니다.` : '데이터를 성공적으로 기록했습니다.';
        } else {
            // 저장되지 않은 경우, AI가 제안한 요약문에서 "기록했습니다" 등의 확정적 표현이 있다면 "준비되었습니다" 등으로 완화
            let summary = aiResult.suggestedSummary || aiResult.message || '분석이 완료되었습니다.';
            summary = summary.replace(/기록했습니다|저장했습니다|완료했습니다/g, '분석이 완료되었습니다. 확인 후 저장해 주세요.');
            updateData.suggestedSummary = summary;
        }

        await updateRows('workspace_item', updateData, { filters: { id: String(itemId) } });

        const displayTitle = String(updateData.suggestedTitle || item.suggestedTitle || '항목');
        const link = workspaceOpenItemLink(itemId);
        const isUnresolvedFinal = !aiResult.reportId;
        const isBlockedFinal = updateData.status === WORKSPACE_STATUS.BLOCKED;

        // 알림 메시지 구성 (상태별 분기 — DB에 반영된 updateData 기준)
        let alertTitle = 'AI 분석 완료';
        let alertMessage = `[${displayTitle}] 분석이 완료되었습니다. 확인 후 저장해 주세요.${locationInfo}`;
        let alertType: 'INFO' | 'ALERT' | 'WARNING' = 'ALERT';

        if (isAutoConfirmed) {
            alertTitle = '데이터 자동 기록 완료';
            alertMessage = `${updateData.suggestedSummary}${locationInfo}`;
            alertType = 'INFO';
        } else if (isBlockedFinal) {
            alertTitle = '🔴 데이터 등록 차단됨';
            alertMessage = `보안 정책에 의해 [${displayTitle}] 등록이 차단되었습니다.${locationInfo}`;
            alertType = 'WARNING';
        } else if (isUnresolvedFinal) {
            alertTitle = '⚠️ 미분류 데이터 발생 — 조치 필요';
            alertMessage = `[${displayTitle}] 매칭되는 테이블이 없습니다. 관리자의 확인 또는 보고서 추가가 필요합니다.${locationInfo}`;
            alertType = 'ALERT';
        }

        // [수정] 알림 로직 단일화: 한 작업에 알림은 무조건 한 건만 발생하도록 강제
        // 특히 관리자가 작성자인 경우 관리자용 조치 알림이 사원용 알림보다 우선순위가 높으므로 이를 병합합니다.
        
        const isCreatorAdmin = creatorUser?.role?.toUpperCase() === 'ADMIN';

        if (isUnresolvedFinal) {
            const rec = aiResult._recommendation;
            const adminMsg =
                rec
                    ? `[${aiResult.suggestedTitle || '알 수 없는 문서'}] 매칭 테이블 없음.\n🤖 AI 추천: "${rec.tableName}" 테이블 생성 후 재분류 요청 권장.\n📋 조치: ${rec.advice}`
                    : alertMessage;

            // 1. 관리자 그룹 알림 (작성자 제외한 타 관리자들용)
            await notifyAdminsUpsert({
                title: alertTitle,
                message: adminMsg,
                type: 'ALERT',
                link,
                excludeUserIds: [String(item.creatorId)]
            });

            // 2. 작성자 본인 알림 (하나의 배지로 통합 추적)
            await upsertInAppNotificationByLink({
                userId: String(item.creatorId),
                link,
                title: alertTitle,
                message: isCreatorAdmin ? adminMsg : alertMessage,
                type: 'ALERT'
            });
        } else {
            // 미분류가 아닌 경우 (정상 완료 또는 차단)
            await upsertInAppNotificationByLink({
                userId: String(item.creatorId),
                link,
                title: alertTitle,
                message: alertMessage,
                type: alertType
            });
        }

        console.log(`[AI Background] Item ${itemId} analysis completed. (Auto-Confirmed: ${isAutoConfirmed})`);
        revalidatePath('/workspace');
        if (aiResult.reportId) {
            revalidatePath(`/report/${aiResult.reportId}`);
        }

    } catch (err) {
        console.error(`[AI Background] Analysis failed for item ${itemId}:`, err);
    }
}

/**
 * 워크스페이스 항목을 삭제합니다. (레코드 + 실제 파일)
 */
export async function deleteWorkspaceItemAction(itemId: string) {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');

    try {
        console.log(`[Workspace Delete] Item: ${itemId}`);

        // 1. 이미지 파일 경로 확인 (workspace_item 또는 dashboard_data)
        const items = await queryTable('workspace_item', { filters: { id: String(itemId) } });
        const item = Array.isArray(items) ? items[0] : (items.rows?.[0]);

        if (item) {
            // 항목 삭제 시 연관된 알림도 물리적으로 삭제 (대시보드 잔상 제거)
            await deleteRows('notification', { filters: { link: `/workspace?openItem=${itemId}` } });

            // 실제 삭제 대신 'deleted' 상태로 업데이트 (히스토리 보존)
            await updateRows('workspace_item', { 
                status: WORKSPACE_STATUS.DELETED,
                updatedAt: new Date().toISOString()
            }, { filters: { id: String(itemId) } });
            
            console.log(`[Workspace Delete] Item marked as deleted: ${itemId}`);
        } else {
            // workspace_item에 없다면 dashboard_data(미분류)에서 확인
            const rows = await queryTable('dashboard_data', { filters: { id: String(itemId) } });
            const row = Array.isArray(rows) ? rows[0] : (rows.rows?.[0]);
            if (row) {
                // dashboard_data의 경우 isDeleted 플래그 활용
                await updateRows('dashboard_data', { 
                    isDeleted: 1, 
                    updatedAt: new Date().toISOString() 
                }, { filters: { id: String(itemId) } });
            }
        }

        revalidatePath('/workspace');
        return { success: true, message: "항목이 삭제되었습니다." };
    } catch (err: any) {
        console.error("Failed to delete workspace item:", err);
        return { success: false, message: err.message };
    }
}

/**
 * 좌표를 사람이 읽을 수 있는 주소로 변환하는 헬퍼 함수 (OSM Nominatim 활용)
 */
async function getAddressFromCoords(lat: number, lng: number): Promise<string> {
    try {
        console.log(`[Reverse Geocoding] Fetching address for ${lat}, ${lng}...`);
        // Nominatim API 사용 (PoC 단계에서는 공개 API 사용)
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: {
                'User-Agent': 'EGDesk-App/1.0'
            }
        });
        
        if (!response.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        const data = await response.json();
        const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        // 너무 긴 주소는 줄임 (예: 구/동 단위까지만)
        return address.length > 50 ? address.substring(0, 50) + '...' : address;
    } catch (e) {
        console.error('[Reverse Geocoding Error]', e);
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}
/**
 * # 태그 자동 완성을 위해 마스터 데이터를 통합 검색합니다.
 */
/**
 * @ 또는 # 태그 자동 완성을 위해 마스터 데이터를 필터링 검색합니다.
 * 기호가 없는 경우(trigger=null) 모든 카테고리를 통합 검색합니다.
 */
export async function searchAutocompleteTagsAction(query: string, trigger: string | null = '#') {
    // 쿼리어가 단어 검색일 경우(ambient) 너무 짧으면 빈 결과 반환 (한글 2자 미만 등)
    if (!trigger && (!query || query.trim().length < 2)) {
        return [];
    }

    const safeQuery = query || '';

    try {
        const lowerQuery = safeQuery.toLowerCase();

        // 트리거에 따른 검색 대상 필터링
        // @: 인물 (사원, 거래처 직원)
        // #: 조직/사물 (부서, 거래처, 제품)
        // null: 지능형 통합 검색 (전체)
        const isAmbient = !trigger;
        const isPeopleSearch = trigger === '@' || isAmbient;
        const isObjectSearch = trigger === '#' || isAmbient;

        // 1. 트리거별 대상 소스 병렬 조회
        const [users, depts, clients, products, clientEmployees] = await Promise.all([
            isPeopleSearch ? queryTable('user', { filters: { isActive: '1' } }) : Promise.resolve([]),
            isObjectSearch ? queryTable('department', {}) : Promise.resolve([]),
            (isObjectSearch || isPeopleSearch) ? queryTable('master_client', {}) : Promise.resolve([]),
            isObjectSearch ? queryTable('master_product', {}) : Promise.resolve([]),
            isPeopleSearch ? queryTable('master_client_employee', {}) : Promise.resolve([])
        ]);

        const results: any[] = [];

        // 2. 검색어 매칭 및 통합
        if (isPeopleSearch) {
            // [우리회사 사원]
            (users || []).forEach((u: any) => {
                if (u.fullName?.toLowerCase().includes(lowerQuery) || u.username?.toLowerCase().includes(lowerQuery)) {
                    results.push({ type: '사원', name: u.fullName, id: u.id, sub: u.position || '사원' });
                }
            });

            // [거래처 담당자]
            (clientEmployees || []).forEach((e: any) => {
                if (e.name?.toLowerCase().includes(lowerQuery)) {
                    const client = (clients || []).find((c: any) => c.id === e.clientId);
                    results.push({ type: '거래처직원', name: e.name, id: e.id, sub: client?.name || '거래처' });
                }
            });
        }

        if (isObjectSearch) {
            // [우리회사 부서]
            (depts || []).forEach((d: any) => {
                if (d.name?.toLowerCase().includes(lowerQuery)) {
                    results.push({ type: '부서', name: d.name, id: d.id, sub: '부서' });
                }
            });

            // [거래처]
            (clients || []).forEach((c: any) => {
                if (c.name?.toLowerCase().includes(lowerQuery)) {
                    results.push({ type: '거래처', name: c.name, id: c.id, sub: '거래처' });
                }
            });

            // [제품]
            (products || []).forEach((p: any) => {
                if (p.name?.toLowerCase().includes(lowerQuery) || p.spec?.toLowerCase().includes(lowerQuery)) {
                    results.push({ type: '제품', name: p.name, id: p.id, sub: p.spec || '제품' });
                }
            });
        }

        // 지능형 검색 시 중복 제거 (여러 카테고리에 걸친 경우 등)
        const uniqueResults = Array.from(new Map(results.map(item => [`${item.type}-${item.name}`, item])).values());

        return uniqueResults.slice(0, 15);
    } catch (err) {
        console.error('[Autocomplete Action] Failed to search tags:', err);
        return [];
    }
}
