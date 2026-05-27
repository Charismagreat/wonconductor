// test_list_accounts.ts
import { listAccounts } from './egdesk-helpers';

async function testListAccounts() {
  console.log('>>> [테스트] listAccounts()에서 MANUALIMPORT 계좌를 정확히 찾아냅니다...');
  try {
    const res = await listAccounts();
    const accounts = Array.isArray(res) ? res : (res?.accounts || []);
    console.log(`총 계좌 개수: ${accounts.length}개`);
    const found = accounts.find((acc: any) => String(acc.accountNumber || '').includes('MANUAL'));
    if (found) {
      console.log('🎯 MANUALIMPORT 계좌 상세 JSON:');
      console.log(JSON.stringify(found, null, 2));
    } else {
      console.log('❌ MANUALIMPORT 계좌를 찾지 못했습니다.');
    }
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

testListAccounts();
