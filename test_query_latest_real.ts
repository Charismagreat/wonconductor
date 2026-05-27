// test_query_latest_real.ts
import { queryBankProductTable } from './egdesk-helpers';

async function testQueryLatestReal() {
  const tableSlug = 'ibk_b2b_receivables';
  console.log(`>>> [테스트] '${tableSlug}' 테이블을 대상으로 latestOnly 기능 테스트를 시작합니다.`);

  try {
    // 1. 일반 쿼리 (latestOnly: false)
    console.log('\n--- 1. 일반 쿼리 실행 (latestOnly: false, limit: 10) ---');
    const normalRes = await queryBankProductTable({
      tableSlug,
      limit: 10
    });
    
    console.log(`일반 쿼리 결과 총 개수: ${normalRes.totalMatching}건`);
    console.log(`반환된 행 개수: ${normalRes.rows?.length || 0}건`);
    
    if (normalRes.rows && normalRes.rows.length > 0) {
      console.log('일반 쿼리 데이터 샘플 (첫 5개 행):');
      normalRes.rows.slice(0, 5).forEach((row: any, i: number) => {
        console.log(`  [${i + 1}] ID: ${row.id}, 채권번호: ${row.receivable_number || row.note_number || row.account_number}, 일자: ${row.registered_date || row.transaction_date || row.created_at}, 상태: ${row.status}`);
      });
    }

    // 2. 최신 쿼리 (latestOnly: true)
    console.log('\n--- 2. 최신 쿼리 실행 (latestOnly: true, limit: 10) ---');
    const latestRes = await queryBankProductTable({
      tableSlug,
      limit: 10,
      // @ts-ignore
      latestOnly: true
    });
    
    console.log(`최신 쿼리(latestOnly) 결과 총 개수: ${latestRes.totalMatching}건`);
    console.log(`반환된 행 개수: ${latestRes.rows?.length || 0}건`);
    
    if (latestRes.rows && latestRes.rows.length > 0) {
      console.log('최신 쿼리 데이터 샘플 (첫 5개 행):');
      latestRes.rows.slice(0, 5).forEach((row: any, i: number) => {
        console.log(`  [${i + 1}] ID: ${row.id}, 채권번호: ${row.receivable_number || row.note_number || row.account_number}, 일자: ${row.registered_date || row.transaction_date || row.created_at}, 상태: ${row.status}`);
      });
    }

    // 3. 중복 고유 식별자 존재 여부 검증
    if (normalRes.rows && latestRes.rows) {
      console.log('\n--- 3. 검증 결과 분석 ---');
      const normalIds = normalRes.rows.map((r: any) => r.receivable_number || r.note_number || r.id);
      const latestIds = latestRes.rows.map((r: any) => r.receivable_number || r.note_number || r.id);
      
      const hasDuplicatesInNormal = normalIds.length !== new Set(normalIds).size;
      const hasDuplicatesInLatest = latestIds.length !== new Set(latestIds).size;
      
      console.log(`일반 쿼리 내 중복 ID 존재 여부: ${hasDuplicatesInNormal ? '있음 (중복 존재)' : '없음 (고유)'}`);
      console.log(`최신 쿼리(latestOnly) 내 중복 ID 존재 여부: ${hasDuplicatesInLatest ? '있음' : '없음 (정상 필터링됨)'}`);
      
      if (hasDuplicatesInNormal && !hasDuplicatesInLatest) {
        console.log('성공: latestOnly 옵션이 동일한 고유 식별자에 대해 가장 최신 데이터만 정상적으로 필터링하여 반환하고 있습니다!');
      } else {
        console.log('안내: 이 테스트 데이터셋에는 원래 고유 식별자 중복이 없거나, 또는 다른 방식으로 동작하고 있습니다.');
      }
    }

  } catch (error: any) {
    console.error('!!! 테스트 실행 중 에러 발생:', error.message);
  }
}

testQueryLatestReal();
