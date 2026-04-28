'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { 
    queryTable, 
    insertRows, 
    updateRows, 
    deleteRows,
    renameTable
} from '@/egdesk-helpers';
import { 
 
    checkReportAuthorization 
} from './shared';
import { getSessionAction } from './auth';
import { recommendSchemaFromSample } from '@/lib/ai-vision';
import { SystemTableService } from '@/lib/services/system-table-service';
import { DbSyncService } from '@/lib/services/db-sync-service';
import { ReportService } from '@/lib/services/report-service';

/**
 * 보고서를 삭제 상태로 변경합니다. (Soft Delete)
 */
export async function deleteReportAction(reportId: string) {
    await updateRows('dashboard_master', { 
        isDeleted: 1,
        deletedAt: new Date().toISOString()
    }, { filters: { reportId: String(reportId) } });
    revalidatePath('/');
    revalidatePath('/archive');
}

/**
 * 삭제된 보고서를 복구합니다.
 */
export async function restoreReportAction(reportId: string) {
    await updateRows('dashboard_master', { 
        isDeleted: 0,
        deletedAt: null
    }, { filters: { reportId: String(reportId) } });
    revalidatePath('/');
    revalidatePath('/archive');
}

/**
 * 보고서를 완전히 삭제하고 연관된 모든 데이터를 정리합니다.
 */
export async function permanentDeleteReportAction(reportId: string) {
    const reports = await queryTable('dashboard_master', { filters: { reportId: String(reportId) } });
    const report = reports[0];
    
    await ReportService.permanentDeleteReport(reportId, report?.tableName);
    
    revalidatePath('/');
    revalidatePath('/archive');
}

/**
 * 보고서의 이름을 변경합니다.
 */
export async function renameReportAction(reportId: string, newName: string) {
    await updateRows('dashboard_master', { name: newName }, { filters: { reportId: String(reportId) } });
    revalidatePath(`/report/${reportId}`);
    revalidatePath('/');
}


/**
 * AI를 통해 컬럼 추천을 받습니다.
 */
export async function getSchemaRecommendationAction(reportId: string) {
    const reports = await queryTable('dashboard_master', { filters: { reportId: String(reportId) } });
    const report = reports[0];
    if (!report) throw new Error('보고서를 찾을 수 없습니다.');

    const currentColumns = JSON.parse(report.columns);
    const sampleRows = await queryTable('dashboard_data', { 
        filters: { reportId: String(reportId) },
        limit: 20
    });

    const rowsData = sampleRows.map((r: any) => JSON.parse(r.data));
    const recommendation = await recommendSchemaFromSample(currentColumns, rowsData);
    
    return recommendation.columns;
}

/**
 * 보고서 접근 권한을 업데이트합니다.
 */
export async function updateReportAccessAction(reportId: string, userIds: string[], departmentIds: string[] = []) {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('접근 권한이 없습니다.');
    }

    await SystemTableService.ensureTable('dashboard_access');
    await deleteRows('dashboard_access', { filters: { reportId } });
    
    const records: any[] = [];
    
    // 1. 사원별 권한 추가
    if (userIds.length > 0) {
        userIds.forEach(userId => {
            records.push({
                reportId,
                userId,
                departmentId: null,
                role: 'VIEWER',
                grantedAt: new Date().toISOString(),
                grantedBy: session.id
            });
        });
    }

    // 2. 부서별 권한 추가
    if (departmentIds.length > 0) {
        departmentIds.forEach(deptId => {
            records.push({
                reportId,
                userId: null,
                departmentId: deptId,
                role: 'VIEWER',
                grantedAt: new Date().toISOString(),
                grantedBy: session.id
            });
        });
    }

    if (records.length > 0) {
        await insertRows('dashboard_access', records);
    }

    revalidatePath(`/report/${reportId}`);
    revalidatePath(`/report/${reportId}/input`);
    revalidatePath('/');
    return { success: true };
}

/**
 * 보고서에 권한이 있는 사용자 및 부서 목록을 가져옵니다.
 */
