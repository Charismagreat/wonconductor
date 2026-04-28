import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { queryTable } from "@/egdesk-helpers";
import { runAITool } from "@/lib/ai-tools";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// 도구(Tools) 정의
const tools: any[] = [
  {
    functionDeclarations: [
      {
        name: "get_finance_monthly_summary",
        description: "금융 허브의 월별 지출/수입 요약을 가져옵니다. 전월 대비 비교 등에 사용하세요.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            months: { type: SchemaType.NUMBER, description: "조회할 개월 수 (최근 N개월)" }
          }
        }
      },
      {
        name: "get_finance_statistics",
        description: "특정 기간 동안의 금융 자산 통계(카테고리별 지출 등)를 조회합니다.",
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
        description: "승인일자(approvalDate)를 기준으로 카드 사용 내역을 정확히 집계합니다. 사용자가 '정확한 금액' 또는 '승인일 기준'을 요청할 때 반드시 이 도구를 사용하세요.",
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
        description: "항목별로 값을 집계(SUM)합니다. 삭제되지 않은 유효 데이터만 계산합니다. groupByKey와 sumKey는 반드시 테이블 스키마의 실제 필드명(예: '구 분', '금 액')을 사용하세요. 반환 형식은 항상 고정: [{label: '그룹값', value: 합계숫자}, ...] 입니다. 차트를 만들 때 반드시 xAxis는 'label', series의 key는 'value'로 설정하세요.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tableId: { type: SchemaType.STRING, description: "보고서 ID" },
            groupByKey: { type: SchemaType.STRING, description: "집계 기준 열 (스키마의 실제 키, 예: '구 분')" },
            sumKey: { type: SchemaType.STRING, description: "합산할 열 (스키마의 실제 키, 예: '금 액')" }
          },
          required: ["tableId", "groupByKey", "sumKey"]
        }
      },
      {
        name: "execute_analytical_sql",
        description: "데이터 필터링 등 단순 조회용 원시 쿼리입니다. 테이블명은 'dashboard_data'. WHERE 조건 예시: WHERE reportId = 'xxx'. 주의: 데이터베이스 보안 필터에 의해 'DELETE' 텍스트(isDeleted 등 포함)가 포함되면 즉시 차단되므로 단일 항목 집계를 원한다면 절대 이 도구보다 'get_aggregated_report_data'를 쓰세요. 불가피할 때만 쓰세요.",
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
        description: "워크스페이스 테이블의 데이터를 필터링하여 조회합니다.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tableId: { type: SchemaType.STRING, description: "보고서 ID" },
            limit: { type: SchemaType.NUMBER, description: "조회할 행 수" },
            offset: { type: SchemaType.NUMBER, description: "건너뛸 행 수" }
          },
          required: ["tableId"]
        }
      },
      {
        name: "list_bank_accounts",
        description: "등록된 은행 계좌 목록과 현재 잔액 정보를 가져옵니다. '은행별 잔액', '계좌 현황' 요청 시 반드시 사용하세요.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            bankId: { type: SchemaType.STRING, description: "특정 은행 ID (선택 사항)" }
          }
        }
      },
      {
        name: "get_finance_dashboard_summary",
        description: "MY DB(대시보드) 메인 화면에 표시되는 전체 금융 통계(은행별 잔액, 전체 거래 건수 등)를 그대로 가져옵니다. 대시보드와 동일한 숫자를 보여줘야 할 때 가장 먼저 사용하세요.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {}
        }
      },
      {
        name: "query_bank_transactions",
        description: "은행 계좌의 상세 입출금 거래 내역을 조회합니다. '거래 내역', '입출금 리스트' 요청 시 사용하세요.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            startDate: { type: SchemaType.STRING, description: "시작일 (YYYY-MM-DD)" },
            endDate: { type: SchemaType.STRING, description: "종료일 (YYYY-MM-DD)" },
            limit: { type: SchemaType.NUMBER, description: "조회 건수" }
          }
        }
      },
      {
        name: "query_card_transactions",
        description: "신용카드의 상세 결제 내역을 조회합니다. '카드 내역', '결제 리스트' 요청 시 사용하세요.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            startDate: { type: SchemaType.STRING, description: "시작일 (YYYY-MM-DD)" },
            endDate: { type: SchemaType.STRING, description: "종료일 (YYYY-MM-DD)" },
            limit: { type: SchemaType.NUMBER, description: "조회 건수" }
          }
        }
      }
    ]
  }
];

