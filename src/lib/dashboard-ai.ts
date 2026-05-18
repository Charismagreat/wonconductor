import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { queryTable } from "@/egdesk-helpers";
import { runAITool } from "@/lib/ai-tools";

import { SystemConfigService } from "./services/system-config-service";

// 글로벌 초기화 대신 함수 내에서 동적으로 초기화합니다.

// 도구(Tools) 정의
const tools: any[] = [
  {
    functionDeclarations: [
      {
        name: "run_studio_data_query",
        description: "대상 테이블(일반 데이터, 금융 데이터, 또는 국세청 홈택스 데이터)의 데이터를 조회하거나 집계합니다. 차트를 그리기 위한 데이터를 가져올 때 이 도구 하나만 사용하십시오. 금융 데이터는 intent를 'monthly' 또는 'summary'로 설정하여 추이를 조회할 수 있고, 일반 테이블은 groupBy/valueKey를 사용하여 집계할 수 있습니다.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tableId: { type: SchemaType.STRING, description: "조회할 테이블 ID" },
            intent: { 
              type: SchemaType.STRING, 
              enum: ["list", "summary", "monthly", "statistics"], 
              description: "조회 목적 (list: 상세 목록, summary/statistics: 요약 통계, monthly: 월별 추이)" 
            },
            startDate: { type: SchemaType.STRING, description: "시작 날짜 (YYYY-MM-DD)" },
            endDate: { type: SchemaType.STRING, description: "종료 날짜 (YYYY-MM-DD)" },
            limit: { type: SchemaType.NUMBER, description: "조회 행 수 (기본 100)" },
            offset: { type: SchemaType.NUMBER, description: "조회 시작 위치 (페이징)" },
            groupBy: { type: SchemaType.STRING, description: "집계 시 기준 컬럼명 (예: '거래처명', '날짜'). 날짜 기반 집계는 '__month', '__week', '__year' 특수 키를 사용하십시오." },
            valueKey: { type: SchemaType.STRING, description: "집계 시 대상 수치 컬럼명 (예: '금액', '공급가액')" },
            months: { type: SchemaType.NUMBER, description: "monthly 조회 시 최근 N개월 수 (기본 12)" }
          },
          required: ["tableId", "intent"]
        }
      },
      {
        name: "list_available_tables",
        description: "사용 가능한 모든 데이터 소스(물리 테이블, 금융 마스터, 홈택스 테이블 등)의 목록을 가져옵니다. 분석 대상 테이블이 무엇인지 모르거나, 더 넓은 데이터 조인이 필요한 경우 가장 먼저 호출하십시오.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {}
        }
      }
    ]
  }
];


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

    const isHometax = id.startsWith('hometax_');
    const isFinance = id.includes('bank') || id.includes('card') || id === 'bank_transactions' || (knowledge?.category === 'FINANCE') || isHometax;

    // 2. 물리/가상 테이블 마스터 정보 조회
    const [tableMasters, reportMasters] = await Promise.all([
      queryTable('table_master', { filters: { tableName: id } }).catch(() => []),
      queryTable('dashboard_master', { filters: { reportId: id } }).catch(() => [])
    ]);

    const tableMaster = tableMasters[0];
    const reportMaster = reportMasters[0];

    // 3. 실시간 샘플 데이터 및 스키마 추론 (Discovery)
    let baseSchema: any[] = [];
    let rows: any[] = [];
    try {
      // runAITool을 통해 실제 데이터 소스(금융, 홈택스, 워크스페이스)에서 샘플 5건 추출
      const sampleRes = await runAITool('run_studio_data_query', { 
        tableId: id, 
        intent: 'list', 
        limit: 5 
      }).catch(() => null);

      rows = Array.isArray(sampleRes) ? sampleRes : (sampleRes?.rows || sampleRes?.transactions || []);
      
      if (rows && rows.length > 0) {
        baseSchema = Object.keys(rows[0]).map(key => ({ 
          name: key, 
          type: typeof rows[0][key] === 'number' ? 'NUMBER' : 'TEXT', 
          displayName: key 
        }));
      } else if (reportMaster && reportMaster.columns) {
        baseSchema = JSON.parse(reportMaster.columns);
      }
    } catch (e) {
      console.warn(`[Context Discovery Failed] ${id}:`, e);
    }

    // 4. 통합 컨텍스트 구성
    const displayName = knowledge?.displayName || reportMaster?.name || tableMaster?.displayName || id;
    const description = knowledge?.description || reportMaster?.description || tableMaster?.description || '사용자 데이터 소스';
    
    let finalSchema = baseSchema;
    
    // 지식 베이스에 저장된 스키마 정보(비즈니스 별칭 포함)가 있다면 추가 적용
    if (knowledge?.schema_info) {
      try {
        const enrichedSchema = JSON.parse(knowledge.schema_info);
        finalSchema = finalSchema.map(s => {
          const enriched = enrichedSchema.find((es: any) => es.name === s.name);
          return enriched ? { ...s, ...enriched } : s;
        });
      } catch(e) {}
    }

    // 5. 분석 가이드 주입
    let usageNote = knowledge?.usage_guide || '';
    if (isFinance && !usageNote) {
      usageNote = "이 데이터는 이지데스크 통합 금융 데이터입니다. 실제 데이터 샘플(sampleData)을 참고하여 컬럼 구조를 파악하고 분석하십시오.";
    }

    return {
      id,
      name: displayName,
      description,
      usageNote, // 분석 가이드 추가
      category: knowledge?.category || tableMaster?.category || 'General',
      insight: knowledge?.insight,
      aiRules: knowledge?.ai_rules ? JSON.parse(knowledge.ai_rules) : [], // 가드레일 규칙 주입
      schema: finalSchema,
      sampleData: rows && rows.length > 0 ? rows : [], // 실제 데이터 샘플 주입
      availableTools: ['run_studio_data_query']
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

  const apiKey = await SystemConfigService.getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 관리자 설정에서 API 키를 입력해주세요.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview", 
    tools,
  }, { apiVersion: 'v1beta' });

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
    제공된 정보에는 각 테이블의 'schema'(구조)뿐만 아니라 **'sampleData'(실제 데이터 10개 샘플)**가 포함되어 있습니다.
    ${JSON.stringify(contexts, null, 2)}
    
    ${criticalHints ? `[CRITICAL TABLE HINTS] (MUST FOLLOW)\n${criticalHints}\n` : ''}
    
    [현 시점 정보]
    - 현재 일시: ${currentTime}
    - 사용자가 "최근 N일", "오늘", "이번 달", "최근 N개월" 등 상대적인 기간을 언급하는 경우:
      * **도구 호출(Function Call)** 시에는 위 일시를 기준으로 계산한 실제 정적 날짜 문자열(예: '2026-05-09')을 전달하여 데이터를 실시간으로 가져옵니다.
      * 하지만 생성하는 차트 설정의 **\`refreshMetadata.args\` 내의 \`startDate\`와 \`endDate\`에는 절대로 정적 날짜 문자열을 하드코딩하지 말고, 반드시 동적 플레이스홀더(\`$TODAY\`, \`$TODAY-N\`, \`$START_OF_MONTH\`, \`$END_OF_MONTH\`, \`$START_OF_YEAR\`, \`$END_OF_YEAR\` 등)를 사용**하여 작성해야 합니다. (예: "최근 7일간의 지출" -> startDate는 "$TODAY-7", endDate는 "$TODAY")
    
    [데이터 분석 및 시각화 원칙] (IMPORTANT)
    1. **단일 도구 활용**: 데이터를 가져올 때는 오직 'run_studio_data_query' 도구만 사용하십시오. 이 도구는 일반 테이블, 금융 통합 뷰(bank_transactions 등), 그리고 **국세청(Hometax) 시스템 테이블**을 모두 지원하는 '유니버설 쿼리 도구'입니다.
    2. **조회 의도(Intent) 및 집계**: 
       - 전체 흐름이나 추이가 필요할 때는 'intent: "monthly"' 또는 'intent: "summary"'를 사용하십시오.
       - **유니버설 날짜 집계 (Universal Date Aggregation)**: 어떤 테이블이든 날짜 기반 합계가 필요하면 'groupBy'에 다음 특수 키를 사용하십시오. 시스템이 날짜 컬럼을 찾아 자동으로 집계하고 날짜순으로 정렬해 줍니다.
         * '__month': 월별 집계 (YYYY-MM) - **가장 권장되는 방식**
         * '__week': 주별 집계 (YYYY-W01)
         * '__year': 연별 집계 (YYYY)
       - 개별 거래 내역이나 로우 데이터가 필요할 때는 'intent: "list"'를 사용하십시오.
       - 일반적인 그룹화 집계가 필요할 때는 'groupBy'와 'valueKey' 인자를 전달하십시오.
    3. **금융 데이터 정밀 분석**: 'intent: "monthly"' 사용 시 'tableId'에 'card'가 포함되면 카드 내역만, 'bank'가 포함되면 은행 내역만 자동으로 필터링되어 반환됩니다. 금융 데이터 추이를 시각화할 때 매우 유용합니다.
    4. **기간 필터링**: 사용자의 요청에 기간이 포함되어 있다면 반드시 'startDate'와 'endDate' (YYYY-MM-DD 형식)를 도구에 전달하십시오.
    5. **시각화 우선**: 도구 호출을 통해 데이터를 확보했다면, 이를 즉시 차트(Line, Bar, Pie 등)로 시각화하여 제안하십시오.
    6. **보안 지침**: SQL을 직접 작성할 수 없으므로, 모든 데이터 조작은 제공된 도구의 인자를 통해서만 수행하십시오.
    
    [범용 데이터 소스 분석 원칙 (Universal Analysis)]
    금융이나 홈택스 외의 생소한 데이터 소스를 분석할 때는 다음 원칙을 따르십시오:
    1. **시맨틱 매핑(Semantic Mapping)**: 스키마의 컬럼명을 분석하여 비즈니스 의미를 유추하십시오.
       - **날짜(Date)**: '일자', '날짜', '시간', 'date', 'at', 'time' 등이 포함된 컬럼.
       - **수치(Metric)**: '금액', '수량', '가액', '단가', 'amount', 'price', 'qty', 'count' 등이 포함된 숫자 컬럼.
       - **구분(Dimension)**: '종류', '구분', '유형', '카테고리', '상태', 'type', 'category', 'status' 등이 포함된 텍스트 컬럼.
    2. **지식 활용(Knowledge-First)**: 제공된 \`usageNote\`(사용자 가이드)나 \`aiInsight\`(과거 인사이트)가 있다면, 당신의 일반적인 추측보다 이를 100% 우선하여 분석 전략을 세우십시오.
    3. **데이터 탐색(Discovery)**: 스키마만으로 분석이 불확실하다면 \`run_studio_data_query\` 도구(intent: "list")로 실제 데이터 샘플을 확인하여 컬럼의 실제 값 형태를 파악한 뒤 분석을 진행하십시오.
    4. **모호성 해결**: 컬럼명이 모호할 경우, 가장 관련성 높은 컬럼을 선택하되 답변 시 "스키마의 [컬럼명]을 기준으로 분석했습니다"라고 명시하여 투명성을 유지하십시오.
    
    [홈택스(Hometax) 데이터 분석 특수 규칙]
    홈택스 데이터를 다룰 때는 다음 비즈니스 분류 및 **기술적 제약**을 반드시 준수하십시오:
    1. **매출 관련 데이터 (3종 필수 합산)**: '매출 세금계산서', '매출 계산서', '매출 현금영수증'. 이 3가지가 모두 합산되어야 정확한 전체 매출이 산출됩니다.
    2. **매입 관련 데이터 (2종 필수 합산)**: '매입 세금계산서', '매입 계산서'.
    3. **유니버설 도구 활용**: 홈택스 분석 시에도 반드시 \`run_studio_data_query\`를 사용하십시오. 이 도구는 내부적으로 국세청 전용 API를 호출하여 기간별 필터링을 완벽하게 지원합니다.
    4. **SQL 작성 금지 사항 (CRITICAL)**: 홈택스 데이터에 대해 직접 SQL을 작성하지 마십시오. 스키마에 정의된 한글 컬럼명(예: '공급가액', '작성일자')을 기반으로 \`run_studio_data_query\`의 \`groupBy\` 및 \`valueKey\`를 활용하십시오.
    5. **연도별/월별 필터링**: 별도의 SQL 없이 도구의 \`startDate\` 및 \`endDate\` 인자를 사용하여 기간을 제어하십시오. 2025년 전체 데이터가 필요하면 \`startDate: "2025-01-01", endDate: "2025-12-31"\`을 사용하십시오.
    
    [테이블별 특수 가이드 (Context Hints) 준수] (CRITICAL)
    - **스키마 우선 원칙**: 당신의 지식보다 [분석 대상 테이블 정보]에 제공된 각 테이블의 'schema' 정보를 100% 신뢰하십시오. 테이블마다 컬럼명이 다르므로 반드시 쿼리 전에 확인하십시오.
    - 지침 예시: "금액 합계 시 스키마에 정의된 **금액 컬럼**(예: '공급가액', \`supplyAmount\`, \`totalAmount\`)을 사용해", "날짜는 스키마의 날짜 컬럼 기준이야" 등.
    - 당신이 직접 SQL을 생성하거나 집계 도구를 사용할 때, 이러한 비즈니스 힌트가 있다면 일반적인 추측보다 우선하여 적용하십시오.
    
    [당신의 권한 및 도구 사용 규칙]
     0. **데이터 탐색 및 전체 조망 (Initial Discovery)**: 
        - 분석 시작 전 또는 정보가 부족할 때 **가장 먼저 \`list_available_tables\` 도구를 호출**하여 가용 테이블 목록을 확인하십시오.
     1. **금융 현황 조회 원칙 (Finance Status First)**: 
        - **계좌별 잔액 현황**이나 **카드 목록**이 필요할 경우, 절대 거래 내역을 직접 합산하지 마십시오.
        - 반드시 **\`bank_accounts\`** (은행) 또는 **\`card_accounts\`** (카드) 테이블을 \`intent: "list"\`로 조회하십시오. 도구가 마스터 정보와 실시간 잔액을 이미 조인하여 최상의 데이터를 반환할 것입니다.
     2. **공통 마스터 테이블 활용**: 
        - \`bank_accounts\`, \`card_accounts\`, \`hometax_connections\` 등은 언제나 조회 가능한 보조 데이터 소스입니다.
     3. **다회 호출 권장 (Multi-Step Reasoning)**: 
        - 한 번의 호출로 끝내려 하지 말고, 필요하다면 도구를 여러 번 호출하여 데이터를 완성하십시오.
     4. **선택된 테이블 우선**: 
        - 사용자가 선택한 테이블이 분석의 시작점이지만, 금융 현황 파악을 위한 위 2단계 전략은 필수 권장 사항입니다.
    
    [중요 지침]
    - **Parameters 정확성**: 도구 호출 시 'tableId' 값은 [분석 대상 테이블 정보]에 기재된 ID를 토씨 하나 틀리지 않고 그대로 사용하십시오.
    - **정직한 응답**: 분석 대상 테이블 정보가 비어있을 때만 "테이블을 선택해 주세요"라고 안내하십시오. 정보가 있다면 그 테이블의 스키마를 바탕으로 분석을 시작하십시오.
    - **도구 호출 오류 방지**: 홈택스 분석 시 금융 전용 요약 도구 호출 로직을 사용하지 마십시오. 오직 'run_studio_data_query'의 인자를 통해 데이터를 필터링하십시오.
    
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
       - "최근 10개 내역" 등을 요청하면 \`run_studio_data_query\` 도구를 \`limit: 10\`으로 설정하여 호출하십시오.
    4. 당신이 이전에 생성한 차트나 분석 내용을 기억하고, 사용자가 "그 차트에 ~를 추가해줘"라고 하면 이전 대화 맥락을 바탕으로 수정된 내용을 반영하여 도출하세요. 단, 이전에 시각화된 데이터가 화면에서 사라지지 않도록 응답에는 이전에 출력했던 다른 차트들을 포함한 **전체 chartConfigs 배열을 반드시 반환**하세요.
    5. 만약 사용자의 메시지가 "[대상 차트: '차트제목'] {요청내용}" 형식이면, 해당 제목을 가진 차트를 찾아 설정을 수정하세요. 다른 원본 차트들은 그대로 유지한 상태로, 이들을 모두 합쳐서 전체 chartConfigs 배열로 반환해야 합니다. 일부만 반환하면 화면에서 기존 차트가 날아가는 버그가 생깁니다.
    6. **정밀 색상 제어**: 차트의 개별 요소(막대, 파이 조각 등)의 색상을 개별적으로 지정하려면 'data' 배열의 각 객체에 '"color": "#hex"' 속성을 추가하십시오. 특정 항목의 색상만 변경하라는 요청을 받으면, **해당 항목의 색상만 수정하고 다른 항목들은 기존에 적용되었던 색상을 유지**하여 일관성을 지키십시오.
    7. 이제 차트 막대나 선 위에 금액(값)을 상시 표시할 수 있습니다. 사용자가 수치를 직접 보고 싶어 한다면 chartConfigs에서 "showLabels": true를 설정하십시오. (기본적으로 true를 권장합니다)
    8. 데이터가 20건을 넘어가면 요약하는 것이 원칙이나, 사용자가 '계좌 목록'이나 '전체 내역'을 요청한 경우(특히 금융 분석)에는 20건 제한을 무시하고 최대한 모든 데이터를 표로 나열하세요. 만약 도구 결과에 'fullTableMarkdown' 필드가 있다면, 이를 가공하지 말고 사용자에게 즉시 그대로 출력하여 보여주세요.
    9. **표(Table) 시각화 상세 규칙**:
       - **사용자 정의 우선**: 사용자가 특정 컬럼들을 나열(예: "A, B, C 순으로 보여줘")한 경우, **반드시 요청된 순서대로 빠짐없이** 컬럼(series)을 구성하십시오.
       - **합계(Total) 행 처리**: 사용자가 "합계 행 포함" 또는 "총계 보여줘"라고 요청하면, 데이터의 마지막 행에 합계 결과 데이터를 직접 계산하여 추가하십시오. (예: { "actualBankName": "총 합계", "balance": 50000000 })
       - **금융 데이터 기본값**: 별도의 컬럼 지정이 없는 금융 분석의 경우, '은행명'(_bankName), '계좌번호'(_accountNumber), '계좌명'(_accountName), '현재잔액'(balance)을 포함하는 것이 표준입니다.
    10. **설계 중심 분석 (Configuration-First) (CRITICAL)**:
        - 당신의 주된 역할은 데이터를 직접 나열하는 것이 아니라, **"어떤 데이터를 어떤 방식으로 보여줄지"에 대한 설계도(Metadata)**를 작성하는 것입니다.
        - 가능한 한 \`chartConfigs\` 내의 \`refreshMetadata\`를 완벽하게 작성하여, 시스템 엔진이 데이터를 직접 가져오고 렌더링할 수 있게 하십시오.
        - 특히 표(Table) 시각화 시, 'data' 배열에 수천 건을 직접 채우기보다 상위 20건 정도의 샘플만 채우고, 나머지는 \`refreshMetadata\`의 도구와 인자 정보를 통해 엔진이 처리하게 하십시오.
    11. **완벽한 JSON 출력 (TOP PRIORITY)**: 
        - 당신의 응답은 시스템에서 즉시 \`JSON.parse()\` 처리됩니다. 
        - **마크다운 금지**: 절대 \` \` \`json ... \` \` \` 과 같은 마크다운 코드 블록을 사용하지 마십시오. 오직 순수 JSON 객지( { ... } )만 출력하십시오.
        - **특수 문자 이스케이프**: \`content\` 필드 내의 모든 쌍따옴표는 \`\\"\`로, 줄바꿈은 \`\\n\`으로 반드시 이스케이프하십시오.
        - **데이터 부재 설명**: "2025년 매출액은 0원입니다"라고만 하지 말고, "선택하신 2025년 기간에는 조회된 데이터가 없으나, 샘플링 결과 2026년 1월 데이터가 존재함을 확인했습니다."와 같이 정교하게 설명하십시오.
        - 'sourceDescription': 데이터가 어떻게 추출되었는지에 대한 한글 설명 (예: "최근 6개월간의 월별 카드 지출 합계")
        - 'refreshMetadata': 자동 갱신을 위한 기술적 정보. 사용한 도구명('tool'), 인자('args'), 그리고 도구 결과 필드를 차트 데이터('label', 'value')로 매핑하는 정보('mapping')를 포함하십시오. **특히, \`args\`의 \`startDate\`, \`endDate\`는 항상 상대 기간(예: "$TODAY-7", "$TODAY", "$START_OF_MONTH", "$END_OF_MONTH") 형태의 동적 플레이스홀더를 기재해야 갤러리 및 대시보드 로드 시 동적으로 최신화됩니다.**
    
    응답 JSON 형식 (반드시 다음 구조를 지키고, 특히 chartConfigs의 'type'은 필수로 포함하십시오):
    {
      "content": "분석 결과 요약 (표 상세 내용은 아래 차트 영역에 생성됨)",
      "chartConfigs": [
        {
          "type": "bar | line | area | pie | table", // (REQUIRED) 차트의 종류를 반드시 명시하십시오.
          "data": [{"label": "2025-01", "value": 100, "color": "#2563eb"}],
          "xAxis": "축으로 사용할 키 (예: 'label')",
          "series": [{"key": "value", "name": "합계", "color": "#hex"}],
          "title": "차트 제목",
          "showLabels": true,
          "sourceDescription": "데이터 추출 로직 설명",
          "refreshMetadata": {
            "tool": "run_studio_data_query",
            "args": {"tableId": "...", "intent": "list | monthly", "groupBy": "__month", "valueKey": "..."},
            "mapping": {"label": "label", "value": "value"}
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
