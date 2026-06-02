// test_show_refreshed_widget_data.ts
import { queryBankProductTable } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] 3개의 어음/B2B 테이블 원천 데이터 실시간 조회 및 정밀 분석...');
  try {
    // 1. IBK 외상매출채권 (받을어음)
    console.log('\n--- 1. ibk_b2b_receivables (IBK 외상매출채권) ---');
    const ibkReceivablesRes = await queryBankProductTable({ tableSlug: 'ibk_b2b_receivables', limit: 100 });
    const ibkReceivables = ibkReceivablesRes.rows || [];
    console.log(`전체 데이터 개수: ${ibkReceivables.length}건`);
    const activeIbkReceivables = ibkReceivables.filter((r: any) => r.status !== '완제');
    console.log(`활성 데이터(status !== '완제') 개수: ${activeIbkReceivables.length}건`);
    activeIbkReceivables.slice(0, 5).forEach((r: any, idx: number) => {
      console.log(`  [${idx + 1}] ID: ${r.id}, 구매기업: ${r.buyer_name}, 만기일: ${r.maturity_date}, 금액: ${r.receivable_amount}, 상태: ${r.status}`);
    });

    // 2. Woori B2B대출 실행내역
    console.log('\n--- 2. woori_b2b_loan_executions (Woori B2B대출) ---');
    const wooriLoansRes = await queryBankProductTable({ tableSlug: 'woori_b2b_loan_executions', limit: 100 });
    const wooriLoans = wooriLoansRes.rows || [];
    console.log(`전체 데이터 개수: ${wooriLoans.length}건`);
    const activeWooriLoans = wooriLoans.filter((r: any) => r.status !== '완제');
    console.log(`활성 데이터(status !== '완제') 개수: ${activeWooriLoans.length}건`);
    activeWooriLoans.slice(0, 5).forEach((r: any, idx: number) => {
      console.log(`  [${idx + 1}] ID: ${r.id}, 거래처(vendor): ${r.vendor}, 채권만기일: ${r.receivable_maturity_date}, 대출만기일: ${r.loan_maturity_date}, 금액: ${r.applied_amount}, 상태: ${r.status}`);
    });

    // 3. IBK 배서내역
    console.log('\n--- 3. ibk_endorsements (IBK 배서내역) ---');
    const ibkEndorsementsRes = await queryBankProductTable({ tableSlug: 'ibk_endorsements', limit: 100 });
    const ibkEndorsements = ibkEndorsementsRes.rows || [];
    console.log(`전체 데이터 개수: ${ibkEndorsements.length}건`);
    const activeIbkEndorsements = ibkEndorsements.filter((r: any) => r.status !== '완제');
    console.log(`활성 데이터(status !== '완제') 개수: ${activeIbkEndorsements.length}건`);
    activeIbkEndorsements.slice(0, 5).forEach((r: any, idx: number) => {
      console.log(`  [${idx + 1}] ID: ${r.id}, 피배서인: ${r.endorsee_name}, 발행인: ${r.issuer_name}, 만기일: ${r.maturity_date}, 금액: ${r.endorsement_amount}, 상태: ${r.status}`);
    });

  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();

