const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function sync() {
  try {
    const idMap = JSON.parse(fs.readFileSync('report_id_map.json', 'utf8'));
    console.log('ID Map loaded.');

    // 1. workspace_item 보정
    console.log('Syncing workspace_item...');
    const wsItemsRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ tool: 'user_data_sql_query', arguments: { query: "SELECT id, reportId FROM workspace_item" } })
    }).then(res => res.json());
    
    if (wsItemsRes.result && wsItemsRes.result.content) {
      const wsItems = JSON.parse(wsItemsRes.result.content[0].text).rows || [];
      for (const item of wsItems) {
        const newId = idMap[item.reportId];
        if (newId) {
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
            body: JSON.stringify({
              tool: 'user_data_sql_query',
              arguments: { query: `UPDATE workspace_item SET reportId = '${newId}' WHERE id = ${item.id}` }
            })
          });
        }
      }
      console.log(`Processed ${wsItems.length} workspace items.`);
    }

    // 2. dashboard_chart 보정
    console.log('Syncing dashboard_chart...');
    const chartsRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ tool: 'user_data_sql_query', arguments: { query: "SELECT id, config FROM dashboard_chart" } })
    }).then(res => res.json());
    
    if (chartsRes.result && chartsRes.result.content) {
      const charts = JSON.parse(chartsRes.result.content[0].text).rows || [];
      for (const chart of charts) {
        let config = chart.config;
        let changed = false;
        for (const [oldId, newId] of Object.entries(idMap)) {
          if (config.includes(oldId)) {
            // "reportId":"finance-hub-bank-table" -> "reportId":2
            // We should be careful about partial matches, but since these are long slugs, it's usually safe.
            config = config.split(`"${oldId}"`).join(newId.toString());
            config = config.split(`'${oldId}'`).join(newId.toString());
            changed = true;
          }
        }
        if (changed) {
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
            body: JSON.stringify({
              tool: 'user_data_sql_query',
              arguments: { query: `UPDATE dashboard_chart SET config = '${config.replace(/'/g, "''")}' WHERE id = ${chart.id}` }
            })
          });
        }
      }
      console.log(`Processed ${charts.length} dashboard charts.`);
    }

    // 3. micro_app_config 보정
    console.log('Syncing micro_app_config...');
    const configsRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ tool: 'user_data_sql_query', arguments: { query: "SELECT id, sourceTableId FROM micro_app_config" } })
    }).then(res => res.json());
    
    if (configsRes.result && configsRes.result.content) {
      const configs = JSON.parse(configsRes.result.content[0].text).rows || [];
      for (const conf of configs) {
        const newId = idMap[conf.sourceTableId];
        if (newId) {
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
            body: JSON.stringify({
              tool: 'user_data_sql_query',
              arguments: { query: `UPDATE micro_app_config SET sourceTableId = '${newId}' WHERE id = ${conf.id}` }
            })
          });
        }
      }
      console.log(`Processed ${configs.length} micro app configs.`);
    }

    console.log('Sync complete!');

  } catch (e) {
    console.error(e);
  }
}
sync();
