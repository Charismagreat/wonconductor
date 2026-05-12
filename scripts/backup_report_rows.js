const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function backupReportRows() {
  try {
    console.log('Fetching report_row count...');
    const countRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { query: "SELECT count(*) as cnt FROM report_row" }
      })
    }).then(res => res.json());
    
    const count = JSON.parse(countRes.result.content[0].text).rows[0].cnt;
    console.log(`Total report_rows: ${count}`);

    // 페이징 처리 (데이터가 많을 경우 대비)
    let allRows = [];
    const limit = 1000;
    for (let offset = 0; offset < count; offset += limit) {
      console.log(`Fetching rows ${offset} to ${offset + limit}...`);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({
          tool: 'user_data_sql_query',
          arguments: { query: `SELECT * FROM report_row LIMIT ${limit} OFFSET ${offset}` }
        })
      }).then(res => res.json());
      
      const data = JSON.parse(res.result.content[0].text);
      allRows = allRows.concat(data.rows || data);
    }

    fs.writeFileSync('report_row_backup.json', JSON.stringify(allRows, null, 2));
    console.log(`Successfully backed up ${allRows.length} report rows to report_row_backup.json`);

  } catch (e) {
    console.error(e);
  }
}
backupReportRows();