export async function getReportAccessListAction(reportId: string) {
    if (!reportId) return { users: [], departments: [] };
    try {
        await SystemTableService.ensureTable('dashboard_access');
        const accessList = await queryTable('dashboard_access', { filters: { reportId: String(reportId) } });
        
        const userIds = accessList.map((a: any) => a.userId).filter(Boolean);
        const departmentIds = accessList.map((a: any) => a.departmentId).filter(Boolean);
        
        const users = userIds.length > 0 ? await Promise.all(
            userIds.map(async (id: string) => {
                const results = await queryTable('user', { filters: { id: String(id) } });
                return results[0];
            })
        ) : [];
        
        const departments = departmentIds.length > 0 ? await Promise.all(
            departmentIds.map(async (id: string) => {
                const results = await queryTable('department', { filters: { id: String(id) } });
                return results[0];
            })
        ) : [];
        
        return {
            users: users.filter(u => u),
            departments: departments.filter(d => d)
        };
    } catch (err) {
        console.error('[Error] getReportAccessListAction:', err);
        return { users: [], departments: [] };
    }
}

/**
 * 수동 보고서를 생성합니다.
 */
export async function createManualReportAction(name: string, sheetName: string, columns: any[]) {
    const session = await getSessionAction();
    const ownerId = session?.id || 'admin';

    // 컬럼 보강 (데이터 ID 자동 추가)
    let finalColumns = [...columns];
    if (!columns.some(c => c.isAutoGenerated)) {
        finalColumns = [
            { id: 'did', name: '데이터 ID', type: 'string', isRequired: true, isAutoGenerated: true },
            ...columns
        ];
    }

    const reportIdStr = `rep-${Date.now()}`;
    const insertRes = await insertRows('dashboard_master', [{
        reportId: reportIdStr,
        name,
        sheetName,
        columns: JSON.stringify(finalColumns),
        ownerId,
        createdAt: new Date().toISOString(),
        lastSerial: 0
    }]);

    const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
    const reportId = reportIdStr;

    revalidatePath('/');
    redirect(`/report/${reportId}?action=new`);
}

/**
 * 보고서의 스키마(컬럼 정의)를 업데이트합니다.
 */
export async function updateReportSchemaAction(
    reportId: string, 
    columns: any[], 
    convertExistingData: boolean = false,
    newName?: string
) {
    const reports = await queryTable('dashboard_master', { filters: { reportId: String(reportId) } });
    const report = reports[0];
    if (!report) throw new Error('보고서를 찾을 수 없습니다.');
    const oldColumns = JSON.parse(report.columns || '[]');

    // 1. 물리적 테이블 스키마 동기화 (Blue-Green)
    if (report.tableName && Array.isArray(oldColumns)) {
        const structuralChange = oldColumns.length !== columns.length || 
            oldColumns.some((oc: any, idx: number) => columns[idx] && oc.name !== columns[idx].name);
        
        if (structuralChange) {
            const newTableName = await DbSyncService.migratePhysicalTable(
                reportId, report.name, report.tableName, oldColumns, columns, newName
            );
            
            const updateValues: any = { tableName: newTableName, columns: JSON.stringify(columns) };
            if (newName) updateValues.name = newName;
            await updateRows('dashboard_master', updateValues, { filters: { reportId: String(reportId) } });
        } else {
            const updateValues: any = { columns: JSON.stringify(columns) };
            if (newName) updateValues.name = newName;
            await updateRows('dashboard_master', updateValues, { filters: { reportId: String(reportId) } });
            
            if (newName && report.tableName) {
                await renameTable(report.tableName, report.tableName, newName).catch(() => {});
            }
        }
    } else {
        const updateValues: any = { columns: JSON.stringify(columns) };
        if (newName) updateValues.name = newName;
        await updateRows('dashboard_master', updateValues, { filters: { reportId: String(reportId) } });
    }

    // 2. 기존 데이터 변환 (가상 테이블 중심)
    if (convertExistingData && Array.isArray(oldColumns)) {
        await ReportService.migrateReportData(reportId, report.tableName, oldColumns, columns);
    }

    revalidatePath(`/report/${reportId}`);
    return { success: true };
}
