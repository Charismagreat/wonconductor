// test_date_distribution.ts
import { queryBankProductTable } from './egdesk-helpers';

async function testDateDistribution() {
  const tableSlug = 'woori_b2b_loan_executions';
  try {
    const res = await queryBankProductTable({ tableSlug, limit: 100 });
    const rows = res.rows || [];
    
    console.log('>>> [분석] 전체 데이터의 날짜(received_date) 분포:');
    const dist: Record<string, number> = {};
    rows.forEach((r: any) => {
      const d = r.received_date || 'N/A';
      dist[d] = (dist[d] || 0) + 1;
    });
    
    // 날짜 역순 정렬해서 출력
    Object.keys(dist).sort().reverse().forEach(date => {
      console.log(` - ${date}: ${dist[date]}건`);
    });

  } catch (error: any) {
    console.error(error.message);
  }
}

testDateDistribution();
