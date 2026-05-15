'use server';

import { revalidatePath } from 'next/cache';
import { 
  queryTable, 
  insertRows, 
  updateRows, 
  deleteRows,
  listTables,
  getTableSchema,
  listBanks,
  listHometaxConnections,
  listBankProductTables
} from '@/egdesk-helpers';
import { getSessionAction } from './auth';
import { getUnifiedTableSchema, getUnifiedTableName } from './schema-registry';

/**
 * 프로젝트 내의 모든 가용 데이터 소스(물리 테이블, 리포트, 금융/홈택스 시스템 테이블, 은행 상품 테이블)를 통합하여 가져옵니다.
 * 이 액션은 Chart Studio, App Studio, Form Studio 등 모든 메뉴에서 데이터 선택 시 공통으로 사용됩니다.
 */
export async function getUnifiedDataSourcesAction() {
  const user = await getSessionAction();
  if (!user) throw new Error('인증이 필요합니다.');

  try {
    // 모든 소스를 병렬로 가져오기 (성능 최적화)
    const [tablesRes, bankProductsRes, reportsRes, tableMasterRes] = await Promise.all([
      listTables().catch(e => { console.warn('Failed to fetch tables:', e); return { tables: [] }; }),
      listBankProductTables().catch(e => { console.warn('Failed to fetch bank product tables:', e); return []; }),
      queryTable('dashboard_master', { limit: 100 }).catch(e => { console.warn('Failed to fetch reports:', e); return []; }),
      queryTable('table_master', { limit: 500 }).catch(() => [])
    ]);

    const tables = Array.isArray(tablesRes) ? tablesRes : (tablesRes as any)?.tables || [];
    const products = Array.isArray(bankProductsRes) ? bankProductsRes : (bankProductsRes as any)?.tables || (bankProductsRes as any)?.products || [];
    const reports = Array.isArray(reportsRes) ? reportsRes : (reportsRes as any)?.rows || [];
    const masterEntries = Array.isArray(tableMasterRes) ? tableMasterRes : (tableMasterRes as any)?.rows || [];
    
    // table_master 맵 생성 (빠른 조회를 위해)
    const masterMap = new Map(masterEntries.map((m: any) => [m.tableName, m]));

    const suggestions: any[] = [];

    // 1. 시스템 금융 소스 (Fixed - 국세청 5종 + 금융 3종)
    const systemSources = [
      { id: 'bank_transactions', name: '은행거래내역', reason: '실시간 은행 입출금 내역 기반 자금 관리가 가능합니다.' },
      { id: 'card_approvals', name: '신용카드 거래 내역', reason: '법인/개인 카드 지출 내역을 기반으로 비용 분석이 가능합니다.' },
      { id: 'hometax_sales_tax_invoices', name: '매출세금계산서', reason: '국세청 연동 매출 증빙 데이터를 분석합니다.' },
      { id: 'hometax_sales_exempt_invoices', name: '매출계산서(면세)', reason: '국세청 연동 면세 매출 증빙 데이터를 분석합니다.' },
      { id: 'hometax_purchase_tax_invoices', name: '매입세금계산서', reason: '국세청 연동 매입 증빙 데이터를 분석합니다.' },
      { id: 'hometax_purchase_exempt_invoices', name: '매입계산서(면세)', reason: '국세청 연동 면세 매입 증빙 데이터를 분석합니다.' },
      { id: 'hometax_cash_receipts', name: '현금영수증 내역', reason: '현금 결제 증빙 내역을 추적합니다.' }
    ];

    for (const sys of systemSources) {
      suggestions.push({
        tableId: sys.id,
        tableName: sys.name,
        physicalTableName: sys.id,
        type: 'system',
        templateId: 'cash-report',
        reason: sys.reason,
        priority: 'high'
      });
    }

    // 2. 은행 상품 테이블 (Loans, Bills, etc.)
    products.forEach((p: any, idx: number) => {
      const slug = p.slug;
      if (!slug) return;
      
      const bankId = p.bankId || 'unknown';
      const uniqueId = `bank-product:${bankId}:${slug}:${idx}`;
      
      suggestions.push({
        tableId: uniqueId,
        tableName: p.displayName || slug,
        physicalTableName: slug, 
        type: 'bank-product',
        templateId: 'custom-app',
        reason: `${bankId.toUpperCase()} 포털에서 수집된 ${p.displayName || '은행 상품'} 정보입니다. (${p.rowCount || 0}건)`,
        priority: 'high',
        schema: p.columns || [] // 서버에서 반환된 스키마 정보 포함
      });
    });

    // 3. 사용자가 생성한 리포트 (dashboard_master 테이블)
    for (const r of reports) {
      const reportKey = r.reportId || String(r.id);
      if (suggestions.some(s => s.tableId === reportKey)) continue;
      
      suggestions.push({
        tableId: reportKey,
        tableName: r.name,
        physicalTableName: r.tableName || reportKey,
        type: 'report',
        templateId: 'custom-app',
        reason: r.description || `사용자 정의 리포트: ${r.sheetName || 'MY DB'}`,
        priority: 'medium'
      });
    }

    // 4. 물리 테이블 (전체 포함)
    for (const table of tables) {
      const tableId = table.tableName;
      const masterInfo = masterMap.get(tableId);
      
      const name = masterInfo?.displayName || table.displayName || table.tableName;
      const category = masterInfo?.category || (tableId.startsWith('tb_') ? 'EXCEL' : tableId.startsWith('tpl_') ? 'INDUSTRY' : 'SYSTEM');
      const rowCount = masterInfo?.rowCount ?? table.rowCount ?? 0;

      if (!tableId || suggestions.some(s => s.tableId === tableId)) continue;

      suggestions.push({
        tableId,
        tableName: name,
        physicalTableName: tableId,
        type: 'table',
        templateId: 'custom-app',
        reason: `${category} 카테고리에 속한 물리 데이터 테이블입니다. (${rowCount}건)`,
        priority: 'low',
        schema: table.schema || table.columns || [] // 서버 리스팅 정보에 있으면 포함
      });
    }

    const priorityMap: any = { high: 0, medium: 1, low: 2 };
    return suggestions.sort((a, b) => (priorityMap[a.priority] || 2) - (priorityMap[b.priority] || 2));
    
  } catch (error) {
    console.error('Failed to get unified data sources:', error);
    return [];
  }
}

