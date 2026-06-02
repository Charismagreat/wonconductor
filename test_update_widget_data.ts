// test_update_widget_data.ts
import { queryTable, updateRows } from './egdesk-helpers';
import { refreshSingleChartAction } from './src/lib/services/chart-service';

async function test() {
  console.log('>>> [테스트] 위젯 ID 21 (받을어음, 배서어음, B2B대출 현황)의 실시간 갱신 설정 업데이트 및 검증...');
  try {
    const widgetsRaw = await queryTable('dashboard_chart', { filters: { id: '21' }, limit: 1 });
    const widgets = Array.isArray(widgetsRaw) ? widgetsRaw : (widgetsRaw?.rows || []);
    
    if (widgets.length === 0) {
      console.log('❌ ID 21 위젯을 찾지 못했습니다.');
      return;
    }
    
    const widget = widgets[0];
    const config = JSON.parse(widget.config || '{}');
    
    // 1. refreshMetadata 주입
    config.refreshMetadata = {
      tool: "get_bills_and_loans_summary",
      args: {},
      mapping: {
        maturity_date: "maturity_date",
        bank_name: "bank_name",
        customer_name: "customer_name",
        amount: "amount"
      }
    };
    
    // 2. DB 업데이트 수행
    const updatedConfigStr = JSON.stringify(config);
    const updateRes = await updateRows('dashboard_chart', { config: updatedConfigStr }, { filters: { id: '21' } });
    console.log('✅ 위젯 refreshMetadata가 성공적으로 업데이트되었습니다!', updateRes);

    // 3. 실시간 새로고침 동작 시뮬레이션 및 데이터 검증
    console.log('\n>>> refreshSingleChartAction(widget) 호출을 통한 실시간 데이터 갱신 시작...');
    const refreshedWidget = await refreshSingleChartAction({
      ...widget,
      config: config
    });
    
    const refreshedConfig = refreshedWidget.config || {};
    const refreshedData = refreshedConfig.data || [];
    
    console.log(`\n🎉 새로고침 완료! 최종 데이터 개수: ${refreshedData.length}개`);
    console.log('최종 데이터 리스트:');
    refreshedData.forEach((item: any, idx: number) => {
      console.log(`  [${idx + 1}] 만기일: ${item.maturity_date}, 은행: ${item.bank_name}, 거래처: ${item.customer_name}, 금액: ${item.amount.toLocaleString()}원`);
    });
    
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();

