import { 
  queryTable, executeSQL, listAccounts, queryBankTransactions, getOverallStats,
  queryTaxInvoices, queryTaxExemptInvoices, queryCashReceipts, listTables, listHometaxConnections
} from "@/egdesk-helpers";
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
    
    if (!Array.isArray(knowledges) || knowledges.length === 0 || !knowledges[0].ai_rules) return rows;
    
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
    case "list_available_tables": {
      // 1. Userdata Tables (Physical tables uploaded by user)
      const userTablesRes = await listTables().catch(() => []);
      const userTables = Array.isArray(userTablesRes) ? userTablesRes : [];
      
      // 2. FinanceHub Virtual Tables (Master and Transactions)
      const financeTables = [
        { id: 'bank_accounts', name: '은행/카드 계좌 마스터', description: '현재 모든 연결된 계좌의 잔액, 은행명, 계좌번호 정보' },
        { id: 'bank_transactions', name: '은행 거래 내역', description: '입금, 출금, 잔액 등 은행 입출금 거래 히스토리' },
        { id: 'card_accounts', name: '신용카드 마스터', description: '등록된 카드 목록 및 한도 정보' },
        { id: 'card_transactions', name: '카드 승인 내역', description: '카드 결제 일자, 가맹점, 금액 정보' }
      ];

      // 3. Hometax Tables
      const hometaxTables = [
        { id: 'hometax_connections', name: '홈택스 연결 정보', description: '사업자별 홈택스 인증 및 연결 상태' },
        { id: 'tax_invoices', name: '세금계산서', description: '홈택스에서 수집된 매출/매입 세금계산서(과세)' },
        { id: 'tax_exempt_invoices', name: '계산서', description: '홈택스에서 수집된 매출/매입 계산서(면세)' },
        { id: 'cash_receipts', name: '현금영수증', description: '홈택스에서 수집된 현금영수증 내역' }
      ];

      return {
        userdata: userTables.map((t: any) => ({ id: t.id || t.name, name: t.displayName || t.name, description: t.description || '사용자 업로드 테이블' })),
        finance: financeTables,
        hometax: hometaxTables,
        _totalCount: userTables.length + financeTables.length + hometaxTables.length,
        _instruction: "위 테이블 ID를 'run_studio_data_query'의 tableId 인자로 사용하여 데이터를 쿼리하십시오."
      };
    }
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
    case "get_finance_statistics": {
      const [stats, accounts] = await Promise.all([
        getStatistics({
          startDate: args.startDate,
          endDate: args.endDate
        }),
        listAccounts()
      ]);

      if (stats && Array.isArray(stats.breakdown)) {
        const accList = Array.isArray(accounts) ? accounts : (accounts?.accounts || []);
        stats.breakdown = stats.breakdown.map((item: any) => {
          const acc = accList.find((a: any) => a.accountId === item.accountId);
          return {
            ...item,
            _bankName: acc?.bankName || acc?.bankId || item.accountId,
            _accountNumber: acc?.accountNumber || '',
            _accountName: acc?.accountName || ''
          };
        });
      }
      return stats;
    }
    case "list_bank_accounts": {
      const [accRes, txRes] = await Promise.all([
        listAccounts(),
        queryBankTransactions({ limit: 10000 })
      ]);
      
      const accounts = Array.isArray(accRes) ? accRes : (accRes?.accounts || []);
      const transactions = Array.isArray(txRes) ? txRes : (txRes?.transactions || []);
      
      // 거래 내역에서 계좌별 건수 및 최신 잔액 직접 집계
      const txStats: Record<string, { count: number, balance: number, date: string }> = {};
      transactions.forEach((tx: any) => {
        const id = tx.accountId;
        if (!txStats[id]) {
            txStats[id] = { count: 0, balance: 0, date: '' };
        }
        txStats[id].count++;
        if (!txStats[id].date || tx.date >= txStats[id].date) {
            txStats[id].date = tx.date;
            txStats[id].balance = tx.balance;
        }
      });

      const validAccounts = accounts.filter((acc: any) => {
        const bId = String(acc.bankId || '').toLowerCase();
        const aName = String(acc.accountName || '').toLowerCase();
        return !bId.includes('card') && !aName.includes('카드');
      });

      const integratedRows = validAccounts.map((acc: any) => {
        const stat = txStats[acc.accountId] || txStats[acc.id];
        return {
            id: acc.id || acc.accountId,
            일자: stat?.date || '기록없음',
            은행명: acc.bankName || acc.bankId,
            계좌번호: acc.accountNumber,
            계좌명: acc.accountName || '일반계좌',
            잔액: stat?.balance || acc.balance || 0,
            거래건수: stat?.count || 0,
            _bankName: acc.bankName || acc.bankId,
            _accountNumber: acc.accountNumber
        };
      });

      // 거래가 1건이라도 있는 '활성 계좌'만 반환
      result = integratedRows
        .filter((acc: any) => acc.거래건수 > 0)
        .sort((a: any, b: any) => (b.잔액 as number) - (a.잔액 as number));

      return await applyGuardrails('bank_accounts', result);
    }
    case "list_card_accounts": {
      const accRes = await listAccounts();
      const accounts = Array.isArray(accRes) ? accRes : (accRes?.accounts || []);
      const validCards = accounts.filter((acc: any) => {
        const bId = String(acc.bankId || '').toLowerCase();
        const aName = String(acc.accountName || '').toLowerCase();
        return bId.includes('card') || aName.includes('카드');
      });
      result = validCards.map((acc: any) => ({
        id: acc.id || acc.accountId,
        카드사: acc.bankName || acc.bankId,
        카드번호: acc.accountNumber || acc.cardNumber,
        카드명: acc.accountName,
        한도: acc.limit || 0,
        _bankName: acc.bankName || acc.bankId,
        _accountNumber: acc.accountNumber || acc.cardNumber,
        _accountName: acc.accountName
      }));
      return await applyGuardrails('card_accounts', result);
    }
    case "query_bank_transactions": {
      const [res, accounts] = await Promise.all([
        queryBankTransactions({
          startDate: args.startDate,
          endDate: args.endDate,
          limit: args.limit || 100,
          orderDir: (args.orderDir || 'desc').toLowerCase() as any
        }),
        listAccounts()
      ]);
      
      const rawRows = Array.isArray(res) ? res : (res?.transactions || []);
      const accList = Array.isArray(accounts) ? accounts : (accounts?.accounts || []);
      const rows = rawRows.map((tx: any) => {
        const acc = accList.find((a: any) => a.accountId === tx.accountId || a.accountNumber === tx.accountNumber || a.id === tx.accountId);
        return {
          ...tx,
          _bankName: acc?.bankName || acc?.bankId || tx.bankId || '-',
          _accountNumber: acc?.accountNumber || acc?.cardNumber || tx.accountNumber || '-',
          _accountName: acc?.accountName || acc?.name || '일반계좌',
          _productName: acc?.productName || '-'
        };
      });
      return await applyGuardrails('bank_transactions', rows);
    }
    case "query_card_transactions": {
      const [res, accounts] = await Promise.all([
        queryCardTransactions({
          startDate: args.startDate,
          endDate: args.endDate,
          limit: args.limit || 100,
          orderDir: (args.orderDir || 'desc').toLowerCase() as any
        }),
        listAccounts()
      ]);
      
      const rawRows = Array.isArray(res) ? res : (res?.transactions || []);
      const accList = Array.isArray(accounts) ? accounts : (accounts?.accounts || []);
      const rows = rawRows.map((tx: any) => {
        const acc = accList.find((a: any) => a.accountId === tx.accountId || a.cardNumber === tx.cardNumber || a.id === tx.accountId);
        return {
          ...tx,
          _bankName: acc?.bankName || acc?.cardCompanyId || tx.cardCompanyId || '-',
          _accountNumber: acc?.accountNumber || acc?.cardNumber || tx.cardNumber || '-',
          _accountName: acc?.accountName || acc?.cardName || '카드',
          _productName: acc?.productName || '-'
        };
      });
      return await applyGuardrails('card_transactions', rows);
    }
    case "get_card_usage_by_approval_date": {
      const txs = await queryTable('card_transactions', {
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
      const transactions = await applyGuardrails('card_transactions', txs.slice(0, 100));
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

      let allRows: any[] = [];
      if (args.rows && Array.isArray(args.rows)) {
        allRows = args.rows;
      } else {
        const queryOptions: any = { filters, limit: 5000 };
        if (args.startDate) queryOptions.startDate = args.startDate;
        if (args.endDate) queryOptions.endDate = args.endDate;
        const rowsRes = await queryTable(targetTable, queryOptions);
        allRows = Array.isArray(rowsRes) ? rowsRes : (rowsRes?.rows || []);
      }
      
      const validRows = allRows.filter((row: any) => row.isDeleted === 0 || row.isDeleted === '0' || row.isDeleted === undefined);

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
      } else if (targetTableStr.includes('card_transactions') || targetTableStr.includes('card-table')) {
        targetTable = 'card_transactions';
        delete filters.isDeleted;
      } else if (targetTable !== 'dashboard_data' && !targetTableStr.includes('-')) {
        // Physical
      } else {
        targetTable = 'dashboard_data';
        filters.reportId = args.tableId;
      }
      const wsRows = await queryTable(targetTable, { 
        filters, 
        limit: args.limit || 100, 
        offset: args.offset || 0,
        startDate: args.startDate,
        endDate: args.endDate
      });
      const rows = Array.isArray(wsRows) ? wsRows : (wsRows?.rows || []);
      return await applyGuardrails(args.tableId, rows);
    }
    case "run_studio_data_query": {
      const { tableId, intent, startDate, endDate, limit, offset, groupBy, valueKey } = args;
      const idStr = String(tableId || '');
      const isFinance = idStr === 'bank_transactions' || idStr.includes('bank') || idStr.includes('card');
      const isHometax = idStr.startsWith('hometax_');

      if (isFinance) {
        // 금융 데이터 분기
        if (idStr === 'bank_accounts') {
          return await runAITool('list_bank_accounts', { limit });
        } else if (idStr === 'card_accounts') {
          return await runAITool('list_card_accounts', { limit });
        }
        
        if (intent === 'summary' || intent === 'statistics') {
          return await runAITool('get_finance_statistics', { startDate, endDate });
        } else if (intent === 'monthly') {
          return await runAITool('get_finance_monthly_summary', { months: args.months || 12 });
        } else {
          // 상세 목록은 bank_transactions 또는 card_approvals 자동 선택
          const toolName = (idStr.includes('card') || idStr.includes('approvals')) 
            ? 'query_card_transactions' 
            : 'query_bank_transactions';
          return await runAITool(toolName, { startDate, endDate, limit: limit || 100 });
        }
      } else if (isHometax) {
        // [Universal] 국세청(홈택스) 데이터 분기
        const queryOptions = { startDate, endDate, limit: limit || 100, offset: offset || 0 };
        let hometaxResult;

        const isSales = idStr.includes('sales');
        const isExempt = idStr.includes('exempt');
        const isCash = idStr.includes('cash_receipts');

        if (isCash) {
          hometaxResult = await queryCashReceipts(queryOptions);
        } else if (isExempt) {
          hometaxResult = await queryTaxExemptInvoices({ ...queryOptions, invoiceType: isSales ? 'sales' : 'purchase' });
        } else {
          // 세금계산서 (Tax Invoices)
          hometaxResult = await queryTaxInvoices({ ...queryOptions, invoiceType: isSales ? 'sales' : 'purchase' });
        }

        const rows = Array.isArray(hometaxResult) ? hometaxResult : (hometaxResult?.rows || []);
        
        // 만약 집계 요청(groupBy)이 있다면 가공
        if (groupBy && valueKey && rows.length > 0) {
          return await runAITool('get_aggregated_report_data', { tableId, groupByKey: groupBy, sumKey: valueKey, mode: 'sum', rows });
        }
        return await applyGuardrails(tableId, rows);
      } else {
        // 일반 워크스페이스 데이터 분기
        if (groupBy && valueKey) {
          return await runAITool('get_aggregated_report_data', { tableId, groupByKey: groupBy, sumKey: valueKey, mode: 'sum', startDate, endDate });
        } else {
          return await runAITool('query_workspace_table', { tableId, limit: limit || 100, offset: offset || 0, startDate, endDate });
        }
      }
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
