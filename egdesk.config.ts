/**
 * EGDesk User Data Configuration
 * Generated at: 2026-06-01T03:15:45.742Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '7a04500c-83ee-4dac-91de-18733863e83a',
} as const;

export interface TableDefinition {
  name: string;
  displayName: string;
  description?: string;
  /** Omitted or unknown until synced / counted */
  rowCount?: number;
  columnCount: number;
  columns: string[];
}

export const TABLES = {
  table1: {
    name: 'ibk_loan_transactions',
    displayName: 'IBK 대출거래내역',
    description: '재생성된 IBK 대출거래내역 (Mock/빈 테이블)',
    rowCount: 0,
    columnCount: 14,
    columns: ['id', 'account_number', 'transaction_date', 'transaction_type', 'currency', 'transaction_amount', 'principal_amount', 'interest_amount', 'loan_balance', 'interest_rate', 'start_date', 'end_date', 'status', 'synced_at']
  } as TableDefinition,
  table2: {
    name: 'system_settings',
    displayName: 'System Settings',
    description: 'System Settings Table for EGDesk Dashboard',
    rowCount: 1,
    columnCount: 13,
    columns: ['id', 'legacyId', 'companyName', 'logoUrl', 'themeColor', 'businessContext', 'geminiApiKey', 'isInitialized', 'backupScheduleEnabled', 'backupScheduleDays', 'backupScheduleTime', 'backupRetentionCount', 'updatedAt']
  } as TableDefinition,
  table3: {
    name: 'dashboard_chart',
    displayName: 'Dashboard Chart Widgets',
    rowCount: 32,
    columnCount: 10,
    columns: ['id', 'userId', 'config', 'layout', 'isSample', '__is_deleted', '__deleted_at', 'orderIndex', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table4: {
    name: 'ai_studio_sessions',
    displayName: 'AI Studio Session',
    rowCount: 2,
    columnCount: 6,
    columns: ['id', 'userId', 'data', 'updatedAt', '__is_deleted', '__deleted_at']
  } as TableDefinition,
  table5: {
    name: 'form_submissions',
    displayName: 'Form Submissions',
    rowCount: 0,
    columnCount: 11,
    columns: ['id', 'templateId', 'userId', 'customerData', 'manualInputs', '__created_at', '__updated_at', '__creator_id', '__modifier_id', '__is_deleted', '__deleted_at']
  } as TableDefinition,
  table6: {
    name: 'form_studio_templates',
    displayName: 'Form Studio Templates',
    rowCount: 0,
    columnCount: 14,
    columns: ['id', 'name', 'formType', 'backgroundImageData', 'mappingConfig', 'webLayoutConfig', 'sourceTable', 'status', '__created_at', '__updated_at', '__creator_id', '__modifier_id', '__is_deleted', '__deleted_at']
  } as TableDefinition,
  table7: {
    name: 'micro_app_projects',
    displayName: 'Micro App Project',
    rowCount: 1,
    columnCount: 14,
    columns: ['id', 'projectId', 'name', 'description', 'templateId', 'status', 'widgets', 'sources', 'mappingConfig', 'uiSettings', 'tags', 'themeColor', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table8: {
    name: 'table_master',
    displayName: 'Physical Table Registry',
    rowCount: 23,
    columnCount: 9,
    columns: ['id', 'tableName', 'displayName', 'category', 'schema', 'rowCount', 'isDeleted', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table9: {
    name: 'source_view_settings',
    displayName: 'Centralized Source View Settings',
    rowCount: 0,
    columnCount: 4,
    columns: ['id', 'sourceId', 'view_config', 'updatedAt']
  } as TableDefinition,
  table10: {
    name: 'table_knowledge',
    displayName: 'Table Intelligence Knowledge',
    rowCount: 0,
    columnCount: 14,
    columns: ['id', 'target_id', 'target_type', 'description', 'category', 'insight', 'schema_info', 'ai_rules', 'sample_rows', 'sample_analysis', 'version_number', 'is_current', 'status', 'updated_at']
  } as TableDefinition,
  table11: {
    name: 'micro_app_config',
    displayName: 'Micro App Configurations',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'projectId', 'templateId', 'sourceTableId', 'mappingConfig', 'uiSettings', 'rbacRoles', 'createdBy', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table12: {
    name: 'input_guardrail',
    displayName: 'Input Data Guardrails',
    rowCount: 0,
    columnCount: 8,
    columns: ['id', 'reportId', 'columnName', 'ruleType', 'ruleValue', 'errorMessage', 'isActive', 'createdAt']
  } as TableDefinition,
  table13: {
    name: 'department',
    displayName: 'Organization Departments',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'name', 'description', 'icon', 'metadata', 'createdAt']
  } as TableDefinition,
  table14: {
    name: 'action_task_history',
    displayName: 'Action Task History',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'taskId', 'oldStatus', 'newStatus', 'changedById', 'changedAt']
  } as TableDefinition,
  table15: {
    name: 'action_task',
    displayName: 'Action Tasks',
    rowCount: 0,
    columnCount: 13,
    columns: ['id', 'instanceId', 'reportId', 'title', 'description', 'type', 'status', 'assigneeId', 'assigneeRole', 'dueAt', 'metadata', 'completedAt', 'createdAt']
  } as TableDefinition,
  table16: {
    name: 'workflow_instance',
    displayName: 'Workflow Instances',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'templateId', 'triggerRowId', 'status', 'startedAt', 'completedAt']
  } as TableDefinition,
  table17: {
    name: 'workflow_template',
    displayName: 'Workflow Templates',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'name', 'triggerReportId', 'triggerCondition', 'tasks', 'createdAt']
  } as TableDefinition,
  table18: {
    name: 'notification',
    displayName: 'User Notifications',
    rowCount: 0,
    columnCount: 9,
    columns: ['id', 'userId', 'title', 'message', 'link', 'type', 'isRead', 'metadata', 'createdAt']
  } as TableDefinition,
  table19: {
    name: 'workspace_item',
    displayName: 'Workspace Image Items',
    rowCount: 0,
    columnCount: 16,
    columns: ['id', 'creatorId', 'imageUrl', 'originalText', 'suggestedTitle', 'suggestedSummary', 'aiData', 'status', 'reportId', 'rowId', 'metadata', 'createdAt', 'updatedAt', 'location_lat', 'location_lng', 'location_name']
  } as TableDefinition,
  table20: {
    name: 'dashboard_data_history',
    displayName: 'Dashboard Row History',
    rowCount: 232,
    columnCount: 7,
    columns: ['id', 'rowId', 'oldData', 'newData', 'changeType', 'changedById', 'changedAt']
  } as TableDefinition,
  table21: {
    name: 'dashboard_access',
    displayName: 'Dashboard Access Controls',
    rowCount: 0,
    columnCount: 8,
    columns: ['id', 'reportId', 'userId', 'departmentId', 'role', 'isBlocked', 'grantedAt', 'grantedBy']
  } as TableDefinition,
  table22: {
    name: 'dashboard_data',
    displayName: 'Dashboard Virtual Rows',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'reportId', 'data', 'contentHash', '__is_deleted', '__deleted_at', 'creatorId', 'updaterId', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table23: {
    name: 'workflow_steering',
    displayName: 'AI Workflow Steering',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'reportId', 'rowId', 'eventType', 'recommendation', 'reasoning', 'status', 'decidedById', 'decidedAt', 'createdAt']
  } as TableDefinition,
  table24: {
    name: 'dashboard_master',
    displayName: 'Dashboard Master Metadata',
    rowCount: 0,
    columnCount: 15,
    columns: ['id', 'reportId', 'name', 'sheetName', 'description', 'tableName', 'columns', 'uiConfig', 'aiConfig', 'isDeleted', 'deletedAt', 'ownerId', 'lastSerial', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table25: {
    name: 'user',
    displayName: 'System Users',
    rowCount: 1,
    columnCount: 12,
    columns: ['id', 'username', 'email', 'password', 'role', 'fullName', 'employeeId', 'departmentId', 'position', 'isActive', 'metadata', 'createdAt']
  } as TableDefinition
} as const;


// Main table (first table by default)
export const MAIN_TABLE = TABLES.table1;


// Helper to get table by name
export function getTableByName(tableName: string): TableDefinition | undefined {
  return Object.values(TABLES).find(t => t.name === tableName);
}

// Export table names for easy access
export const TABLE_NAMES = {
  table1: 'ibk_loan_transactions',
  table2: 'system_settings',
  table3: 'dashboard_chart',
  table4: 'ai_studio_sessions',
  table5: 'form_submissions',
  table6: 'form_studio_templates',
  table7: 'micro_app_projects',
  table8: 'table_master',
  table9: 'source_view_settings',
  table10: 'table_knowledge',
  table11: 'micro_app_config',
  table12: 'input_guardrail',
  table13: 'department',
  table14: 'action_task_history',
  table15: 'action_task',
  table16: 'workflow_instance',
  table17: 'workflow_template',
  table18: 'notification',
  table19: 'workspace_item',
  table20: 'dashboard_data_history',
  table21: 'dashboard_access',
  table22: 'dashboard_data',
  table23: 'workflow_steering',
  table24: 'dashboard_master',
  table25: 'user'
} as const;
