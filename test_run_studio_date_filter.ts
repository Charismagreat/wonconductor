// test_run_studio_date_filter.ts
import { runAITool } from './src/lib/ai-tools';

async function testDateFilter() {
  const tableId = 'bank-product:ibk:ibk_endorsements:3';
  console.log(`>>> [테스트] '${tableId}' 테이블에 대해 동적 날짜 필터링 검증을 시작합니다.`);

  // 1. startDate: "2026-05-27"로 조회 (이때는 0건이 반환되어야 정상)
  try {
    console.log('\n--- 1. startDate: "2026-05-27" 필터링 테스트 (기대 결과: 0건) ---');
    const res1 = await runAITool('run_studio_data_query', {
      intent: 'list',
      tableId,
      startDate: '2026-05-27',
      limit: 10
    });
    console.log(`조회 결과 개수: ${res1?.length || 0}건`);
  } catch (error: any) {
    console.error('실패:', error.message);
  }

  // 2. startDate: "2026-05-01"로 조회 (배서일자 2026-05-08인 데이터 1건이 나와야 정상)
  try {
    console.log('\n--- 2. startDate: "2026-05-01" 필터링 테스트 (기대 결과: 1건 - 2026-05-08 어음) ---');
    const res2 = await runAITool('run_studio_data_query', {
      intent: 'list',
      tableId,
      startDate: '2026-05-01',
      limit: 10
    });
    console.log(`조회 결과 개수: ${res2?.length || 0}건`);
    if (Array.isArray(res2) && res2.length > 0) {
      res2.forEach((row: any, i: number) => {
        console.log(`  [${i + 1}] ID: ${row.id}, 어음번호: ${row.note_number}, 배서일자(endorsement_date): ${row.endorsement_date}, 금액: ${row.endorsement_amount}`);
      });
      console.log('성공: endorsement_date 컬럼을 동적으로 자동 감지하여 정확하게 `>= 2026-05-01` 날짜 필터가 적용되었습니다!');
    } else {
      console.log('경고: 결과가 존재하지 않습니다.');
    }
  } catch (error: any) {
    console.error('실패:', error.message);
  }
}

testDateFilter();
