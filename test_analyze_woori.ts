// test_analyze_woori.ts
import { queryBankProductTable } from './egdesk-helpers';

async function analyzeWoori() {
  const tableSlug = 'woori_b2b_loan_executions';
  console.log(`>>> [테스트] '${tableSlug}' 테이블의 전체 45건 데이터를 정밀 분석합니다.`);

  try {
    // 1. 전체 데이터 조회 (최대 100건)
    const allData = await queryBankProductTable({
      tableSlug,
      limit: 100
    });

    console.log('--------------------------------------------------');
    console.log(`총 데이터 건수: ${allData.rows?.length || 0}건`);
    console.log('--------------------------------------------------');

    if (allData.rows) {
      // received_date 기준 2026-05-01 이후 데이터 필터링해보기
      const mayData = allData.rows.filter((r: any) => {
        const date = r.received_date || r.deposit_date || '';
        return date >= '2026-05-01';
      });

      console.log(`[분석] 2026-05-01 이후의 전체 데이터 (필터링 전): ${mayData.length}건`);
      mayData.forEach((row: any, i: number) => {
        console.log(`  Row [${i + 1}] ID: ${row.id}, 채권번호: ${row.receivable_number}, 수취일자(received_date): ${row.received_date}, 대출원금: ${row.applied_amount}`);
      });

      // receivable_number 고유값 세트 확인
      const uniqueRecs = Array.from(new Set(mayData.map((r: any) => r.receivable_number)));
      console.log(`\n[분석] 2026-05-01 이후 데이터 중 고유 채권번호(receivable_number) 개수: ${uniqueRecs.length}개`);
      console.log('고유 채권번호 목록:', uniqueRecs);
    }
    console.log('--------------------------------------------------');
  } catch (error: any) {
    console.error('!!! 에러 발생:', error.message);
  }
}

analyzeWoori();
