// test_mock_refresh.ts
import { refreshSingleChartAction, ChartConfig } from './src/lib/services/chart-service';

async function testMockRefresh() {
  console.log('>>> [테스트] 최초 핀 고정 시점의 mockChart(4개 계좌만 필터링된 상태)로 새로고침을 시뮬레이션합니다.');

  // 1. 스튜디오에서 4개 대출 계좌만 추출하여 핀 고정한 가상 차트 구성
  const mockChart: ChartConfig = {
    id: 'mock-loan-chart-12345',
    userId: 'admin',
    config: {
      title: '주요 대출 계좌 현황 (테스트)',
      type: 'table',
      // 사용자가 필터링하여 최초 저장된 4개의 계좌 목록
      data: [
        { "은행명": "ibk", "계좌번호": "306-063568-04-036", "잔액": -262920006 },
        { "은행명": "ibk", "계좌번호": "9220015683100031", "잔액": -65000000 },
        { "은행명": "kookmin", "계좌번호": "60104165951", "잔액": -74284465 },
        { "은행명": "hana", "계좌번호": "21398007329742", "잔액": -80000000 }
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
  console.log(`차트 제목: ${mockChart.config.title}`);
  console.log(`최초 고정 데이터 수 (oldData): ${mockChart.config.data.length}개`);
  console.log('최초 계좌번호 목록:', mockChart.config.data.map((r: any) => r.계좌번호));
  console.log('--------------------------------------------------');

  try {
    // 2. 새로고침 수행 (전체 37개 계좌가 리턴되는 환경)
    console.log('\n>>> [테스트] refreshSingleChartAction(mockChart) 호출 실행...');
    const refreshed = await refreshSingleChartAction(mockChart);

    console.log('--------------------------------------------------');
    console.log(`새로고침 완료 후 데이터 수: ${refreshed.config.data?.length || 0}개`);
    if (refreshed.config.data) {
      console.log('새로고침 후 계좌번호 목록:', refreshed.config.data.map((r: any) => r.계좌번호));
      
      const isFilterPreserved = refreshed.config.data.length === 4;
      if (isFilterPreserved) {
        console.log('\n🎉 성공!!! 37개 전체 계좌가 쿼리되었음에도 불구하고, 원래 핀 고정되었던 4개의 주요 대출 계좌 데이터만 정상적으로 지능형 필터링되어 유지되었습니다!');
      } else {
        console.log('\n❌ 실패: 필터가 보존되지 않고 전체 계좌 정보가 노출되었습니다.');
      }
    }
    console.log('--------------------------------------------------');
  } catch (error: any) {
    console.error('에러:', error.message);
  }
}

testMockRefresh();
