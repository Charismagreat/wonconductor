import crypto from 'crypto';
import { queryTable } from '@/egdesk-helpers';

// Password Security Utilities
export const SALT_SIZE = 16;
export const KEY_LEN = 64;


export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(SALT_SIZE).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
    return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
    if (!storedHash) return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, hash] = parts;
    const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
    return derivedKey.toString('hex') === hash;
}

/**
 * 보고서에 대한 사용자의 접근 권한을 확인합니다.
 * ADMIN, EDITOR는 모든 권한을 가지며, VIEWER는 명시적으로 권한이 부여되었거나 소유자인 경우에만 허용합니다.
 */
export async function checkReportAuthorization(reportId: string, userId: string, role: string) {
    if (role === 'ADMIN' || role === 'EDITOR') return true;
    
    // getMasterRecords는 report.ts에서 정의한 것을 가져오거나 여기 내부 로직으로 대체
    const isNumeric = /^\d+$/.test(String(reportId));
    const filters = isNumeric ? { id: String(reportId) } : { reportId: String(reportId) };
    const reportsRaw = await queryTable('dashboard_master', { filters });
    const reportsArr = Array.isArray(reportsRaw) ? reportsRaw : (reportsRaw as any)?.rows ?? [];
    const report = reportsArr[0];

    if (!report) return false;
    if (report.ownerId === userId) return true;

    // 1. 개별 사용자 권한 확인 (차단 여부 우선 확인)
    const userAccessRaw = await queryTable('dashboard_access', {
        filters: { reportId: String(reportId), userId: String(userId) }
    });
    const userAccess = Array.isArray(userAccessRaw) ? userAccessRaw : (userAccessRaw as any)?.rows ?? [];
    
    // 명시적으로 차단된 경우
    if (userAccess.some((a: any) => String(a.isBlocked) === '1' || Number(a.isBlocked) === 1)) return false;
    // 명시적으로 허용된 기록이 있는 경우
    if (userAccess.length > 0) return true;

    // 2. 부서 권한 확인
    const usersRaw = await queryTable('user', { filters: { id: String(userId) } });
    const usersArr = Array.isArray(usersRaw) ? usersRaw : (usersRaw as any)?.rows ?? [];
    const user = usersArr[0];
    if (user && user.departmentId) {
        const deptAccessRaw = await queryTable('dashboard_access', {
            filters: { reportId: String(reportId), departmentId: String(user.departmentId) }
        });
        const deptAccess = Array.isArray(deptAccessRaw) ? deptAccessRaw : (deptAccessRaw as any)?.rows ?? [];
        
        // 부서 차단 확인
        if (deptAccess.some((a: any) => String(a.isBlocked) === '1' || Number(a.isBlocked) === 1)) return false;
        // 부서 허용 확인
        if (deptAccess.length > 0) return true;
    }
    
    // 기본 정책: 허용 (사용자 요청에 따라 Whitelist에서 Blacklist 방식으로 전환)
    return true;
}

/**
 * 필수 시스템 테이블 스키마 정의 (Self-Healing 용)
 */
