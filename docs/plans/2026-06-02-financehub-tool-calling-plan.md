# 대시보드 금융 툴 호출 및 N+1 병목 최적화 구현 계획서 (c:\Users\user\Desktop\ExcelToDB)

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** 대시보드(`/dashboard`) 로딩 시 백그라운드 리프레시로 인해 몰리던 금융 API 호출(N+1 병목)을 전 계좌 일괄 조회 방식으로 전환하여 획기적으로 차단하고, AI 분석용 도구 정의에 금융 전용 분석 툴들을 공식 노출시킵니다.

**Architecture:** 
1. `src/lib/ai-tools.ts`의 `list_bank_accounts`에서 개별 은행 계좌마다 트랜잭션을 쿼리하던 `Promise.all` 루프를 제거하고, `queryBankTransactions({ limit: 5000 })` 일괄 조회를 단 1회 실행하여 메모리 상에서 그룹화/최신 데이터 매핑을 고속으로 처리합니다.
2. `src/lib/dashboard-ai.ts`의 `tools`에 `get_finance_dashboard_summary`, `get_finance_monthly_summary`, `get_finance_statistics` 도구를 명시적으로 정의하여 AI가 금융 관련 시각화 데이터 생성 시 올바른 전용 도구를 호출하도록 지원합니다.

**Tech Stack:** Next.js Server Actions, TypeScript, SQLite, Google Generative AI (Gemini)

---

### Task 1: `src/lib/ai-tools.ts` 리팩토링 (list_bank_accounts N+1 병목 제거)

**Files:**
- Modify: `c:\Users\user\Desktop\ExcelToDB\src\lib\ai-tools.ts`

**Step 1: Write minimal implementation to optimize list_bank_accounts**
`src/lib/ai-tools.ts`의 `list_bank_accounts` 분기(기존 282-358라인)를 다음과 같이 최적화합니다:

```typescript
    case "list_bank_accounts": {
      const accRes = await listAccounts();
      const accounts = Array.isArray(accRes) ? accRes : (accRes?.accounts || []);
      
      const validAccounts = accounts.filter((acc: any) => {
        const bId = String(acc.bankId || '').toLowerCase();
        const aName = String(acc.accountName || '').toLowerCase();
        return !bId.includes('card') && !aName.includes('카드');
      });

      // 단 한 번의 대용량 일괄 조회를 통해 전 계좌의 거래 내역을 수집 (N+1 제거!)
      const txStats: Record<string, { count: number, balance: number, date: string, timestamp: number }> = {};
      
      try {
        const txRes = await queryBankTransactions({ limit: 5000 });
        const transactions = Array.isArray(txRes) ? txRes : (txRes?.transactions || []);
        
        transactions.forEach((tx: any) => {
          const accId = tx.accountId;
          if (!accId) return;

          if (!txStats[accId]) {
            txStats[accId] = { count: 0, balance: 0, date: '', timestamp: 0 };
          }
          
          txStats[accId].count++;
          
          const currentTimestamp = getSafeTimestamp(tx);
          const lastTimestamp = txStats[accId].timestamp;
          
          if (!lastTimestamp || currentTimestamp > lastTimestamp) {
            txStats[accId].date = tx.date;
            txStats[accId].balance = tx.balance;
            txStats[accId].timestamp = currentTimestamp;
          }
        });
      } catch (e) {
        console.error(`Failed to fetch all bank transactions at once:`, e);
      }

      const integratedRows = validAccounts.map((acc: any) => {
        const id = acc.id || acc.accountId;
        const stat = txStats[id];
        const balance = stat?.balance !== undefined ? stat.balance : (acc.balance || 0);
        
        // 약정금액 및 사용가능한도 파싱 (마이너스 통장/대출 전용 메타데이터)
        const rawContract = acc.metadata?.contractAmount || acc.metadata?.payableAmount || '';
        const contractAmount = rawContract
          ? Number(String(rawContract).replace(/[^0-9.-]/g, '')) 
          : null;
        const availableLimit = contractAmount !== null 
          ? contractAmount + balance 
          : null;

        return {
            id: id,
            일자: stat?.date || '기록없음',
            은행명: acc.bankName || acc.bankId,
            계좌번호: acc.accountNumber,
            계좌명: acc.accountName || '일반계좌',
            잔액: balance,
            거래건수: stat?.count || 0,
            약정금액: contractAmount,
            사용가능한도: availableLimit,
            관리점: acc.metadata?.branchName || null,
            _bankName: acc.bankName || acc.bankId,
            _accountNumber: acc.accountNumber
        };
      });

      // 거래가 1건이라도 있거나 잔액이 있는 계좌 반환 (비활성 빈 계좌 배제)
      result = integratedRows
        .filter((acc: any) => acc.거래건수 > 0 || acc.잔액 !== 0)
        .sort((a: any, b: any) => (b.잔액 as number) - (a.잔액 as number));

      return await applyGuardrails('bank_accounts', result);
    }
```

