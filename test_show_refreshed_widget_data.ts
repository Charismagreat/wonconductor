// test_show_refreshed_widget_data.ts
import { queryTable } from './egdesk-helpers';

async function checkWidgetCache(id: string) {
  try {
    const widgetsRaw = await queryTable('dashboard_chart', { filters: { id }, limit: 1 });
    const widgets = Array.isArray(widgetsRaw) ? widgetsRaw : (widgetsRaw?.rows || []);
    
    if (widgets.length === 0) {
      console.log(`❌ ID ${id} 위젯을 찾지 못했습니다.`);
      return;
    }
    
    const widget = widgets[0];
    const config = JSON.parse(widget.config || '{}');
    const data = config.data || [];
    
    console.log(`\n==================================================`);
    console.log(`🎯 [ID: ${id}] Title: ${config.title || widget.title}`);
    console.log(`현재 캐시 데이터 건수: ${data.length}개`);
    
    const found = data.find((row: any) => 
      String(row.계좌번호 || row._accountNumber || row.accountNumber || '').includes('306-063568-04-036')
    );
    
    if (found) {
      console.log(`✅ 306-063568-04-036 대출 계좌 존재함:`);
      console.log(JSON.stringify(found, null, 2));
    } else {
      console.log(`❌ 306-063568-04-036 대출 계좌 없음!`);
    }
  } catch (error: any) {
    console.error(`ID ${id} 조회 에러:`, error.message);
  }
}

async function test() {
  await checkWidgetCache('10');
  await checkWidgetCache('35');
  await checkWidgetCache('36');
}

test();



