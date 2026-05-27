// test_check_woori.ts
import { listBankProductTables, queryBankProductTable } from './egdesk-helpers';

async function testCheckWoori() {
  console.log('>>> [테스트] listBankProductTables에서 woori 관련 테이블이 있는지 검색합니다...');
  try {
    const res = await listBankProductTables();
    const tables = Array.isArray(res) ? res : res.tables || [];
    
    const wooriTable = tables.find((t: any) => t.slug.includes('woori') || t.slug.includes('executions') || t.slug === 'woori_b2b_loan_executions');
    
    if (!wooriTable) {
      console.log('--------------------------------------------------');
      console.log('경고: listBankProductTables 결과에 woori_b2b_loan_executions 테이블이 존재하지 않습니다!');
      console.log('사용 가능한 테이블 목록:');
      tables.forEach((t: any) => console.log(` - Slug: ${t.slug} (displayName: ${t.displayName}, rows: ${t.rowCount})`));
      console.log('--------------------------------------------------');
      return;
    }
    
    console.log('--------------------------------------------------');
    console.log(`테이블 발견! Slug: ${wooriTable.slug}`);
    console.log(`이름: ${wooriTable.displayName}`);
    console.log(`행 수(rowCount): ${wooriTable.rowCount}`);
    console.log(`컬럼 목록:`, JSON.stringify(wooriTable.columns, null, 2));
    console.log('--------------------------------------------------');

    // 만약 테이블이 존재한다면, 지능형 Fallback status 필터 없이 직접 queryBankProductTable 호출
    console.log('\n>>> [테스트] status 필터 없이 직접 queryBankProductTable 호출 시도 (limit: 5)');
    const rawRes = await queryBankProductTable({
      tableSlug: wooriTable.slug,
      limit: 5
    });
    console.log(`결과 - 총 매칭: ${rawRes.totalMatching}, 반환된 행 수: ${rawRes.rows?.length || 0}`);
    if (rawRes.rows && rawRes.rows.length > 0) {
      console.log('데이터 샘플:', JSON.stringify(rawRes.rows.slice(0, 2), null, 2));
    }
  } catch (error: any) {
    console.error('!!! 테스트 실행 중 에러 발생:', error.message);
  }
}

testCheckWoori();
