'use server';

import { revalidatePath } from 'next/cache';
import { getSessionAction } from './auth';

/**
 * 지식 리스트를 조회하고 추천 정보를 포함하여 반환합니다.
 */
export async function getKnowledgeListAction(query?: string) {
  try {
    const { queryTable } = await import('@/egdesk-helpers');
    
    console.log('[DEBUG] getKnowledgeListAction started');
    
    // 1. 지식 정보 조회
    const knowledge = await queryTable('table_knowledge', { 
      limit: 1000,
      offset: 0
    });
    console.log('[DEBUG] table_knowledge result type:', typeof knowledge, 'isArray:', Array.isArray(knowledge));
    console.log('[DEBUG] Knowledge count:', knowledge?.length || 0);

    // 2. 물리 테이블 목록 조회
    const physicalTables = await queryTable('table_master', { 
      limit: 1000,
      offset: 0
    });
    console.log('[DEBUG] table_master result type:', typeof physicalTables, 'isArray:', Array.isArray(physicalTables));
    console.log('[DEBUG] Physical count:', physicalTables?.length || 0);

    // 3. 테이블 뷰 목록 조회 (구 가상 테이블)
    const tableViews = await queryTable('dashboard_master', { 
      limit: 1000,
      offset: 0
    });
    console.log('[DEBUG] dashboard_master result type:', typeof tableViews, 'isArray:', Array.isArray(tableViews));
    console.log('[DEBUG] View count:', tableViews?.length || 0);

    const result = { 
      success: true, 
      data: {
        knowledge: knowledge || [],
        physical: (physicalTables || []).map((t: any) => {
          const isProtected = (knowledge || []).some((k: any) => k.target_id === t.tableName && k.target_type === 'PHYSICAL' && k.is_current === 1);
          return { id: t.tableName, name: t.displayName || t.tableName, type: 'PHYSICAL', isProtected };
        }),
        view: (tableViews || []).map((t: any) => {
          const isProtected = (knowledge || []).some((k: any) => k.target_id === t.reportId && k.target_type === 'VIRTUAL' && k.is_current === 1);
          return { id: t.reportId, name: t.name || t.reportId, type: 'VIRTUAL', isProtected };
        })
      }
    };
    
    console.log('[DEBUG] Final result data counts - P:', result.data.physical.length, 'V:', result.data.view.length);
    return result;
  } catch (error: any) {
    console.error('[DEBUG] getKnowledgeListAction ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * AI를 사용하여 테이블 지식 제안(Propose)을 생성합니다.
 */
export async function proposeAIKnowledgeAction(targetId: string, targetType: 'PHYSICAL' | 'VIRTUAL' = 'PHYSICAL') {
  try {
    const user = await getSessionAction();
    if (!user) throw new Error('인증이 필요합니다.');

    const { getTableSchema, queryTable, insertRows } = await import('@/egdesk-helpers');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    console.log(`[DEBUG] Profiling start for ${targetId} (${targetType})`);

    // 1. 샘플 데이터 및 스키마 가져오기
    let rows: any[] = [];
    let schema: any[] = [];
    let displayName = targetId;
    
    if (targetType === 'PHYSICAL') {
      rows = await queryTable(targetId, { limit: 5 });
      const schemaRes = await getTableSchema(targetId);
      schema = schemaRes.schema || [];
      
      // table_master에서 displayName 가져오기
      const masterRes = await queryTable('table_master', { filters: { tableName: targetId } });
      if (masterRes && masterRes[0]) displayName = masterRes[0].displayName || targetId;
      console.log(`[DEBUG] Physical schema found: ${schema.length} columns, display: ${displayName}`);
    } else {
      // 가상 테이블 (Report) 정보 가져오기
      const reportRes = await queryTable('dashboard_master', { filters: { reportId: targetId } });
      if (!reportRes[0]) throw new Error('가상 테이블 정보를 찾을 수 없습니다.');
      
      displayName = reportRes[0].name;
      schema = JSON.parse(reportRes[0].columns || '[]');
      // 가상 테이블은 실제 데이터를 쿼리하기 위해 reportId 기준의 뷰 필요
      // 여기서는 우선 스키마 위주로 분석
    }

    // 2. Gemini를 통한 분석
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
      Analyze the following ${targetType === 'VIRTUAL' ? 'Virtual Report' : 'Database Table'} and provide a professional business description.
      Name: ${displayName}
      Columns: ${JSON.stringify(schema)}
      Sample Data: ${JSON.stringify(rows)}
      
      Task:
      1. Analyze the primary purpose of this data.
      2. Categorize it: Financial | Transactional | Operational | HR | Sales | Administrative | Contact | Other.
      3. Identify master data links and provide business insights in Korean.
      4. For each column, provide a "displayName" (Korean) and a "description" (Korean).
      
      Respond ONLY with a JSON object:
      {
        "description": "한글로 작성된 상세 비즈니스 용도",
        "category": "The category from the list above",
        "insight": "이 데이터에 대한 비즈니스 인사이트 (한글)",
        "enriched_schema": [
          { "name": "col_name", "displayName": "한글명", "description": "컬럼의 의미 설명" }
        ]
      }
    `;

    console.log('[DEBUG] Gemini analysis starting...');
    const result = await model.generateContent(prompt);
    const analysisText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(analysisText);
    console.log('[DEBUG] Gemini analysis success:', analysis.category);

    // 3. 제안(PROPOSED) 상태로 저장
    const proposedKnowledge = {
      target_id: targetId,
      target_type: targetType,
      displayName: displayName,
      description: analysis.description,
      category: analysis.category,
      insight: analysis.insight,
      schema_info: JSON.stringify(analysis.enriched_schema),
      status: 'PROPOSED',
      is_current: 0,
      version_number: 0, // 제안 버전은 0으로 표시하거나 별도 관리
      updated_at: new Date().toISOString()
    };

    console.log('[DEBUG] Saving proposed knowledge...');
    const insertRes = await insertRows('table_knowledge', [proposedKnowledge]);
    const newId = insertRes && insertRes[0] ? insertRes[0].id : null;
    console.log('[DEBUG] Save success, ID:', newId);

    return { success: true, data: { ...proposedKnowledge, id: newId } };
  } catch (error: any) {
    console.error('proposeAIKnowledgeAction failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 제안된 지식을 승인(Approve)하고 현재 버전으로 설정합니다.
 * mergedData에는 사용자가 수정한 최종본이 들어옵니다.
 */
export async function approveKnowledgeAction(proposalId: number, mergedData: any) {
  try {
    // 1. 제안 정보 확인
    const proposals = await queryTable('table_knowledge', { filters: { id: String(proposalId) } });
    if (!proposals[0]) throw new Error('제안 정보를 찾을 수 없습니다.');
    
    const { target_id, target_type } = proposals[0];

    // 2. 현재 활성 버전 찾기 (버전 번호 산출용)
    const currentOnes = await queryTable('table_knowledge', { 
      filters: { target_id, target_type, is_current: 1 } 
    });
    
    let nextVersion = 1;
    if (currentOnes.length > 0) {
      nextVersion = (currentOnes[0].version_number || 1) + 1;
      // 기존 활성 버전 ARCHIVED로 변경
      await updateRows('table_knowledge', 
        { is_current: 0, status: 'ARCHIVED' }, 
        { id: String(currentOnes[0].id) }
      );
    }

    // 3. 제안된 레코드를 ACTIVE로 업데이트하거나 새 레코드 생성
    // 여기서는 제안 레코드를 그대로 승인된 레코드로 전환
    await updateRows('table_knowledge', 
      { 
        ...mergedData, 
        is_current: 1, 
        status: 'ACTIVE', 
        version_number: nextVersion,
        updated_at: new Date().toISOString()
      }, 
      { id: String(proposalId) }
    );

    revalidatePath('/admin/guardrails');
    return { success: true };
  } catch (error: any) {
    console.error('approveKnowledgeAction failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 지식을 이전 버전으로 롤백합니다.
 */
export async function rollbackKnowledgeAction(targetId: string, targetType: string, versionNumber: number) {
  try {
    // TODO: 롤백 로직 구현
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
