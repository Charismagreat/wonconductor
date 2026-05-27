// test_list_banking_summary.ts
import { listBankProductTables } from './egdesk-helpers';

async function testListBankingSummary() {
  console.log('>>> [테스트] listBankProductTables 요약 정보를 조회합니다...');
  try {
    const res = await listBankProductTables();
    const tables = Array.isArray(res) ? res : res.tables || [];
    
    console.log('--------------------------------------------------');
    console.log(`총 테이블 개수: ${tables.length}개`);
    console.log('--------------------------------------------------');
    
    tables.forEach((table: any, index: number) => {
      console.log(`[${index + 1}] Slug: ${table.slug}`);
      console.log(`    이름: ${table.displayName}`);
      console.log(`    은행 ID: ${table.bankId}`);
      console.log(`    상품 라벨: ${table.productLabel}`);
      console.log(`    행 수 (rowCount): ${table.rowCount}`);
      console.log(`    컬럼 목록: ${table.columns.map((c: any) => c.name).join(', ')}`);
      console.log('--------------------------------------------------');
    });
  } catch (error: any) {
    console.error('!!! 테스트 중 에러 발생:', error.message);
  }
}

testListBankingSummary();
