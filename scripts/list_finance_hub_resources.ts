
import { 
  listBanks,
  listAccounts,
  listHometaxConnections,
  listBankProductTables
} from './egdesk-helpers.ts';

async function listAllFinanceHubResources() {
  console.log('>>> [FinanceHub Audit] 전용 리스팅 도구를 사용하여 모든 자원을 파악합니다...');
  
  try {
    // 1. 은행 목록
    console.log('\n--- [Banks] ---');
    const banks = await listBanks();
    console.log(JSON.stringify(banks, null, 2));

    // 2. 계좌 목록
    console.log('\n--- [Accounts] ---');
    const accounts = await listAccounts();
    console.log(JSON.stringify(accounts, null, 2));

    // 3. 국세청 연결 목록
    console.log('\n--- [Hometax Connections] ---');
    const hometax = await listHometaxConnections();
    console.log(JSON.stringify(hometax, null, 2));

    // 4. 은행 상품 테이블 목록
    console.log('\n--- [Bank Product Tables] ---');
    const products = await listBankProductTables();
    console.log(JSON.stringify(products, null, 2));

  } catch (error: any) {
    console.error('!!! 리스팅 중 에러 발생:', error.message);
  }
}

listAllFinanceHubResources();
