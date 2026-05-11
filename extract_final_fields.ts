
import { 
  queryBankTransactions, 
  queryCardTransactions,
  queryTaxInvoices
} from './egdesk-helpers.ts';

async function finalFieldExtraction() {
  console.log('>>> [Final Schema Tuning] 실제 데이터 행에서 필드명을 직접 추출합니다...');
  
  const targets = [
    { name: 'bank_transactions', fn: () => queryBankTransactions({ limit: 1, offset: 0 }) },
    { name: 'card_approvals', fn: () => queryCardTransactions({ limit: 1, offset: 0 }) },
    { name: 'tax_invoices', fn: () => queryTaxInvoices({ invoiceType: 'purchase', limit: 1, offset: 0 }) }
  ];

  for (const target of targets) {
    try {
      console.log(`\n--- [${target.name}] 실제 필드 추출 중... ---`);
      const res = await target.fn();
      const rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
      
      if (rows.length > 0) {
        console.log(`검증된 실제 필드 목록:`);
        console.log(Object.keys(rows[0]).join(', '));
      } else {
        console.log('데이터가 없어 기본 권장 필드를 유지합니다.');
      }
    } catch (error: any) {
      console.warn(`조회 실패: ${error.message}`);
    }
  }
}

finalFieldExtraction();
