// test_list_banking.ts
import { listBankProductTables } from './egdesk-helpers';

async function testListBanking() {
  console.log('>>> [테스트] listBankProductTables API 호출 중...');
  try {
    const res = await listBankProductTables();
    console.log('--------------------------------------------------');
    console.log('API 응답 결과:');
    console.log(JSON.stringify(res, null, 2));
    console.log('--------------------------------------------------');
  } catch (error: any) {
    console.error('!!! 테스트 중 에러 발생:', error.message);
  }
}

testListBanking();
