// test_check_pinned_config.ts
import { loadAllPinnedChartsAction } from './src/lib/services/chart-service';

async function checkPinnedConfig() {
  console.log('>>> [테스트] 대시보드에 Pinned 된 차트들의 config와 refreshMetadata 설정을 조사합니다.');
  try {
    const charts = await loadAllPinnedChartsAction();
    console.log('--------------------------------------------------');
    console.log(`총 Pinned 차트 수: ${charts.length}개`);
    console.log('--------------------------------------------------');

    charts.forEach((chart, index) => {
      console.log(`\n[차트 #${index + 1}] ID: ${chart.id}`);
      console.log(`제목 (Title): ${chart.config.title}`);
      console.log(`차트 타입 (Type): ${chart.config.type}`);
      console.log(`데이터 개수 (Data length): ${chart.config.data?.length || 0}개`);
      
      if (chart.config.refreshMetadata) {
        console.log('refreshMetadata 설정:');
        console.log(JSON.stringify(chart.config.refreshMetadata, null, 2));
      } else {
        console.log('경고: refreshMetadata 가 존재하지 않는 차트입니다.');
      }
      console.log('--------------------------------------------------');
    });
  } catch (error: any) {
    console.error('!!! 에러 발생:', error.message);
  }
}

checkPinnedConfig();
