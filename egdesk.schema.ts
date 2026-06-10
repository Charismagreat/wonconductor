/**
 * egdesk.schema.ts — committed seed schema
 *
 * COMMIT THIS FILE TO GIT.
 *
 * When someone opens this project in their EGDesk, these tables are created
 * automatically in their dev database on first server start.
 *
 * Unlike egdesk.config.ts (auto-generated, gitignored), this file is the
 * portable source of truth for your app's database structure.
 *
 * Edit this file when you add/remove tables or columns. Do NOT edit
 * egdesk.config.ts — EGDesk regenerates it from the live database.
 */

export const TABLES = {
  ibk_loan_transactions: {
    name: 'ibk_loan_transactions',
    displayName: 'IBK 대출거래내역',
    columns: ['account_number', 'transaction_date', 'transaction_type', 'currency', 'transaction_amount', 'principal_amount', 'interest_amount', 'loan_balance', 'interest_rate', 'start_date', 'end_date', 'status', 'synced_at'],
    columnCount: 13,
    rowCount: 0,
  },
  system_settings: {
    name: 'system_settings',
    displayName: 'System Settings',
    columns: ['legacyId', 'companyName', 'logoUrl', 'themeColor', 'businessContext', 'geminiApiKey', 'isInitialized', 'backupScheduleEnabled', 'backupScheduleDays', 'backupScheduleTime', 'backupRetentionCount', 'updatedAt'],
    columnCount: 12,
    rowCount: 0,
  },
  dashboard_chart: {
    name: 'dashboard_chart',
    displayName: 'Dashboard Chart Widgets',
    columns: ['userId', 'config', 'layout', 'isSample', '__is_deleted', '__deleted_at', 'orderIndex', 'createdAt', 'updatedAt'],
    columnCount: 9,
    rowCount: 0,
  },
  ai_studio_sessions: {
    name: 'ai_studio_sessions',
    displayName: 'AI Studio Session',
    columns: ['userId', 'data', 'updatedAt', '__is_deleted', '__deleted_at'],
    columnCount: 5,
    rowCount: 0,
  },
  form_submissions: {
    name: 'form_submissions',
    displayName: 'Form Submissions',
    columns: ['templateId', 'userId', 'customerData', 'manualInputs', '__created_at', '__updated_at', '__creator_id', '__modifier_id', '__is_deleted', '__deleted_at'],
    columnCount: 10,
    rowCount: 0,
  },
  form_studio_templates: {
    name: 'form_studio_templates',
    displayName: 'Form Studio Templates',
    columns: ['name', 'formType', 'backgroundImageData', 'mappingConfig', 'webLayoutConfig', 'sourceTable', 'status', '__created_at', '__updated_at', '__creator_id', '__modifier_id', '__is_deleted', '__deleted_at'],
    columnCount: 13,
    rowCount: 0,
  },
  micro_app_projects: {
    name: 'micro_app_projects',
    displayName: 'Micro App Project',
    columns: ['projectId', 'name', 'description', 'templateId', 'status', 'widgets', 'sources', 'mappingConfig', 'uiSettings', 'tags', 'themeColor', 'createdAt', 'updatedAt'],
    columnCount: 13,
    rowCount: 0,
  },
  table_master: {
    name: 'table_master',
    displayName: 'Physical Table Registry',
    columns: ['tableName', 'displayName', 'category', 'schema', 'rowCount', 'isDeleted', 'createdAt', 'updatedAt'],
    columnCount: 8,
    rowCount: 0,
  },
  source_view_settings: {
    name: 'source_view_settings',
    displayName: 'Centralized Source View Settings',
    columns: ['sourceId', 'view_config', 'updatedAt'],
    columnCount: 3,
    rowCount: 0,
  },
  table_knowledge: {
    name: 'table_knowledge',
    displayName: 'Table Intelligence Knowledge',
    columns: ['target_id', 'target_type', 'description', 'category', 'insight', 'schema_info', 'ai_rules', 'sample_rows', 'sample_analysis', 'version_number', 'is_current', 'status', 'updated_at'],
    columnCount: 13,
    rowCount: 0,
  },
  micro_app_config: {
    name: 'micro_app_config',
    displayName: 'Micro App Configurations',
    columns: ['projectId', 'templateId', 'sourceTableId', 'mappingConfig', 'uiSettings', 'rbacRoles', 'createdBy', 'createdAt', 'updatedAt'],
    columnCount: 9,
    rowCount: 0,
  },
  input_guardrail: {
    name: 'input_guardrail',
    displayName: 'Input Data Guardrails',
    columns: ['reportId', 'columnName', 'ruleType', 'ruleValue', 'errorMessage', 'isActive', 'createdAt'],
    columnCount: 7,
    rowCount: 0,
  },
  department: {
    name: 'department',
    displayName: 'Organization Departments',
    columns: ['name', 'description', 'icon', 'metadata', 'createdAt'],
    columnCount: 5,
    rowCount: 0,
  },
  action_task_history: {
    name: 'action_task_history',
    displayName: 'Action Task History',
    columns: ['taskId', 'oldStatus', 'newStatus', 'changedById', 'changedAt'],
    columnCount: 5,
    rowCount: 0,
  },
  action_task: {
    name: 'action_task',
    displayName: 'Action Tasks',
    columns: ['instanceId', 'reportId', 'title', 'description', 'type', 'status', 'assigneeId', 'assigneeRole', 'dueAt', 'metadata', 'completedAt', 'createdAt'],
    columnCount: 12,
    rowCount: 0,
  },
  workflow_instance: {
    name: 'workflow_instance',
    displayName: 'Workflow Instances',
    columns: ['templateId', 'triggerRowId', 'status', 'startedAt', 'completedAt'],
    columnCount: 5,
    rowCount: 0,
  },
  workflow_template: {
    name: 'workflow_template',
    displayName: 'Workflow Templates',
    columns: ['name', 'triggerReportId', 'triggerCondition', 'tasks', 'createdAt'],
    columnCount: 5,
    rowCount: 0,
  },
  notification: {
    name: 'notification',
    displayName: 'User Notifications',
    columns: ['userId', 'title', 'message', 'link', 'type', 'isRead', 'metadata', 'createdAt'],
    columnCount: 8,
    rowCount: 0,
  },
  workspace_item: {
    name: 'workspace_item',
    displayName: 'Workspace Image Items',
    columns: ['creatorId', 'imageUrl', 'originalText', 'suggestedTitle', 'suggestedSummary', 'aiData', 'status', 'reportId', 'rowId', 'metadata', 'createdAt', 'updatedAt', 'location_lat', 'location_lng', 'location_name'],
    columnCount: 15,
    rowCount: 0,
  },
  dashboard_data_history: {
    name: 'dashboard_data_history',
    displayName: 'Dashboard Row History',
    columns: ['rowId', 'oldData', 'newData', 'changeType', 'changedById', 'changedAt'],
    columnCount: 6,
    rowCount: 0,
  },
  dashboard_access: {
    name: 'dashboard_access',
    displayName: 'Dashboard Access Controls',
    columns: ['reportId', 'userId', 'departmentId', 'role', 'isBlocked', 'grantedAt', 'grantedBy'],
    columnCount: 7,
    rowCount: 0,
  },
  dashboard_data: {
    name: 'dashboard_data',
    displayName: 'Dashboard Virtual Rows',
    columns: ['reportId', 'data', 'contentHash', '__is_deleted', '__deleted_at', 'creatorId', 'updaterId', 'createdAt', 'updatedAt'],
    columnCount: 9,
    rowCount: 0,
  },
  workflow_steering: {
    name: 'workflow_steering',
    displayName: 'AI Workflow Steering',
    columns: ['reportId', 'rowId', 'eventType', 'recommendation', 'reasoning', 'status', 'decidedById', 'decidedAt', 'createdAt'],
    columnCount: 9,
    rowCount: 0,
  },
  dashboard_master: {
    name: 'dashboard_master',
    displayName: 'Dashboard Master Metadata',
    columns: ['reportId', 'name', 'sheetName', 'description', 'tableName', 'columns', 'uiConfig', 'aiConfig', 'isDeleted', 'deletedAt', 'ownerId', 'lastSerial', 'createdAt', 'updatedAt'],
    columnCount: 14,
    rowCount: 0,
  },
  user: {
    name: 'user',
    displayName: 'System Users',
    columns: ['username', 'email', 'password', 'role', 'fullName', 'employeeId', 'departmentId', 'position', 'isActive', 'metadata', 'createdAt'],
    columnCount: 11,
    rowCount: 0,
  }
} as const;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];
