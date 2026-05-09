import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { queryTable } from "@/egdesk-helpers";
import { runAITool } from "@/lib/ai-tools";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// 도구(Tools) 정의
const tools: any[] = [
  {
    functionDeclarations: [
      {
        name: "get_finance_monthly_summary",
        description: "은행/카드 등 금융 자산의 월별 지출/수입 요약을 가져옵니다. **홈택스(세금계산서) 데이터 분석에는 사용하지 마십시오.**",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            months: { type: SchemaType.NUMBER, description: "조회할 개월 수 (최근 N개월)" }
          }
        }
      },
      {
        name: "get_finance_statistics",
        description: "특정 기간 동안의 은행/카드 금융 자산 통계(카테고리별 지출 등)를 조회합니다. **홈택스 분석 시에는 사용하지 마십시오.**",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            startDate: { type: SchemaType.STRING, description: "시작일 (YYYY-MM-DD)" },
            endDate: { type: SchemaType.STRING, description: "종료일 (YYYY-MM-DD)" }
          }
        }
      },
      {
        name: "get_card_usage_by_approval_date",
        description: "승인일자(approvalDate)를 기준으로 카드 사용 내역을 정확히 집계합니다.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            startDate: { type: SchemaType.STRING, description: "시작일 (YYYY-MM-DD)" },
            endDate: { type: SchemaType.STRING, description: "종료일 (YYYY-MM-DD)" }
          },
          required: ["startDate", "endDate"]
        }
      },
      {
        name: "get_aggregated_report_data",
        description: "선택된 물리 테이블의 항목별 값을 집계(SUM)합니다. 차트 생성을 위한 최우선 도구입니다. tableId에는 선택된 테이블의 ID 또는 tableName을 넣으세요. 반환 형식: [{label: '그룹명', value: 숫자}, ...]",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tableId: { type: SchemaType.STRING, description: "선택된 테이블 ID 또는 tableName" },
            groupByKey: { type: SchemaType.STRING, description: "집계 기준 열" },
            sumKey: { type: SchemaType.STRING, description: "합산할 열" }
          },
          required: ["tableId", "groupByKey", "sumKey"]
        }
      },
      {
        name: "execute_analytical_sql",
        description: "데이터 필터링 등 단순 조회용 원시 쿼리입니다. 테이블명은 'dashboard_data'가 아닌 실제 물리 테이블명을 사용하십시오. **중요**: 쿼리에 'DELETE' 텍스트(isDeleted 등 포함)가 들어가면 보안 필터에 의해 차단됩니다.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            sql: { type: SchemaType.STRING, description: "실행할 SELECT SQL 쿼리" }
          },
          required: ["sql"]
        }
      },
      {
        name: "query_workspace_table",
        description: "선택된 물리 테이블의 데이터를 필터링하여 조회합니다. 원재료 데이터를 확보할 때 사용하세요.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tableId: { type: SchemaType.STRING, description: "선택된 테이블 ID 또는 tableName" },
            limit: { type: SchemaType.NUMBER, description: "조회 건수" }
          },
          required: ["tableId"]
        }
      },
      {
        name: "list_bank_accounts",
        description: "**주의: 선택된 테이블이 없을 때만 사용하십시오. 특히 홈택스(세금계산서) 분석 시에는 절대로 사용하지 마십시오.** 시스템 전체의 은행 계좌 목록을 가져옵니다.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            bankId: { type: SchemaType.STRING }
          }
        }
      },
      {
        name: "get_finance_dashboard_summary",
        description: "**경고: 선택된 테이블이 하나라도 있다면 절대 사용 금지.** 홈택스 데이터(세금계산서) 등과는 무관한 은행 계좌 통합 요약 도구입니다.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {}
        }
      }
    ]
  }
];

const model = genAI.getGenerativeModel({ 
  model: "gemini-3-flash-preview", 
  tools,
}, { apiVersion: 'v1beta' });

