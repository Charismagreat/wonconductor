// test_find_widget_by_title.ts
import { queryTable } from './egdesk-helpers';

async function test() {
  console.log('>>> [테스트] 모든 활성 위젯의 쿼리 및 필터링 설정을 추출합니다...');
  try {
    const widgetsRaw = await queryTable('dashboard_chart', { limit: 100 });
    const widgets = Array.isArray(widgetsRaw) ? widgetsRaw : (widgetsRaw?.rows || []);
    
    // __is_deleted가 0인 것만 필터링 (메모리 상에서 안전하게 처리)
    const activeWidgets = widgets.filter((w: any) => String(w.__is_deleted) === '0');
    console.log(`활성 위젯 총 개수: ${activeWidgets.length}개\n`);
    
    activeWidgets.forEach((w: any, idx: number) => {
      let config: any = {};
      try {
        config = JSON.parse(w.config || '{}');
      } catch (e) {}
      
      const title = config.title || w.title || '제목 없음';
      console.log(`[위젯 #${idx + 1}] ID: ${w.id}`);
      console.log(`  - 제목: ${title}`);
      console.log(`  - 차트 타입: ${config.type || w.chartType || '미지정'}`);
      
      if (config.refreshMetadata) {
        console.log(`  - 연동 툴: ${config.refreshMetadata.tool}`);
        console.log(`  - 쿼리 인자(Args):`, JSON.stringify(config.refreshMetadata.args || {}, null, 2).replace(/\n/g, '\n    '));
        console.log(`  - 데이터 매핑(Mapping):`, JSON.stringify(config.refreshMetadata.mapping || {}, null, 2).replace(/\n/g, '\n    '));
      } else {
        console.log(`  - 연동 툴: 수동/정적 데이터 (refreshMetadata 없음)`);
      }
      
      if (config.data && Array.isArray(config.data)) {
        console.log(`  - 데이터 행 개수: ${config.data.length}개`);
      }
      console.log('--------------------------------------------------\n');
    });
  } catch (error: any) {
    console.error('에러 발생:', error.message);
  }
}

test();



