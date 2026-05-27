// test_find_widget_by_title.ts
import { queryTable } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] dashboard_chart 테이블에서 관련 위젯을 찾습니다...');
  try {
    const widgetsRaw = await queryTable('dashboard_chart', { limit: 100 });
    const widgets = Array.isArray(widgetsRaw) ? widgetsRaw : (widgetsRaw?.rows || []);
    
    widgets.forEach((w: any) => {
      let config: any = {};
      try {
        config = JSON.parse(w.config || '{}');
      } catch (e) {}

      const title = config.title || w.title || '';
      if (title.includes('은행별 자금 현황') || title.includes('계좌 잔액 현황표') || w.config.includes('MANUALIMPORT')) {
        console.log(`🎯 위젯 발견! ID: ${w.id}`);
        console.log(`   Title: ${title}`);
        console.log(`   ChartType: ${config.type || w.chartType}`);
        console.log(`   refreshMetadata:`, JSON.stringify(config.refreshMetadata || {}, null, 2));
        if (config.data && Array.isArray(config.data)) {
          console.log(`   Data Row Count: ${config.data.length}`);
          console.log(`   Data Samples:`, JSON.stringify(config.data.slice(0, 3), null, 2));
        }
        console.log('--------------------------------------------------');
      }
    });
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();