export interface ToolTrace {
  toolName: string;
  args: any;
  result: any;
  timestamp: string;
  duration?: number;
}

export interface AIResponse {
  content: string;
  chartConfigs?: any[];
  traces?: ToolTrace[];
}


/**
 * 선택된 테이블들의 기본 컨텍스트를 수집합니다. (table_knowledge 통합)
 */
async function getInitialContext(tableIds: string[]) {
  const { queryTable } = await import('@/egdesk-helpers');
  
  const contexts = await Promise.all(tableIds.map(async (id) => {
    // 1. table_knowledge에서 활성 지식 조회
    const knowledges = await queryTable('table_knowledge', { 
      filters: { target_id: id, is_current: 1 } 
    }).catch(() => []);
    
    const knowledge = knowledges[0];

    // 2. 물리/가상 테이블 마스터 정보 조회
    const [tableMasters, reportMasters] = await Promise.all([
      queryTable('table_master', { filters: { tableName: id } }).catch(() => []),
      queryTable('dashboard_master', { filters: { reportId: id } }).catch(() => [])
    ]);

    const tableMaster = tableMasters[0];
    const reportMaster = reportMasters[0];

    // 3. 샘플 데이터 및 기본 스키마 (지식이 없을 때를 대비)
    let baseSchema: any[] = [];
    try {
      const rows = await queryTable(id, { limit: 1 }).catch(() => null);
      if (rows && rows.length > 0) {
        baseSchema = Object.keys(rows[0]).map(key => ({ 
          name: key, 
          type: typeof rows[0][key] === 'number' ? 'NUMBER' : 'TEXT', 
          displayName: key 
        }));
      } else if (reportMaster && reportMaster.columns) {
        baseSchema = JSON.parse(reportMaster.columns);
      }
    } catch (e) {}

    // 4. 통합 컨텍스트 구성
    const displayName = knowledge?.displayName || reportMaster?.name || tableMaster?.displayName || id;
    const description = knowledge?.description || reportMaster?.description || tableMaster?.description || '사용자 데이터 소스';
    
    // 지식 베이스에 저장된 스키마 정보(비즈니스 별칭 포함)가 있다면 우선 적용
    let finalSchema = baseSchema;
    if (knowledge?.schema_info) {
      try {
        const enrichedSchema = JSON.parse(knowledge.schema_info);
        finalSchema = baseSchema.map(s => {
          const enriched = enrichedSchema.find((es: any) => es.name === s.name);
          return enriched ? { ...s, ...enriched } : s;
        });
      } catch(e) {}
    }

    return {
      id,
      name: displayName,
      description,
      category: knowledge?.category || tableMaster?.category || 'General',
      insight: knowledge?.insight,
      aiRules: knowledge?.ai_rules ? JSON.parse(knowledge.ai_rules) : [], // 가드레일 규칙 주입
      schema: finalSchema,
      availableTools: ['get_aggregated_report_data', 'execute_analytical_sql', 'query_workspace_table']
    };
  }));

  return contexts.filter(Boolean);
}

/**
 * AI에게 시각화 추천 또는 대화형 분석을 요청합니다. (Agentic Control Loop)
 */
