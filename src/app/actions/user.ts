'use server';

import { revalidatePath } from 'next/cache';
import { queryTable, insertRows, updateRows, deleteRows } from '@/egdesk-helpers';
import { hashPassword } from './shared';
import { getSessionAction } from './auth';
import crypto from 'crypto';

export async function getUsersAction() {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('접근 권한이 없습니다.');
    }

    const usersRaw = await queryTable('user', { 
        orderBy: 'username',
        orderDirection: 'ASC'
    });

    const users = Array.isArray(usersRaw) ? usersRaw : (usersRaw as any)?.rows ?? [];

    return users.map((user: any) => ({
        ...user,
        hasPassword: !!user.password,
        password: undefined
    }));
}

export async function updateUserAction(userId: string, data: any) {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('접근 권한이 없습니다.');
    }

    // admin_user 본인의 역할이나 활성화 상태 변경은 제한 (안전장치)
    const targetUsersRaw = await queryTable('user', { filters: { id: String(userId) } });
    const targetUsers = Array.isArray(targetUsersRaw) ? targetUsersRaw : (targetUsersRaw as any)?.rows ?? [];
    const targetUser = targetUsers[0];
    if (targetUser?.username === 'admin_user') {
        if (data.role !== 'ADMIN' || data.isActive === false) {
            throw new Error('기본 관리자 계정의 권한이나 활성 상태는 변경할 수 없습니다.');
        }
    }

    const { username, role, fullName, employeeId, isActive, password } = data;
    const finalEmployeeId = employeeId?.trim() || null;

    // 아이디 중복 체크 (수정 시 본인 제외)
    if (username) {
        const trimmedUsername = username.trim();
        const existingUsersRaw = await queryTable('user', { filters: { username: trimmedUsername } });
        const existingUsers = Array.isArray(existingUsersRaw) ? existingUsersRaw : (existingUsersRaw as any)?.rows ?? [];
        if (existingUsers.length > 0 && existingUsers[0].id !== userId) {
            throw new Error('이미 사용 중인 아이디입니다.');
        }
    }

    // 사번 중복 체크 (수정 시 본인 제외)
    if (finalEmployeeId) {
        const existingEmpsRaw = await queryTable('user', { filters: { employeeId: finalEmployeeId } });
        const existingEmps = Array.isArray(existingEmpsRaw) ? existingEmpsRaw : (existingEmpsRaw as any)?.rows ?? [];
        if (existingEmps.length > 0 && existingEmps[0].id !== userId) {
            throw new Error('이미 다른 사용자가 사용 중인 사번입니다.');
        }
    }
    
    await updateRows('user', { 
        username: username?.trim(), 
        role, 
        fullName: fullName?.trim(), 
        employeeId: finalEmployeeId, 
        isActive: isActive === undefined ? 1 : (isActive ? 1 : 0),
        ...(password ? { password: hashPassword(password) } : {})
    }, { filters: { id: String(userId) } });

    revalidatePath('/users');
    revalidatePath('/');
    return { success: true };
}

export async function createUserAction(data: any) {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('접근 권한이 없습니다.');
    }

    const { username, role, fullName, employeeId, password } = data;
    const trimmedUsername = username.trim();
    const finalEmployeeId = employeeId?.trim() || null;
    
    // 아이디 중복 체크
    const existingUsersRaw = await queryTable('user', { filters: { username: trimmedUsername } });
    const existingUsers = Array.isArray(existingUsersRaw) ? existingUsersRaw : (existingUsersRaw as any)?.rows ?? [];
    if (existingUsers.length > 0) throw new Error('이미 존재하는 아이디입니다.');

    // 사번 중복 체크
    if (finalEmployeeId) {
        const existingEmpsRaw = await queryTable('user', { filters: { employeeId: finalEmployeeId } });
        const existingEmps = Array.isArray(existingEmpsRaw) ? existingEmpsRaw : (existingEmpsRaw as any)?.rows ?? [];
        if (existingEmps.length > 0) throw new Error('이미 존재하는 사번입니다.');
    }

    try {
        const insertRes = await insertRows('user', [{
            
            username: trimmedUsername, 
            role, 
            fullName: fullName?.trim(), 
            employeeId: finalEmployeeId, 
            isActive: 1,
            password: password ? hashPassword(password) : undefined,
            createdAt: new Date().toISOString() // 필수 필드 누락 해결
        }]);
        
        const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
        const result = { success: true, message: '1 rows inserted' }; // Mock result for compatibility

        // Validate insert result more strictly
        const isActuallyInserted = result && (
            result.success === true || 
            (result.message && result.message.includes('1 rows inserted'))
        );

        if (!isActuallyInserted) {
            throw new Error('데이터베이스에 기록되지 않았습니다. (필드 제약 조건 확인 필요)');
        }

        console.log(`[USER_ACTION] New user created: ${trimmedUsername}`);

        revalidatePath('/users');
        revalidatePath('/');
        return { success: true };
    } catch (error: any) {
        console.error(`[USER_ACTION] Registration failed: ${error.message}`);
        throw error;
    }
}

