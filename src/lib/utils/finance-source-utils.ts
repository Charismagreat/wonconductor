import { 
  queryTaxInvoices, 
  queryTaxExemptInvoices, 
  queryCashReceipts, 
  queryBankTransactions, 
  queryCardTransactions,
  listAccounts,
  listBankProductTables,
  queryBankProductTable
} from '@/egdesk-helpers';
import { inferColumnType } from './schema';

/**
 * 금융/홈택스 소스에서 마이 디비와 동일한 '완벽한 스키마'를 추출합니다.
 */
export async function getFinanceSourceSchema(id: string) {
  const allFetched: any[] = [];
  const limit = 100; // 샘플링용이므로 100건이면 충분
  let offset = 0;

  try {
    // 1. 은행 거래 내역 (모든 계좌 순회)
    if (id === 'bank_transactions') {
      const accounts = await listAccounts();
      const safeAccounts = Array.isArray(accounts) ? accounts : (accounts?.accounts || []);
      const transactionMap = new Map();

      for (const acc of safeAccounts) {
        const targetId = acc.id || acc.accountId;
        const batchData = await queryBankTransactions({ accountId: targetId, limit: 20, offset: 0 });
        const rawBatch = Array.isArray(batchData) ? batchData : (batchData?.rows || batchData?.transactions || []);
        
        for (const d of rawBatch) {
          if (String(d.__is_deleted) === '1') continue;
          
          if (!transactionMap.has(d.id)) {
            transactionMap.set(d.id, {
              ...d,
              bankId: acc.bankId,
              bankName: acc.bankName || acc._bankName,
              accountId: targetId,
              accountNumber: acc.accountNumber,
              accountName: acc.accountName || acc.name
            });
          }
        }
      }
      allFetched.push(...Array.from(transactionMap.values()));
    } 
    // 2. 홈택스 및 카드 내역
    else {
      let batchData: any = null;
      if (id.includes('_tax_invoices')) batchData = await queryTaxInvoices({ invoiceType: id.includes('sales') ? 'sales' : 'purchase', limit, offset });
      else if (id.includes('_exempt_invoices')) batchData = await queryTaxExemptInvoices({ invoiceType: id.includes('sales') ? 'sales' : 'purchase', limit, offset });
      else if (id.includes('cash_receipts')) batchData = await queryCashReceipts({ type: id.includes('sales') ? 'sales' : 'purchase', limit, offset });
      else if (id === 'card_approvals') batchData = await queryCardTransactions({ limit, offset });
      else {
        // 은행 개별 상품 테이블
        const productTables = await listBankProductTables();
        const safeTables = Array.isArray(productTables) ? productTables : (productTables?.tables || []);
        const targetTable = safeTables.find((t: any) => t.slug === id || id.includes(t.slug));
        
        if (targetTable) {
          const res = await queryBankProductTable({ tableSlug: targetTable.slug, limit: 10, offset: 0 });
          allFetched.push(...(Array.isArray(res) ? res : (res?.rows || [])));
        }
      }

      if (batchData) {
        const rawBatch = Array.isArray(batchData) ? batchData : (batchData?.rows || batchData?.transactions || batchData?.invoices || batchData?.receipts || []);
        allFetched.push(...rawBatch.filter((d: any) => String(d.__is_deleted) !== '1'));
      }
    }

    // 3. 데이터 기반 키 추출 (마이 디비 핵심 로직)
    const allKeys = new Set<string>();
    allFetched.forEach(item => {
      Object.keys(item).forEach(key => {
        if (!key.startsWith('_')) allKeys.add(key);
      });
    });

    if (allKeys.size > 0) {
      return Array.from(allKeys).map(k => ({
        name: k,
        displayName: k,
        type: inferColumnType(k)
      }));
    }

    // 4. 데이터가 없을 경우를 대비한 최소한의 기본 스키마 (홈택스용)
    if (id.startsWith('hometax_')) {
      return [
        { name: '작성일자', displayName: '작성일자', type: 'date' },
        { name: '공급자상호', displayName: '공급자상호', type: 'string' },
        { name: '공급받는자상호', displayName: '공급받는자상호', type: 'string' },
        { name: '합계금액', displayName: '합계금액', type: 'currency' },
        { name: '공급가액', displayName: '공급가액', type: 'currency' },
        { name: '세액', displayName: '세액', type: 'currency' },
        { name: '승인번호', displayName: '승인번호', type: 'string' },
        { name: '비고', displayName: '비고', type: 'textarea' }
      ];
    }

    return [];
  } catch (err) {
    console.error(`[FinanceSourceUtils] Failed to fetch schema for ${id}:`, err);
    return [];
  }
}
