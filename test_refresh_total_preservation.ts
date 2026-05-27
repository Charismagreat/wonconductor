// test_refresh_total_preservation.ts
import { refreshSingleChartAction, ChartConfig } from './src/lib/services/chart-service';

async function testTotalPreservation() {
  console.log('>>> [테스트] 합계(Total) 행이 필터링에서 제외되고 안전하게 보존되는지 검증합니다.');

  // 1. 4개 대출 계좌와 마지막에 '합계' 행을 포함한 mockChart 구성
  const mockChart: ChartConfig = {
    id: 'mock-loan-chart-total-999',
    userId: 'admin',
    config: {
      title: '주요 대출 계좌 현황 (합계 테스트)',
      type: 'table',
      data: [
        { "은행명": "ibk", "계좌번호": "306-063568-04-036", "잔액": -262920006 },
        { "은행명": "ibk", "계좌번호": "9220015683100031", "잔액": -65000000 },
        { "은행명": "kookmin", "계좌번호": "60104165951", "잔액": -74284465 },
        { "은행명": "hana", "계좌번호": "21398007329742", "잔액": -80000000 },
        { "은행명": "합계", "계좌번호": "-", "잔액": -482204471 } // <-- 합계 요약 행 포함!
      ],
      refreshMetadata: {
        tool: "run_studio_data_query",
        args: {
          tableId: "bank_accounts",
          intent: "list"
        },
        mapping: {
          "은행명": "은행명",
          "계좌번호": "계좌번호",
          "잔액": "잔액"
        }
      }
    }
  };

  console.log('--------------------------------------------------');
  console.log(`기존 데이터 수: ${mockChart.config.data.length}개 (합계 행 포함)`);
  console.log('기존 계좌번호 목록:', mockChart.config.data.map((r: any) => r.계좌번호 || r.은행명));
  console.log('--------------------------------------------------');

  try {
    // 2. 새로고침 수행
    console.log('\n>>> [테스트] refreshSingleChartAction(mockChart) 호출 실행...');
    const refreshed = await refreshSingleChartAction(mockChart);

    console.log('--------------------------------------------------');
    console.log(`새로고침 완료 후 데이터 수: ${refreshed.config.data?.length || 0}개`);
    if (refreshed.config.data) {
      console.log('새로고침 후 데이터 목록:');
      refreshed.config.data.forEach((row: any, i: number) => {
        console.log(`  [${i + 1}] 은행명: ${row.은행명}, 계좌번호: ${row.계좌번호}, 잔액: ${row.잔액}`);
      });
      
      const hasTotalRow = refreshed.config.data.some((r: any) => String(r.은행명 || '').includes('합계'));
      if (hasTotalRow && refreshed.config.data.length > 1) {
        console.log('\n🎉 대성공!!! 필터링이 적용된 상태에서 "합계" 요약 행이 안전하게 제외/보존되어 정확하게 출력되었습니다!');
      } else {
        console.log('\n❌ 실패: 합계 행이 필터링 과정에서 소실되었습니다.');
      }
    }
    console.log('--------------------------------------------------');
  } catch (error: any) {
    console.error('에러:', error.message);
  }
}

testTotalPreservation();
