// test_list_accounts.ts
import { listAccounts } from './egdesk-helpers';

async function testListAccounts() {
  console.log('>>> [테스트] listAccounts()를 통해 전체 금융 계좌 목록을 조회합니다...');
  try {
    const res = await listAccounts();
    const accounts = Array.isArray(res) ? res : (res?.accounts || []);
    console.log(`총 계좌 개수: ${accounts.length}개`);
    console.log('--------------------------------------------------');
    accounts.forEach((acc: any, i: number) => {
      console.log(`[${i+1}] ID: ${acc.id || acc.accountId}, BankId: ${acc.bankId}, AccountNumber: ${acc.accountNumber}, AccountName: ${acc.accountName}, Balance: ${acc.balance}`);
    });
    console.log('--------------------------------------------------');
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

testListAccounts();

