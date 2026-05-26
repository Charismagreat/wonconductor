/**
 * EGDesk User Data Configuration
 * Generated at: 2026-05-26T04:37:58.226Z
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
    name: 'system_settings',
    displayName: 'System Settings',
    description: 'System Settings Table for EGDesk Dashboard',
    rowCount: 1,
    columnCount: 13,
    columns: ['id', 'legacyId', 'companyName', 'logoUrl', 'themeColor', 'businessContext', 'geminiApiKey', 'isInitialized', 'backupScheduleEnabled', 'backupScheduleDays', 'backupScheduleTime', 'backupRetentionCount', 'updatedAt']
  } as TableDefinition,
  table2: {
    name: 'dashboard_chart',
    displayName: 'Dashboard Chart Widgets',
    rowCount: 15,
    columnCount: 10,
    columns: ['id', 'userId', 'config', 'layout', 'isSample', '__is_deleted', '__deleted_at', 'orderIndex', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table3: {
    name: 'ai_studio_sessions',
    displayName: 'AI Studio Session',
    rowCount: 2,
    columnCount: 6,
    columns: ['id', 'userId', 'data', 'updatedAt', '__is_deleted', '__deleted_at']
  } as TableDefinition,
  table4: {
    name: 'form_submissions',
    displayName: 'Form Submissions',
    rowCount: 0,
    columnCount: 11,
    columns: ['id', 'templateId', 'userId', 'customerData', 'manualInputs', '__created_at', '__updated_at', '__creator_id', '__modifier_id', '__is_deleted', '__deleted_at']
  } as TableDefinition,
  table5: {
    name: 'form_studio_templates',
    displayName: 'Form Studio Templates',
    rowCount: 0,
    columnCount: 14,
    columns: ['id', 'name', 'formType', 'backgroundImageData', 'mappingConfig', 'webLayoutConfig', 'sourceTable', 'status', '__created_at', '__updated_at', '__creator_id', '__modifier_id', '__is_deleted', '__deleted_at']
  } as TableDefinition,
  table6: {
    name: 'micro_app_projects',
    displayName: 'Micro App Project',
    rowCount: 1,
    columnCount: 14,
    columns: ['id', 'projectId', 'name', 'description', 'templateId', 'status', 'widgets', 'sources', 'mappingConfig', 'uiSettings', 'tags', 'themeColor', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table7: {
    name: 'table_master',
    displayName: 'Physical Table Registry',
    rowCount: 23,
    columnCount: 9,
    columns: ['id', 'tableName', 'displayName', 'category', 'schema', 'rowCount', 'isDeleted', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table8: {
    name: 'source_view_settings',
    displayName: 'Centralized Source View Settings',
    rowCount: 0,
    columnCount: 4,
    columns: ['id', 'sourceId', 'view_config', 'updatedAt']
  } as TableDefinition,
  table9: {
    name: 'table_knowledge',
    displayName: 'Table Intelligence Knowledge',
    rowCount: 0,
    columnCount: 14,
    columns: ['id', 'target_id', 'target_type', 'description', 'category', 'insight', 'schema_info', 'ai_rules', 'sample_rows', 'sample_analysis', 'version_number', 'is_current', 'status', 'updated_at']
  } as TableDefinition,
  table10: {
    name: 'micro_app_config',
    displayName: 'Micro App Configurations',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'projectId', 'templateId', 'sourceTableId', 'mappingConfig', 'uiSettings', 'rbacRoles', 'createdBy', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table11: {
    name: 'input_guardrail',
    displayName: 'Input Data Guardrails',
    rowCount: 0,
    columnCount: 8,
    columns: ['id', 'reportId', 'columnName', 'ruleType', 'ruleValue', 'errorMessage', 'isActive', 'createdAt']
  } as TableDefinition,
  table12: {
    name: 'department',
    displayName: 'Organization Departments',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'name', 'description', 'icon', 'metadata', 'createdAt']
  } as TableDefinition,
  table13: {
    name: 'action_task_history',
    displayName: 'Action Task History',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'taskId', 'oldStatus', 'newStatus', 'changedById', 'changedAt']
  } as TableDefinition,
  table14: {
    name: 'action_task',
    displayName: 'Action Tasks',
    rowCount: 0,
    columnCount: 13,
    columns: ['id', 'instanceId', 'reportId', 'title', 'description', 'type', 'status', 'assigneeId', 'assigneeRole', 'dueAt', 'metadata', 'completedAt', 'createdAt']
  } as TableDefinition,
  table15: {
    name: 'workflow_instance',
    displayName: 'Workflow Instances',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'templateId', 'triggerRowId', 'status', 'startedAt', 'completedAt']
  } as TableDefinition,
  table16: {
    name: 'workflow_template',
    displayName: 'Workflow Templates',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'name', 'triggerReportId', 'triggerCondition', 'tasks', 'createdAt']
  } as TableDefinition,
  table17: {
    name: 'notification',
    displayName: 'User Notifications',
    rowCount: 0,
    columnCount: 9,
    columns: ['id', 'userId', 'title', 'message', 'link', 'type', 'isRead', 'metadata', 'createdAt']
  } as TableDefinition,
  table18: {
    name: 'workspace_item',
    displayName: 'Workspace Image Items',
    rowCount: 0,
    columnCount: 16,
    columns: ['id', 'creatorId', 'imageUrl', 'originalText', 'suggestedTitle', 'suggestedSummary', 'aiData', 'status', 'reportId', 'rowId', 'metadata', 'createdAt', 'updatedAt', 'location_lat', 'location_lng', 'location_name']
  } as TableDefinition,
  table19: {
    name: 'dashboard_data_history',
    displayName: 'Dashboard Row History',
    rowCount: 198,
    columnCount: 7,
    columns: ['id', 'rowId', 'oldData', 'newData', 'changeType', 'changedById', 'changedAt']
  } as TableDefinition,
  table20: {
    name: 'dashboard_access',
    displayName: 'Dashboard Access Controls',
    rowCount: 0,
    columnCount: 8,
    columns: ['id', 'reportId', 'userId', 'departmentId', 'role', 'isBlocked', 'grantedAt', 'grantedBy']
  } as TableDefinition,
  table21: {
    name: 'dashboard_data',
    displayName: 'Dashboard Virtual Rows',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'reportId', 'data', 'contentHash', '__is_deleted', '__deleted_at', 'creatorId', 'updaterId', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table22: {
    name: 'workflow_steering',
    displayName: 'AI Workflow Steering',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'reportId', 'rowId', 'eventType', 'recommendation', 'reasoning', 'status', 'decidedById', 'decidedAt', 'createdAt']
  } as TableDefinition,
  table23: {
    name: 'dashboard_master',
    displayName: 'Dashboard Master Metadata',
    rowCount: 0,
    columnCount: 15,
    columns: ['id', 'reportId', 'name', 'sheetName', 'description', 'tableName', 'columns', 'uiConfig', 'aiConfig', 'isDeleted', 'deletedAt', 'ownerId', 'lastSerial', 'createdAt', 'updatedAt']
  } as TableDefinition,
  table24: {
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
  table1: 'system_settings',
  table2: 'dashboard_chart',
  table3: 'ai_studio_sessions',
  table4: 'form_submissions',
  table5: 'form_studio_templates',
  table6: 'micro_app_projects',
  table7: 'table_master',
  table8: 'source_view_settings',
  table9: 'table_knowledge',
  table10: 'micro_app_config',
  table11: 'input_guardrail',
  table12: 'department',
  table13: 'action_task_history',
  table14: 'action_task',
  table15: 'workflow_instance',
  table16: 'workflow_template',
  table17: 'notification',
  table18: 'workspace_item',
  table19: 'dashboard_data_history',
  table20: 'dashboard_access',
  table21: 'dashboard_data',
  table22: 'workflow_steering',
  table23: 'dashboard_master',
  table24: 'user'
} as const;
