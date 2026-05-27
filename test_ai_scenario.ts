// test_ai_scenario.ts
import { runAITool } from './src/lib/ai-tools';

async function testAiScenario() {
  console.log('>>> [테스트] 실제 AI가 호출하는 방식과 동일한 시나리오로 run_studio_data_query 통합 검증을 시작합니다.');

  // 시나리오 1: IBK B2B 채권 목록 상세 조회 (latestOnly 자동 적용 검증)
  console.log('\n==================================================');
  console.log('시나리오 1: IBK B2B 채권 목록 상세 조회');
  console.log('목적: B2B 채권에 대해 latestOnly 옵션이 적용되어 안전하게 조회되는가?');
  console.log('==================================================');
  try {
    const res1 = await runAITool('run_studio_data_query', {
      intent: 'list',
      tableId: 'bank-product:ibk:ibk_b2b_receivables:0',
      limit: 5
    });
    console.log(`- 결과 개수: ${res1?.length || 0}건`);
    if (Array.isArray(res1) && res1.length > 0) {
      console.log('데이터 샘플 (첫 2개 행):');
      res1.slice(0, 2).forEach((row: any, i: number) => {
        console.log(`  [${i + 1}] ID: ${row.id}, 채권번호: ${row.receivable_number || row.note_number}, 등록일자(registered_date): ${row.registered_date}, 금액: ${row.receivable_amount}, rn: ${row.rn}`);
      });
    }
  } catch (error: any) {
    console.error('시나리오 1 실패:', error.message);
  }

  // 시나리오 2: 우리 B2B 대출 실행 목록 조회 (날짜 필터 startDate 및 latestOnly 교차 검증)
  console.log('\n==================================================');
  console.log('시나리오 2: 우리 B2B 대출 실행 목록 조회 (startDate: "2026-05-01")');
  console.log('목적: received_date 컬럼을 동적으로 감지해 올바르게 날짜 필터링이 적용되고 중복이 배제되는가?');
  console.log('==================================================');
  try {
    const res2 = await runAITool('run_studio_data_query', {
      intent: 'list',
      tableId: 'bank-product:woori:woori_b2b_loan_executions:1',
      startDate: '2026-05-01',
      limit: 5
    });
    console.log(`- 결과 개수: ${res2?.length || 0}건`);
    if (Array.isArray(res2) && res2.length > 0) {
      console.log('데이터 샘플:');
      res2.forEach((row: any, i: number) => {
        console.log(`  [${i + 1}] ID: ${row.id}, 채권번호: ${row.receivable_number}, 수취일자(received_date): ${row.received_date}, 입금일자(deposit_date): ${row.deposit_date}, 대출원금: ${row.applied_amount}, rn: ${row.rn}`);
      });
    }
  } catch (error: any) {
    console.error('시나리오 2 실패:', error.message);
  }

  // 시나리오 3: IBK 어음 배서 내역 목록 조회 (startDate와 endDate 및 latestOnly 교차 검증)
  console.log('\n==================================================');
  console.log('시나리오 3: IBK 어음 배서 내역 목록 조회 (startDate: "2026-04-01", endDate: "2026-05-15")');
  console.log('목적: endorsement_date 컬럼을 동적 감지하여 특정 범위 내의 어음만 중복 없이 조회하는가?');
  console.log('==================================================');
  try {
    const res3 = await runAITool('run_studio_data_query', {
      intent: 'list',
      tableId: 'bank-product:ibk:ibk_endorsements:3',
      startDate: '2026-04-01',
      endDate: '2026-05-15',
      limit: 5
    });
    console.log(`- 결과 개수: ${res3?.length || 0}건`);
    if (Array.isArray(res3) && res3.length > 0) {
      console.log('데이터 목록:');
      res3.forEach((row: any, i: number) => {
        console.log(`  [${i + 1}] ID: ${row.id}, 어음번호: ${row.note_number}, 배서일자(endorsement_date): ${row.endorsement_date}, 금액: ${row.endorsement_amount}, 상태: ${row.status}`);
      });
    }
  } catch (error: any) {
    console.error('시나리오 3 실패:', error.message);
  }
}

testAiScenario();
