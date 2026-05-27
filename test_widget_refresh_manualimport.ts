// test_widget_refresh_manualimport.ts
import { queryTable } from './egdesk-helpers';
import { refreshSingleChartAction } from './src/lib/services/chart-service';

async function test() {
  console.log('>>> [테스트] 위젯 새로고침 시 MANUALIMPORT 계좌 필터링 검증...');
  try {
    // 1. 위젯 ID 29를 DB에서 가져옵니다.
    const filter = { id: '29' };
    const widgetsRaw = await queryTable('dashboard_chart', { filters: filter, limit: 1 });
    const widgets = Array.isArray(widgetsRaw) ? widgetsRaw : (widgetsRaw?.rows || []);
    
    if (widgets.length === 0) {
      console.log('❌ ID 29 위젯을 찾지 못했습니다.');
      return;
    }
    
    const widget = widgets[0];
    const initialConfig = JSON.parse(widget.config || '{}');
    const initialData = initialConfig.data || [];
    
    console.log(`기존 위젯 데이터 개수: ${initialData.length}개`);
    const hasManualBefore = initialData.some((r: any) => String(r.계좌번호).includes('MANUALIMPORT'));
    console.log(`새로고침 전 MANUALIMPORT 계좌 존재 여부: ${hasManualBefore ? '예 (발견!)' : '아니오'}`);
    
    console.log('\n>>> refreshSingleChartAction(widget) 호출 실행...');
    const refreshedWidget = await refreshSingleChartAction(widget);
    const refreshedConfig = JSON.parse(refreshedWidget.config || '{}');
    const refreshedData = refreshedConfig.data || [];
    
    console.log(`새로고침 후 위젯 데이터 개수: ${refreshedData.length}개`);
    const hasManualAfter = refreshedData.some((r: any) => String(r.계좌번호).includes('MANUALIMPORT'));
    console.log(`새로고침 후 MANUALIMPORT 계좌 존재 여부: ${hasManualAfter ? '예' : '아니오 (성공적으로 필터링됨!)'}`);
    
    if (!hasManualAfter && hasManualBefore) {
      console.log('\n🎉 대성공: 기존 캐시 데이터에 존재하던 수동 업로드 계좌(MANUALIMPORT)가 새로고침 후 완벽하게 배제되었습니다!');
    } else {
      console.log('\n경고: 기대하던 필터링 동작에 예외가 발생했습니다.');
    }
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();
