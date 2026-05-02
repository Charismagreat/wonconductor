import { queryTable, executeSQL, listAccounts, queryBankTransactions, getOverallStats } from "@/egdesk-helpers";
import { queryCardTransactions, getMonthlySummary, getTransactionStats as getStatistics } from "@/egdesk-helpers";

/**
 * 가드레일 규칙을 데이터에 물리적으로 적용합니다.
 */
async function applyGuardrails(tableId: string, rows: any[]) {
  if (!rows || rows.length === 0) return rows;
  if (!tableId) return rows;
  
  try {
    const { queryTable } = require('@/egdesk-helpers');
    const knowledges = await queryTable('table_knowledge', { 
      filters: { target_id: tableId, is_current: 1 } 
    }).catch(() => []);
    
    if (knowledges.length === 0 || !knowledges[0].ai_rules) return rows;
    
    let rules = [];
    try {
      rules = typeof knowledges[0].ai_rules === 'string' 
        ? JSON.parse(knowledges[0].ai_rules) 
        : knowledges[0].ai_rules;
    } catch(e) { return rows; }

    if (!Array.isArray(rules)) return rows;

    return rows.map(row => {
      const newRow = { ...row };
      rules.forEach((rule: any) => {
        if (rule.type === 'mask' && newRow[rule.column]) {
          const val = String(newRow[rule.column]);
          if (rule.pattern === 'last4') {
            newRow[rule.column] = val.length > 4 ? '*'.repeat(val.length - 4) + val.slice(-4) : '****';
          } else {
            newRow[rule.column] = '********';
          }
        } else if (rule.type === 'deny') {
          delete newRow[rule.column];
        }
      });
      return newRow;
    });
  } catch (e) {
    console.error('Guardrail enforcement failed:', e);
    return rows;
  }
}

/**
 * 도구 호출(Function Call) 실행기 - 공유 유틸리티
 */
