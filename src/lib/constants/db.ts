/**
 * 물리 테이블에 공통으로 삽입될 시스템 컬럼 정의
 */
export const SYSTEM_COLUMNS = {
    CREATED_AT: {
        name: '__created_at',
        displayName: '생성일시',
        type: 'date',
        isRequired: true,
        isSystem: true
    },
    UPDATED_AT: {
        name: '__updated_at',
        displayName: '수정일시',
        type: 'date',
        isRequired: true,
        isSystem: true
    },
    CREATOR_ID: {
        name: '__creator_id',
        displayName: '작성자',
        type: 'string',
        isRequired: true,
        isSystem: true
    }
} as const;

export const SYSTEM_COLUMN_LIST = Object.values(SYSTEM_COLUMNS);
