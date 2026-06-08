// test_list_accounts.ts
import { runAITool } from './src/lib/ai-tools';

async function testListAccounts() {
  console.log('>>> [테스트] runAITool(\'list_bank_accounts\')의 최종 출력 리스트를 확인합니다...');
  try {
    const res = await runAITool('list_bank_accounts', {});
    console.log(`반환된 계좌 수: ${res.length}개`);
    console.log('--------------------------------------------------');
    res.forEach((acc: any, i: number) => {
      console.log(`[${i+1}] 은행: ${acc.은행명 || acc._bankName}, 계좌번호: ${acc.계좌번호}, 계좌명: ${acc.계좌명}, 잔액: ${acc.잔액}, 거래건수: ${acc.거래건수}, 약정금액: ${acc.약정금액}, 사용가능한도: ${acc.사용가능한도}`);
    });
    console.log('--------------------------------------------------');
    
    const found = res.find((acc: any) => String(acc.계좌번호 || '').includes('306-063568-04-036'));
    if (found) {
      console.log('🎯 306-063568-04-036 계좌가 결과에 포함되어 있습니다!');
      console.log(JSON.stringify(found, null, 2));
    } else {
      console.log('❌ 306-063568-04-036 계좌가 누락되었습니다.');
    }
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

testListAccounts();


