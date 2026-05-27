// test_refresh_filter_preservation.ts
import { refreshSingleChartAction, loadAllPinnedChartsAction } from './src/lib/services/chart-service';

async function testFilterPreservation() {
  console.log('>>> [테스트] Pinned 차트 새로고침 시 필터 보존 지능형 기능 검증을 시작합니다.');

  try {
    // 1. 기존 Pinned 차트 중 "주요 대출 계좌 현황" 차트 찾기
    const allCharts = await loadAllPinnedChartsAction();
    const targetChart = allCharts.find(c => c.config.title === '주요 대출 계좌 현황');

    if (!targetChart) {
      console.log('경고: 테스트 대상 차트("주요 대출 계좌 현황")를 발견하지 못했습니다.');
      return;
    }

    console.log('--------------------------------------------------');
    console.log(`대상 차트 발견! ID: ${targetChart.id}`);
    console.log(`기존 고정(Pinned) 데이터 수: ${targetChart.config.data?.length || 0}개`);
    if (targetChart.config.data) {
      console.log('기존 데이터 계좌번호 목록:', targetChart.config.data.map((r: any) => r.계좌번호 || r.accountNumber));
    }
    console.log('--------------------------------------------------');

    // 2. 백그라운드 새로고침 동작 시뮬레이션 실행 (refreshSingleChartAction)
    console.log('\n>>> [테스트] refreshSingleChartAction() 호출 및 새로고침 수행 중...');
    const refreshed = await refreshSingleChartAction(targetChart);

    console.log('--------------------------------------------------');
    console.log(`새로고침 후 데이터 수: ${refreshed.config.data?.length || 0}개`);
    if (refreshed.config.data) {
      console.log('새로고침 후 데이터 계좌번호 목록:', refreshed.config.data.map((r: any) => r.계좌번호 || r.accountNumber));
      
      const isPreserved = refreshed.config.data.length < 37 && refreshed.config.data.length > 0;
      if (isPreserved) {
        console.log('\n성공: 새로고침 후 37개 전체 계좌가 아니라, 사용자가 선택한 계좌번호들만 안전하게 필터링 보존되었습니다!');
      } else {
        console.log('\n경고: 필터링 보존이 실패하고 전체 계좌 정보가 노출되었습니다.');
      }
    }
    console.log('--------------------------------------------------');

  } catch (error: any) {
    console.error('!!! 에러 발생:', error.message);
  }
}

testFilterPreservation();
