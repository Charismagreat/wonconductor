// test_query_banking.ts
import { runAITool } from './src/lib/ai-tools';

async function testQueryBanking() {
  const targetAccount = '306-063568-04-036';
  
  console.log(`>>> [테스트] runAITool('query_bank_transactions')을 통해 통합 거래 내역을 조회합니다...`);
  try {
    const res = await runAITool('query_bank_transactions', {
      limit: 100
    });
    
    const transactions = Array.isArray(res) ? res : (res?.transactions || res?.rows || []);
    console.log(`전체 반환된 거래 내역 수: ${transactions.length}개`);
    
    // 특정 계좌(306-063568-04-036)의 거래 내역 필터링
    const matched = transactions.filter((tx: any) => 
      String(tx._accountNumber || tx.accountNumber || '').includes(targetAccount)
    );
    
    console.log(`\n🎯 결과 내에 ${targetAccount} 계좌 거래 내역 존재 여부: ${matched.length > 0 ? '예 (성공!)' : '아니오 (실패)'}`);
    if (matched.length > 0) {
      console.log('매칭된 거래 내역 상세 목록 (최근 5건):');
      matched.slice(0, 5).forEach((tx: any, idx: number) => {
        console.log(`  [${idx+1}] 일자: ${tx.date}, 구분: ${tx.description}, 입금: ${tx.deposit.toLocaleString()}원, 출금: ${tx.withdrawal.toLocaleString()}원, 잔액: ${tx.balance.toLocaleString()}원`);
      });
    }
  } catch (error: any) {
    console.error('!!! 테스트 중 에러 발생:', error.message);
  }
}

testQueryBanking();


