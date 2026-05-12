
import { getTableSchema } from './egdesk-helpers.ts';

async function auditFinancialSchemas() {
  const targetTables = [
    'bank_transactions', 
    'card_approvals', 
    'tax_invoices', 
    'tax_exempt_invoices', 
    'cash_receipts'
  ];
  
  console.log('>>> [Financial Audit] 핵심 금융 테이블 물리 스키마 전수 조사를 시작합니다...');
  
  for (const table of targetTables) {
    try {
      console.log(`\n--- [${table}] 테이블 점검 ---`);
      const res = await getTableSchema(table);
      const cols = Array.isArray(res) ? res : (res as any)?.columns || (res as any)?.schema || [];
      
      if (cols.length > 0) {
        console.log(`발견된 컬럼 (${cols.length}개):`);
        console.log(cols.map((c: any) => `${c.name} (${c.type})`).join(', '));
      } else {
        console.log('결과: 테이블은 존재하나 컬럼 정보가 없거나 비어 있습니다.');
      }
    } catch (error: any) {
      console.warn(`결과: 점검 실패 - ${error.message}`);
    }
  }
}

auditFinancialSchemas();