const model = genAI.getGenerativeModel({ 
  model: "gemini-3-flash-preview", 
  tools,
}, { apiVersion: 'v1beta' });

// ... (ChartConfig 등 인터페이스 생략)

/**
 * 선택된 테이블들의 기본 컨텍스트를 수집합니다.
 */
async function getInitialContext(tableIds: string[]) {
  const contexts = await Promise.all(tableIds.map(async (id) => {
    // FinanceHub 특정 테이블들에 대한 정밀 컨텍스트 부여 (다양한 ID 패턴 대응)
    const isBank = id === 'finance_bank_transactions' || id === 'finance-hub-bank-table' || id === 'rep-finance_bank_transactions';
    const isCard = id === 'finance_card_transactions' || id === 'finance-hub-card-table' || id === 'rep-finance_card_transactions';
    const isHometax = id.includes('hometax') || id.includes('tax_invoices');
    const isPromissory = id.includes('promissory');
    const isFinanceHub = id === 'finance-hub-table' || isBank || isCard || isHometax || isPromissory;

    if (isFinanceHub) {
      // 가상 금융 테이블을 위한 고정 스키마 정의 (실제 시스템 컬럼 반영)
      const bankSchema = [
        { name: 'date', type: 'DATE', displayName: '거래일자' },
        { name: 'time', type: 'TEXT', displayName: '거래시간' },
        { name: 'transaction_datetime', type: 'TEXT', displayName: '거래일시(상세)' },
        { name: '_bankName', type: 'TEXT', displayName: '은행명(표시용)' },
        { name: 'bankId', type: 'TEXT', displayName: '은행ID' },
        { name: 'accountNumber', type: 'TEXT', displayName: '계좌번호' },
        { name: 'accountName', type: 'TEXT', displayName: '계좌명' },
        { name: 'description', type: 'TEXT', displayName: '적요' },
        { name: 'counterparty', type: 'TEXT', displayName: '거래처/상대방' },
        { name: 'customerName', type: 'TEXT', displayName: '고객명' },
        { name: 'withdrawal', type: 'NUMBER', displayName: '출금액' },
        { name: 'deposit', type: 'NUMBER', displayName: '입금액' },
        { name: 'balance', type: 'NUMBER', displayName: '현재잔액' },
        { name: 'type', type: 'TEXT', displayName: '거래유형' },
        { name: 'category', type: 'TEXT', displayName: '카테고리' },
        { name: 'memo', type: 'TEXT', displayName: '메모' },
        { name: 'branch', type: 'TEXT', displayName: '지점' }
      ];
      const cardSchema = [
        { name: 'date', type: 'DATE', displayName: '이용일자' },
        { name: 'cardName', type: 'TEXT', displayName: '카드명' },
        { name: 'cardNumber', type: 'TEXT', displayName: '카드번호' },
        { name: 'merchantName', type: 'TEXT', displayName: '가맹점명' },
        { name: 'amount', type: 'NUMBER', displayName: '결제금액' },
        { name: 'category', type: 'TEXT', displayName: '카테고리' },
        { name: 'status', type: 'TEXT', displayName: '상태' },
        { name: 'approvalDate', type: 'TEXT', displayName: '승인일자' },
        { name: 'approvalNumber', type: 'TEXT', displayName: '승인번호' },
        { name: 'installment', type: 'TEXT', displayName: '할부정보' }
      ];
      const hometaxSchema = [
        { name: 'writeDate', type: 'DATE', displayName: '작성일자' },
        { name: 'issueDate', type: 'DATE', displayName: '발급일자' },
        { name: 'supplierName', type: 'TEXT', displayName: '공급자명' },
        { name: 'supplierBusinessNumber', type: 'TEXT', displayName: '공급자사업자번호' },
        { name: 'receiverName', type: 'TEXT', displayName: '공급받는자명' },
        { name: 'receiverBusinessNumber', type: 'TEXT', displayName: '공급받는자사업자번호' },
        { name: 'supplyAmount', type: 'NUMBER', displayName: '공급가액' },
        { name: 'taxAmount', type: 'NUMBER', displayName: '세액' },
        { name: 'totalAmount', type: 'NUMBER', displayName: '합계금액' },
        { name: 'itemNames', type: 'TEXT', displayName: '품목명' },
        { name: 'invoiceType', type: 'TEXT', displayName: '계산서종류' },
        { name: 'status', type: 'TEXT', displayName: '상태' }
      ];

      let currentSchema = bankSchema;
      if (isCard) currentSchema = cardSchema;
      else if (isHometax) currentSchema = hometaxSchema;
      else if (isPromissory) currentSchema = [{ name: 'issueDate', type: 'DATE', displayName: '발행일' }, { name: 'maturityDate', type: 'DATE', displayName: '만기일' }, { name: 'amount', type: 'NUMBER', displayName: '어음금액' }, { name: 'noteNumber', type: 'TEXT', displayName: '어음번호' }, { name: 'issuer', type: 'TEXT', displayName: '발행인' }, { name: 'receiver', type: 'TEXT', displayName: '수취인' }];

      return {
        id,
        name: isBank ? '은행 계좌 거래 내역' : (isCard ? '신용카드 거래 내역' : (isHometax ? '홈택스 세금계산서 내역' : '금융거래 데이터')),
        description: isBank 
          ? '등록된 모든 은행 계좌의 입출금 및 잔액 정보입니다.' 
          : (isCard ? '등록된 모든 신용카드의 결제 및 사용 내역입니다.' : '금융 및 세무 통합 데이터입니다.'),
        category: 'Finance',
        schema: currentSchema,
        availableTools: isCard 
          ? ['get_finance_monthly_summary', 'get_finance_statistics', 'get_card_usage_by_approval_date', 'query_card_transactions'] 
          : (isHometax ? ['get_aggregated_report_data', 'execute_analytical_sql'] : ['get_finance_monthly_summary', 'get_finance_statistics', 'list_bank_accounts', 'query_bank_transactions', 'get_finance_dashboard_summary'])
      };
    } else {
      const reports = await queryTable('dashboard_master', { filters: { id } });
      const report = reports[0];
      if (!report) return null;
      return {
        id,
        name: report.name,
        schema: JSON.parse(report.columns),
        availableTools: ['get_aggregated_report_data', 'execute_analytical_sql', 'query_workspace_table']
      };
    }
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
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다.");
  }

  const contexts = await getInitialContext(tableIds);
  const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const systemPrompt = `
    당신은 데이터 분석 전문가 및 시각화 전문가입니다. 사용자가 선택한 테이블의 정보를 분석하여 최적의 차트 시각화를 추천하거나 사용자의 질문에 답하세요.
    
    [현 시점 정보]
    - 현재 일시: ${currentTime}
    - 사용자가 "최근", "오늘", "이번 달", "최근 10일" 등을 언급하면 위 일시를 기준으로 도구의 기간(startDate, endDate)을 계산하십시오.
    
    [당신의 권한]
    당신은 실시간으로 데이터를 조회하고 집계할 수 있는 '도구(Tools)'를 가지고 있습니다. 
    1. **잔액 및 계좌 현황 (최우선)**: 사용자가 "현재 잔액", "계좌 현황", "은행별 잔액", 혹은 **"MY DB 테이블", "가상 테이블", "이미 들어와 있는 데이터"** 등을 언급하며 분석을 요청하면 **무조건 'get_finance_dashboard_summary' 도구를 먼저 호출**하십시오. 이 도구는 이지데스크 서버의 가상 테이블 로직을 그대로 사용하여 'bankBreakdown' 정보를 반환합니다. 
       - 'bankBreakdown' 배열의 각 항목은 '은행명', '현재잔액', '계좌번호' 등을 포함합니다.
       - 사용자가 "현명한 방법(MY DB 테이블 직접 쿼리)"을 제안한 것을 기억하고, 이 도구가 그 역할을 수행함을 인지하십시오.
    2. 입출금 상세 내역: 특정 기간의 상세 거래 리스트가 필요할 때만 'query_bank_transactions' 또는 'query_card_transactions'를 사용하십시오.
    3. 지난달 비교 등 집계: 'get_finance_monthly_summary' 등을 호출하십시오.
    
    [중요 지침]
    - 절대로 임의로 0원이라고 추측하지 마세요. 도구 호출 결과가 0이라면 데이터 동기화가 필요한 상태임을 안내하세요.
    - 계좌 정보 출력 시 'bankBreakdown'에 있는 정보를 기반으로 하되, 카드 계좌는 필터링 규칙(이전에 안내됨)을 준수하세요.
    
    [분석 대상 테이블 정보]
    ${JSON.stringify(contexts, null, 2)}
    
    [응답 규칙]
    1. 답변 내용은 한국어로 친절하게 작성하세요.
    2. **표 형식 시각화 통합**: 사용자가 "표 형식으로 보여줘", "내역을 보여줘", "리스트로 보여줘"라고 요청하면, 'content'에는 간단한 요약만 작성하고 **상세 데이터는 반드시 'chartConfigs' 내에 'type: "table"'을 사용하여 독립된 표 컴포넌트로 생성**하십시오.
    3. **최근 데이터 해석**: 
       - 유선/금융 테이블의 경우 현재 일시를 기준으로 기간을 설정하십시오. 
       - 일반 워크스페이스 테이블에서 "최근 10개 내역" 등을 요청하면 'execute_analytical_sql'을 사용하여 'ORDER BY createdAt DESC LIMIT 10' 쿼리를 수행하십시오. 
       - 데이터는 'data'라는 JSON 컬럼을 쓰므로 직접 SQL을 쓸 땐 \`data->>'속성명'\` 을 씁니다.
       - **중요 (SQL 보안 제한)**: 쿼리에 \`DELETE\` 텍스트가 한 글자라도 들어가면(예: \`isDeleted\`, \`deletedAt\`) 백엔드 보안 필터가 즉시 쿼리를 차단하고 에러를 뿜습니다. 따라서 SQL 내에서 isDeleted 등의 필터링 구문을 절대 사용하지 마세요.
       - **가장 좋은 해결책**: 차트를 위한 데이터 집계 요청 시 **'get_aggregated_report_data'** 도구를 적극 사용하세요. 
       - **필수(차트 축 규칙)**: 'get_aggregated_report_data' 도구는 항상 [{label: "그룹명", value: 숫자}, ...] 형식으로 결과를 반환합니다. 따라서 이 도구의 결과로 차트를 만들 때는 **반드시** xAxis를 "label"로, series를 [{key: "value", name: "표시할 이름"}]으로 설정하세요. 이것을 지키지 않으면 차트에 '알 수 없음'만 표시되는 치명적 오류가 발생합니다!
    4. 당신이 이전에 생성한 차트나 분석 내용을 기억하고, 사용자가 "그 차트에 ~를 추가해줘"라고 하면 이전 대화 맥락을 바탕으로 수정된 내용을 반영하여 도출하세요. 단, 이전에 시각화된 데이터가 화면에서 사라지지 않도록 응답에는 이전에 출력했던 다른 차트들을 포함한 **전체 chartConfigs 배열을 반드시 반환**하세요.
    5. 만약 사용자의 메시지가 "[대상 차트: '차트제목'] {요청내용}" 형식이면, 해당 제목을 가진 차트를 찾아 설정을 수정하세요. 다른 원본 차트들은 그대로 유지한 상태로, 이들을 모두 합쳐서 전체 chartConfigs 배열로 반환해야 합니다. 일부만 반환하면 화면에서 기존 차트가 날아가는 버그가 생깁니다.
    6. **정밀 색상 제어**: 차트의 개별 요소(막대, 파이 조각 등)의 색상을 개별적으로 지정하려면 'data' 배열의 각 객체에 '"color": "#hex"' 속성을 추가하십시오. 특정 항목의 색상만 변경하라는 요청을 받으면, **해당 항목의 색상만 수정하고 다른 항목들은 기존에 적용되었던 색상을 유지**하여 일관성을 지키십시오.
    7. 이제 차트 막대나 선 위에 금액(값)을 상시 표시할 수 있습니다. 사용자가 수치를 직접 보고 싶어 한다면 chartConfigs에서 "showLabels": true를 설정하십시오. (기본적으로 true를 권장합니다)
    8. 데이터가 20건을 넘어가면 요약하는 것이 원칙이나, 사용자가 '계좌 목록'이나 '전체 내역'을 요청한 경우(특히 금융 분석)에는 20건 제한을 무시하고 최대한 모든 데이터를 표로 나열하세요. 만약 도구 결과에 'fullTableMarkdown' 필드가 있다면, 이를 가공하지 말고 사용자에게 즉시 그대로 출력하여 보여주세요.
    9. 금융 표 생성 시 '은행명', '계좌번호', '현재잔액'은 반드시 별도의 독립된 컬럼으로 표시해야 하며, 이를 하나로 합치거나 생략해서는 안 됩니다.
    10. 인사말이나 불필요한 설명 없이 반드시 처음부터 끝까지 올바른 1개의 JSON 객체 형식만 문자열로 출력하세요. JSON 파싱이 실패하지 않도록 'content' 등 문자열 내부에 쌍따옴표나 줄바꿈이 있다면 반드시 올바르게 이스케이프('\\n', '\\"') 처리하십시오.
    11. **Explainability & Dynamic Sync**: 차트를 생성할 때 다음 두 필드를 반드시 포함하여 사용자가 데이터의 근거를 이해하고 최신 데이터로 갱신할 수 있게 하십시오.
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

  const lastUserMessage = messages[messages.length - 1].content;
  let response = await chat.sendMessage(lastUserMessage);
  
  // 기능 호출 루프 (Agentic Loop) - 무한 재시도 및 Quota 초과 방지
  let retryCount = 0;
  while (response.response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && retryCount < 2) {
    const functionCalls = response.response.candidates[0].content.parts
      .filter(p => p.functionCall)
      .map(p => p.functionCall!);
    
    const functionResponses = await Promise.all(functionCalls.map(async (call) => {
      let result;
      try {
        result = await runAITool(call.name, call.args);
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
  
  // 디버깅을 위한 상세 로그 기록
  try {
    const logPath = 'c:\\dev\\egdesk_won3\\ExcelToDB\\ai_response_debug.txt';
    const logData = {
      timestamp: new Date().toISOString(),
      responseText,
      fullResponse: response.response,
      retryCount
    };
    require('fs').appendFileSync(logPath, `\n--- DEBUG INFO ---\n${JSON.stringify(logData, null, 2)}\n`);
  } catch(e) {}

  let cleanedResponseText = responseText.trim();

  // JSON 추출 로직 (더 견고하게 수정)
  const firstBrace = cleanedResponseText.indexOf('{');
  const lastBrace = cleanedResponseText.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    const jsonString = cleanedResponseText.substring(firstBrace, lastBrace + 1);
    try {
      // 1차 시도: 표준 파싱
      return JSON.parse(jsonString);
    } catch (e) {
      // 2차 시도: 줄바꿈 및 특수문자 이스케이프 보정 후 파싱
      try {
        const repaired = jsonString
          .replace(/\n/g, " ")
          .replace(/\r/g, " ")
          .replace(/\t/g, " ")
          .replace(/\\([^"\\\/bfnrtu])/g, '$1'); // 잘못된 이스케이프 제거
        return JSON.parse(repaired);
      } catch (e2) {
        console.error("[Final JSON Parse Failure]", e2);
      }
    }
  }

  return { content: responseText || "분석 결과를 생성하는 도중 기술적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
}
