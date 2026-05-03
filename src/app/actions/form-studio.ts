'use server';

import { createTable, queryTable, executeSQL, listTables, insertRows, updateRows } from '@/egdesk-helpers';

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

    if (data.id) {
      // Update existing
      await updateRows('form_templates', {
        name: data.name,
        backgroundImageData: data.backgroundImageData,
        mappingConfig: data.mappingConfig,
        sourceTable: data.sourceTable,
        status: data.status
      }, { filters: { id: String(data.id) } });
    } else {
      // Insert new
      await insertRows('form_templates', [{
        name: data.name,
        backgroundImageData: data.backgroundImageData,
        mappingConfig: data.mappingConfig,
        sourceTable: data.sourceTable,
        status: data.status,
        createdAt: new Date().toISOString(),
        __is_deleted: 0
      }]);
    }

    // 삽입된 ID를 가져오기 위해 최근 추가된 레코드 조회
    if (!data.id) {
        const lastRecords = await queryTable('form_templates', {
            orderBy: 'id',
            orderDirection: 'DESC',
            limit: 1
        });
        const lastRecord = Array.isArray(lastRecords) ? lastRecords[0] : (lastRecords?.rows?.[0]);
        return { success: true, id: lastRecord?.id };
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
    // queryTable might not support OR conditions easily in filters, 
    // but in EGDesk helpers, usually we handle this by fetching and filtering in JS if needed,
    // or improving the filter. For now, let's try to set it to 0 and fix existing nulls.
    const filters: any = { status: status || 'PUBLISHED' };
    
    const allTemplates = await queryTable('form_templates', { 
        filters,
        orderBy: 'id',
        orderDirection: 'DESC'
    });
    
    const templates = (Array.isArray(allTemplates) ? allTemplates : (allTemplates?.rows || []))
        .filter((t: any) => t.__is_deleted === 0 || t.__is_deleted === '0' || t.__is_deleted === null);
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
    const results = await queryTable('form_templates', { filters: { id: String(id) }, limit: 1 });
    const template = Array.isArray(results) ? results[0] : (results?.rows?.[0]);
    if (template) {
      return { success: true, template };
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
    await insertRows('form_submissions', [{
      templateId: data.templateId,
      userId: data.userId,
      customerData: data.customerData,
      manualInputs: data.manualInputs,
      createdAt: new Date().toISOString()
    }]);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save form submission:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 템플릿 삭제
 */
export async function deleteFormTemplateAction(id: number) {
  try {
    // 1. form_templates 테이블에서 삭제 (__is_deleted = 1)
    await updateRows('form_templates', {
      __is_deleted: 1,
      __deleted_at: new Date().toISOString()
    }, { filters: { id: String(id) } });
    
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete form template:', error);
    return { success: false, error: error.message };
  }
}

/**
 * AI를 사용하여 양식 이미지 내 필드 위치를 분석하고 매핑 제안을 생성합니다.
 */
export async function analyzeFormMappingAction(imageData: string, columns: string[]) {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    // API 키는 환경 변수에서 가져옵니다.
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    // Base64 데이터에서 헤더 제거 및 바이너리 변환
    const base64Content = imageData.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
    
    const prompt = `
      당신은 전문적인 문서 양식 분석가입니다. 
      제공된 이미지(문서 양식)를 분석하여 다음 데이터 컬럼들이 위치해야 할 최적의 좌표를 찾으세요.
      
      대상 컬럼 목록: ${columns.join(', ')}
      
      [분석 규칙]
      1. 각 컬럼의 이름(예: 견적번호, 일자)이 이미지 어디에 적혀있는지 찾으세요.
      2. 텍스트 라벨 바로 옆이나 아래에 있는 빈 칸(데이터가 입력될 공간)의 중심 좌표를 백분율(0-100)로 계산하세요.
      3. x: 가로 위치 (0=왼쪽, 100=오른쪽), y: 세로 위치 (0=상단, 100=하단)
      4. 결과는 반드시 다음과 같은 순수 JSON 배열 형식으로만 응답하세요. 다른 설명은 생략하세요.
      
      JSON 형식 예시:
      [
        {"columnKey": "컬럼명", "x": 10.5, "y": 20.2, "fontSize": 14},
        ...
      ]
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Content,
          mimeType: 'image/png' // 실제 타입에 맞춰 조정 가능하나 png로 통칭
        }
      }
    ]);

    const responseText = result.response.text();
    // JSON 추출 (코드 블록 제거 등)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const proposals = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return { success: true, proposals };
  } catch (error: any) {
    console.error('AI Analysis failed:', error);
    return { success: false, error: error.message };
  }
}
