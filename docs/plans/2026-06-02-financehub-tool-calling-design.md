# 2026-06-02 대시보드 금융(FinanceHub) API 폭격 및 도구 호출 개선 설계 문서

본 문서는 마이 대시보드(`/dashboard`) 로딩 시 고정(Pinned) 차트 백그라운드 리프레시 과정에서 발생하는 끔찍한 금융 API 중복 호출(N+1 쿼리 병목)을 완벽히 해결하고, AI 차트 스튜디오 분석 시 금융 도구 호출이 정상적으로 활성화되도록 도구 노출 구조를 개선하기 위한 상세 설계 문서입니다.

## 1. 🔍 문제 상황 및 원인 분석

### 🚨 현상
* 대시보드 페이지 로드 시 백그라운드 스레드에서 `financehub` 관련 조회 쿼리가 수백 번 가까이 중복 실행되어 Quota 초과(`429 Too Many Requests`) 및 대시보드 로딩 지연이 발생함.
* AI 차트 스튜디오 분석 시 금융 관련 도구 호출(Tool Calling) 횟수가 매우 부족하게 처리되어 올바른 금융 대시보드가 그려지지 못함.

### ⚙️ 원인
1. **차트 리프레시 N+1 병목**:
   * 대시보드 진입 시 `refreshUserChartsAction`이 백그라운드에서 모든 핀 고정 차트의 데이터를 리프레시합니다.
   * 이때 금융 차트에 사용되는 `list_bank_accounts` 도구(`src/lib/ai-tools.ts`)가 호출됩니다.
   * 이 도구는 **모든 개별 은행 계좌를 순회(`Promise.all(validAccounts.map)`)하면서 각 계좌 ID별로 `queryBankTransactions({ accountId: id, limit: 1000 })`를 매번 개별 쿼리**하는 심각한 N+1 구조를 가지고 있어, 계좌 수가 많을 때 수백 건의 중복 호출이 폭발적으로 발생했습니다.
2. **AI 도구 노출 제한**:
   * `src/lib/dashboard-ai.ts`의 Generative AI 도구 리스트(`tools`)에는 `run_studio_data_query`와 `list_available_tables`만 등록되어 있어, AI가 고성능 금융 요약 툴들을 인지하지 못해 호출할 수 없었습니다.

---

## 2. 💡 해결 방안 및 상세 설계

### **[개선 1] `list_bank_accounts` 일괄 조회 최적화 리팩토링**
* **개념**: 계좌 목록을 루프 돌며 개별 쿼리하던 것을 제거하고, `queryBankTransactions`에 `accountId`를 전달하지 않고 **단 1회의 대용량 일괄 쿼리**로 모든 거래 내역을 수집한 뒤 메모리 상에서 매핑합니다.

```typescript
// 1. 은행 계좌 목록 한 번 조회
const accRes = await listAccounts();
const accounts = Array.isArray(accRes) ? accRes : (accRes?.accounts || []);
const validAccounts = accounts.filter((acc: any) => {
  const bId = String(acc.bankId || '').toLowerCase();
  const aName = String(acc.accountName || '').toLowerCase();
  return !bId.includes('card') && !aName.includes('카드');
});

// 2. 단 한 번의 대용량 일괄 조회를 통해 전 계좌의 거래 내역을 수집 (N+1 제거!)
const txRes = await queryBankTransactions({ limit: 5000 });
const transactions = Array.isArray(txRes) ? txRes : (txRes?.transactions || []);

// 3. 메모리 상에서 계좌 ID별로 거래 건수, 최근 거래일자, 최종 잔액을 빠르게 계산
const txStats: Record<string, { count: number, balance: number, date: string, timestamp: number }> = {};

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

// 4. 최종 integratedRows 조립 및 반환 (누락 계좌는 Fallback 잔액 적용)
const integratedRows = validAccounts.map((acc: any) => {
  const id = acc.id || acc.accountId;
  const stat = txStats[id];
  const balance = stat?.balance !== undefined ? stat.balance : (acc.balance || 0);
  ...
});
```

### **[개선 2] `dashboard-ai.ts`에 금융 분석 도구 주입**
* `src/lib/dashboard-ai.ts`의 `tools` 배열에 금융 전용 분석 도구들을 명시적으로 선언하여 AI가 자연스럽게 툴 호출을 이용할 수 있도록 보완합니다:
  * `get_finance_dashboard_summary`
  * `get_finance_monthly_summary`
  * `get_finance_statistics`

---

## 3. 🛠️ 구현 및 검증 계획

### **대상 워크스페이스**
* `c:\Users\user\Desktop\ExcelToDB` (요청에 따라 이 워크스페이스만 단독 수정)

### **자동 및 수동 검증**
1. **구문 및 정적 분석**:
   * 수정 후 `npm run build`를 실행하여 Next.js 서버/클라이언트 컴포넌트의 정적 컴파일 무결성을 보증합니다.
2. **동작 테스트**:
   * `scratch/test-list-accounts-batch.ts` 테스트 스크립트를 작성하고 실행하여 리팩토링된 `list_bank_accounts` 툴이 단 1~2회의 RTT 호출만으로 최신 거래일, 잔액을 정확하게 반환하는지 기능 수준에서 완벽히 검증합니다.
