import { runAITool } from './src/lib/ai-tools';

async function verify() {
  try {
    const result = await runAITool('get_aggregated_report_data', {
      tableId: 'tpl_sales_revenue_target',
      groupByKey: 'month',
      sumKey: ['actual', 'target']
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
  }
}

verify();
