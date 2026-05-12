
import { 
  listHometaxConnections,
  queryTaxInvoices,
  listBankProductTables
} from './egdesk-helpers.ts';

async function verifyRealSchemas() {
  console.log('>>> [FinanceHub Final Verification] 실데이터 기반 스키마 검증을 시작합니다...');
  
  try {
    // 1. 국세청 연결 상태 확인
    const hometaxConns = await listHometaxConnections();
    console.log('\n[Hometax Connections]:', JSON.stringify(hometaxConns, null, 2));

    // 2. 세금계산서 실데이터 샘플링 (Sales/Purchase 통합 시도)
    console.log('\n[Tax Invoices Sampling]...');
    const taxInvoices = await queryTaxInvoices({ limit: 100, offset: 0 });
    const taxRows = Array.isArray(taxInvoices) ? taxInvoices : (taxInvoices as any)?.rows || [];
    
    if (taxRows.length > 0) {
      console.log('실제 세금계산서 필드:', Object.keys(taxRows[0]).join(', '));
    } else {
      console.log('세금계산서 데이터가 여전히 0건입니다.');
    }

    // 3. 은행 상품 메타데이터 확인 (이미 스키마 정보가 포함됨)
    console.log('\n[Bank Product Tables]...');
    const bankProducts = await listBankProductTables();
    const productList = Array.isArray(bankProducts) ? bankProducts : (bankProducts as any)?.tables || [];
    
    if (productList.length > 0) {
      console.log('첫 번째 은행 상품 실제 필드:', productList[0].columns?.map((c: any) => c.name).join(', '));
    }

  } catch (error: any) {
    console.error('!!! 검증 중 에러 발생:', error.message);
  }
}

verifyRealSchemas();
