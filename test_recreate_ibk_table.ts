// test_recreate_ibk_table.ts
import { createTable } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] ibk_loan_transactions 물리 테이블을 재생성합니다...');
  try {
    const res = await createTable(
      'IBK 대출거래내역',
      [
        { name: 'account_number', type: 'TEXT' },
        { name: 'transaction_date', type: 'DATE' },
        { name: 'transaction_type', type: 'TEXT' },
        { name: 'currency', type: 'TEXT' },
        { name: 'transaction_amount', type: 'REAL' },
        { name: 'principal_amount', type: 'REAL' },
        { name: 'interest_amount', type: 'REAL' },
        { name: 'loan_balance', type: 'REAL' },
        { name: 'interest_rate', type: 'REAL' },
        { name: 'start_date', type: 'DATE' },
        { name: 'end_date', type: 'DATE' },
        { name: 'status', type: 'TEXT' },
        { name: 'synced_at', type: 'TEXT' }
      ],
      {
        tableName: 'ibk_loan_transactions',
        description: '재생성된 IBK 대출거래내역 (Mock/빈 테이블)'
      }
    );
    console.log('성공적으로 테이블을 생성했습니다:', res);
  } catch (error: any) {
    console.error('테이블 생성 중 에러 발생:', error.message);
  }
}

test();
