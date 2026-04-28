import { queryTable, executeSQL, listAccounts, queryBankTransactions, getOverallStats } from "@/egdesk-helpers";
import { queryCardTransactions, getMonthlySummary, getTransactionStats as getStatistics } from "@/egdesk-helpers";

/**
 * 도구 호출(Function Call) 실행기 - 공유 유틸리티
 */
export async function runAITool(name: string, args: any) {
  console.log(`[AI Tool Execution] ${name}`, args);
  switch (name) {
    case "get_finance_dashboard_summary": {
      // 1. 통일된 가상 ID를 사용하여 통합 데이터 쿼리 (The Smart Way Phase 2)
      // 이제 queryTable이 내부적으로 조인 로직을 처리하므로 로직이 매우 단순해집니다.
      const { queryTable } = require('@/egdesk-helpers');
      const integratedRows = await queryTable('bank_transactions', { limit: 100 });

      // 2. 리턴 데이터 구성 (AI 전달용)
      const stats = {
        bankBreakdown: integratedRows,
        _totalCount: integratedRows.length,
        _isFullList: true,
        _source: "Unified Virtual Table (bank_transactions)",
        fullTableMarkdown: ""
      };

      // 3. AI 출력용 마스크다운 표 생성
      let tableMarkdown = "### 🏦 은행 및 계좌별 잔액 현황 (전체 71건)\n\n";
      tableMarkdown += "| 은행명 | 계좌번호 | 현재잔액 | 최종거래일 |\n| :--- | :--- | :---: | :---: |\n";
      
      integratedRows.forEach((row: any) => {
        tableMarkdown += `| ${row._bankName} | ${row.accountNumber} | **${row.balance.toLocaleString()}** | ${row.date} |\n`;
      });
      
      stats.fullTableMarkdown = tableMarkdown;

      return stats;
    }
    case "get_finance_monthly_summary":
      return await getMonthlySummary({ months: args.months || 6 });
    case "get_finance_statistics":
      return await getStatistics({ startDate: args.startDate, endDate: args.endDate });
    case "list_bank_accounts": {
      // [개정] 통합 가상 테이블을 사용하여 MY DB와 동일한 계좌 목록을 가져옵니다.
      const items = await queryTable('bank_transactions', { limit: 100 });
      return items.filter((acc: any) => {
        const bId = String(acc.bankId || '').toLowerCase();
        const aName = String(acc.accountName || '').toLowerCase();
        return !bId.includes('card') && !aName.includes('카드');
      });
    }
    case "query_bank_transactions": {
      // [개정] 가상 테이블을 통해 정규화된 거래 내역을 가져옵니다.
      const txs = await queryTable('bank_transactions', {
        startDate: args.startDate,
        endDate: args.endDate,
        limit: args.limit || 100,
        orderBy: 'date',
        orderDir: 'desc'
      });
      
      // [강제 필터링] 대시보드와 동일하게 은행 계좌의 내역만 반환 (카드 제외)
      return txs.filter((tx: any) => {
        const bId = String(tx.bankId || '').toLowerCase();
        const aName = String(tx.accountName || '').toLowerCase();
        return !bId.includes('card') && !aName.includes('카드');
      });
    }
    case "query_card_transactions": {
      // [개정] 가상 테이블을 통해 정규화된 카드 거래 내역을 가져옵니다.
      const txs = await queryTable('card_approvals', {
        startDate: args.startDate,
        endDate: args.endDate,
        limit: args.limit || 100,
        orderBy: 'date',
        orderDir: 'desc'
      });
      
      // [강제 필터링] 카드 거래만 반환
      return txs.filter((tx: any) => {
        const bId = String(tx.bankId || tx.cardCompanyId || '').toLowerCase();
        const aName = String(tx.accountName || tx.cardName || '').toLowerCase();
        return bId.includes('card') || aName.includes('카드');
      });
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

      return {
        totalAmount,
        transactionCount: txs.length,
        period: `${args.startDate} ~ ${args.endDate}`,
        categorySummary,
        transactions: txs.slice(0, 100).map((t: any) => ({
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
      // 삭제된 데이터 자동 필터링: SQL에 isDeleted 조건 주입
      let sql = args.sql as string;
      // WHERE 절이 이미 있으면 AND 추가, 없으면 WHERE 추가
      // dashboard_data 테이블을 대상으로 하는 쿼리에만 적용
      if (/dashboard_data/i.test(sql) && !/isDeleted/i.test(sql)) {
        if (/WHERE/i.test(sql)) {
          sql = sql.replace(/WHERE/i, 'WHERE isDeleted = 0 AND');
        } else {
          // FROM dashboard_data 뒤에 WHERE 절 삽입
          sql = sql.replace(/(FROM\s+dashboard_data\b)/i, '$1 WHERE isDeleted = 0');
        }
      }
      return await executeSQL(sql);
    }
    case "get_aggregated_report_data": {
      // 업종별 템플릿은 별도의 물리 테이블로 생성되므로, dashboard_data가 아닌 경우 해당 테이블을 직접 쿼리
      const targetTable = (args.tableId && args.tableId !== 'dashboard_data' && !args.tableId.includes('-')) ? args.tableId : 'dashboard_data';
      const filters: any = { isDeleted: '0' };
      if (targetTable === 'dashboard_data') filters.reportId = args.tableId;
      
      const rows = await queryTable(targetTable, { 
        filters,
        limit: 5000
      });
      const allRows = Array.isArray(rows) ? rows : (rows?.rows || []);
      // 이중 안전장치: 코드에서도 isDeleted가 정확히 0인 행만 허용
      const validRows = allRows.filter((row: any) => 
        row.isDeleted === 0 || row.isDeleted === '0'
      );
      
      // 집계 모드 (sum 또는 count, 기본값은 sum)
      const mode = args.mode || 'sum';
      // sumKey를 배열로 처리 가능하도록 정규화 (단일 문자열인 경우도 배열로 변환)
      const sumKeys = Array.isArray(args.sumKey) ? args.sumKey : [args.sumKey || 'value'];
      
      const summary: Record<string, Record<string, number>> = {};
      validRows.forEach((row: any) => {
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
            if (typeof amountRaw === 'number') {
              amount = amountRaw;
            } else if (typeof amountRaw === 'string') {
              amount = parseFloat(amountRaw.replace(/,/g, ''));
            }
            if (!isNaN(amount)) summary[gKey][sk] += amount;
          }
        });
      });

      // 결과 반환: 각 그룹키별로 모든 sumKeys의 합계를 포함한 객체 배열 생성
      return Object.keys(summary).map(key => {
        const item: any = { label: key };
        // 기존 호환성을 위해 첫 번째 sumKey 결과는 'value' 키로도 제공
        if (sumKeys.length === 1) {
          item.value = summary[key][sumKeys[0]];
        }
        // 모든 집계 필드 추가
        Object.assign(item, summary[key]);
        return item;
      }).sort((a, b) => (b.value !== undefined ? b.value - (a.value || 0) : 0));
    }
    case "query_workspace_table": {
      let targetTable = args.tableId;
      const filters: any = { isDeleted: '0' };
      
      // [개정] 물리 테이블 매핑을 제거하고 queryTable의 자동 핸들링에 맡깁니다.
      // 가상 ID(finance-hub-*)가 들어오면 queryTable이 알아서 조인 로직을 수행합니다.
      if (targetTable.includes('bank_transactions') || targetTable.includes('bank-table')) {
        targetTable = 'bank_transactions';
        delete filters.isDeleted;
      } else if (targetTable.includes('card_transactions') || targetTable.includes('card-table') || targetTable.includes('card_approvals')) {
        targetTable = 'card_approvals';
        delete filters.isDeleted;
      } else if (targetTable !== 'dashboard_data' && !targetTable.includes('-')) {
        // 물리 테이블인 경우
      } else {
        targetTable = 'dashboard_data';
        filters.reportId = args.tableId;
      }

      const wsRows = await queryTable(targetTable, { 
        filters,
        limit: args.limit || 100,
        offset: args.offset || 0
      });
      return Array.isArray(wsRows) ? wsRows : (wsRows?.rows || []);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
