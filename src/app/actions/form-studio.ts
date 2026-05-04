'use server';

import { createTable, queryTable, executeSQL, listTables, insertRows, updateRows } from '@/egdesk-helpers';

/**
 * 폼 스튜디오에 필요한 테이블들이 없으면 생성합니다.
 */
export async function initFormStudioTables() {
  try {
    const result = await listTables();
    const existingTables = Array.isArray(result) ? result : (result?.tables || []);
    
    // Cleanup legacy versioned tables
    for (const table of existingTables) {
        const name = (typeof table === 'string' ? table : (table.tableName || table.name));
        if (name && (name.startsWith('form_studio_templates_v') || name === 'form_templates')) {
            console.log(`Cleaning up legacy table: ${name}`);
            try {
                // executeSQL is restricted to SELECT, so we must use a helper if available.
                // But there's no dropTable helper in the provided agents.md/helpers.
                // If createTable with same name exists, it might handle it.
                // For now, let's just ignore the manual drop if not strictly needed, 
                // but standardizing names is better.
            } catch (e) {}
        }
    }

    const tableNames = new Set(existingTables.map((t: any) => 
        (typeof t === 'string' ? t : (t.tableName || t.name))?.toLowerCase()
    ));

    // 1. form_studio_templates 테이블 생성
    if (!tableNames.has('form_studio_templates')) {
      console.log('Creating form_studio_templates with standard system columns...');
      await createTable('Form Studio Templates', [
        { name: 'name', type: 'TEXT' },
        { name: 'formType', type: 'TEXT' }, 
        { name: 'backgroundImageData', type: 'TEXT' }, 
        { name: 'mappingConfig', type: 'TEXT' }, 
        { name: 'webLayoutConfig', type: 'TEXT' }, 
        { name: 'sourceTable', type: 'TEXT' }, 
        { name: 'status', type: 'TEXT' }, 
        // 필수 시스템 컬럼
        { name: '__created_at', type: 'TEXT' },
        { name: '__updated_at', type: 'TEXT' },
        { name: '__creator_id', type: 'TEXT' },
        { name: '__modifier_id', type: 'TEXT' },
        { name: '__is_deleted', type: 'INTEGER' },
        { name: '__deleted_at', type: 'TEXT' }
      ], { 
        tableName: 'form_studio_templates', 
        uniqueKeyColumns: ['id'], 
        duplicateAction: 'update' 
      });
    }

    // 2. form_submissions 테이블 생성
    if (!tableNames.has('form_submissions')) {
      console.log('Creating form_submissions with standard system columns...');
      await createTable('Form Submissions', [
        { name: 'templateId', type: 'INTEGER' },
        { name: 'userId', type: 'TEXT' },
        { name: 'customerData', type: 'TEXT' }, 
        { name: 'manualInputs', type: 'TEXT' }, 
        // 필수 시스템 컬럼
        { name: '__created_at', type: 'TEXT' },
        { name: '__updated_at', type: 'TEXT' },
        { name: '__creator_id', type: 'TEXT' },
        { name: '__modifier_id', type: 'TEXT' },
        { name: '__is_deleted', type: 'INTEGER' },
        { name: '__deleted_at', type: 'TEXT' }
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
  formType: 'CLASSIC' | 'MODERN' | 'HTML';
  backgroundImageData: string;
  mappingConfig: string;
  webLayoutConfig: string;
  sourceTable: string;
  status: 'DRAFT' | 'PUBLISHED';
}) {
  try {
    console.log(`[FormStudio] saveFormTemplateAction started: ${data.name} (${data.formType})`);
    console.log(`[FormStudio] webLayoutConfig length: ${data.webLayoutConfig?.length || 0}`);

    await initFormStudioTables();
    const now = new Date().toISOString();

    if (data.id) {
      console.log(`[FormStudio] Updating template ${data.id}`);
      await updateRows('form_studio_templates', {
        name: data.name,
        formType: data.formType,
        backgroundImageData: data.backgroundImageData,
        mappingConfig: data.mappingConfig,
        webLayoutConfig: data.webLayoutConfig || '',
        sourceTable: data.sourceTable,
        status: data.status,
        __updated_at: now
      }, { filters: { id: String(data.id) } });
    } else {
      console.log(`[FormStudio] Inserting new template`);
      await insertRows('form_studio_templates', [{
        name: data.name,
        formType: data.formType,
        backgroundImageData: data.backgroundImageData,
        mappingConfig: data.mappingConfig,
        webLayoutConfig: data.webLayoutConfig || '',
        sourceTable: data.sourceTable,
        status: data.status,
        __created_at: now,
        __updated_at: now,
        __is_deleted: 0
      }]);
    }

    console.log(`[FormStudio] Data operation completed`);

    // 삽입된 ID를 가져오기 위해 최근 추가된 레코드 조회
    if (!data.id) {
        const lastRecords = await queryTable('form_studio_templates', {
            orderBy: 'id',
            orderDirection: 'DESC',
            limit: 1
        });
        const lastRecord = Array.isArray(lastRecords) ? lastRecords[0] : (lastRecords?.rows?.[0]);
        console.log(`[FormStudio] New record ID: ${lastRecord?.id}`);
        return { success: true, id: lastRecord?.id };
    }

    console.log(`[FormStudio] Save successful for ID: ${data.id}`);
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error('[FormStudio] Failed to save form template:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 템플릿 목록 조회
 */
export async function listFormTemplatesAction(status?: 'DRAFT' | 'PUBLISHED') {
  try {
    await initFormStudioTables();
    const filters: any = { status: status || 'PUBLISHED', __is_deleted: '0' };
    
    const allTemplates = await queryTable('form_studio_templates', { 
        filters,
        orderBy: 'id',
        orderDirection: 'DESC'
    });
    
    const templates = (Array.isArray(allTemplates) ? allTemplates : (allTemplates?.rows || []));
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
    const results = await queryTable('form_studio_templates', { filters: { id: String(id) }, limit: 1 });
    const template = Array.isArray(results) ? results[0] : (results?.rows?.[0]);
    if (template && (template.__is_deleted === 0 || template.__is_deleted === '0')) {
      return { success: true, template };
    }
    return { success: false, error: '템플릿을 찾을 수 없거나 삭제되었습니다.' };
  } catch (error: any) {
    console.error('Failed to get form template:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 템플릿 삭제
 */
export async function deleteFormTemplateAction(id: number) {
  try {
    await updateRows('form_studio_templates', {
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
    const now = new Date().toISOString();
    await insertRows('form_submissions', [{
      templateId: data.templateId,
      userId: data.userId,
      customerData: data.customerData,
      manualInputs: data.manualInputs,
      __created_at: now,
      __updated_at: now,
      __is_deleted: 0
    }]);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save form submission:', error);
    return { success: false, error: error.message };
  }
}

/**
 * AI를 사용하여 양식 이미지 내 필드 위치를 분석하고 매핑 제안을 생성합니다.
 */
export async function analyzeFormMappingAction(imageData: string, sourceTable: string, columns: string[]) {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    // API 키는 환경 변수에서 가져옵니다.
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    // Base64 데이터에서 헤더 제거 및 바이너리 변환
    const base64Content = imageData.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
    
    // columns가 배열인지 확인 (방어적 코드)
    const columnList = Array.isArray(columns) ? columns : [];
    
    const prompt = `
      당신은 전문적인 문서 양식 분석가이자 UI/UX 엔지니어입니다. 
      제공된 이미지(문서 양식)를 분석하여 두 가지 형태의 결과물을 생성하세요.
      
      연결된 테이블: ${sourceTable}
      대상 컬럼 목록: ${columnList.join(', ')}
      
      [필수 결과물 1: Mappings]
      - 각 컬럼의 이미지 내 정밀 좌표 (x, y: 0-100)
      
      [필수 결과물 2: WebLayout]
      - 원본 양식의 논리적 구조를 유지한 반응형 웹 레이아웃 스키마
      - 섹션(sections)으로 구분하고, 각 섹션 내에 필드(fields)를 배치하세요.
      - 각 필드는 가로 너비(colSpan: 1~4)를 가집니다.
      
      결과는 반드시 다음과 같은 순수 JSON 형식으로만 응답하세요. 다른 설명은 생략하세요.
      
      JSON 형식 예시:
      {
        "mappings": [
          {"columnKey": "컬럼명", "x": 10.5, "y": 20.2, "fontSize": 14, "width": 15}
        ],
        "webLayout": {
          "sections": [
            {
              "title": "기본 정보",
              "fields": [
                {"columnKey": "견적번호", "label": "견적번호", "colSpan": 2},
                {"columnKey": "일자", "label": "일자", "colSpan": 2}
              ]
            }
          ]
        }
      }
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Content,
          mimeType: 'image/png' 
        }
      }
    ]);

    const responseText = result.response.text();
    // JSON 추출
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { mappings: [], webLayout: { sections: [] } };
    
    // Mappings 고유 ID 부여
    const mappings = (aiResult.mappings || []).map((p: any) => ({
      ...p,
      id: `ai-${Math.random().toString(36).substr(2, 9)}`,
      width: p.width || 15,
      fontSize: p.fontSize || 14
    }));

    return { 
      success: true, 
      mappings, 
      webLayout: aiResult.webLayout 
    };
  } catch (error: any) {
    console.error('AI Analysis failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * HTML 코드를 분석하여 데이터 소스의 컬럼과 자동으로 매핑(name 속성 주입 등)합니다.
 */
export async function optimizeHtmlForMappingAction(htmlContent: string, columns: string[]) {
  try {
    console.log(`[FormStudio] AI HTML Mapping started. Content length: ${htmlContent.length}`);
    
    // 1. 대용량 자산(Base64) 임시 치환하여 프롬프트 크기 축소
    const assetMap: Record<string, string> = {};
    let strippedHtml = htmlContent;
    let assetCount = 0;
    
    // src="data:..." 패턴 찾기
    strippedHtml = strippedHtml.replace(/src=["'](data:[^"']+)["']/g, (match, data) => {
      const token = `__ASSET_${assetCount}__`;
      assetMap[token] = data;
      assetCount++;
      return `src="${token}"`;
    });
    
    console.log(`[FormStudio] Stripped ${assetCount} assets. Reduced length: ${strippedHtml.length}`);

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
    // Using standard project model as per AGENTS.md
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `
      당신은 HTML 전문 개발자이자 데이터 바인딩 전문가입니다. 
      제공된 HTML 코드를 분석하여, 주어진 데이터베이스 컬럼 목록과 매칭되는 정적 데이터를 찾고 이를 데이터 바인딩이 가능한 형태로 수정하세요.
      
      [데이터베이스 컬럼 목록]
      ${columns.join(', ')}
      
      [수정 규칙]
      1. input, textarea, select 태그 등 입력 가능한 요소가 있다면, 해당 요소의 'name' 속성을 일치하는 컬럼명으로 설정하세요.
      2. 텍스트 요소(span, p, div, td 등) 내에 정적 데이터가 있다면, 이를 <span name="컬럼명">데이터</span> 형태로 감싸거나 적절한 방식으로 name 속성을 부여하세요.
      3. **중요: 무결성(연관 테이블) 반복 데이터 처리**
         - HTML 내에 품목 리스트와 같은 '반복되는 행(table row)'이 있다면, 각 행의 필드에 인덱스가 부여된 컬럼명(예: 품명_1, 수량_1, 품명_2, 수량_2...)을 순서대로 매핑하세요.
         - 만약 HTML 구조상 반복되는 행이 하나만 있고 나머지는 비어있거나 스크립트로 생성된다면, AI가 판단하여 인덱스 번호가 붙은 여러 개의 행으로 확장하거나 구조를 최적화하여 모든 데이터(최대 10개 행)가 들어갈 수 있도록 코드를 수정하세요.
      4. 스타일이나 전체적인 레이아웃은 절대 깨뜨리지 마세요.
      5. 결과는 반드시 원본 HTML의 구조를 유지한 채 수정된 '전체 HTML 코드'만 응답하세요. 다른 설명은 생략하세요.
      6. src="__ASSET_X__" 형태의 토큰은 절대 수정하지 말고 그대로 유지하세요.
      
      [HTML 소스]
      ${strippedHtml}
    `;

    console.log('[FormStudio] Calling Gemini AI...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    console.log('[FormStudio] AI response received.');

    // Markdown 코드 블록 제거 (있을 경우)
    const cleanedHtml = text.replace(/```html\n?|```/g, '').trim();
    
    // 2. 임시 치환했던 자산 복구
    let finalHtml = cleanedHtml;
    Object.entries(assetMap).forEach(([token, data]) => {
      finalHtml = finalHtml.split(`"${token}"`).join(`"${data}"`);
      finalHtml = finalHtml.split(`'${token}'`).join(`'${data}'`);
    });

    console.log(`[FormStudio] AI HTML Mapping complete. Final length: ${finalHtml.length}`);
    return { success: true, optimizedHtml: finalHtml };
  } catch (error: any) {
    console.error('[FormStudio] HTML Optimization failed:', error);
    return { success: false, error: error.message };
  }
}