export async function getVisualizationRecommendation(
  tableIds: string[],
  messages: any[]
): Promise<AIResponse> {

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const contexts = await getInitialContext(tableIds);
  const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  // 테이블별 특수 힌트 취합 (Hometax 등 컬럼명 주의사항)
  const criticalHints = contexts
    .filter(c => c && c.usageNote)
    .map(c => `[${c.name}]: ${c.usageNote}`)
    .join('\n');

  const systemPrompt = `
    당신은 데이터 분석 전문가 및 시각화 전문가입니다. 사용자가 선택한 테이블의 정보를 분석하여 최적의 차트 시각화를 추천하거나 사용자의 질문에 답하세요.
    
    [분석 대상 테이블 정보]
    ${JSON.stringify(contexts, null, 2)}
    
    ${criticalHints ? `[CRITICAL TABLE HINTS] (MUST FOLLOW)\n${criticalHints}\n` : ''}
    
    [현 시점 정보]
    - 현재 일시: ${currentTime}
    - 사용자가 "최근", "오늘", "이번 달", "최근 10일" 등을 언급하면 위 일시를 기준으로 도구의 기간(startDate, endDate)을 계산하십시오.
    
    [범용 데이터 소스 분석 원칙 (Universal Analysis)] (NEW)
    금융이나 홈택스 외의 생소한 데이터 소스를 분석할 때는 다음 원칙을 따르십시오:
    1. **시맨틱 매핑(Semantic Mapping)**: 스키마의 컬럼명을 분석하여 비즈니스 의미를 유추하십시오.
       - **날짜(Date)**: '일자', '날짜', '시간', 'date', 'at', 'time' 등이 포함된 컬럼.
       - **수치(Metric)**: '금액', '수량', '가액', '단가', 'amount', 'price', 'qty', 'count' 등이 포함된 숫자 컬럼.
       - **구분(Dimension)**: '종류', '구분', '유형', '카테고리', '상태', 'type', 'category', 'status' 등이 포함된 텍스트 컬럼.
    2. **지식 활용(Knowledge-First)**: 제공된 \`usageNote\`(사용자 가이드)나 \`aiInsight\`(과거 인사이트)가 있다면, 당신의 일반적인 추측보다 이를 100% 우선하여 분석 전략을 세우십시오.
    3. **데이터 탐색(Discovery)**: 스키마만으로 분석이 불확실하다면 \`query_workspace_table\` 도구로 실제 데이터 샘플을 1~2건 확인하여 컬럼의 실제 값 형태를 파악한 뒤 분석을 진행하십시오.
    4. **모호성 해결**: 컬럼명이 모호할 경우, 가장 관련성 높은 컬럼을 선택하되 답변 시 "스키마의 [컬럼명]을 기준으로 분석했습니다"라고 명시하여 투명성을 유지하십시오.
    
    [홈택스(Hometax) 데이터 분석 특수 규칙]
    홈택스 데이터를 다룰 때는 다음 비즈니스 분류 및 **기술적 제약**을 반드시 준수하십시오:
    1. **매출 관련 데이터 (3종 필수 합산)**: '매출 세금계산서', '매출 계산서', '매출 현금영수증'. 이 3가지가 모두 합산되어야 정확한 전체 매출이 산출됩니다.
    2. **매입 관련 데이터 (2종 필수 합산)**: '매입 세금계산서', '매입 계산서'.
    3. **데이터 소스 매핑**: 사용자가 선택한 테이블의 이름에 '매출'이 포함되어 있다면 매출 소스로, '매입'이 포함되어 있다면 매입 소스로 분류하십시오.
    4. **SQL 작성 금지 사항 (CRITICAL)**: **홈택스 테이블들을 \`UNION ALL\`로 묶는 복합 쿼리를 절대 작성하지 마십시오.** 각 테이블은 컬럼명과 구조가 서로 다릅니다(어떤 것은 한글, 어떤 것은 영문). 
       - **대안**: 대신 각 테이블에 대해 \`get_aggregated_report_data\` 도구를 **개별적으로 여러 번 호출**하거나, 각각 별도의 SQL을 실행하여 결과를 얻은 뒤 당신이 최종적으로 수치를 합산하십시오.
    5. **연도별/월별 필터링**: 각 테이블 스키마에 정의된 **날짜 컬럼**(예: '작성일자', \`writeDate\`, \`saleDate\`)을 기준으로 필터링하십시오. 연도 요청 시 해당 컬럼에 대해 \`LIKE '2025-%'\` 조건을 사용하십시오.
    
    [테이블별 특수 가이드 (Context Hints) 준수] (CRITICAL)
    - **스키마 우선 원칙**: 당신의 지식보다 [분석 대상 테이블 정보]에 제공된 각 테이블의 'schema' 정보를 100% 신뢰하십시오. 테이블마다 컬럼명이 다르므로 반드시 쿼리 전에 확인하십시오.
    - 지침 예시: "금액 합계 시 스키마에 정의된 **금액 컬럼**(예: '공급가액', \`supplyAmount\`, \`totalAmount\`)을 사용해", "날짜는 스키마의 날짜 컬럼 기준이야" 등.
    - 당신이 직접 SQL을 생성하거나 집계 도구를 사용할 때, 이러한 비즈니스 힌트가 있다면 일반적인 추측보다 우선하여 적용하십시오.
    
    [당신의 권한 및 도구 사용 규칙]
    1. **원재료(Ingredients) 원칙 (CRITICAL)**: MY DB 페이지에 표시되는 모든 테이블은 물리 테이블이며, 사용자가 그중 하나를 선택했다면 해당 테이블의 데이터는 차트와 표를 만들기 위한 **최우선적이며 유일한 원재료**입니다.
    2. **선택된 테이블 (Target Tables)**: 아래 [분석 대상 테이블 정보] 섹션에 데이터가 있다면, 사용자는 특정 물리 테이블을 직접 선택한 상태입니다. 
       - 당신은 이 '원재료' 테이블에서 데이터를 추출하여 요리(분석 및 시각화)를 해야 합니다.
       - **매출 세금계산서 발행 건수 등을 물었을 때, 홈택스 관련 테이블이 선택되어 있다면 절대 'get_finance_dashboard_summary' 같은 통합 금융 요약 도구로 넘어가 다른 데이터를 가져오지 마십시오.**
    3. **분석 우선순위**: 
       - [분석 대상 테이블 정보]의 'tableName'을 확인하여, 해당 물리 테이블을 'get_aggregated_report_data' 등을 통해 쿼리하여 재료를 확보하십시오.
       - 금융 질문이라 할지라도, 사용자가 특정 테이블을 선택했다면 'get_finance_dashboard_summary' 같은 통합 요약 도구보다 **선택된 물리 테이블의 데이터**를 재료로 삼아야 합니다.
    4. **데이터 부재 시 대응**: 만약 선택된 원재료 테이블을 쿼리했는데 데이터가 정말로 없다면, 그때 비로소 "선택하신 테이블에는 데이터가 없지만, 전체 금융 현황은 다음과 같습니다"라며 보조적인 요약 정보를 제공하십시오.
    
    [중요 지침]
    - **Parameters 정확성**: 도구 호출 시 'tableId' 값은 [분석 대상 테이블 정보]에 기재된 ID를 토씨 하나 틀리지 않고 그대로 사용하십시오.
    - **정직한 응답**: 분석 대상 테이블 정보가 비어있을 때만 "테이블을 선택해 주세요"라고 안내하십시오. 정보가 있다면 그 테이블의 스키마를 바탕으로 분석을 시작하십시오.
    - **도구 호출 오류 방지**: 'get_finance_dashboard_summary'와 'list_bank_accounts'는 선택된 테이블이 없을 때 시스템 전체를 훑는 최후의 수단입니다. 홈택스 분석 시 이들을 호출하면 심각한 데이터 왜곡이 발생합니다.
    
    [SQL 및 데이터 구조 규칙] (IMPORTANT)
    1. **가상 테이블 (dashboard_data)**: \`tableName\`이 \`dashboard_data\`인 경우, 데이터는 'data'라는 JSON 컬럼에 저장되어 있습니다. 이때는 \`data->>'컬럼명'\` 형식을 사용하십시오.
    2. **물리 테이블 (Physical Tables)**: 모든 홈택스(hometax_...) 및 금융 테이블은 컬럼이 평면적으로 펼쳐진 물리 테이블입니다. \`data->>\` 형식을 **절대 사용하지 마십시오.**
    3. **홈택스 컬럼명 주의 (VERY IMPORTANT)**: 홈택스 테이블은 종류에 따라 컬럼 언어가 다릅니다.
       - **세금계산서 (\`tax_invoice\` 포함)**: 반드시 **한글** 컬럼명 사용. 
         (예: \`SELECT SUM(공급가액) FROM hometax_sales_tax_invoices WHERE 작성일자 LIKE '2025-%'\`)
       - **일반 계산서/면세 (\`sales_invoices\`, \`purchase_invoices\`)**: 반드시 **영문** 컬럼명 사용. **한글 사용 시 100% 오류 발생.**
         (예: \`SELECT SUM(supplyAmount) FROM hometax_sales_invoices WHERE writeDate LIKE '2025-%'\`)
       - **현금영수증 (\`cash_receipts\`)**: 반드시 **영문** 컬럼명 사용. 
         (예: \`SELECT SUM(totalAmount) FROM hometax_cash_receipts WHERE saleDate LIKE '2025-%'\`)
    
    [응답 규칙]
    1. 답변 내용은 한국어로 친절하게 작성하세요.
    2. **표 형식 시각화 통합**: 사용자가 "표 형식으로 보여줘", "내역을 보여줘", "리스트로 보여줘"라고 요청하면, 'content'에는 간단한 요약만 작성하고 **상세 데이터는 반드시 'chartConfigs' 내에 'type: "table"'을 사용하여 독립된 표 컴포넌트로 생성**하십시오.
    3. **최근 데이터 해석**: 
       - 유선/금융 테이블의 경우 현재 일시를 기준으로 기간을 설정하십시오. 
       - "최근 10개 내역" 등을 요청하면 'execute_analytical_sql'을 사용하여 'ORDER BY createdAt DESC LIMIT 10' 쿼리를 수행하십시오. 
       - **중요 (SQL 보안 제한)**: 쿼리에 \`DELETE\` 텍스트가 한 글자라도 들어가면(예: \`isDeleted\`, \`deletedAt\`) 백엔드 보안 필터가 즉시 쿼리를 차단하고 에러를 뿜습니다. 따라서 SQL 내에서 isDeleted 등의 필터링 구문을 절대 사용하지 마세요.
       - **가장 좋은 해결책**: 차트를 위한 데이터 집계 요청 시 **'get_aggregated_report_data'** 도구를 적극 사용하세요. 
       - **필수(차트 축 규칙)**: 'get_aggregated_report_data' 도구는 항상 [{label: "그룹명", value: 숫자}, ...] 형식으로 결과를 반환합니다. 따라서 이 도구의 결과로 차트를 만들 때는 **반드시** xAxis를 "label"로, series를 [{key: "value", name: "표시할 이름"}]으로 설정하세요. 이것을 지키지 않으면 차트에 '알 수 없음'만 표시되는 치명적 오류가 발생합니다!
    4. 당신이 이전에 생성한 차트나 분석 내용을 기억하고, 사용자가 "그 차트에 ~를 추가해줘"라고 하면 이전 대화 맥락을 바탕으로 수정된 내용을 반영하여 도출하세요. 단, 이전에 시각화된 데이터가 화면에서 사라지지 않도록 응답에는 이전에 출력했던 다른 차트들을 포함한 **전체 chartConfigs 배열을 반드시 반환**하세요.
    5. 만약 사용자의 메시지가 "[대상 차트: '차트제목'] {요청내용}" 형식이면, 해당 제목을 가진 차트를 찾아 설정을 수정하세요. 다른 원본 차트들은 그대로 유지한 상태로, 이들을 모두 합쳐서 전체 chartConfigs 배열로 반환해야 합니다. 일부만 반환하면 화면에서 기존 차트가 날아가는 버그가 생깁니다.
    6. **정밀 색상 제어**: 차트의 개별 요소(막대, 파이 조각 등)의 색상을 개별적으로 지정하려면 'data' 배열의 각 객체에 '"color": "#hex"' 속성을 추가하십시오. 특정 항목의 색상만 변경하라는 요청을 받으면, **해당 항목의 색상만 수정하고 다른 항목들은 기존에 적용되었던 색상을 유지**하여 일관성을 지키십시오.
    7. 이제 차트 막대나 선 위에 금액(값)을 상시 표시할 수 있습니다. 사용자가 수치를 직접 보고 싶어 한다면 chartConfigs에서 "showLabels": true를 설정하십시오. (기본적으로 true를 권장합니다)
    8. 데이터가 20건을 넘어가면 요약하는 것이 원칙이나, 사용자가 '계좌 목록'이나 '전체 내역'을 요청한 경우(특히 금융 분석)에는 20건 제한을 무시하고 최대한 모든 데이터를 표로 나열하세요. 만약 도구 결과에 'fullTableMarkdown' 필드가 있다면, 이를 가공하지 말고 사용자에게 즉시 그대로 출력하여 보여주세요.
    9. **표(Table) 시각화 상세 규칙**:
       - **사용자 정의 우선**: 사용자가 특정 컬럼들을 나열(예: "A, B, C 순으로 보여줘")한 경우, **반드시 요청된 순서대로 빠짐없이** 컬럼(series)을 구성하십시오.
       - **합계(Total) 행 처리**: 사용자가 "합계 행 포함" 또는 "총계 보여줘"라고 요청하면, 데이터의 마지막 행에 합계 결과 데이터를 직접 계산하여 추가하십시오. (예: { "actualBankName": "총 합계", "balance": 50000000 })
       - **금융 데이터 기본값**: 별도의 컬럼 지정이 없는 금융 분석의 경우, '은행명'(actualBankName), '계좌번호'(actualAccountNumber), '현재잔액'(balance)을 포함하는 것이 표준입니다.
    10. **완벽한 JSON 출력 (TOP PRIORITY)**: 당신의 응답은 시스템에서 즉시 \`JSON.parse()\` 처리됩니다. 
        - **마크다운 금지**: 절대 \` \` \`json ... \` \` \` 과 같은 마크다운 코드 블록을 사용하지 마십시오. 오직 순수 JSON 객체( { ... } )만 출력하십시오.
        - **특수 문자 이스케이프**: \`content\` 필드 내의 모든 쌍따옴표는 \`\\"\`로, 줄바꿈은 \`\\n\`으로 반드시 이스케이프하십시오.
        - **데이터 부재 설명**: "2025년 매출액은 0원입니다"라고만 하지 말고, "선택하신 2025년 기간에는 조회된 데이터가 없으나, 샘플링 결과 2026년 1월 데이터가 존재함을 확인했습니다."와 같이 정교하게 설명하십시오.
       - 'sourceDescription': 데이터가 어떻게 추출되었는지에 대한 한글 설명 (예: "최근 6개월간의 월별 카드 지출 합계")
       - 'refreshMetadata': 자동 갱신을 위한 기술적 정보. 사용한 도구명('tool'), 인자('args'), 그리고 도구 결과 필드를 차트 데이터('label', 'value')로 매핑하는 정보('mapping')를 포함하십시오.
    
    응답 JSON 형식:
    {
      "content": "분석 결과 요약 (표 상세 내용은 아래 차트 영역에 생성됨)",
      "chartConfigs": [
        {
          "type": "bar | line | area | pie | table",
          "data": [{"label": "값1", "value": 100, "color": "#2563eb"}],
          "xAxis": "축으로 사용할 키 (table인 경우 첫 번째 컬럼)",
          "series": [{"key": "값의 키", "name": "표시될 이름", "color": "#hex"}],
          "title": "차트 제목",
          "showLabels": true,
          "sourceDescription": "데이터 추출 로직 설명",
          "refreshMetadata": {
            "tool": "사용된 도구명",
            "args": {"인자": "값"},
            "mapping": {"label": "결과필드명1", "value": "결과필드명2"}
          }
        }
      ]
    }
  `;

  // 대화 히스토리 구성 (Context Retention)
  const history = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "준비되었습니다. 이전 대화 맥락과 제공된 도구들을 활용하여 정확한 데이터 분석과 시각화를 도와드리겠습니다." }] }
  ];

  // 기존 메시지들을 히스토리에 추가 (최대 10개로 제한하여 토큰 관리)
  const recentMessages = messages.slice(-10);
  recentMessages.forEach((msg, idx) => {
    // 마지막 메시지는 sendMessage로 보낼 것이므로 제외 
    if (idx === recentMessages.length - 1) return;
    
    history.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  });

  const chat = model.startChat({ history });

  const traces: ToolTrace[] = [];
  const lastUserMessage = messages[messages.length - 1].content;
  let response = await chat.sendMessage(lastUserMessage);
  
  // 기능 호출 루프 (Agentic Loop) - 무한 재시도 및 Quota 초과 방지
  let retryCount = 0;
  while (response.response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && retryCount < 5) {
    const functionCalls = response.response.candidates[0].content.parts
      .filter(p => p.functionCall)
      .map(p => p.functionCall!);
    
    const functionResponses = await Promise.all(functionCalls.map(async (call) => {
      const startTime = Date.now();
      let result;
      try {
        result = await runAITool(call.name, call.args);
        
        // 트레이스 기록 (메타데이터 추출 포함)
        const trace: ToolTrace = {
          toolName: call.name,
          args: call.args,
          result: result,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime
        };

        if (result && typeof result === 'object') {
          if (result._executedSql) (trace as any).sql = result._executedSql;
          if (result._queryContext) (trace as any).context = result._queryContext;
        }
        
        traces.push(trace);

        // 데이터 경량화: AI가 처리하기 쉽게 꼭 필요한 필드만 남김
        if (call.name === 'get_finance_dashboard_summary' && result?.bankBreakdown) {
          result.bankBreakdown = result.bankBreakdown.map((b: any) => ({
            "은행명": b._bankName,
            "계좌번호": b.accountNumber,
            "현재잔액": b.balance,
            "계좌별칭": b.accountName, 
            "최종거래일": b.date
          }));
        }
      } catch (error: any) {
        console.error(`[AI Tool Error - ${call.name}]:`, error);
        result = { error: error.message || String(error) };

        traces.push({
          toolName: call.name,
          args: call.args,
          result: result,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime
        });
      }
      
      return {
        functionResponse: {
          name: call.name,
          response: { result }
        }
      };
    }));

    response = await chat.sendMessage(functionResponses);
    retryCount++;
  }

  const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // 디버깅 로그 (필요 시 확인)
  try {
    const logPath = 'c:\\dev\\egdesk_won3\\ExcelToDB\\ai_response_debug.txt';
    require('fs').appendFileSync(logPath, `\n[${new Date().toISOString()}] Response: ${responseText.substring(0, 500)}...\n`);
  } catch(e) {}

  let cleanedResponseText = responseText.trim();

  // 1. JSON 코드 블록 제거 (```json ... ```)
  if (cleanedResponseText.includes('```json')) {
    cleanedResponseText = cleanedResponseText.split('```json')[1].split('```')[0].trim();
  } else if (cleanedResponseText.includes('```')) {
    cleanedResponseText = cleanedResponseText.split('```')[1].split('```')[0].trim();
  }

  // 2. JSON 추출 및 파싱
  const firstBrace = cleanedResponseText.indexOf('{');
  const lastBrace = cleanedResponseText.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    const jsonString = cleanedResponseText.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonString);
      return { 
        content: parsed.content || "분석이 완료되었습니다.",
        chartConfigs: parsed.chartConfigs || [],
        traces 
      };
    } catch (e) {
      console.warn("AI JSON Parse Failed, falling back to raw content.");
    }
  }

  // 3. 최후의 보루: 비정형 응답을 정형화하여 반환
  return { 
    content: responseText || "분석 결과를 생성하는 도중 데이터 형식이 올바르지 않아 요약에 실패했습니다. (추출된 데이터는 'Trace' 탭에서 확인 가능합니다)",
    chartConfigs: [],
    traces 
  };
}