export const SYSTEM_TABLES = [
    {
        tableName: 'user', displayName: 'System Users', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'username', type: 'TEXT', notNull: true },
            { name: 'email', type: 'TEXT' },
            { name: 'password', type: 'TEXT' },
            { name: 'role', type: 'TEXT', notNull: true, defaultValue: 'VIEWER' },
            { name: 'fullName', type: 'TEXT' },
            { name: 'employeeId', type: 'TEXT' }, // 사원번호
            { name: 'departmentId', type: 'TEXT' }, // 소속 부서 ID
            { name: 'position', type: 'TEXT' }, // 직위 (팀장, 사원 등)
            { name: 'isActive', type: 'INTEGER', defaultValue: 1 },
            { name: 'metadata', type: 'TEXT' }, // 샘플 데이터 태깅 용도
            { name: 'createdAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'dashboard_master', displayName: 'Dashboard Master Metadata', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'reportId', type: 'TEXT', unique: true },
            { name: 'name', type: 'TEXT', notNull: true },
            { name: 'sheetName', type: 'TEXT' },
            { name: 'description', type: 'TEXT' },
            { name: 'tableName', type: 'TEXT', notNull: true },
            { name: 'columns', type: 'TEXT', notNull: true },
            { name: 'uiConfig', type: 'TEXT' },
            { name: 'aiConfig', type: 'TEXT' },
            { name: 'isDeleted', type: 'INTEGER', defaultValue: 0 },
            { name: 'deletedAt', type: 'TEXT' },
            { name: 'ownerId', type: 'TEXT', notNull: true },
            { name: 'lastSerial', type: 'INTEGER', defaultValue: 0 },
            { name: 'createdAt', type: 'TEXT', notNull: true },
            { name: 'updatedAt', type: 'TEXT' }
        ] as any[]
    },
    {
        tableName: 'workflow_steering', displayName: 'AI Workflow Steering', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'reportId', type: 'TEXT', notNull: true },
            { name: 'rowId', type: 'TEXT' },
            { name: 'eventType', type: 'TEXT', defaultValue: 'INSERT' },
            { name: 'recommendation', type: 'TEXT', notNull: true }, // JSON: { notify: [], task: {} }
            { name: 'reasoning', type: 'TEXT' }, 
            { name: 'status', type: 'TEXT', defaultValue: 'PENDING' },
            { name: 'decidedById', type: 'TEXT' },
            { name: 'decidedAt', type: 'TEXT' },
            { name: 'createdAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'dashboard_data', displayName: 'Dashboard Virtual Rows', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'reportId', type: 'TEXT', notNull: true },
            { name: 'data', type: 'TEXT', notNull: true },
            { name: 'contentHash', type: 'TEXT' },
            { name: '__is_deleted', type: 'INTEGER', defaultValue: 0 },
            { name: '__deleted_at', type: 'TEXT' },
            { name: 'creatorId', type: 'TEXT' },
            { name: 'updaterId', type: 'TEXT' },
            { name: 'createdAt', type: 'TEXT', notNull: true },
            { name: 'updatedAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'dashboard_access', displayName: 'Dashboard Access Controls', schema: [
            { name: 'reportId', type: 'TEXT', notNull: true },
            { name: 'userId', type: 'TEXT' }, // NULL 가능 (부서 권한일 경우)
            { name: 'departmentId', type: 'TEXT' }, // 부서 ID (사용자 권한일 경우 NULL)
            { name: 'role', type: 'TEXT', notNull: true, defaultValue: 'VIEWER' },
            { name: 'isBlocked', type: 'INTEGER', defaultValue: 0 },
            { name: 'grantedAt', type: 'TEXT', notNull: true },
            { name: 'grantedBy', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'dashboard_data_history', displayName: 'Dashboard Row History', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'rowId', type: 'TEXT', notNull: true },
            { name: 'oldData', type: 'TEXT' },
            { name: 'newData', type: 'TEXT' },
            { name: 'changeType', type: 'TEXT' },
            { name: 'changedById', type: 'TEXT' },
            { name: 'changedAt', type: 'TEXT' }
        ] as any[]
    },
    {
        tableName: 'workspace_item', displayName: 'Workspace Image Items', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'creatorId', type: 'TEXT' },
            { name: 'imageUrl', type: 'TEXT' },
            { name: 'originalText', type: 'TEXT' },
            { name: 'suggestedTitle', type: 'TEXT' },
            { name: 'suggestedSummary', type: 'TEXT' },
            { name: 'aiData', type: 'TEXT' },
            { name: 'status', type: 'TEXT', defaultValue: 'pending' },
            { name: 'reportId', type: 'TEXT' },
            { name: 'rowId', type: 'TEXT' },
            { name: 'metadata', type: 'TEXT' }, // 샘플 데이터 태깅 용도
            { name: 'createdAt', type: 'TEXT', notNull: true },
            { name: 'updatedAt', type: 'TEXT', notNull: true },
            { name: 'location_lat', type: 'REAL' },
            { name: 'location_lng', type: 'REAL' },
            { name: 'location_name', type: 'TEXT' }
        ] as any[]
    },
    {
        tableName: 'notification', displayName: 'User Notifications', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'userId', type: 'TEXT', notNull: true },
            { name: 'title', type: 'TEXT', notNull: true },
            { name: 'message', type: 'TEXT' },
            { name: 'link', type: 'TEXT' },
            { name: 'type', type: 'TEXT', defaultValue: 'INFO' },
            { name: 'isRead', type: 'INTEGER', defaultValue: 0 },
            { name: 'metadata', type: 'TEXT' }, // 샘플 데이터 태깅 용도
            { name: 'createdAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'workflow_template', displayName: 'Workflow Templates', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'name', type: 'TEXT', notNull: true },
            { name: 'triggerReportId', type: 'TEXT', notNull: true },
            { name: 'triggerCondition', type: 'TEXT' }, // JSON string
            { name: 'tasks', type: 'TEXT' }, // JSON string of task templates
            { name: 'createdAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'workflow_instance', displayName: 'Workflow Instances', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'templateId', type: 'TEXT', notNull: true },
            { name: 'triggerRowId', type: 'TEXT', notNull: true },
            { name: 'status', type: 'TEXT', defaultValue: 'RUNNING' },
            { name: 'startedAt', type: 'TEXT', notNull: true },
            { name: 'completedAt', type: 'TEXT' }
        ] as any[]
    },
    {
        tableName: 'action_task', displayName: 'Action Tasks', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'instanceId', type: 'TEXT' }, // 워크플로우 인스턴스와 배정된 경우
            { name: 'reportId', type: 'TEXT' }, // 특정 보고서와 직접 연결된 경우
            { name: 'title', type: 'TEXT', notNull: true },
            { name: 'description', type: 'TEXT' },
            { name: 'type', type: 'TEXT', defaultValue: 'TASK' },
            { name: 'status', type: 'TEXT', defaultValue: 'TODO' },
            { name: 'assigneeId', type: 'TEXT' },
            { name: 'assigneeRole', type: 'TEXT' },
            { name: 'dueAt', type: 'TEXT' },
            { name: 'metadata', type: 'TEXT' }, // 샘플 데이터 태깅 용도
            { name: 'completedAt', type: 'TEXT' },
            { name: 'createdAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'action_task_history', displayName: 'Action Task History', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'taskId', type: 'TEXT', notNull: true },
            { name: 'oldStatus', type: 'TEXT' },
            { name: 'newStatus', type: 'TEXT', notNull: true },
            { name: 'changedById', type: 'TEXT', notNull: true },
            { name: 'changedAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'department', displayName: 'Organization Departments', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'name', type: 'TEXT', notNull: true },
            { name: 'description', type: 'TEXT' },
            { name: 'icon', type: 'TEXT' },
            { name: 'metadata', type: 'TEXT' }, // 샘플 데이터 태깅 용도
            { name: 'createdAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'input_guardrail', displayName: 'Input Data Guardrails', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'reportId', type: 'TEXT' }, // NULL이면 전역 규칙
            { name: 'columnName', type: 'TEXT' },
            { name: 'ruleType', type: 'TEXT', notNull: true }, // regex, range, options, type_check 등
            { name: 'ruleValue', type: 'TEXT' },
            { name: 'errorMessage', type: 'TEXT' },
            { name: 'isActive', type: 'INTEGER', defaultValue: 1 },
            { name: 'createdAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'dashboard_chart', displayName: 'Dashboard Chart Widgets', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'userId', type: 'TEXT' },
            { name: 'config', type: 'TEXT', notNull: true }, // JSON content
            { name: 'layout', type: 'TEXT' }, // JSON content
            { name: 'isSample', type: 'INTEGER', defaultValue: 0 },
            { name: 'createdAt', type: 'TEXT', notNull: true },
            { name: 'updatedAt', type: 'TEXT' }
        ] as any[]
    },
    {
        tableName: 'micro_app_config', displayName: 'Micro App Configurations', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'projectId', type: 'TEXT', notNull: true },
            { name: 'templateId', type: 'TEXT', notNull: true },
            { name: 'sourceTableId', type: 'TEXT', notNull: true },
            { name: 'mappingConfig', type: 'TEXT' }, // JSON
            { name: 'uiSettings', type: 'TEXT' }, // JSON
            { name: 'rbacRoles', type: 'TEXT' }, // JSON
            { name: 'createdBy', type: 'TEXT' },
            { name: 'createdAt', type: 'TEXT', notNull: true },
            { name: 'updatedAt', type: 'TEXT' }
        ] as any[]
    },
    {
        tableName: 'table_knowledge', displayName: 'Table Intelligence Knowledge', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'target_id', type: 'TEXT', notNull: true }, // 물리 테이블명 또는 가상 리포트 ID
            { name: 'target_type', type: 'TEXT', notNull: true, defaultValue: 'PHYSICAL' }, // PHYSICAL | VIRTUAL
            { name: 'description', type: 'TEXT' },
            { name: 'category', type: 'TEXT' },
            { name: 'insight', type: 'TEXT' },
            { name: 'schema_info', type: 'TEXT' }, // JSON
            { name: 'ai_rules', type: 'TEXT' }, // JSON (Structured Guardrail Rules)
            { name: 'sample_rows', type: 'TEXT' }, // JSON
            { name: 'sample_analysis', type: 'TEXT' },
            { name: 'version_number', type: 'INTEGER', defaultValue: 1 },
            { name: 'is_current', type: 'INTEGER', defaultValue: 1 }, // 1: current, 0: archive
            { name: 'status', type: 'TEXT', defaultValue: 'ACTIVE' }, // ACTIVE | PROPOSED | ARCHIVED
            { name: 'updated_at', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'source_view_settings', displayName: 'Centralized Source View Settings', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'sourceId', type: 'TEXT', notNull: true }, // sourceTableId (slug)
            { name: 'view_config', type: 'TEXT', notNull: true }, // JSON: { columns: [{ name, displayName, order, visible, type }] }
            { name: 'updatedAt', type: 'TEXT', notNull: true }
        ] as any[]
    },
    {
        tableName: 'table_master', displayName: 'Physical Table Registry', schema: [
            { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
            { name: 'tableName', type: 'TEXT', unique: true, notNull: true },
            { name: 'displayName', type: 'TEXT' },
            { name: 'category', type: 'TEXT' }, // INDUSTRY, EXCEL, SYSTEM
            { name: 'schema', type: 'TEXT' }, // JSON Column Schema
            { name: 'rowCount', type: 'INTEGER', defaultValue: 0 },
            { name: 'isDeleted', type: 'INTEGER', defaultValue: 0 },
            { name: 'createdAt', type: 'TEXT', notNull: true },
            { name: 'updatedAt', type: 'TEXT' }
        ] as any[]
    }
];
