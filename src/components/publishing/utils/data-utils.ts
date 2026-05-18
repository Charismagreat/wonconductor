export function findNumeric(obj: any, key: string | undefined, fallbackKeywords: string[]): number {
  if (!obj) return 0;

  // 잔액 관련 키워드가 포함된 경우에만 balance/cur_bal 필드 우선 확인
  const isBalanceSearch = fallbackKeywords.some(kw => ['bal', '잔액'].some(b => kw.toLowerCase().includes(b)));

  if (isBalanceSearch) {
    if (obj.balance !== undefined && obj.balance !== null) {
      const val = obj.balance;
      if (typeof val === 'number') return val;
      const cleaned = String(val).replace(/[^0-9.-]/g, '');
      if (cleaned) return Number(cleaned);
    }
    if (obj.cur_bal !== undefined && obj.cur_bal !== null) {
      const val = obj.cur_bal;
      if (typeof val === 'number') return val;
      const cleaned = String(val).replace(/[^0-9.-]/g, '');
      if (cleaned) return Number(cleaned);
    }
  }
  
  // 1. 명시적으로 매핑된 키 확인
  if (key && obj[key] !== undefined) {
    const val = obj[key];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return Number(val.replace(/[^0-9.-]/g, '')) || 0;
  }

  // 2. 키워드 기반 지능형 폴백
  for (const k of Object.keys(obj)) {
    if (fallbackKeywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) {
      const val = obj[k];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.-]/g, '');
        if (cleaned) return Number(cleaned);
      }
    }
  }
  return 0;
}

export function findString(obj: any, key: string | undefined, fallbackKeywords: string[]): string {
  if (!obj) return '';
  
  if (key && obj[key]) return String(obj[key]);

  for (const k of Object.keys(obj)) {
    if (fallbackKeywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) {
      if (obj[k] !== undefined && obj[k] !== null) return String(obj[k]);
    }
  }
  return '';
}

export function extractDate(item: any, mappingKey?: string): string {
  let dateVal = item[mappingKey || ''] || item.date || item.TRAN_DATE || item.transactionDate || item.tranDate || item.date_time || item.transaction_datetime || item.issueDate || item.approvalDate || item.paymentDate || '';
  if (typeof dateVal === 'string' && dateVal.length === 8 && !dateVal.includes('-')) {
      dateVal = `${dateVal.substring(0, 4)}-${dateVal.substring(4, 6)}-${dateVal.substring(6, 8)}`;
  }
  const timeVal = item.time || item.TRAN_TIME || '';
  if (timeVal && typeof dateVal === 'string' && !dateVal.includes(':')) {
      dateVal = `${dateVal.split(' ')[0]} ${timeVal}`;
  }
  return String(dateVal);
}

export function extractAmount(item: any, mappingInflow?: string, mappingOutflow?: string): { inflow: number, outflow: number, amount: number } {
  let inflow = findNumeric(item, mappingInflow, ['inflow', 'deposit', 'inAmt', 'in_amt', 'deposit_amt', 'IN_AMT', '입금', '입금액', '입금금액']);
  let outflow = findNumeric(item, mappingOutflow, ['outflow', 'withdrawal', 'outAmt', 'out_amt', 'withdraw_amt', 'OUT_AMT', '출금', '출금액', '출금금액']);
  
  // 승인 취소 여부 판별 (취소 거래인 경우 반대 방향으로 처리)
  const isCancelled = item.isCancelled === true || item.isCancelled === 'true' || String(item.salesType).includes('취소') || String(item.status).includes('취소');

  if (inflow === 0 && outflow === 0) {
    const genericAmt = findNumeric(item, 'amount', ['amount', 'amt', '승인금액', '결제금액', '금액']);
    if (genericAmt > 0) {
       const isDeposit = item.noteType === 'received' || String(item.type).includes('deposit') || String(item.category).includes('수입');
       if (isCancelled) {
          // 취소된 거래인 경우 입금/출금 성격을 뒤바꿈 (카드 승인 취소 -> 환불/입금 성격으로 변환)
          if (isDeposit) outflow = genericAmt;
          else inflow = genericAmt;
       } else {
          if (isDeposit) inflow = genericAmt;
          else outflow = genericAmt;
       }
    }
  } else {
    if (isCancelled) {
       // 취소된 거래인 경우 기존 입금/출금을 서로 교환
       const temp = inflow;
       inflow = outflow;
       outflow = temp;
    }
  }

  return {
    inflow,
    outflow,
    amount: inflow > 0 ? inflow : -outflow
  };
}
