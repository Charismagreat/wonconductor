'use server';

import { queryTable, insertRows } from '@/egdesk-helpers';
import { revalidatePath } from 'next/cache';

/**
 * 마스터 테이블에서 명칭으로 정보를 검색합니다. (범용)
 * [Soft Delete] 삭제되지 않은 데이터(__is_deleted = 0)만 검색합니다.
 */
export async function searchMasterAction(tableName: string, query: string, lookupField: string = 'name') {
    try {
        // [Soft Delete] 필터 추가
        const results = await queryTable(tableName, { 
            filters: { __is_deleted: '0' },
            limit: 50
        });
        
        const searchTerms = query.toLowerCase().trim();
        if (!searchTerms) return results.slice(0, 10);

        return results.filter((c: any) => 
            (c[lookupField] || '').toLowerCase().includes(searchTerms) ||
            (c.id?.toString() || '').includes(searchTerms) ||
            (c.businessNumber || '').includes(searchTerms)
        );
    } catch (error) {
        console.error(`searchMasterAction Error [${tableName}]:`, error);
        return [];
    }
}

/**
 * 신규 데이터를 마스터 테이블에 등록합니다. (범용)
 */
export async function createMasterAction(tableName: string, name: string, lookupField: string = 'name') {
    try {
        const now = new Date().toISOString();
        const newData = {
            [lookupField]: name,
            createdAt: now,
            __created_at: now,
            __updated_at: now,
            __is_deleted: 0
        };
        
        const result = await insertRows(tableName, [newData]);
        const inserted = Array.isArray(result) ? result[0] : result;
        
        revalidatePath('/');
        return { success: true, item: inserted };
    } catch (error: any) {
        console.error(`createMasterAction Error [${tableName}]:`, error);
        return { success: false, error: error.message };
    }
}
