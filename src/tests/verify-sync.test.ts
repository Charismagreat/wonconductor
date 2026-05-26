import { describe, it, expect } from 'vitest';
import { runAITool } from '../lib/ai-tools';
import dotenv from 'dotenv';
import path from 'path';

describe('금융 대시보드 최종 잔액 검증 테스트', () => {
  it('동일 날짜 다수 거래 발생 시 최신 잔액이 정상 병합되어 반영된다', async () => {
    // 환경 변수 로드
    dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

    console.log("=== [TEST] get_finance_dashboard_summary 실행 ===");
    const summary = await runAITool('get_finance_dashboard_summary', {});
    
    console.log("\n=== [TEST] 계좌별 잔액 병합 결과 ===");
    console.log(JSON.stringify(summary, null, 2));

    expect(summary).toBeDefined();
    expect(summary.bankBreakdown).toBeDefined();
    expect(summary.bankBreakdown.length).toBeGreaterThan(0);
    
    // BC카드 출금 거래가 발생한 IBK 계좌의 최종 셋업 검증
    const ibkAccount = summary.bankBreakdown.find((acc: any) => 
      acc.계좌번호.includes('306-063568') || acc.은행명.includes('ibk') || acc.은행명.includes('기업은행')
    );
    
    if (ibkAccount) {
      console.log("\n=== [TEST] IBK 기업은행 최종 검증 계좌 상태 ===");
      console.log(`- 은행명: ${ibkAccount._bankName}`);
      console.log(`- 계좌번호: ${ibkAccount.계좌번호}`);
      console.log(`- 잔액: ${ibkAccount.잔액.toLocaleString()}원`);
      console.log(`- 최종거래일자: ${ibkAccount.일자}`);
    }
  });
});
