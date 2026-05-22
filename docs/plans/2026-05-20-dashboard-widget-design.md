# 대시보드 금융 위젯 & 계좌 잔액 집계 로직 개선 설계안

본 문서는 EGDesk 대시보드 위젯(Pinned Chart) 및 자금 보고서 템플릿(`CashReport`)에서 은행 계좌 잔액을 계산하고 표시하는 방식에 대한 정밀 분석 결과와, 금융 데이터 무결성 및 시스템 안정성 확보를 위한 개선 설계를 다룹니다.

> [!IMPORTANT]
> **실제 거래 데이터 쿼리 검증 완료**: FinanceHub API(`financehub_query_transactions`)를 실제로 호출하여 거래 데이터 구조를 확인했습니다. 거래 내역에는 고유한 `transaction_datetime` ("2026/05/20 12:03:49") 및 분리된 `date` ("2026-05-20"), `time` ("12:03:49") 필드가 명확하게 반환되고 있음을 검증 완료했습니다.
> 
> 이를 바탕으로 정밀 거래 타임스탬프를 동적 산출하여 **가장 최신의 잔액(latest balance)을 추적 및 보장**하도록 개선 설계되었습니다.

---

## 1. 현황 및 문제점 분석 (Root Cause Analysis)

### 1.1. 거래 정보의 타임스탬프 비교 누락으로 인한 '그날의 첫 거래 잔액' 채택 결함
- **발생 위치**: [CashReport.tsx](file:///c:/EGDesk-Templates/ExcelToDB/src/components/publishing/templates/CashReport.tsx#L285-L295)
- **원인 기작 (Mechanism)**:
  - 기존 코드에서는 날짜 문자열 `date`를 기반으로 `new Date(date).getTime() >= new Date(balances[key].lastDate).getTime()`을 연산하여 최신성을 판별했습니다.
  - 하지만 거래 데이터 내에 정밀한 **거래 일시(`transaction_datetime` / `time` 등)**가 반환됨에도 불구하고 이를 비교하지 않고 단순 날짜 비교에 의존하였습니다.
  - 시간 정보가 없는 단순 날짜 문자열이거나 타임스탬프 비교 누락 시, 연산자 등호(`>=`)로 인해 루프를 순회하면서 **나중에 나타나는 과거 거래(그날의 첫 번째 거래)의 잔액**으로 최종 덮어써지는 심각한 오류가 발생했습니다.

### 1.2. 마이너스 통장 잔액의 `NaN` 위험 및 Recharts 백화 현상
- **발생 위치**: [SmartChart.tsx](file:///c:/EGDesk-Templates/ExcelToDB/src/components/SmartChart.tsx#L272-L278) 및 [SmartChart.tsx](file:///c:/EGDesk-Templates/ExcelToDB/src/components/SmartChart.tsx#L520-L532)
- **원인**:
  - 마이너스 통장 조건(`isMinusAcc`)이 만족할 때 `Number(item.약정금액) + rawVal`을 통해 가용한도를 계산합니다. 하지만 `item.약정금액`이 유효한 숫자가 아닌 특수 문자열(예: `"협의"`, `"없음"`)이거나 누락된 경우, 이 계산 결과는 **`NaN`**이 되어 Recharts 차트 렌더링을 완전히 마비(백화)시킵니다.

### 1.3. 금융 잔액 절댓값 처리로 인한 순자산 부풀리기 오류 (금융 왜곡)
- **발생 위치**: [SmartChart.tsx](file:///c:/EGDesk-Templates/ExcelToDB/src/components/SmartChart.tsx#L277)
- **원인**:
  - 만약 대출이나 마이너스 통장 등 음수(-) 잔액을 가진 계좌에 대해 `item.약정금액` 정보가 누락되었거나 마이너스 통장이 아님에도 일시적으로 계좌 잔액이 음수로 내려간 경우, `Math.abs(rawVal)`을 취하여 무조건 양수로 합산합니다. 이로 인해 실제 부채가 자산으로 더해져 총자산이 비정상적으로 부풀려집니다.

---

## 2. 해결 및 개선 설계 (Proposed Solutions)

### 2.1. 거래 정밀 일시(`transaction_datetime`) 기반 타임스탬프 비교 (A1 완벽 해결)
1. **타임스탬프 동적 산출 헬퍼 함수 (`getSafeTimestamp`) 구현**:
   - 실제 반환 데이터 포맷에 맞추어 `transaction_datetime` (예: `"2026/05/20 12:03:49"`) 또는 `date` + `time` 조합을 결합해 정밀 밀리초 타임스탬프(`ms`)를 산출합니다.
   - 폴백으로 데이터 적재 시각인 `createdAt`을 파싱하여 정합성을 보장합니다.
2. **잔액 업데이트 조건 정밀화**:
   - 추출된 정밀 타임스탬프 값을 기준으로 `currentTimestamp > balances[key].lastTimestamp` 일 경우에만 잔액을 업데이트합니다.
   - 타임스탬프가 완벽히 동일할 경우, 덮어쓰기를 막아 최신 거래 순으로 들어오는 데이터의 잔액 정합성을 완벽하게 유지합니다.

### 2.2. 금융 잔액 계산 안전성 및 정확성 확보 (SmartChart.tsx)
1. **안전한 약정금액 숫자 파싱 및 NaN 방지**:
   - 콤마(`,`) 등 특수문자가 포함된 문자열이더라도 견고하게 숫자로 파싱할 수 있는 유틸리티를 적용하여 `NaN` 전파를 원천 차단합니다.
2. **올바른 순자산 합계 계산 (절댓값 합산 제거)**:
   - 한도가 없는 음수 잔액 계좌(또는 대출 계좌)의 경우, 절댓값을 씌우지 않고 총합에서 음수 값을 그대로 더하여(차감) 실제 순자산이 표시되도록 개정합니다.

---

## 3. 상세 설계안 (Implementation Plan)

### [Component 1] CashReport.tsx (타임스탬프 기반 최신 잔액 확보 패치)

#### 1) 타임스탬프 추출 및 정밀 잔액 집계 로직
```typescript
// 거래 내역 데이터에서 실시간 타임스탬프(밀리초)를 안전하고 정밀하게 추출하는 유틸리티
const getSafeTimestamp = (item: any, dateMappingKey?: string): number => {
  // 1. transaction_datetime 속성이 존재할 때 최우선 사용 ("2026/05/20 12:03:49" 형태 대응)
  if (item.transaction_datetime) {
    const parsed = Date.parse(String(item.transaction_datetime).replace(/\//g, '-'));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 2. date와 time 필드 조합이 있는 경우
  const dateVal = item[dateMappingKey || ''] || item.date || '';
  const timeVal = item.time || '';
  if (dateVal) {
    let cleanStr = String(dateVal).trim().replace(/[\.\/]/g, '-');
    if (/^\d{8}$/.test(cleanStr)) {
      cleanStr = `${cleanStr.substring(0, 4)}-${cleanStr.substring(4, 6)}-${cleanStr.substring(6, 8)}`;
    }
    if (timeVal) {
      cleanStr = `${cleanStr.split(' ')[0]} ${timeVal}`;
    }
    const parsed = Date.parse(cleanStr);
    if (!isNaN(parsed)) return parsed;
  }

  // 3. timestamp 또는 기타 속성 폴백
  if (item.timestamp !== undefined && item.timestamp !== null) {
    const ts = Number(item.timestamp);
    if (!isNaN(ts) && ts > 0) return ts;
  }
  
  // 4. createdAt (DB 적재 UTC 타임스탬프) 폴백
  if (item.createdAt) {
    const parsed = Date.parse(item.createdAt);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  
  return 0;
};

// ...

// CashReport.tsx L249~317 부분 개선
const balances: Record<string, { name: string, balance: number, count: number, lastDate: string, lastTimestamp: number }> = {};
let totalIn = 0;
let totalOut = 0;

const processed = rawData.map(item => {
  // ... (inflow, outflow, rowBalance, bank, accNum, date 추출 생략)
  
  const key = `${bank}-${accNum}`;
  const currentTimestamp = getSafeTimestamp(item, mapping.date);

  totalIn += inflow;
  totalOut += outflow;

  if (!balances[key]) {
    // 1) 신규 계좌 최초 등록
    balances[key] = { 
      name: bank + (accNum ? ` (${accNum})` : ''), 
      balance: rowBalance !== 0 ? rowBalance : (inflow - outflow), 
      count: 1, 
      lastDate: date,
      lastTimestamp: currentTimestamp
    };
  } else {
    balances[key].count += 1;

    // 2) 더 최근의 타임스탬프를 가진 거래인 경우 잔액 덮어쓰기
    if (currentTimestamp > balances[key].lastTimestamp) {
      if (rowBalance !== 0) {
        balances[key].balance = rowBalance;
      }
      balances[key].lastDate = date;
      balances[key].lastTimestamp = currentTimestamp;
    } 
    // 3) 타임스탬프가 완벽히 동일할 경우 (덮어쓰지 않고 최신 잔액 보존)
    else if (currentTimestamp === balances[key].lastTimestamp) {
      if (balances[key].balance === 0 && rowBalance !== 0) {
        balances[key].balance = rowBalance;
      }
    }
  }

  return {
    date,
    description: item[mapping.description] || item.description || item.content || item.remark || '내역 없음',
    inflow,
    outflow,
    amount: inflow > 0 ? inflow : -outflow,
    bank: bank,
    category: item[mapping.category || ''] || item.category || '일반'
  };
});
```

---

### [Component 2] SmartChart.tsx (NaN 방지 및 마이너스 통장 무결성 확보)

#### 1) `totalAmount` 계산부의 정밀 고도화
```typescript
const safeParseNumber = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// ...

const totalAmount = React.useMemo(() => {
  if (!data || data.length === 0) return 0;
  
  const keys = Object.keys(data[0]);
  const amountKey = keys.find(k => /amount|value|금액|잔액|승인금액|출금|입금|공급가액|합계|세액/i.test(k)) || 'value';
  
  return data.reduce((sum, item) => {
    // 1) 합계/소계 요약 행 제외
    const isTotalRow = Object.values(item).some(val => {
      if (typeof val !== 'string') return false;
      const normalized = val.trim().toLowerCase();
      return normalized.includes('합계') || 
             normalized.includes('소계') || 
             normalized.includes('총계') || 
             normalized.includes('누계') || 
             normalized === 'total' || 
             normalized === 'subtotal' || 
             normalized === 'sum';
    });

    if (isTotalRow) return sum;

    const rawVal = safeParseNumber(item[amountKey]);
    const isMinusAcc = rawVal < 0 || String(item.계좌명 || item.name || '').includes('마이너스') || (item.약정금액 !== undefined && item.약정금액 !== null);
    
    if (isMinusAcc) {
      const parsedLimit = safeParseNumber(item.약정금액);
      if (parsedLimit > 0) {
        // 마이너스 통장 가용 한도 적용
        const availableLimit = parsedLimit + rawVal;
        return sum + Math.max(0, availableLimit);
      } else {
        // 대출/약정금액 정보 없는 음수 계좌 -> 순자산에서 차감 (Math.abs 절댓값 제거!)
        return sum + rawVal;
      }
    }
    
    return sum + rawVal;
  }, 0);
}, [data]);
```

#### 2) `type === 'pie'` 가공부의 정밀 고도화
```typescript
      case 'pie': {
        const valKey = chartSeries[0]?.key || 'value';
        const nameKey = xAxis || 'name';
        
        const processedData = safeData.map(item => {
          const rawVal = safeParseNumber(item[valKey]);
          const isMinusAcc = rawVal < 0 || String(item[nameKey]).includes('마이너스') || (item.약정금액 !== undefined && item.약정금액 !== null);
          
          let chartValue = 0;
          if (isMinusAcc) {
            const parsedLimit = safeParseNumber(item.약정금액);
            if (parsedLimit > 0) {
              chartValue = Math.max(0, parsedLimit + rawVal);
            } else {
              chartValue = Math.abs(rawVal);
            }
          } else {
            chartValue = Math.abs(rawVal);
          }
          
          return {
            ...item,
            [valKey]: chartValue,
            _originalValue: rawVal,
            _isMinusAccount: isMinusAcc,
            사용가능한도: isMinusAcc && safeParseNumber(item.약정금액) > 0 ? (safeParseNumber(item.약정금액) + rawVal) : null
          };
        });
        
        // ... (Recharts 및 기타 그룹 구성 로직 유지)
```

---

## 4. 검증 계획 (Verification Plan)

사용자의 로컬 서버 터미널 실행 제약으로 인해, **독립적인 테스트 스크립트 작성 및 비즈니스 엣지 케이스 시뮬레이션 방식**으로 검증을 수행합니다.

### 4.1. 단위 비즈니스 로직 시뮬레이션 테스트
`scratch/verify-balance-logic.js` 스크립트를 작성하여 다음 엣지 케이스들을 대상으로 계산의 정확성을 완벽히 검증합니다:
1. **타임스탬프 기반 최신 잔액 비교 검증**:
   - 실제 쿼리에서 확인한 `transaction_datetime` 및 `time` 데이터를 적용한 테스트셋을 생성하고, 루프 처리 순서와 무관하게 **가장 최근 거래의 잔액이 최종 잔액으로 채택**되는지 검증합니다.
2. **마이너스 통장 가용 한도 및 순자산 계산 검증**:
   - 마이너스 통장(약정금액 존재)과 음수 대출 계좌(약정금액 부재)가 혼재해 있을 때 순자산 합산 금액이 왜곡 없이 제대로 산출되는지 확인합니다.