export async function runAITool(name: string, args: any) {
  console.log(`[AI Tool Execution] ${name}`, args);
  let result: any;

  switch (name) {
    case "get_finance_dashboard_summary": {
      const integratedRows = await runAITool('list_bank_accounts', {});
      const stats = {
        bankBreakdown: integratedRows,
        _totalCount: integratedRows.length,
        _isFullList: true,
        _source: "Unified Account List (bank_accounts + latest transaction)",
        fullTableMarkdown: ""
      };
      let tableMarkdown = `### 🏦 은행 및 계좌별 잔액 현황 (전체 ${integratedRows.length}건)\n\n`;
      tableMarkdown += "| 은행명 | 계좌번호 | 현재잔액 | 최종거래일 |\n| :--- | :--- | :---: | :---: |\n";
      integratedRows.forEach((row: any) => {
        tableMarkdown += `| ${row._bankName} | ${row.accountNumber} | **${(row.balance || 0).toLocaleString()}** | ${row.date} |\n`;
      });
      stats.fullTableMarkdown = tableMarkdown;
      return stats;
    }
    case "get_finance_monthly_summary":
      result = await getMonthlySummary({ months: args.months || 6 });
      return result;
    case "get_finance_statistics":
      result = await getStatistics({ startDate: args.startDate, endDate: args.endDate });
      return result;
    case "list_bank_accounts": {
      const accounts = await listAccounts();
      const validAccounts = accounts.filter((acc: any) => {
        const bId = String(acc.bankId || '').toLowerCase();
        const aName = String(acc.accountName || '').toLowerCase();
        return !bId.includes('card') && !aName.includes('카드');
      });
      const integratedRows = await Promise.all(validAccounts.map(async (acc: any) => {
        const txs = await queryTable('bank_transactions', {
          filters: { accountNumber: acc.accountNumber },
          limit: 1,
          orderBy: 'date',
          orderDir: 'DESC'
        });
        const latestTx = txs[0] || {};
        return {
          _bankName: acc.bankName || acc.bankId,
          accountNumber: acc.accountNumber,
          accountName: acc.accountName,
          balance: latestTx.balance || 0,
          date: latestTx.date || '거래없음'
        };
      }));
      result = integratedRows.sort((a, b) => b.balance - a.balance);
      return await applyGuardrails('bank_accounts', result);
    }
    case "query_bank_transactions": {
      const txs = await queryTable('bank_transactions', {
        startDate: args.startDate,
        endDate: args.endDate,
        limit: args.limit || 100,
        orderBy: 'date',
        orderDir: 'desc'
      });
      const rows = txs.filter((tx: any) => {
        const bId = String(tx.bankId || '').toLowerCase();
        const aName = String(tx.accountName || '').toLowerCase();
        return !bId.includes('card') && !aName.includes('카드');
      });
      return await applyGuardrails('bank_transactions', rows);
    }
    case "query_card_transactions": {
      const txs = await queryTable('card_approvals', {
        startDate: args.startDate,
        endDate: args.endDate,
        limit: args.limit || 100,
        orderBy: 'date',
        orderDir: 'desc'
      });
      const rows = txs.filter((tx: any) => {
        const bId = String(tx.bankId || tx.cardCompanyId || '').toLowerCase();
        const aName = String(tx.accountName || tx.cardName || '').toLowerCase();
        return bId.includes('card') || aName.includes('카드');
      });
      return await applyGuardrails('card_approvals', rows);
    }
    case "get_card_usage_by_approval_date": {
      const txs = await queryTable('card_approvals', {
        startDate: args.startDate,
        endDate: args.endDate,
        limit: 1000,
        orderBy: 'date',
        orderDir: 'desc'
      });
      const totalAmount = txs.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
      const categorySummary: Record<string, number> = {};
      txs.forEach((tx: any) => {
        const cat = tx.category || '기타';
        categorySummary[cat] = (categorySummary[cat] || 0) + (tx.amount || 0);
      });
      const transactions = await applyGuardrails('card_approvals', txs.slice(0, 100));
      return {
        totalAmount,
        transactionCount: txs.length,
        period: `${args.startDate} ~ ${args.endDate}`,
        categorySummary,
        transactions: transactions.map((t: any) => ({
          id: t.id,
          approvalDate: t.approvalDate || t.date,
          cardNumber: t.cardNumber || t.cardNo,
          description: t.description || t.merchantName,
          category: t.category,
          amount: t.amount
        })),
        basis: "승인일자(approvalDate)"
      };
    }
    case "execute_analytical_sql": {
      let sql = args.sql as string;
      if (/dashboard_data/i.test(sql) && !/isDeleted/i.test(sql)) {
        if (/WHERE/i.test(sql)) {
          sql = sql.replace(/WHERE/i, 'WHERE isDeleted = 0 AND');
        } else {
          sql = sql.replace(/(FROM\s+dashboard_data\b)/i, '$1 WHERE isDeleted = 0');
        }
      }
      const rawResult = await executeSQL(sql);
      const tableMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
      if (tableMatch && tableMatch[1] && Array.isArray(rawResult)) {
        return await applyGuardrails(tableMatch[1], rawResult);
      }
      return rawResult;
    }
    case "get_aggregated_report_data": {
      const tableIdStr = String(args.tableId || '');
      const targetTable = (args.tableId && args.tableId !== 'dashboard_data' && !tableIdStr.includes('-')) ? args.tableId : 'dashboard_data';
      const filters: any = { isDeleted: '0' };
      if (targetTable === 'dashboard_data') filters.reportId = args.tableId;

      const rows = await queryTable(targetTable, { filters, limit: 5000 });
      const allRows = Array.isArray(rows) ? rows : (rows?.rows || []);
      const validRows = allRows.filter((row: any) => row.isDeleted === 0 || row.isDeleted === '0');

      // 집계 전에 가드레일 적용 (차단된 컬럼은 집계에서 제외되도록)
      const safeRows = await applyGuardrails(args.tableId, validRows);

      const mode = args.mode || 'sum';
      const sumKeys = Array.isArray(args.sumKey) ? args.sumKey : [args.sumKey || 'value'];
      const summary: Record<string, Record<string, number>> = {};
      
      safeRows.forEach((row: any) => {
        const rowData = targetTable === 'dashboard_data'
          ? (typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}))
          : row;
        const groupValue = rowData[args.groupByKey];
        if (groupValue === undefined || groupValue === null || groupValue === '') return;
        const gKey = String(groupValue);
        if (!summary[gKey]) {
          summary[gKey] = {};
          sumKeys.forEach(sk => summary[gKey][sk] = 0);
        }
        sumKeys.forEach(sk => {
          if (mode === 'count') {
            summary[gKey][sk] += 1;
          } else {
            let amountRaw = rowData[sk];
            let amount = 0;
            if (typeof amountRaw === 'number') amount = amountRaw;
            else if (typeof amountRaw === 'string') amount = parseFloat(amountRaw.replace(/,/g, ''));
            if (!isNaN(amount)) summary[gKey][sk] += amount;
          }
        });
      });

      return Object.keys(summary).map(key => {
        const item: any = { label: key };
        if (sumKeys.length === 1) item.value = summary[key][sumKeys[0]];
        Object.assign(item, summary[key]);
        return item;
      }).sort((a, b) => (b.value !== undefined ? b.value - (a.value || 0) : 0));
    }
    case "query_workspace_table": {
      const targetTableStr = String(args.tableId || '');
      let targetTable = args.tableId;
      const filters: any = { isDeleted: '0' };
      if (targetTableStr.includes('bank_transactions') || targetTableStr.includes('bank-table')) {
        targetTable = 'bank_transactions';
        delete filters.isDeleted;
      } else if (targetTableStr.includes('card_transactions') || targetTableStr.includes('card-table') || targetTableStr.includes('card_approvals')) {
        targetTable = 'card_approvals';
        delete filters.isDeleted;
      } else if (targetTable !== 'dashboard_data' && !targetTableStr.includes('-')) {
        // Physical
      } else {
        targetTable = 'dashboard_data';
        filters.reportId = args.tableId;
      }
      const wsRows = await queryTable(targetTable, { filters, limit: args.limit || 100, offset: args.offset || 0 });
      const rows = Array.isArray(wsRows) ? wsRows : (wsRows?.rows || []);
      return await applyGuardrails(args.tableId, rows);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
