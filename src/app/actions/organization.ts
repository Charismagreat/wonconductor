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

    const departments = await queryTable('department', { orderBy: 'name' });
    
    // 조인된 데이터 조회 (sqlite 문법)
    const membersSql = `
        SELECT u.*, d.name as departmentName 
        FROM user u 
        LEFT JOIN department d ON u.departmentId = d.id 
        WHERE u.isActive = 1
        ORDER BY d.name, u.fullName
    `;
    const membersResult = await executeSQL(membersSql);
    const members = membersResult?.rows || [];

    return { departments, members };
}

/**
 * 📥 부서 정보 단건 추가/수정
 */
export async function upsertDepartmentAction(data: { id?: string, name: string, description?: string }) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') throw new Error('권한 부족');

    if (data.id) {
        await updateRows('department', { 
            name: data.name, 
            description: data.description 
        }, { filters: { id: data.id } });
    } else {
        const insertRes = await insertRows('department', [{
            
            name: data.name,
            description: data.description,
            createdAt: new Date().toISOString()
        }]);
        const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
        const deptId = insertedRow.id;
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

    // 사원번호 중복 체크
    if (data.employeeId) {
        const existing = await queryTable('user', { filters: { employeeId: data.employeeId } });
        if (existing && existing.length > 0) {
            throw new Error(`이미 등록된 사원번호입니다: ${data.employeeId}`);
        }
    }

    let departmentId = data.departmentId;

    // 부서 직접 입력 처리: 이름으로 ID 찾기 또는 생성
    if (!departmentId && data.departmentName) {
        const [existing] = await queryTable('department', { filters: { name: data.departmentName } });
        if (existing) {
            departmentId = existing.id;
        } else {
            const insertRes = await insertRows('department', [{
                
                name: data.departmentName,
                createdAt: new Date().toISOString()
            }]);
            const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
            departmentId = insertedRow.id;
        }
    }

    const { departmentName, ...cleanData } = data; // user 테이블에 없는 필드 제거
    const insertRes = await insertRows('user', [{
        ...cleanData,
        
        departmentId,
        username: data.username || `user_${data.employeeId || Date.now()}`,
        password: hashPassword('1234'), // 기본 패스워드 설정
        isActive: 1,
        createdAt: new Date().toISOString()
    }]);
    const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
    const userId = insertedRow.id;

    revalidatePath('/admin/organization');
    return { success: true };
}

/**
 * 👥 유저(멤버) 정보 단건 수정
 */
export async function updateMemberAction(memberId: string, data: any) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') throw new Error('권한 부족');

    let departmentId = data.departmentId;

    // 부서 직접 입력 처리: 이름으로 ID 찾기 또는 생성
    if (!departmentId && data.departmentName) {
        const [existing] = await queryTable('department', { filters: { name: data.departmentName } });
        if (existing) {
            departmentId = existing.id;
        } else {
            const insertRes = await insertRows('department', [{
                
                name: data.departmentName,
                createdAt: new Date().toISOString()
            }]);
            const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
            departmentId = insertedRow.id;
        }
    }

    const { departmentName, ...cleanData } = data; // user 테이블에 없는 필드 제거
    await updateRows('user', { ...cleanData, departmentId }, { filters: { id: memberId } });
    
    revalidatePath('/admin/organization');
    return { success: true };
}

/**
 * 👥 유저(멤버) 삭제 (비활성화)
 */
export async function deleteMemberAction(memberId: string) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') throw new Error('권한 부족');

    // 실제 삭제 대신 비활성화 처리 추천
    await updateRows('user', { isActive: 0 }, { filters: { id: memberId } });
    
    revalidatePath('/admin/organization');
    return { success: true };
}

/**
 * 📊 엑셀 조직도 데이터 일괄 동기화 (Master Sync)
 * 엑셀 행: [부서, 직위, 이름, 사원번호, 이메일]
 */
export async function syncOrganizationExcelAction(excelRows: any[]) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') throw new Error('권한 부족');

    console.log(`[Org Sync] Starting sync for ${excelRows.length} rows...`);

    // 1. 현재 부서 목록 로드 (캐싱용)
    const existingDepts = await queryTable('department');
    const deptMap = new Map(existingDepts.map((d: any) => [d.name, d.id]));

    // 2. 현재 유저 목록 로드 (사원번호 기준 매핑용)
    const existingUsers = await queryTable('user');
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

        // 부서가 없으면 자동 생성
        let deptId = deptMap.get(deptName);
        if (deptName && !deptId) {
            const insertRes = await insertRows('department', [{
                
                name: deptName,
                createdAt: new Date().toISOString()
            }]);
            const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
            deptId = insertedRow.id;
            deptMap.set(deptName, deptId);
            stats.deptsCreated++;
        }

        const userId = userMap.get(employeeId);
        if (userId) {
            // 정보 업데이트 (Upsert)
            await updateRows('user', {
                fullName,
                email,
                departmentId: deptId || null,
                position: position || null
            }, { filters: { id: userId } });
            stats.updated++;
        } else {
            // 신규 유저 생성
            usersToInsert.push({
                
                username: `user_${employeeId}`, // 기본 유저네임
                fullName,
                email,
                employeeId,
                departmentId: deptId || null,
                position: position || null,
                role: 'VIEWER',
                isActive: 1,
                createdAt: new Date().toISOString()
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