---

### Task 2: `src/lib/dashboard-ai.ts` 개선 (금융 요약/통계 도구 추가)

**Files:**
- Modify: `c:\Users\user\Desktop\ExcelToDB\src\lib\dashboard-ai.ts`

**Step 1: Update tools array definition**
`src/lib/dashboard-ai.ts`의 `tools` 배열 정의(기존 10~46라인)에 금융 특화 3종 분석 도구를 등록합니다:

```typescript
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
      },
      {
        name: "get_finance_dashboard_summary",
        description: "현재 연결된 모든 은행 계좌의 실시간 잔액 현황, 은행명, 계좌번호, 예금 건수 등의 마스터 정보를 요약하여 표(Table)로 가져옵니다. 종합적인 자산 상황 파악에 유용합니다.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {}
        }
      },
      {
        name: "get_finance_monthly_summary",
        description: "최근 수개월 간의 모든 계좌 혹은 특정 계좌/카드의 월별 입출금 및 카드 소비 추이 총액 데이터를 가져옵니다. 금융 데이터의 월별 비교 차트를 그릴 때 사용합니다.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            tableId: { type: SchemaType.STRING, description: "필터링할 금융/카드 테이블 ID (예: 'bank_accounts', 'card_approvals')" },
            months: { type: SchemaType.NUMBER, description: "조회할 최근 개월 수 (기본 6)" }
          }
        }
      },
      {
        name: "get_finance_statistics",
        description: "지정된 기간 동안의 은행 거래 내역 요약 통계(총 입금액, 총 출금액, 거래 빈도 등) 및 계좌별 통계를 가져옵니다.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            startDate: { type: SchemaType.STRING, description: "시작 날짜 (YYYY-MM-DD)" },
            endDate: { type: SchemaType.STRING, description: "종료 날짜 (YYYY-MM-DD)" }
          }
        }
      }
    ]
  }
];
```

---

### Task 3: 빌드 및 일괄 조회 최적화 검증

**Files:**
- Create: `c:\Users\user\Desktop\ExcelToDB\scratch\test-list-accounts-batch.ts`

**Step 1: Write verification script**
`c:\Users\user\Desktop\ExcelToDB\scratch\test-list-accounts-batch.ts`를 작성하여 `list_bank_accounts` 툴이 1회의 일괄 호출을 거쳐 정상적이고 정확하게 잔액 및 건수를 매핑하는지 수동 검증을 지원합니다.

```typescript
import { runAITool } from '../src/lib/ai-tools';

async function verifyBatchLoading() {
    console.log('>>> [검증 시작] 리팩토링된 list_bank_accounts 일괄 조회 툴 실행');
    const start = Date.now();
    try {
        const result = await runAITool('list_bank_accounts', {});
        const duration = Date.now() - start;
        console.log(`>>> [성공] 실행 완료 (소요 시간: ${duration}ms)`);
        console.log(`>>> 총 은행 계좌 개수: ${result.length}개`);
        console.log('>>> 계좌별 취합 샘플:', JSON.stringify(result.slice(0, 3), null, 2));
    } catch (e: any) {
        console.error('>>> [실패] 일괄 조회 도중 오류 발생:', e.message);
    }
}

verifyBatchLoading();
```

**Step 2: Run verification script**
`tsx` 혹은 `npx ts-node`를 사용하여 작성된 스크립트를 실행하고 결과의 무결성을 검증합니다:
Run: `npx tsx scratch/test-list-accounts-batch.ts`
Expected: 성공적으로 계좌별 실 잔액 및 통계 데이터가 출력되며, RTT 호출이 획기적으로 줄어들어 실행 속도가 극적으로 단축됩니다.

**Step 3: Run Next.js build test**
Next.js 정적 빌드가 정상 동작하는지 테스트하여 구문 오류나 alias 오류가 없는지 완벽하게 확인합니다.
Run: `npm run build`
Expected: `Exit code: 0` 및 빌드 성공.
