'use server';

import { createTable, queryTable, executeSQL, listTables } from '@/egdesk-helpers';

/**
 * 폼 스튜디오에 필요한 테이블들이 없으면 생성합니다.
 */
export async function initFormStudioTables() {
  try {
    const result = await listTables();
    const existingTables = Array.isArray(result) ? result : (result?.tables || []);
    const tableNames = new Set(existingTables.map((t: any) => 
        (typeof t === 'string' ? t : (t.tableName || t.name))?.toLowerCase()
    ));
    
    // 1. form_templates 테이블 생성
    if (!tableNames.has('form_templates')) {
      await createTable('Form Templates', [
        { name: 'name', type: 'TEXT' },
        { name: 'backgroundImageData', type: 'TEXT' }, // Base64 image
        { name: 'mappingConfig', type: 'TEXT' }, // JSON string of mapped fields
        { name: 'sourceTable', type: 'TEXT' }, // e.g. finance-hub-bank-table
        { name: 'status', type: 'TEXT' }, // DRAFT, PUBLISHED
        { name: 'createdAt', type: 'TEXT' }
      ], { 
        tableName: 'form_templates', 
        uniqueKeyColumns: ['id'], 
        duplicateAction: 'update' 
      });
    }

    // 2. form_submissions 테이블 생성
    if (!tableNames.has('form_submissions')) {
      await createTable('Form Submissions', [
        { name: 'templateId', type: 'INTEGER' },
        { name: 'userId', type: 'TEXT' },
        { name: 'customerData', type: 'TEXT' }, // JSON string
        { name: 'manualInputs', type: 'TEXT' }, // JSON string
        { name: 'createdAt', type: 'TEXT' }
      ], { 
        tableName: 'form_submissions', 
        uniqueKeyColumns: ['id'], 
        duplicateAction: 'update' 
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to init form studio tables:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 새로운 템플릿 저장 (또는 업데이트)
 */
export async function saveFormTemplateAction(data: {
  id?: number;
  name: string;
  backgroundImageData: string;
  mappingConfig: string;
  sourceTable: string;
  status: 'DRAFT' | 'PUBLISHED';
}) {
  try {
    await initFormStudioTables();

    let query = '';
    let params: any[] = [];

    if (data.id) {
      // Update existing
      query = `UPDATE form_templates SET name = ?, backgroundImageData = ?, mappingConfig = ?, sourceTable = ?, status = ? WHERE id = ?`;
      params = [data.name, data.backgroundImageData, data.mappingConfig, data.sourceTable, data.status, data.id];
    } else {
      // Insert new
      query = `INSERT INTO form_templates (name, backgroundImageData, mappingConfig, sourceTable, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)`;
      params = [data.name, data.backgroundImageData, data.mappingConfig, data.sourceTable, data.status, new Date().toISOString()];
    }

    const result = await executeSQL(query, params);
    
    // 삽입된 ID를 가져오기 위해 최근 추가된 레코드 조회 (SQLite의 last_insert_rowid() 대용)
    if (!data.id) {
        const lastRecord = await executeSQL('SELECT id FROM form_templates ORDER BY id DESC LIMIT 1');
        return { success: true, id: lastRecord[0]?.id };
    }

    return { success: true, id: data.id };
  } catch (error: any) {
    console.error('Failed to save form template:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 템플릿 목록 조회
 */
export async function listFormTemplatesAction(status?: 'DRAFT' | 'PUBLISHED') {
  try {
    await initFormStudioTables();
    let query = 'SELECT * FROM form_templates';
    let params: any[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY id DESC';
    const templatesResult = await executeSQL(query, params);
    const templates = Array.isArray(templatesResult) ? templatesResult : (templatesResult?.rows || []);
    return { success: true, templates };
  } catch (error: any) {
    console.error('Failed to list form templates:', error);
    return { success: false, error: error.message, templates: [] };
  }
}

/**
 * 단일 템플릿 조회
 */
export async function getFormTemplateAction(id: number) {
  try {
    await initFormStudioTables();
    const resultRaw = await executeSQL('SELECT * FROM form_templates WHERE id = ?', [id]);
    const result = Array.isArray(resultRaw) ? resultRaw : (resultRaw?.rows || []);
    if (result && result.length > 0) {
      return { success: true, template: result[0] };
    }
    return { success: false, error: '템플릿을 찾을 수 없습니다.' };
  } catch (error: any) {
    console.error('Failed to get form template:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 제출된 문서 저장 (사원용)
 */
export async function saveFormSubmissionAction(data: {
  templateId: number;
  userId: string;
  customerData: string;
  manualInputs: string;
}) {
  try {
    await initFormStudioTables();
    const query = `INSERT INTO form_submissions (templateId, userId, customerData, manualInputs, createdAt) VALUES (?, ?, ?, ?, ?)`;
    const params = [data.templateId, data.userId, data.customerData, data.manualInputs, new Date().toISOString()];
    await executeSQL(query, params);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save form submission:', error);
    return { success: false, error: error.message };
  }
}
