// test_list_widgets.ts
import { queryTable } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] dashboard_chart 테이블을 조회합니다...');
  try {
    const widgetsRaw = await queryTable('dashboard_chart', { limit: 100 });
    const widgets = Array.isArray(widgetsRaw) ? widgetsRaw : (widgetsRaw?.rows || []);
    console.log(`위젯 개수: ${widgets.length}개`);
    widgets.forEach((w: any) => {
      console.log(`[ID: ${w.id}] Title: ${w.title}, ChartType: ${w.chartType}`);
      try {
        const config = JSON.parse(w.config || '{}');
        console.log(`   Config Keys: ${Object.keys(config).join(', ')}`);
        if (config.pinnedRows) {
          console.log(`   Pinned Rows Count: ${config.pinnedRows.length}`);
          console.log(`   Pinned Data Sample:`, JSON.stringify(config.pinnedRows.slice(0, 2), null, 2));
        }
      } catch (e) {}
      console.log('--------------------------------------------------');
    });
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();
