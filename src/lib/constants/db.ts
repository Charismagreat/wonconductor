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
    },
    MODIFIER_ID: {
        name: '__modifier_id',
        displayName: '수정자',
        type: 'string',
        isRequired: false,
        isSystem: true
    },
    IS_DELETED: {
        name: '__is_deleted',
        displayName: '삭제여부',
        type: 'number',
        isRequired: true,
        isSystem: true
    },
    DELETED_AT: {
        name: '__deleted_at',
        displayName: '삭제일시',
        type: 'date',
        isRequired: false,
        isSystem: true
    }
} as const;

export const SYSTEM_COLUMN_LIST = Object.values(SYSTEM_COLUMNS);
