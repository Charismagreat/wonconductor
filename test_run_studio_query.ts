// test_run_studio_query.ts
import { runAITool } from './src/lib/ai-tools';

async function testRunStudioQuery() {
  const tableId = 'bank-product:bank-product:woori_b2b_loan_executions';
  console.log(`>>> [테스트] runAITool('query_workspace_table')을 통해 '${tableId}' 조회를 테스트합니다.`);

  try {
    const res = await runAITool('query_workspace_table', {
      tableId,
      limit: 5
    });

    console.log('--------------------------------------------------');
    console.log('API 응답 결과:');
    console.log(`반환된 행 개수: ${res?.length || 0}건`);
    
    if (Array.isArray(res) && res.length > 0) {
      console.log('데이터 샘플 (첫 3개 행):');
      res.slice(0, 3).forEach((row: any, i: number) => {
        console.log(`  [${i + 1}] ID: ${row.id}, 채권번호: ${row.receivable_number}, 대출원금: ${row.applied_amount}, 가맹점/제조사: ${row.vendor}`);
      });
      console.log('성공: 수정된 지능형 status 필터 분기 로직에 의해 0건이 아닌 실제 데이터가 정상 조회됩니다!');
    } else {
      console.log('경고: 여전히 결과가 0건입니다. 추가 조사가 필요합니다.');
    }
    console.log('--------------------------------------------------');
  } catch (error: any) {
    console.error('!!! 테스트 실행 중 에러 발생:', error.message);
  }
}

testRunStudioQuery();
