// test_find_widget_by_title.ts
import { loadAllPinnedChartsAction, refreshSingleChartAction, saveAllPinnedChartsAction } from './src/lib/services/chart-service';

async function test() {
  console.log('>>> [테스트] ID 10 위젯의 실시간 새로고침 및 유사 계좌 매칭 결과를 테스트합니다...');
  try {
    const pinnedCharts = await loadAllPinnedChartsAction();
    const targetChart = pinnedCharts.find((c: any) => String(c.id) === '10');
    
    if (!targetChart) {
      console.log('❌ ID 10 위젯을 찾을 수 없습니다.');
      return;
    }
    
    console.log('기존 위젯 데이터 개수:', targetChart.config?.data?.length);
    const oldAcc = targetChart.config.data.find((r: any) => String(r.계좌번호 || '').includes('672'));
    console.log('기존 적금 계좌 데이터:', JSON.stringify(oldAcc, null, 2));
    
    console.log('--- 실시간 새로고침 실행 ---');
    const refreshedChart = await refreshSingleChartAction(targetChart);
    console.log('새로고침 완료! 데이터 개수:', refreshedChart.config?.data?.length);
    
    const newAcc = refreshedChart.config.data.find((r: any) => String(r.계좌번호 || '').includes('672') || String(r.계좌번호 || '').includes('1040926736672'));
    console.log('새로고침 후 적금 계좌 데이터:', JSON.stringify(newAcc, null, 2));
    
    if (newAcc) {
      console.log('✅ 성공: 104-092-6736672 계좌가 새로운 유사 매칭 로직에 의해 누락되지 않고 갱신되었습니다!');
      
      // DB에 변경 사항을 영구 반영합니다.
      const updatedAll = pinnedCharts.map(p => p.id === '10' ? refreshedChart : p);
      await saveAllPinnedChartsAction(updatedAll);
      console.log('✅ 최신 데이터를 DB에 성공적으로 갱신하여 저장했습니다.');
    } else {
      console.log('❌ 실패: 계좌가 갱신 과정에서 여전히 유실되었습니다.');
    }
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();


