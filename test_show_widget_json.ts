// test_show_widget_json.ts
import { queryTable } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] 모든 활성 대시보드 위젯의 구성을 출력합니다...');
  try {
    const widgetsRaw = await queryTable('dashboard_chart', { filters: { __is_deleted: '0' }, limit: 100 });
    const widgets = Array.isArray(widgetsRaw) ? widgetsRaw : (widgetsRaw?.rows || []);
    
    console.log(`활성 위젯 개수: ${widgets.length}개`);
    widgets.forEach((w: any) => {
      let config: any = {};
      try {
        config = JSON.parse(w.config || '{}');
      } catch (e) {}
      
      const title = config.title || w.title || '';
      console.log(`\n==================================================`);
      console.log(`🎯 [ID: ${w.id}] Title: ${title}`);
      console.log(`   - orderIndex: ${w.orderIndex}`);
      console.log(`   - refreshMetadata:`, JSON.stringify(config.refreshMetadata || {}, null, 2));
      if (config.data) {
        console.log(`   - Data count: ${config.data.length}`);
        if (config.data.length > 0) {
          console.log(`   - Sample Data row:`, JSON.stringify(config.data[0]));
        }
      }
    });
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();


