'use server';

import { revalidatePath } from 'next/cache';
import { 
    queryTable, 
    insertRows, 
    updateRows, 
    deleteRows,
    executeSQL
} from '@/egdesk-helpers';
import { hashPassword } from './shared';
import { getSessionAction } from './auth';

/**
 * 🏢 전체 조직도 데이터 조회 (부서 + 유저)
 * SQL JOIN을 사용하여 부서명이 포함된 유저 목록을 가져옵니다.
 */
export async function getOrganizationDataAction() {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') return { departments: [], members: [] };

    // [Soft Delete] 삭제되지 않은 부서만 조회
    const departments = await queryTable('department', { 
        filters: { __is_deleted: '0' },
        orderBy: 'name' 
    });
    
    // 유저 데이터 조회 (삭제되지 않고 활성화된 유저)
    const users = await queryTable('user', {
        filters: { isActive: '1', __is_deleted: '0' }
    });

    // 부서 정보를 Map으로 변환하여 빠른 조인 지원
    const deptMap = new Map(departments.map((d: any) => [d.id, d.name]));

    // 데이터 조인 (departmentId를 기반으로 departmentName 추가)
    const members = users.map((u: any) => ({
        ...u,
        departmentName: deptMap.get(u.departmentId) || '소속 없음'
    })).sort((a, b) => {
        // 부서명 순, 이름 순 정렬
        const deptCompare = (a.departmentName || '').localeCompare(b.departmentName || '');
        if (deptCompare !== 0) return deptCompare;
        return (a.fullName || '').localeCompare(b.fullName || '');
    });

    return { departments, members };
}

/**
 * 📥 부서 정보 단건 추가/수정
 */
export async function upsertDepartmentAction(data: { id?: string, name: string, description?: string }) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') throw new Error('권한 부족');

    const now = new Date().toISOString();

    if (data.id) {
        await updateRows('department', { 
            name: data.name, 
            description: data.description,
            __updated_at: now
        }, { filters: { id: data.id } });
    } else {
        await insertRows('department', [{
            name: data.name,
            description: data.description,
            createdAt: now,
            __created_at: now,
            __updated_at: now,
            __is_deleted: 0
        }]);
    }

    revalidatePath('/admin/organization');
    return { success: true };
}

/**
 * 👥 유저(멤버) 정보 단건 추가
 */
export async function createMemberAction(data: any) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') throw new Error('권한 부족');

    // 사원번호 중복 체크 (삭제되지 않은 유저 중)
    if (data.employeeId) {
        const existing = await queryTable('user', { 
            filters: { employeeId: data.employeeId, __is_deleted: '0' } 
        });
        if (existing && existing.length > 0) {
            throw new Error(`이미 등록된 사원번호입니다: ${data.employeeId}`);
        }
    }

    let departmentId = data.departmentId;
    const now = new Date().toISOString();

    // 부서 직접 입력 처리: 이름으로 ID 찾기 또는 생성
    if (!departmentId && data.departmentName) {
        const [existing] = await queryTable('department', { filters: { name: data.departmentName, __is_deleted: '0' } });
        if (existing) {
            departmentId = existing.id;
        } else {
            const insertRes = await insertRows('department', [{
                name: data.departmentName,
                createdAt: now,
                __created_at: now,
                __updated_at: now,
                __is_deleted: 0
            }]);
            const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
            departmentId = insertedRow.id;
        }
    }

    const { departmentName, ...cleanData } = data; 
    await insertRows('user', [{
        ...cleanData,
        departmentId,
        username: data.username || `user_${data.employeeId || Date.now()}`,
        password: hashPassword('1234'), 
        isActive: 1,
        createdAt: now,
        __created_at: now,
        __updated_at: now,
        __is_deleted: 0
    }]);

    revalidatePath('/admin/organization');
    return { success: true };
}

/**
 * 👥 유저(멤버) 삭제 (논리 삭제)
 */
export async function deleteMemberAction(memberId: string) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') throw new Error('권한 부족');

    const now = new Date().toISOString();
    // isActive 비활성화와 __is_deleted 논리 삭제 동시 적용
    await updateRows('user', { 
        isActive: 0, 
        __is_deleted: 1,
        __deleted_at: now,
        __updated_at: now
    }, { filters: { id: memberId } });
    
    revalidatePath('/admin/organization');
    return { success: true };
}

/**
 * 👥 유저 정보 수정
 */
export async function updateMemberAction(memberId: string, data: any) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') throw new Error('권한 부족');

    const now = new Date().toISOString();
    const { departmentName, ...cleanData } = data;
    await updateRows('user', { 
        ...cleanData, 
        __updated_at: now 
    }, { filters: { id: memberId } });
    
    revalidatePath('/admin/organization');
    return { success: true };
}

/**
 * 📊 엑셀 조직도 데이터 일괄 동기화 (Master Sync)
 */
export async function syncOrganizationExcelAction(excelRows: any[]) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') throw new Error('권한 부족');

    const now = new Date().toISOString();

    // 1. 현재 부서 목록 로드 (삭제되지 않은 것만)
    const existingDepts = await queryTable('department', { filters: { __is_deleted: '0' } });
    const deptMap = new Map(existingDepts.map((d: any) => [d.name, d.id]));

    // 2. 현재 유저 목록 로드 (삭제되지 않은 것만)
    const existingUsers = await queryTable('user', { filters: { __is_deleted: '0' } });
    const userMap = new Map(existingUsers.filter((u: any) => u.employeeId).map((u: any) => [u.employeeId, u.id]));

    const usersToInsert: any[] = [];
    const stats = { inserted: 0, updated: 0, deptsCreated: 0 };

    for (const row of excelRows) {
        const deptName = row['부서'] || row['department'];
        const position = row['직위'] || row['position'];
        const fullName = row['이름'] || row['name'];
        const employeeId = String(row['사원번호'] || row['employeeId'] || '');
        const email = row['이메일'] || row['email'];

        if (!fullName || !employeeId) continue;

        let deptId = deptMap.get(deptName);
        if (deptName && !deptId) {
            const insertRes = await insertRows('department', [{
                name: deptName,
                createdAt: now,
                __created_at: now,
                __updated_at: now,
                __is_deleted: 0
            }]);
            const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
            deptId = insertedRow.id;
            deptMap.set(deptName, deptId);
            stats.deptsCreated++;
        }

        const userId = userMap.get(employeeId);
        if (userId) {
            await updateRows('user', {
                fullName,
                email,
                departmentId: deptId || null,
                position: position || null,
                __updated_at: now
            }, { filters: { id: userId } });
            stats.updated++;
        } else {
            usersToInsert.push({
                username: `user_${employeeId}`,
                fullName,
                email,
                employeeId,
                departmentId: deptId || null,
                position: position || null,
                role: 'VIEWER',
                isActive: 1,
                createdAt: now,
                __created_at: now,
                __updated_at: now,
                __is_deleted: 0
            });
            stats.inserted++;
        }
    }

    if (usersToInsert.length > 0) {
        await insertRows('user', usersToInsert);
    }

    revalidatePath('/admin/organization');
    return { success: true, stats };
}
