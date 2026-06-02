// test_direct_sql_create.ts
import { executeSQL } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] SQLite DB에 ibk_loan_transactions 테이블을 로우 레벨 SQL로 직접 생성합니다...');
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS ibk_loan_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_number TEXT,
        transaction_date TEXT,
        transaction_type TEXT,
        currency TEXT,
        transaction_amount REAL,
        principal_amount REAL,
        interest_amount REAL,
        loan_balance REAL,
        interest_rate REAL,
        start_date TEXT,
        end_date TEXT,
        status TEXT,
        synced_at TEXT,
        __is_deleted INTEGER DEFAULT 0,
        __created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        __updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `;
    const res = await executeSQL(query);
    console.log('SQL 실행 결과:', res);
  } catch (error: any) {
    console.error('SQL 실행 중 에러 발생:', error.message);
  }
}

test();
