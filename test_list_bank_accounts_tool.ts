// test_list_bank_accounts_tool.ts
import { runAITool } from './src/lib/ai-tools';

async function test() {
  console.log('>>> [테스트] runAITool("list_bank_accounts") 호출 중...');
  try {
    const res = await runAITool('list_bank_accounts', {});
    console.log('결과 개수:', res?.length);
    console.log(JSON.stringify(res, null, 2));
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();