/**
 * AI가 워크스페이스 테이블을 스캔하여 발행 가능한 마이크로 앱을 추천합니다.
 * (getUnifiedDataSourcesAction의 별칭으로 유지하여 하위 호환성 보장)
 */
export async function getProactivePublishingSuggestionsAction() {
  return getUnifiedDataSourcesAction();
}

/**
 * 특정 데이터 소스의 뷰 설정(표시명, 순서 등)을 저장합니다.
 * 이 설정은 MY DB, APP STUDIO 등 모든 메뉴에서 공통으로 참조됩니다.
 */
export async function saveSourceViewSettingsAction(sourceId: string, viewConfig: any) {
  const user = await getSessionAction();
  if (!user) throw new Error('인증이 필요합니다.');

  const { queryTable, insertRows, deleteRows } = await import('@/egdesk-helpers');
  const { SystemConfigService } = await import('@/lib/services/system-config-service');
  const now = new Date().toISOString();

  try {
    // 시스템 테이블 보장 (Self-Healing)
    const { SystemConfigService } = await import('@/lib/services/system-config-service');
    await SystemConfigService.ensureSystemTables();

    // 기존 설정 삭제 후 재삽입 (Upsert) - 스키마: id(PK), sourceId, view_config, updatedAt
    await deleteRows('source_view_settings', { filters: { sourceId: sourceId } }).catch(() => {});
    
    await insertRows('source_view_settings', [{
      sourceId: sourceId,
      view_config: JSON.stringify(viewConfig),
      updatedAt: now
    }]);

    revalidatePath('/report/' + sourceId);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save source view settings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 특정 데이터 소스의 저장된 뷰 설정을 가져옵니다.
 */
export async function getSourceViewSettingsAction(sourceId: string) {
  const { queryTable } = await import('@/egdesk-helpers');
  try {
    const results = await queryTable('source_view_settings', { 
      filters: { sourceId: sourceId },
      limit: 1 
    }).catch(() => []);
    
    const rows = Array.isArray(results) ? results : (results?.rows || []);

    if (rows && rows.length > 0) {
      return { 
        success: true, 
        data: {
          ...rows[0],
          view_config: JSON.parse(rows[0].view_config)
        }
      };
    }
    return { success: true, data: null };
  } catch (error: any) {
    console.error('Failed to get source view settings:', error);
    return { success: false, error: error.message };
  }
}


/**
 * 프로젝트에 연결된 모든 소스 테이블의 스키마 정보를 가져옵니다.
 */
export async function getProjectSourceSchemasAction(sourceIds: string[]) {
  try {
    const schemas = await Promise.all(sourceIds.map(async (rawId) => {
      const id = rawId.trim();
      console.log(`>>> [Publishing] Fetching schema for source: "${id}"`);
      
      // 1. 해당 소스의 저장된 뷰 설정 가져오기
      const viewSettingsRes = await getSourceViewSettingsAction(id);
      const savedConfig = viewSettingsRes.success && viewSettingsRes.data ? viewSettingsRes.data.view_config : null;

      let columns: any[] = await getUnifiedTableSchema(id);
      console.log(`>>> [Publishing] Columns found for "${id}":`, columns.length);

      // 3. 저장된 설정(savedConfig)이 있으면 이름과 순서 덮어쓰기
      if (savedConfig && savedConfig.columns) {
        const configuredCols = savedConfig.columns; // { name, displayName, visible, order }
        
        // 설정된 컬럼들만 먼저 순서대로 정렬하여 배치
        const mergedColumns = configuredCols
          .filter((cc: any) => cc.visible !== false)
          .map((cc: any) => {
            const originalCol = columns.find(c => c.name === cc.name) || {};
            return {
              ...originalCol,
              name: cc.name,
              displayName: cc.displayName || originalCol.displayName || cc.name,
              type: originalCol.type || cc.type || 'text'
            };
          });

        // 설정에 없는 나머지 컬럼들 추가 (필요시)
        const remainingCols = columns.filter(c => !configuredCols.some((cc: any) => cc.name === c.name));
        columns = [...mergedColumns, ...remainingCols];
      }

      return { id, columns };
    }));
    return { success: true, schemas };
  } catch (error: any) {
    console.error('[Publishing] getProjectSourceSchemasAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 새로운 마이크로 앱을 발행합니다.
 */
export async function publishMicroAppAction(data: {
  name: string;
  templateId: string;
  sourceTableId: string;
  mappingConfig: any;
  uiSettings: any;
}) {
  const user = await getSessionAction();
  if (!user) throw new Error('인증이 필요합니다.');

  // Create a project first to get a projectId
  const { createMicroAppProjectAction, updateMicroAppProjectAction, publishProjectAction } = await import('./micro-app');
  
  try {
    // 1. 초안 프로젝트 생성
    const projRes = await createMicroAppProjectAction(data.name);
    if (!projRes.success || !projRes.id) throw new Error('프로젝트 생성 실패');
    
    // 2. 프로젝트 정보 업데이트
    await updateMicroAppProjectAction(projRes.id, {
      templateId: data.templateId,
      mappingConfig: data.mappingConfig,
      uiSettings: data.uiSettings,
    });

    // 3. 소스 테이블 추가
    const { addSourcesToProjectAction } = await import('./micro-app');
    // sourceTableId가 콤마로 구분된 여러 개일 수 있으므로 배열로 변환
    const sourceIds = data.sourceTableId.split(',').map(s => s.trim());
    await addSourcesToProjectAction(projRes.id, sourceIds.map(id => ({ id, name: id })));

    // 4. 최종 발행
    const pubRes = await publishProjectAction(projRes.id);
    if (!pubRes.success) throw new Error(pubRes.error);

    revalidatePath('/publishing/new');
    return { success: true };
  } catch (error: any) {
    console.error('publishMicroAppAction failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * AI가 사용자의 대화 맥락을 분석하여 테이블 선택이나 매핑 설정을 조정합니다. (Server Action)
 */
export async function getPublishingAIAdjustmentAction(
  userMessage: string,
  currentTableId: string,
  currentMapping: any
) {
  const user = await getSessionAction();
  if (!user) throw new Error('인증이 필요합니다.');

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  // 1. 가용한 모든 테이블 정보 수집 (지식 아카이브 활용)
  const knowledgeRes = await queryTable('table_knowledge', { limit: 50 });
  const knowledge = Array.isArray(knowledgeRes) ? knowledgeRes : (knowledgeRes as any)?.rows || [];
  const tableContext = knowledge.map((k: any) => ({
    id: k.target_id,
    name: k.description || k.target_id,
    category: k.category,
    insight: k.insight,
    columns: JSON.parse(k.schema_info || '[]').map((c: any) => c.name || c.displayName)
  }));

  // 만약 아카이브에 없으면 기본 테이블 목록에서 보충
  if (tableContext.length === 0) {
    const { tables } = await listTables();
    for (const t of tables.slice(0, 5)) {
      const schema = await getTableSchema(t.name);
      tableContext.push({
        id: t.name,
        name: t.displayName || t.name,
        columns: schema.map((c: any) => c.name)
      });
    }
  }

  const systemPrompt = `
    당신은 'EasyDesk Publishing'의 데이터 매핑 전문가입니다.
    사용자의 요청에 따라 현재 테이블을 변경하거나, 컬럼 매핑 설정을 조정해야 합니다.

    [현재 상태]
    - 현재 선택된 테이블 ID: ${currentTableId}
    - 현재 컬럼 매핑: ${JSON.stringify(currentMapping)}

    [워크스페이스 내 가용 테이블 목록]
    ${JSON.stringify(tableContext, null, 2)}

    [사용자 요청]
    "${userMessage}"

    [수행 지침]
    1. 사용자가 "다른 테이블로 바꿔줘" 혹은 "은행 거래 내역이 있는 걸로 찾아줘"라고 하면 가용 테이블 목록에서 가장 적합한 테이블 ID를 찾아 'newTableId'에 넣으세요.
    2. 테이블이 변경되면 해당 테이블의 컬럼명들을 보고 새로운 'newMapping'을 생성하세요.
    3. 테이블은 그대로인데 특정 컬럼만 바꾸고 싶어한다면 'newMapping'만 업데이트하세요.
    4. 반드시 아래 JSON 형식으로만 응답하세요.

    [응답 JSON 형식]
    {
      "explanation": "변경 사항에 대한 친절한 설명 (한글)",
      "newTableId": "변경할 테이블 ID (변경 없으면 현재 ID 유지)",
      "newTableName": "변경할 테이블의 표시 이름",
      "newMapping": {
        "date": "날짜 컬럼명",
        "inflow": "입금액 컬럼명",
        "outflow": "출금액 컬럼명",
        "description": "적요/내용 컬럼명",
        "bankName": "은행명 컬럼명 (있을 경우)",
        "accountNumber": "계좌번호 컬럼명 (있을 경우)",
        "category": "카테고리/구분 컬럼명"
      }
    }
  `;

  try {
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);

    // 유효성 검사: 선택된 테이블이 가용 테이블 목록에 있는지 확인
    const { tables } = await listTables();
    if (parsed.newTableId && parsed.newTableId !== 'undefined') {
      const exists = tables.some((t: any) => t.name === parsed.newTableId);
      if (!exists) parsed.newTableId = currentTableId; // 존재하지 않으면 현재 테이블 유지
    } else {
      parsed.newTableId = currentTableId;
    }

    return parsed;
  } catch (error) {
    return {
      explanation: "죄송합니다. 설정을 분석하는 중 오류가 발생했습니다.",
      newTableId: currentTableId,
      newMapping: currentMapping
    };
  }
}

/**
 * 프로젝트의 모든 데이터 소스를 분석하여 최적의 디자인 셋업(템플릿, 매핑, UI)을 제안합니다.
 */
export async function getAISuggestedProjectSetupAction(appId: string) {
  console.log(`[AI 추천 엔진] >>> 분석 시작 (App ID: ${appId})`);
  const user = await getSessionAction();
  if (!user) throw new Error('인증이 필요합니다.');

  try {
    // 1. 프로젝트 정보 및 소스 목록 가져오기
    console.log('[AI 추천 엔진] 1. 프로젝트 정보 로드 중...');
    const { getMicroAppProjectAction } = await import('./micro-app');
    const project = await getMicroAppProjectAction(appId);
    if (!project) {
        console.error(`[AI 추천 엔진] 프로젝트를 찾을 수 없음: ${appId}`);
        throw new Error('프로젝트를 찾을 수 없습니다.');
    }
    if (project.sources.length === 0) {
        console.error(`[AI 추천 엔진] 소스 없음: ${appId}`);
        throw new Error('분석할 데이터 소스가 없습니다.');
    }

    // 2. 각 소스의 컨텍스트 수집
    console.log(`[AI 추천 엔진] 2. 데이터 소스(${project.sources.length}개) 분석 중...`);
    const sourceContexts = await Promise.all(project.sources.map(async (s: any) => {
      console.log(`   - 소스 분석: ${s.name} (${s.id})`);
      const schema = await getTableSchema(s.id).catch(e => {
          console.warn(`     ! 스키마 조회 실패 (${s.id}):`, e.message);
          return [];
      });
      const samplesRes = await queryTable(s.id, { limit: 3 }).catch(e => {
          console.warn(`     ! 샘플 데이터 조회 실패 (${s.id}):`, e.message);
          return [];
      });
      const samples = Array.isArray(samplesRes) ? samplesRes : (samplesRes as any)?.rows || [];
      return { id: s.id, name: s.name, schema, samples };
    }));

    // 3. 태그 분석
    const explicitTags = project.tags || [];
    const implicitTags = `${project.name} ${project.description || ''}`.match(/#[\w가-힣]+/g)?.map(t => t.replace('#', '')) || [];
    const allTags = Array.from(new Set([...explicitTags, ...implicitTags]));
    console.log(`[AI 추천 엔진] 3. 컨텍스트 수집 완료. 태그: ${allTags.join(', ')}`);

    const tagHint = allTags.length > 0 
      ? `[중요] 사용자가 다음 스타일 및 정보 필터링 태그를 명시했습니다: ${allTags.join(', ')}. 
         당신의 추천 결과와 설명문(description)에는 반드시 이 태그들이 어떻게 반영되었는지 구체적으로 언급되어야 합니다.` 
      : '제공된 데이터 소스의 특성을 분석하여 최적의 앱 디자인을 추천하세요.';

    // 4. AI 분석 요청
    const apiKey = process.env.GEMINI_API_KEY;
    console.log(`[AI 추천 엔진] 4. AI 호출 준비 중 (API Key 존재 여부: ${!!apiKey})`);
    if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다. (.env.local 확인 필요)');

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
      당신은 기업용 마이크로 앱 디자인 전문가입니다. 
      제공된 데이터 소스와 사용자가 입력한 태그 정보를 바탕으로 최적의 앱 디자인을 추천하세요.

      [프로젝트 정보]
      - 이름: ${project.name}
      - 강조 태그: ${tagHint}

      [데이터 소스 정보]
      ${JSON.stringify(sourceContexts, null, 2)}

      [수행 과제]
      1. 데이터 특성과 '강조 태그'의 의도를 100% 결합하여 분석하세요.
      2. 추천된 설정의 '이유'를 설명하는 'description' 필드에는 반드시 사용자가 제공한 태그를 언급하며 그 태그가 어떻게 반영되었는지 설명하세요.
      3. 가장 적합한 템플릿 아이디를 선택하세요. 완전히 새로운 구조가 필요하므로 "dynamic-widget"을 선택하세요.
      4. 사용자가 이미 설정한 데이터 매핑 구성을 기반으로 레이아웃을 구성하세요. mappingConfig 자체는 생성하지 않습니다.
      5. 'uiSettings'를 통해 테마와 앱 이름, 설명, 그리고 핵심인 **layout(위젯 배치 설계도)**을 제안하세요.

      [레이아웃 (layout) 작성 가이드]
      - 위젯 종류 (type): "kpi", "chart", "pie", "list" 중 선택
      - KPI (type: "kpi"): 총합, 평균 등 단일 숫자를 강조. "dataRef"에는 합산할 숫자 컬럼 지정 (예: inflow, outflow, balance, amount). "color"는 emerald, rose, blue 등.
      - Chart (type: "chart"): 시간에 따른 추이. "subType"은 "line", "bar", "area". "xAxis"는 "date", "series"는 배열 형태로 데이터 컬럼 지정.
      - Pie (type: "pie"): 비중 분석. "groupBy"에 카테고리 컬럼명(예: category), "dataRef"에 금액 컬럼 지정.
      - List (type: "list"): 최근 거래 목록. "columns" 배열에 표시할 컬럼명 지정.
      - grid: Tailwind의 col-span 속성을 이용해 위젯 크기를 결정합니다. (전체 가로폭은 12칸)
        * 주의: KPI 위젯은 반드시 "col-span-12 md:col-span-4" 또는 "col-span-12 md:col-span-3"을 사용하여 한 줄에 3~4개가 배치되도록 하세요. 절대 "col-span-12" 단독으로 사용하여 전체 폭을 차지하게 하지 마세요.
        * 주의: Chart나 List 위젯은 "col-span-12" 또는 "col-span-12 md:col-span-8"을 사용하여 넓게 배치하세요.

      [응답 양식 - 반드시 JSON으로만 응답]
      {
        "explanation": "이 디자인을 추천하는 비즈니스적 이유 (한글)",
        "templateId": "dynamic-widget",
        "uiSettings": {
          "theme": "blue" | "indigo" | "slate" | "emerald" | "rose" | "amber",
          "title": "추천 앱 이름",
          "description": "앱에 대한 짧은 설명",
          "layout": [
            { "type": "kpi", "title": "총 수입", "dataRef": "inflow", "grid": "col-span-12 md:col-span-4", "color": "emerald" },
            { "type": "chart", "subType": "area", "title": "추이 분석", "xAxis": "date", "series": ["inflow", "outflow"], "grid": "col-span-12" },
            { "type": "list", "title": "최근 내역", "grid": "col-span-12 md:col-span-8", "columns": ["date", "description", "amount", "bankName"] }
          ]
        }
      }
    `;

    console.log('[AI 추천 엔진] 5. Gemini API 호출 중...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    console.log('[AI 추천 엔진] 6. AI 응답 수신 완료');
    
    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[AI 추천 엔진] JSON 파싱 실패. 원본 텍스트:', text);
      throw new Error('AI가 유효한 JSON 형식을 반환하지 않았습니다.');
    }
    
    const suggestion = JSON.parse(jsonMatch[0]);
    console.log('[AI 추천 엔진] 7. 분석 성공!');
    return { success: true, data: suggestion };

  } catch (error: any) {
    console.error("[AI 추천 엔진] !!! 치명적 오류:", error);
    return { success: false, error: error.message || 'AI 분석 엔진 내부 오류가 발생했습니다.' };
  }
}


/**
 * 마이크로 앱 설정을 가져옵니다.
 * 사용자 요청에 따라 원본 소스 테이블의 뷰 설정(정렬, 컬럼명 등)을 자동으로 상속받습니다.
 */
export async function getMicroAppConfigAction(id: string) {
  const { queryTable } = await import('@/egdesk-helpers');
  const { ensureProjectTable } = await import('./micro-app');
  
  await ensureProjectTable();
  const results = await queryTable('micro_app_projects', { filters: { projectId: id }, limit: 1 });
  console.log(`[getMicroAppConfigAction] Searching for Published App ID: "${id}"`);
  
  const resultsList = Array.isArray(results) ? results : (results as any)?.rows || [];
  let project = resultsList[0];
  if (!project && id) {
    // 혹시라도 공백 등이 있을 경우를 대비해 전체 검색 후 매칭
    const all = await queryTable('micro_app_projects');
    project = Array.isArray(all) ? all.find((c: any) => String(c.projectId).trim() === String(id).trim()) : null;
  }

  if (!project) {
    console.error(`[getMicroAppConfigAction] Project Config NOT FOUND for ID: ${id}`);
    return null;
  }

  const parsedMapping = project.mappingConfig ? (typeof project.mappingConfig === 'string' ? JSON.parse(project.mappingConfig) : project.mappingConfig) : [];
  const parsedUiSettings = project.uiSettings ? (typeof project.uiSettings === 'string' ? JSON.parse(project.uiSettings) : project.uiSettings) : {};
  const parsedRbacRoles = ['CEO', 'ADMIN']; // 기본 역할
  
  let sources = [];
  try {
    sources = typeof project.sources === 'string' ? JSON.parse(project.sources) : project.sources;
  } catch(e) {}
  const sourceTableId = Array.isArray(sources) ? sources.map((s:any) => s.id).join(',') : '';

  const config = {
    id: project.projectId,
    projectId: project.projectId,
    name: project.name,
    description: project.description,
    templateId: project.templateId || 'custom-app',
    sourceTableId: sourceTableId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };

  // [고도화] 원본 테이블의 뷰 설정 상속 (Inheritance)
  if (config.sourceTableId) {
    try {
      const sourceId = config.sourceTableId.split(',')[0].trim(); // 첫 번째 소스 기준
      const sourceSettingsRes = await getSourceViewSettingsAction(sourceId);
      if (sourceSettingsRes.success && sourceSettingsRes.data) {
        const sourceConfig = sourceSettingsRes.data.view_config;
        // 마이크로 앱 전용 설정이 없는 경우에만 상속 (또는 병합)
        parsedUiSettings.multiSortConfig = parsedUiSettings.multiSortConfig || sourceConfig.multiSortConfig;
        parsedUiSettings.itemsPerPage = parsedUiSettings.itemsPerPage || sourceConfig.itemsPerPage;
        
        // 컬럼명 상속 (mappingConfig에 displayName이 없으면 소스 설정에서 가져옴)
        if (sourceConfig.columns) {
          parsedMapping.forEach((m: any) => {
            const sourceCol = sourceConfig.columns.find((sc: any) => sc.name === m.sourceColumn);
            if (sourceCol && !m.displayName) {
              m.displayName = sourceCol.displayName;
            }
          });
        }
      }
    } catch (e) {
      console.warn('[getMicroAppConfigAction] Failed to inherit source settings:', e);
    }
  }

  return {
    ...config,
    mappingConfig: parsedMapping,
    uiSettings: parsedUiSettings,
    rbacRoles: parsedRbacRoles
  };
}

export async function listMicroAppsAction() {
  const user = await getSessionAction();
  if (!user) return [];

  try {
    const { ensureProjectTable } = await import('./micro-app');
    await ensureProjectTable();
    
    let projects = await queryTable('micro_app_projects', {
      orderBy: 'updatedAt',
      orderDirection: 'DESC'
    });

    if (!Array.isArray(projects)) {
      projects = (projects as any)?.rows || [];
    }

    // 상태가 PUBLISHED인 것만 필터링 (클라이언트에서 필터링하거나 직접 필터)
    const publishedProjects = Array.isArray(projects) ? projects.filter((p: any) => p.status === 'PUBLISHED') : [];

    return publishedProjects.map((project: any) => {
      let sources = [];
      try {
        sources = typeof project.sources === 'string' ? JSON.parse(project.sources) : project.sources;
      } catch(e) {}
      
      const sourceTableId = Array.isArray(sources) ? sources.map((s:any) => s.id).join(',') : '';

      return {
        id: project.projectId || String(project.id), // 프로젝트 ID를 앱 ID로 사용
        projectId: project.projectId || String(project.id),
        name: project.name || '이름 없는 앱',
        description: project.description,
        templateId: project.templateId || 'custom-app',
        sourceTableId: sourceTableId,
        mappingConfig: project.mappingConfig ? (typeof project.mappingConfig === 'string' ? JSON.parse(project.mappingConfig) : project.mappingConfig) : [],
        uiSettings: project.uiSettings ? (typeof project.uiSettings === 'string' ? JSON.parse(project.uiSettings) : project.uiSettings) : { theme: 'blue' },
        rbacRoles: ['CEO', 'ADMIN'],
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      };
    });
  } catch (error) {
    console.error('Failed to list published micro apps:', error);
    return [];
  }
}

/**
 * AI를 사용하여 모든 테이블을 분석하고 지식 저장소를 갱신합니다.
 */
export async function profileAllTablesAction() {
  const user = await getSessionAction();
  if (!user) throw new Error('인증이 필요합니다.');

  const { listTables, getTableSchema, queryTable, insertRows, queryBankTransactions } = await import('@/egdesk-helpers');
  const { tables } = await listTables();
  
  // 사용자 요청에 따라 가상 테이블(FinanceHub 등)을 우선 순위로 정렬
  const sortedTables = [...tables].sort((a, b) => {
    const aIsVirtual = a.name?.toLowerCase().includes('financehub') || a.displayName?.toLowerCase().includes('financehub');
    const bIsVirtual = b.name?.toLowerCase().includes('financehub') || b.displayName?.toLowerCase().includes('financehub');
    if (aIsVirtual && !bIsVirtual) return -1;
    if (!aIsVirtual && bIsVirtual) return 1;
    return 0;
  });

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  for (const table of sortedTables) {
    try {
      // 1. Sample Data & Schema
      const schema = await getTableSchema(table.name);
      const rowsRes = await queryTable(table.name, { limit: 5 });
      const rows = Array.isArray(rowsRes) ? rowsRes : (rowsRes as any)?.rows || [];
      
      // 2. AI Analysis
      const prompt = `
        Analyze the following database table and provide a professional business description.
        Table Name: ${table.displayName || table.name}
        Columns: ${JSON.stringify(schema)}
        Sample Data: ${JSON.stringify(rows)}
        
        Task:
        1. Analyze the primary purpose of this table.
        2. Categorize it: Financial | Transactional | Operational | HR | Sales | Administrative | Contact | Other.
           *Strict Rule*: Only categorize as 'Financial' or 'Transactional' if it contains actual monetary flow or account transactions.
           *Priority*: If the table is marked as a 'REPOSITORY' or has columns like 'BALANCE', 'WITHDRAWAL', 'DEPOSIT', prioritize it as the primary 'Financial' source.
        3. **[Crucial] Identify Master Links**: Check if any columns represent IDs that should link to master tables (master_client, user, master_product, master_project).
        4. Provide business insights in Korean.
        
        Respond ONLY with a JSON object:
        {
          "description": "한글로 작성된 테이블의 상세 비즈니스 용도",
          "category": "The category from the list above",
          "insight": "이 데이터로 어떤 마이크로 앱을 만들면 좋을지에 대한 제안 (한글)",
          "enriched_schema": [
            { 
              "name": "column_name", 
              "displayName": "표시 이름", 
              "type": "string|number|date|currency...",
              "masterTable": "master_client|user|master_product|master_project",
              "lookupField": "name",
              "isMasterLinked": true
            }
          ]
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const analysis = JSON.parse(text);

      // [추가] 2.5 Deep Inspection (금융 데이터 정합성 체크)
      if (analysis.category === 'Financial' || analysis.category === 'Transactional') {
        try {
          // 요약 잔액이 모두 0인지 확인
          const allZero = rows.every(r => (Number(r.balance || r.BALANCE || 0)) === 0);
          if (allZero && rows.length > 0) {
            // 상세 거래 내역 조회 시도 (계좌 ID가 있을 경우)
            const accountId = rows[0].id || rows[0].ID;
            if (accountId) {
              const txs = await queryBankTransactions({ accountId, limit: 1 });
              if (txs && txs.length > 0 && (Number(txs[0].balance || txs[0].BALANCE || 0)) > 0) {
                analysis.insight += " (데이터 경고: 계좌 요약 잔액이 0이나 상세 내역에 실잔액이 존재합니다. 거래 내역 기반의 역산 매핑이 권장됩니다.)";
              }
            }
          }
        } catch (e) {
          console.warn(`Deep inspection failed for ${table.name}:`, e);
        }
      }

      // 3. Store Knowledge (AI가 분석한 고도화된 스키마 정보 포함)
      const finalSchema = schema.map((s: any) => {
        const enriched = (analysis.enriched_schema || []).find((es: any) => es.name === s.name);
        return enriched ? { ...s, ...enriched } : s;
      });

      await insertRows('table_knowledge', [{
        target_id: table.name,
        description: analysis.description,
        category: analysis.category,
        insight: analysis.insight,
        schema_info: JSON.stringify(finalSchema), 
        sample_rows: JSON.stringify(rows),   
        sample_analysis: text,
        updated_at: new Date().toISOString()
      }]);

      console.log(`[AI Profiling] Knowledge stored for ${table.name}`);
    } catch (error) {
      console.error(`Failed to profile table ${table.name}:`, error);
    }
  }

  return { success: true };
}

function inferColumnType(name: string): string {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('date') || lowercase.includes('at') || lowercase.includes('time')) return 'date';
  if (lowercase.includes('amount') || lowercase.includes('price') || lowercase.includes('cost') || lowercase.includes('fee') || lowercase.includes('금액') || lowercase.includes('가액') || lowercase.includes('세액') || lowercase === '부가세') return 'currency';
  if (lowercase.includes('count') || lowercase.includes('quantity') || (lowercase.includes('id') && lowercase !== 'id' && !lowercase.includes('uuid'))) return 'number';
  if (lowercase.startsWith('is') || lowercase.startsWith('has') || lowercase === 'active' || lowercase === 'deleted') return 'boolean';
  if (lowercase.includes('memo') || lowercase.includes('description') || lowercase.includes('data') || lowercase.includes('비고') || lowercase.includes('적요')) return 'textarea';
  return 'string';
}

/**
 * 퍼블리싱용 데이터를 서버 사이드에서 안전하게 가져옵니다.
 * 복수 소스(배열) 처리를 지원하도록 고도화되었습니다.
 */
export async function fetchPublishingDataAction(sourceTableIds: string | string[], options: any = {}) {
  const ids = Array.isArray(sourceTableIds) ? sourceTableIds : [sourceTableIds];
  
  // [강화] 프로젝트 메타데이터에서 소스 이름 맵 생성
  let projectSourceMap = new Map<string, string>();
  if (options.projectId) {
    try {
      const { getMicroAppProjectAction } = await import('@/app/actions/micro-app');
      const project = await getMicroAppProjectAction(options.projectId);
      if (project && project.sources) {
        project.sources.forEach((s: any) => {
          projectSourceMap.set(s.id, s.name);
        });
      }
    } catch (e) {
      console.warn(`[fetchPublishingDataAction] Failed to load project metadata for names:`, e);
    }
  }

  // 모든 데이터셋 가져오기 (이름 맵 전달)
  const allResults = await Promise.all(ids.map(id => fetchSingleSourceData(id, { ...options, projectSourceMap })));
  
  // 모든 결과를 하나로 합침 (하위 호환성 유지)
  const mergedTransactions = allResults.flatMap(r => r.transactions);
  const mergedColumns = allResults[0]?.columns || []; 

  return { 
    datasets: allResults, // [NEW] 개별 소스별 데이터셋 포함
    transactions: mergedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    columns: mergedColumns,
    _sourceName: allResults.length === 1 ? allResults[0]._sourceName : (allResults[0]?._sourceName || 'Multiple Sources')
  };
}

/**
 * 단일 소스 데이터를 가져오는 내부 함수
 * [수정] 독자적인 조인 로직을 제거하고 @/egdesk-helpers의 통합 queryTable을 사용합니다.
 * 또한 MY DB의 뷰 설정(savedConfig)을 자동으로 상속받습니다.
 */
async function fetchSingleSourceData(sourceTableId: string, options: any = {}) {
  const user = await getSessionAction();
  if (!user) console.warn('[fetchPublishingDataAction] No session found');

  const { 
    queryTable,
    getTableSchema
  } = await import('@/egdesk-helpers');

  // 1. 데이터 가져오기 (가상 테이블 핸들러가 포함된 통합 queryTable 사용)
  // [수정] MCP 백엔드 한도(보통 1000건)를 우회하기 위해 청크 단위로 페이징하여 요청한 limit까지 모두 가져옵니다.
  const targetLimit = options.limit || 10000;
  const CHUNK_SIZE = 1000;
  let allRows: any[] = [];
  let currentOffset = options.offset || 0;

  while (allRows.length < targetLimit) {
    const fetchLimit = Math.min(CHUNK_SIZE, targetLimit - allRows.length);
    let rowsChunkRaw;

    // [고도화] 가상 테이블 ID 인터셉트 - AI 스튜디오와 동일한 고품질 데이터 소스 연결
    if (sourceTableId === 'bank_accounts' || sourceTableId === 'card_accounts') {
      const { runAITool } = await import('@/lib/ai-tools');
      const toolName = sourceTableId === 'bank_accounts' ? 'list_bank_accounts' : 'list_card_accounts';
      rowsChunkRaw = await runAITool(toolName as any, { limit: fetchLimit });
    } else {
      rowsChunkRaw = await queryTable(sourceTableId, { ...options, limit: fetchLimit, offset: currentOffset });
    }

    const rowsChunk = Array.isArray(rowsChunkRaw) ? rowsChunkRaw : (rowsChunkRaw as any)?.rows || [];
    
    if (!rowsChunk || rowsChunk.length === 0) break;
    
    allRows = allRows.concat(rowsChunk);
    currentOffset += rowsChunk.length;
    
    if (rowsChunk.length < fetchLimit) break;
  }
  
  const rows = allRows;
  // 2. 기본 스키마(컬럼) 정보 가져오기 (중앙 레지스트리 활용)
  let columns: any[] = await getUnifiedTableSchema(sourceTableId);

  // 3. [핵심] MY DB의 뷰 설정(컬럼명 변경, 순서 등) 상속
  try {
    const viewSettingsRes = await getSourceViewSettingsAction(sourceTableId);
    const savedConfig = viewSettingsRes.success && viewSettingsRes.data ? viewSettingsRes.data.view_config : null;

    if (savedConfig && savedConfig.columns) {
      const configuredCols = savedConfig.columns;
      
      // 설정된 컬럼들을 순서대로 정렬하고 별칭 적용
      const mergedColumns = configuredCols
        .filter((cc: any) => cc.visible !== false)
        .map((cc: any) => {
          const originalCol = columns.find(c => c.name === cc.name) || {};
          return {
            ...originalCol,
            name: cc.name,
            displayName: cc.displayName || originalCol.displayName || cc.name,
            type: originalCol.type || cc.type || 'string'
          };
        }).filter((c: any) => c.name);

      // 설정에 없는 나머지 컬럼들 추가
      const remainingCols = columns.filter(c => !configuredCols.some((cc: any) => cc.name === c.name));
      columns = [...mergedColumns, ...remainingCols];
    }
  } catch (e) {
    console.warn(`[fetchSingleSourceData] Failed to inherit view settings for ${sourceTableId}:`, e);
  }

  // 4. 소스 이름 가져오기 (프로젝트 메타데이터 우선 -> DB 검색 -> 시스템 폴백)
  let sourceName = '';
  
  // [1순위] 전달받은 프로젝트 소스 맵에서 이름 찾기 (가장 정확함)
  if (options.projectSourceMap && options.projectSourceMap.has(sourceTableId)) {
    sourceName = options.projectSourceMap.get(sourceTableId);
  } 
  
  if (!sourceName) {
    sourceName = await getUnifiedTableName(sourceTableId);
  }

  return { 
    id: sourceTableId,
    _sourceName: sourceName,
    transactions: rows.map((r: any) => ({ ...r, _sourceId: sourceTableId })), 
    columns: columns
  };
}


/**
 * 데이터 구조는 유지한 채 디자인 스타일(테마, 타이틀, 설명 등)만 새롭게 제안합니다.
 */
export async function getAIDesignRefreshAction(appId: string) {
  console.log(`[AI 디자인 리프레시] >>> 스타일 분석 시작 (App ID: ${appId})`);
  const user = await getSessionAction();
  if (!user) throw new Error('인증이 필요합니다.');

  try {
    const { getMicroAppProjectAction } = await import('./micro-app');
    const project = await getMicroAppProjectAction(appId);
    if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다.');

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
      당신은 기업용 대시보드 UI/UX 전문가입니다. 
      현재 앱의 내용은 확정되었습니다. 이 앱을 더 프리미엄하고 세련되게 보일 수 있는 '디자인 스타일'만 제안하세요.
      데이터 매핑은 변경하지 않습니다.

      [현재 앱 정보]
      - 이름: ${project.name}
      - 설명: ${project.description || ''}
      - 강조 태그: ${JSON.stringify(project.tags)}

      [수행 과제]
      1. 현재 테마와 태그를 분석하여 더 전문적인 비즈니스 룩앤필을 제안하세요.
      2. 'uiSettings' (theme, title, description)만 제안하세요. 
         - theme: blue, indigo, slate, emerald, rose, amber 중 선택
         - description: 앱의 가치를 높여주는 전문적인 비즈니스 문구로 작성

      [응답 양식 - 반드시 JSON으로만 응답]
      {
        "explanation": "이 디자인 스타일을 제안하는 이유",
        "uiSettings": {
          "theme": "color-name",
          "title": "세련된 앱 이름",
          "description": "매력적인 비즈니스 설명"
        }
      }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('유효한 디자인 제안을 생성하지 못했습니다.');
    
    const suggestion = JSON.parse(jsonMatch[0]);
    return { success: true, data: suggestion };

  } catch (error: any) {
    console.error("[AI 디자인 리프레시] 오류:", error);
    return { success: false, error: error.message };
  }
}