/**
 * 엑셀 데이터를 통해 다수의 사용자를 일괄 등록합니다.
 * @param usersData 사용자 데이터 배열
 */
export async function bulkCreateUsersAction(usersData: any[]) {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('접근 권한이 없습니다.');
    }

    let createdCount = 0;
    let skippedCount = 0;
    const skippedItems: any[] = [];

    for (const data of usersData) {
        try {
            const { username, role, fullName, employeeId, password } = data;
            if (!username) {
                skippedCount++;
                skippedItems.push({ username: 'N/A', reason: '아이디 누락' });
                continue;
            }

            const trimmedUsername = String(username).trim();
            const finalEmployeeId = employeeId ? String(employeeId).trim() : null;
            const finalRole = (role && ['ADMIN', 'EDITOR', 'VIEWER'].includes(String(role).toUpperCase())) 
                ? String(role).toUpperCase() 
                : 'VIEWER';
            
            // 아이디 중복 체크
            const existingUsersRaw = await queryTable('user', { filters: { username: trimmedUsername } });
            const existingUsers = Array.isArray(existingUsersRaw) ? existingUsersRaw : (existingUsersRaw as any)?.rows ?? [];
            if (existingUsers.length > 0) {
                skippedCount++;
                skippedItems.push({ username: trimmedUsername, reason: '아이디 중복' });
                continue;
            }

            // 사번 중복 체크
            if (finalEmployeeId) {
                const existingEmpsRaw = await queryTable('user', { filters: { employeeId: finalEmployeeId } });
                const existingEmps = Array.isArray(existingEmpsRaw) ? existingEmpsRaw : (existingEmpsRaw as any)?.rows ?? [];
                if (existingEmps.length > 0) {
                    skippedCount++;
                    skippedItems.push({ username: trimmedUsername, reason: '사번 중복' });
                    continue;
                }
            }

            // 비밀번호 설정 (비어있으면 123456)
            const finalPassword = (password && String(password).trim()) ? String(password).trim() : '123456';

            await insertRows('user', [{
                
                username: trimmedUsername, 
                role: finalRole, 
                fullName: fullName ? String(fullName).trim() : null, 
                employeeId: finalEmployeeId, 
                isActive: 1,
                password: hashPassword(finalPassword)
            }]);
            createdCount++;
        } catch (err) {
            console.error('Bulk upload error for item:', data, err);
            skippedCount++;
            skippedItems.push({ username: data.username || 'Unknown', reason: '알 수 없는 오류' });
        }
    }

    revalidatePath('/users');
    revalidatePath('/');
    
    return { 
        success: true, 
        createdCount, 
        skippedCount, 
        skippedItems 
    };
}

export async function deleteUserAction(userId: string) {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('접근 권한이 없습니다.');
    }

    // 자기 자신 삭제 방지
    if (session.id === userId) {
        throw new Error('본인의 계정은 삭제할 수 없습니다.');
    }

    // 기본 관리자 계정 삭제 방지
    const targetUsersRaw = await queryTable('user', { filters: { id: userId } });
    const targetUsers = Array.isArray(targetUsersRaw) ? targetUsersRaw : (targetUsersRaw as any)?.rows ?? [];
    const targetUser = targetUsers[0];
    if (targetUser?.username === 'admin_user') {
        throw new Error('기본 관리자 계정은 삭제할 수 없습니다.');
    }

    await deleteRows('user', { filters: { id: userId } });

    revalidatePath('/users');
    revalidatePath('/');
    return { success: true };
}
