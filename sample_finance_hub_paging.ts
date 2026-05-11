
import { 
  queryTaxInvoices, 
  queryTaxExemptInvoices, 
  queryCashReceipts 
} from './egdesk-helpers.ts';

async function sampleFinanceHubWithPaging() {
  console.log('>>> [FinanceHub Audit] 페이징 파라미터를 명시하여 재검증을 시작합니다...');
  
  const tasks = [
    { name: 'Tax Invoices (Sales)', fn: () => queryTaxInvoices({ invoiceType: 'sales', limit: 10, offset: 0 }) },
    { name: 'Tax Invoices (Purchase)', fn: () => queryTaxInvoices({ invoiceType: 'purchase', limit: 10, offset: 0 }) },
    { name: 'Tax Exempt Invoices', fn: () => queryTaxExemptInvoices({ limit: 10, offset: 0 }) },
    { name: 'Cash Receipts', fn: () => queryCashReceipts({ limit: 10, offset: 0 }) }
  ];

  for (const task of tasks) {
    try {
      console.log(`\n--- [${task.name}] 샘플링 중... ---`);
      const res = await task.fn();
      
      // 결과 구조 확인 (res.rows 또는 res 직접 배열 등)
      const rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
      
      if (rows.length > 0) {
        console.log(`성공! 발견된 실제 컬럼 (${rows.length}건 조회됨):`);
        console.log(Object.keys(rows[0]).join(', '));
      } else {
        console.log('결과: 명시적 페이징에도 불구하고 데이터가 0건입니다.');
      }
    } catch (error: any) {
      console.warn(`결과: 에러 발생 - ${error.message}`);
    }
  }
}

sampleFinanceHubWithPaging();
