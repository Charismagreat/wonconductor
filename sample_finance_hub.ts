
import { 
  queryTaxInvoices, 
  queryTaxExemptInvoices, 
  queryCashReceipts 
} from './egdesk-helpers.ts';

async function sampleFinanceHubSchemas() {
  console.log('>>> [FinanceHub Audit] 전용 함수를 통한 실시간 데이터 구조 분석을 시작합니다...');
  
  const tasks = [
    { name: 'Tax Invoices', fn: () => queryTaxInvoices({ limit: 1 }) },
    { name: 'Tax Exempt Invoices', fn: () => queryTaxExemptInvoices({ limit: 1 }) },
    { name: 'Cash Receipts', fn: () => queryCashReceipts({ limit: 1 }) }
  ];

  for (const task of tasks) {
    try {
      console.log(`\n--- [${task.name}] 샘플링 중... ---`);
      const res = await task.fn();
      const rows = Array.isArray(res) ? res : (res?.rows || res?.data || []);
      
      if (rows.length > 0) {
        console.log(`발견된 실제 컬럼:`);
        console.log(Object.keys(rows[0]).join(', '));
      } else {
        console.log('결과: 데이터가 비어 있어 구조를 파악할 수 없습니다.');
      }
    } catch (error: any) {
      console.warn(`결과: 실패 - ${error.message}`);
    }
  }
}

sampleFinanceHubSchemas();
