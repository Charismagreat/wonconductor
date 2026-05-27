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
 * 거래 내역 데이터에서 실시간 타임스탬프(밀리초)를 안전하고 정밀하게 추출하는 유틸리티
 */
function getSafeTimestamp(item: any): number {
  if (!item) return 0;
  // 1. transaction_datetime 속성이 존재할 때 최우선 사용
  if (item.transaction_datetime) {
    const parsed = Date.parse(String(item.transaction_datetime).replace(/\//g, '-'));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 2. date와 time 필드 조합이 있는 경우
  const dateVal = item.date || item.TRAN_DATE || item.transactionDate || item.tranDate || '';
  const timeVal = item.time || item.TRAN_TIME || '';
  if (dateVal) {
    let cleanStr = String(dateVal).trim().replace(/[\.\/]/g, '-');
    if (/^\d{8}$/.test(cleanStr)) {
      cleanStr = `${cleanStr.substring(0, 4)}-${cleanStr.substring(4, 6)}-${cleanStr.substring(6, 8)}`;
    }
    if (timeVal) {
      cleanStr = `${cleanStr.split(' ')[0]} ${timeVal}`;
    }
    const parsed = Date.parse(cleanStr);
    if (!isNaN(parsed)) return parsed;
  }

  // 3. timestamp 또는 기타 속성 폴백
  if (item.timestamp !== undefined && item.timestamp !== null) {
    const ts = Number(item.timestamp);
    if (!isNaN(ts) && ts > 0) return ts;
  }
  
  // 4. createdAt (DB 적재 UTC 타임스탬프) 폴백
  if (item.createdAt) {
    const parsed = Date.parse(item.createdAt);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  
  return 0;
}

/**
 * 도구 호출(Function Call) 실행기 - 공유 유틸리티
 */
export async function runAITool(name: string, args: any): Promise<any> {
  console.log(`[AI Tool Execution] ${name}`, args);
  let result: any;

  switch (name) {
    case "list_available_tables": {
      // 1. Userdata Tables (일반 테이블 목록)
      const userTablesRaw = await listTables().catch(() => ({ tables: [] }));
      const userTables = Array.isArray(userTablesRaw?.tables) ? userTablesRaw.tables : [];
      
      // 2. FinanceHub Virtual Tables (Master and Transactions)
      const financeTables = [
        { id: 'bank_accounts', name: '은행/카드 계좌 마스터', description: '현재 모든 연결된 계좌의 잔액, 은행명, 계좌번호 정보' },
        { id: 'bank_transactions', name: '은행 거래 내역', description: '입금, 출금, 잔액 등 은행 입출금 거래 히스토리' },
        { id: 'card_accounts', name: '신용카드 마스터', description: '등록된 카드 목록 및 한도 정보' },
        { id: 'card_transactions', name: '카드 승인 내역', description: '카드 결제 일자, 가맹점, 금액 정보' }
      ];

      // 2.1 은행 개별 대출/어음 금융 상품 테이블 동적 추가
      try {
        const { listBankProductTables } = require('@/egdesk-helpers');
        const prodTablesRes = await listBankProductTables().catch(() => null);
        const prodTables = Array.isArray(prodTablesRes) ? prodTablesRes : (prodTablesRes?.tables || []);
        prodTables.forEach((t: any) => {
          financeTables.push({
            id: `bank-product:bank-product:${t.slug}`,
            name: t.displayName || t.slug,
            description: `${t.displayName || t.slug} 개별 금융 상품 테이블 (${t.rowCount || 0} rows)`
          });
        });
      } catch (e) {
        console.error('Failed to dynamic merge bank product tables in AI tools:', e);
      }

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
      tableMarkdown += "| 은행명 | 계좌번호 | 계좌명 | 현재잔액 | 약정금액 | 사용가능한도 | 관리점 | 최종거래일 |\n| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n";
      integratedRows.forEach((row: any) => {
        const balanceStr = (row.잔액 || 0).toLocaleString() + "원";
        const contractStr = row.약정금액 ? `${row.약정금액.toLocaleString()}원` : "-";
        const availableStr = row.사용가능한도 ? `${row.사용가능한도.toLocaleString()}원` : "-";
        const branchStr = row.관리점 || "-";
        tableMarkdown += `| ${row._bankName} | ${row.계좌번호} | ${row.계좌명} | **${balanceStr}** | ${contractStr} | **${availableStr}** | ${branchStr} | ${row.일자} |\n`;
      });
      stats.fullTableMarkdown = tableMarkdown;
      return stats;
    }
    case "get_finance_monthly_summary": {
      const requestedMonths = args.months || 6;
      const tableId = String(args.tableId || '');
      const isCardQuery = tableId.includes('card') || tableId.includes('approvals');

      if (isCardQuery) {
        // [필수 개선] 신용카드 취소 거래(isCancelled 또는 취소 승인 내역)를 차감(-)하여 월별 합산 계산
        const rawCardTxRes = await queryCardTransactions({ limit: 5000, includeCancelled: true });
        const txs = Array.isArray(rawCardTxRes) ? rawCardTxRes : (rawCardTxRes?.transactions || rawCardTxRes?.rows || []);
        
        const monthlyAggregation: Record<string, number> = {};
        
        txs.forEach((tx: any) => {
          const dateStr = tx.approvalDate || tx.date;
          if (!dateStr || dateStr.length < 7) return;
          const month = dateStr.substring(0, 7); // "YYYY-MM"
          
          // 취소 여부 확인
          const isCancelled = tx.isCancelled === true || tx.isCancelled === 'true' || tx.isCancelled === 1 || String(tx.salesType).includes('취소') || String(tx.status).includes('취소');
          
          const amount = Number(tx.amount) || 0;
          
          if (!monthlyAggregation[month]) {
            monthlyAggregation[month] = 0;
          }
          
          if (isCancelled) {
            monthlyAggregation[month] -= amount;
          } else {
            monthlyAggregation[month] += amount;
          }
        });
        
        const sortedMonths = Object.keys(monthlyAggregation).sort().reverse().slice(0, requestedMonths);
        
        const mappedSummary = sortedMonths.map(month => {
          const value = monthlyAggregation[month];
          return {
            month,
            yearMonth: month,
            deposit: 0,
            withdrawal: value >= 0 ? value : 0,
            label: month,
            value: value >= 0 ? value : 0
          };
        });
        
        return {
          success: true,
          data: mappedSummary,
          summary: mappedSummary,
          totalMonths: sortedMonths.length
        };
      }

      // [이슈 해결] months 인자가 단순 Row Limit으로 작동하는 경우를 대비해 넉넉하게 조회 (계좌 수 고려)
      const fetchLimit = requestedMonths * 20; 
      const result = await getMonthlySummary({ months: fetchLimit });
      
      // [개선] 요청된 tableId에 따라 은행/카드 필터링
      if (Array.isArray(result?.summary)) {
        const accountsRes = await listAccounts().catch(() => ({ accounts: [] }));
        const accounts = Array.isArray(accountsRes) ? accountsRes : (accountsRes?.accounts || []);
        
        const isBankQuery = tableId.includes('bank') || tableId.includes('transaction') || tableId === 'bank_accounts';

        let filteredSummary = result.summary.filter((item: any) => {
          // 계좌 정보 매칭 (accountId 우선, 없으면 bankId로 매칭)
          const acc = accounts.find((a: any) => 
            (item.accountId && a.accountId === item.accountId) || 
            (!item.accountId && a.bankId === item.bankId)
          );
          
          const bId = String(acc?.bankId || item.bankId || '').toLowerCase();
          const aName = String(acc?.accountName || item.accountName || '').toLowerCase();
          const isCard = bId.includes('card') || aName.includes('카드');
          
          if (isBankQuery) return !isCard;
          return true;
        });

        // [필수] 필터링 후 다시 월별 정렬 및 최근 N개월 제한 적용
        filteredSummary.sort((a: any, b: any) => String(b.yearMonth).localeCompare(String(a.yearMonth)));
        
        // 유니크한 월 목록 추출하여 최근 N개월만 선택
        const uniqueMonths = Array.from(new Set(filteredSummary.map((s: any) => s.yearMonth))).sort().reverse().slice(0, requestedMonths);
        filteredSummary = filteredSummary.filter((s: any) => uniqueMonths.includes(s.yearMonth));

        const mappedSummary = filteredSummary.map((item: any) => ({
          ...item,
          month: item.yearMonth || item.month,
          deposit: item.totalDeposits || item.deposit || 0,
          withdrawal: item.totalWithdrawals || item.withdrawal || 0,
          label: item.yearMonth || item.month,
          value: item.totalWithdrawals || item.withdrawal || 0
        }));
        
        return {
          ...result,
          data: mappedSummary,
          summary: mappedSummary,
          totalMonths: uniqueMonths.length
        };
      }
      
      return result;
    }
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
      const accRes = await listAccounts();
      const accounts = Array.isArray(accRes) ? accRes : (accRes?.accounts || []);
      
      const validAccounts = accounts.filter((acc: any) => {
        const bId = String(acc.bankId || '').toLowerCase();
        const aName = String(acc.accountName || '').toLowerCase();
        return !bId.includes('card') && !aName.includes('카드');
      });

      // 각 은행 계좌별로 개별 트랜잭션을 안전하게 조회하여 병합 집계 (Promise.all 활용)
      const txStats: Record<string, { count: number, balance: number, date: string, timestamp: number }> = {};
      
      await Promise.all(validAccounts.map(async (acc: any) => {
        const id = acc.id || acc.accountId;
        try {
          // 계좌 ID를 명시적으로 전달하므로 타 계좌에 영향받지 않고 최대 1000건까지 거래를 완전히 수집함
          const txRes = await queryBankTransactions({ accountId: id, limit: 1000 });
          let transactions = Array.isArray(txRes) ? txRes : (txRes?.transactions || []);
          const cleanAccNum = String(acc.accountNumber || '').replace(/[^0-9]/g, '');

          // [스마트 대출 원장 연동] 거래 내역이 없거나 대출계좌인 경우, 대출 상세 전용 테이블(hana_loan_history 등)을 스캔하여 동적 병합합니다.
          if (transactions.length === 0 || acc.accountType === 'loan') {
            try {
              const { queryBankProductTable } = require('@/egdesk-helpers');
              
              if (String(acc.bankId || acc.bankName).toLowerCase().includes('hana') || String(acc.bankId || acc.bankName).toLowerCase().includes('하나')) {
                const hanaLoanRes = await queryBankProductTable({ tableSlug: 'hana_loan_history', limit: 500 });
                const hanaTxs = Array.isArray(hanaLoanRes) ? hanaLoanRes : (hanaLoanRes?.rows || []);
                const matchedHana = hanaTxs.filter((t: any) => {
                  const tNum = String(t.account_number || t.accountNumber || '').replace(/[^0-9]/g, '');
                  return tNum === cleanAccNum || tNum.includes(cleanAccNum) || cleanAccNum.includes(tNum);
                });
                if (matchedHana.length > 0) {
                  transactions = matchedHana.map((t: any) => ({
                    id: t.id,
                    date: t.transaction_date || t.date,
                    description: t.description,
                    amount: t.amount,
                    balance: t.balance,
                    synced_at: t.synced_at
                  }));
                }
              }
              
              if (String(acc.bankId || acc.bankName).toLowerCase().includes('ibk') || String(acc.bankId || acc.bankName).toLowerCase().includes('기업')) {
                const ibkLoanRes = await queryBankProductTable({ tableSlug: 'ibk_loan_history', limit: 500 });
                const ibkTxs = Array.isArray(ibkLoanRes) ? ibkLoanRes : (ibkLoanRes?.rows || []);
                const matchedIbk = ibkTxs.filter((t: any) => {
                  const tNum = String(t.account_number || t.accountNumber || '').replace(/[^0-9]/g, '');
                  return tNum === cleanAccNum || tNum.includes(cleanAccNum) || cleanAccNum.includes(tNum);
                });
                if (matchedIbk.length > 0) {
                  transactions = matchedIbk.map((t: any) => ({
                    id: t.id,
                    date: t.transaction_date || t.date,
                    description: t.description,
                    amount: t.amount,
                    balance: t.balance,
                    synced_at: t.synced_at
                  }));
                }
              }
            } catch (e: any) {
              console.error(`Failed to scan fallback loan history for ${cleanAccNum}:`, e.message);
            }
          }
          
          txStats[id] = { count: 0, balance: 0, date: '', timestamp: 0 };
          
          // 동일한 날짜에 다수 거래 발생 시 최신 잔액이 누락되는 현상을 방지하기 위해 
          // 1차: 타임스탬프 오름차순, 2차: DB PK ID 오름차순으로 명시적 정렬을 수행합니다.
          const sortedTransactions = [...transactions].sort((a: any, b: any) => {
            const tsA = getSafeTimestamp(a);
            const tsB = getSafeTimestamp(b);
            if (tsA !== tsB) {
              return tsA - tsB;
            }
            const idA = Number(a.id) || 0;
            const idB = Number(b.id) || 0;
            return idA - idB;
          });
          
          let runningBalance = 0; // 대출 계좌의 공란 잔액 복구용 러닝 밸런스
          sortedTransactions.forEach((tx: any) => {
            // [비즈니스 룰 반영] '기간연장' 등 실질적 입출금이 없는 거래는 최종 잔액 갱신 및 카운트에서 배제합니다.
            const desc = String(tx.description || '');
            if (desc.includes('기간연장')) {
              return;
            }

            txStats[id].count++;
            
            const currentTimestamp = getSafeTimestamp(tx);
            txStats[id].date = tx.date;
            
            // [지능형 대출 잔액 복원] 원장에 balance가 null(공란)인 경우 대출 실행(-) 및 상환(+) 트랜잭션을 역추적하여 실 잔액을 복구합니다.
            if (tx.balance !== undefined && tx.balance !== null) {
              txStats[id].balance = Number(tx.balance) || 0;
              runningBalance = txStats[id].balance;
            } else if (acc.accountType === 'loan' || String(acc.accountName).includes('대출')) {
              const amount = Number(tx.amount) || 0;
              if (desc.includes('실행')) {
                runningBalance -= amount; // 대출 실행액 만큼 부채 증가
              } else if (desc.includes('상환')) {
                runningBalance += amount; // 대출 상환액 만큼 부채 차감
              }
              txStats[id].balance = runningBalance;
            }
            
            txStats[id].timestamp = currentTimestamp;
          });
        } catch (e) {
          console.error(`Failed to fetch transactions for account ${id}:`, e);
          txStats[id] = { count: 0, balance: acc.balance || 0, date: '조회오류', timestamp: 0 };
        }
      }));

      const integratedRows = validAccounts.map((acc: any) => {
        const id = acc.id || acc.accountId;
        const stat = txStats[id];
        let balance = stat?.balance !== undefined ? stat.balance : (acc.balance || 0);
        
        // [비즈니스 룰] 대출계좌(loan)인 경우 잔액을 부채 성격(음수)으로 전환하여 올바른 전체 부채 합산이 가능하도록 보정합니다.
        const isLoan = acc.accountType === 'loan' || String(acc.accountName).includes('대출');
        if (isLoan && balance > 0) {
          balance = -balance;
        }

        // 약정금액 및 사용가능한도 파싱 (마이너스 통장/대출 전용 메타데이터)
        const rawContract = acc.metadata?.contractAmount || acc.metadata?.payableAmount || acc.limit || acc.metadata?.limit || '';
        const contractAmount = rawContract
          ? Number(String(rawContract).replace(/[^0-9.-]/g, '')) 
          : null;
        
        // 사용가능한도 계산 (마이너스 부채 상태에서 약정한도가 합산되므로 availableLimit = contractAmount + balance 로 가용한도가 나옴)
        const availableLimit = contractAmount !== null 
          ? contractAmount + balance 
          : null;

        return {
            id: id,
            일자: stat?.date || '기록없음',
            은행명: acc.bankName || acc.bankId,
            계좌번호: acc.accountNumber,
            계좌명: acc.accountName || '일반계좌',
            잔액: balance,
            거래건수: stat?.count || 0,
            약정금액: contractAmount,
            사용가능한도: availableLimit,
            관리점: acc.metadata?.branchName || null,
            _bankName: acc.bankName || acc.bankId,
            _accountNumber: acc.accountNumber,
            accountType: acc.accountType,
            isLoan: isLoan
        };
      });

      // 거래가 1건이라도 있거나, 잔액이 0이 아니거나, 약정금액(대출한도)이 설정된 계좌를 반환
      result = integratedRows
        .filter((acc: any) => acc.거래건수 > 0 || acc.잔액 !== 0 || (acc.약정금액 !== null && acc.약정금액 !== undefined && acc.약정금액 !== 0))
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
        const isCancelled = tx.isCancelled === true || tx.isCancelled === 'true' || tx.isCancelled === 1 || String(tx.salesType).includes('취소') || String(tx.status).includes('취소');
        const amt = Number(tx.amount) || 0;
        return {
          ...tx,
          amount: isCancelled ? -Math.abs(amt) : amt,
          isCancelled,
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
      // [수정] 취소 거래(isCancelled 또는 취소 문자열 포함)인 경우 차감(-) 처리합니다.
      const totalAmount = txs.reduce((sum: number, tx: any) => {
        const isCancelled = tx.isCancelled === true || tx.isCancelled === 'true' || String(tx.salesType).includes('취소') || String(tx.status).includes('취소');
        const amt = tx.amount || 0;
        return isCancelled ? sum - amt : sum + amt;
      }, 0);
      
      const categorySummary: Record<string, number> = {};
      txs.forEach((tx: any) => {
        const cat = tx.category || '기타';
        const isCancelled = tx.isCancelled === true || tx.isCancelled === 'true' || String(tx.salesType).includes('취소') || String(tx.status).includes('취소');
        const amt = tx.amount || 0;
        const adjustedAmt = isCancelled ? -amt : amt;
        categorySummary[cat] = (categorySummary[cat] || 0) + adjustedAmt;
      });
      const transactions = await applyGuardrails('card_transactions', txs.slice(0, 100));
      return {
        totalAmount,
        transactionCount: txs.length,
        period: `${args.startDate} ~ ${args.endDate}`,
        categorySummary,
        transactions: transactions.map((t: any) => {
          const isCancelled = t.isCancelled === true || t.isCancelled === 'true' || String(t.salesType).includes('취소') || String(t.status).includes('취소');
          const amt = Number(t.amount) || 0;
          return {
            id: t.id,
            approvalDate: t.approvalDate || t.date,
            cardNumber: t.cardNumber || t.cardNo,
            description: t.description || t.merchantName,
            category: t.category,
            amount: isCancelled ? -Math.abs(amt) : amt,
            isCancelled
          };
        }),
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

      // 집계 전에 가드레일 적용
      const safeRows = await applyGuardrails(args.tableId, validRows);

      const mode = args.mode || 'sum';
      const sumKeys = Array.isArray(args.sumKey) ? args.sumKey : [args.sumKey || 'value'];
      const groupByKey = args.groupByKey;
      const summary: Record<string, Record<string, number>> = {};
      
      const hometaxFieldMappings: Record<string, string> = {
        '작성일자': 'date',
        '승인번호': 'approvalNo',
        '발급일자': 'issueDate',
        '전송일자': 'sendDate',
        '공급자사업자등록번호': 'supplierBusinessNumber',
        '공급자종사업장번호': 'supplierSubBusinessNumber',
        '공급자상호': 'supplierName',
        '공급자대표자명': 'supplierCEO',
        '공급자주소': 'supplierAddress',
        '공급받는자사업자등록번호': 'receiverBusinessNumber',
        '공급받는자종사업장번호': 'receiverSubBusinessNumber',
        '공급받는자상호': 'receiverName',
        '공급받는자대표자명': 'receiverCEO',
        '공급받는자주소': 'receiverAddress',
        '합계금액': 'totalAmount',
        '공급가액': 'supplyAmount',
        '세액': 'taxAmount',
        '전자세금계산서분류': 'invoiceCategory',
        '전자세금계산서종류': 'invoiceTypeDetail',
        '발급유형': 'issueType',
        '비고': 'remarks',
        '영수청구구분': 'claimType',
        '공급자이메일': 'supplierEmail',
        '공급받는자이메일1': 'receiverEmail1',
        '공급받는자이메일2': 'receiverEmail2',
        '품목일자': 'itemDate',
        '품목명': 'itemName',
        '품목규격': 'itemSpec',
        '품목수량': 'itemQty',
        '품목단가': 'itemPrice',
        '품목공급가액': 'itemSupplyAmount',
        '품목세액': 'itemTaxAmount',
        '품목비고': 'itemRemarks',
      };

      safeRows.forEach((row: any) => {
        const rawRowData = targetTable === 'dashboard_data'
          ? (typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}))
          : row;
        
        // [자가 치유] 테이블 조인 및 한글/영문 혼합 데이터의 안정성을 위해 양방향 필드 미러링 적용
        const rowData = { ...rawRowData };
        Object.entries(hometaxFieldMappings).forEach(([kor, eng]) => {
          if (rowData[kor] !== undefined && rowData[eng] === undefined) {
            rowData[eng] = rowData[kor];
          } else if (rowData[eng] !== undefined && rowData[kor] === undefined) {
            rowData[kor] = rowData[eng];
          }
        });
        
        // [개선] 날짜 기반 집계 특수 처리 (__month, __week, __year)
        let groupValue: any;
        if (groupByKey && groupByKey.startsWith('__')) {
          const dateVal = rowData['date'] || rowData['작성일자'] || rowData['일자'] || rowData['createdAt'] || rowData['writeDate'] || rowData['approvalDate'] || rowData['saleDate'] || rowData['transactionDate'];
          if (dateVal && typeof dateVal === 'string') {
            const d = new Date(dateVal.replace(/\./g, '-'));
            if (!isNaN(d.getTime())) {
              if (groupByKey === '__month') {
                groupValue = dateVal.substring(0, 7).replace(/[^0-9-]/g, '-'); // YYYY-MM
              } else if (groupByKey === '__year') {
                groupValue = dateVal.substring(0, 4); // YYYY
              } else if (groupByKey === '__week') {
                // 주차 계산 (ISO 주차 기준)
                const target = new Date(d.valueOf());
                const dayNr = (d.getDay() + 6) % 7;
                target.setDate(target.getDate() - dayNr + 3);
                const firstThursday = target.valueOf();
                target.setMonth(0, 1);
                if (target.getDay() !== 4) {
                  target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
                }
                const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
                groupValue = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
              }
            }
          }
        } else {
          groupValue = rowData[groupByKey];
        }

        if (groupValue === undefined || groupValue === null || groupValue === '') return;
        const gKey = String(groupValue);
        if (!summary[gKey]) {
          summary[gKey] = {};
          sumKeys.forEach((sk: any) => summary[gKey][sk] = 0);
        }
        sumKeys.forEach((sk: any) => {
          if (mode === 'count') {
            summary[gKey][sk] += 1;
          } else {
            // [자가 치유] 합계 대상 키 탐색 시 한글/영문 매칭 호환
            let amountRaw = rowData[sk];
            if (amountRaw === undefined) {
              const altKey = hometaxFieldMappings[sk] || Object.keys(hometaxFieldMappings).find(k => hometaxFieldMappings[k] === sk);
              if (altKey) amountRaw = rowData[altKey];
            }
            
            let amount = 0;
            if (typeof amountRaw === 'number') amount = amountRaw;
            else if (typeof amountRaw === 'string') amount = parseFloat(amountRaw.replace(/,/g, ''));
            
            // [수정] 취소 거래인 경우 총액 합산 시 마이너스(-) 차감 처리합니다.
            const isCancelled = rowData.isCancelled === true || rowData.isCancelled === 'true' || String(rowData.salesType).includes('취소') || String(rowData.status).includes('취소');
            if (isCancelled && (sk === 'amount' || sk === 'outflow' || sk === 'withdrawal' || sk === '금액' || sk === '승인금액' || sk === '출금액' || sk === '공급가액' || sk === 'supplyAmount')) {
              amount = -amount;
            }

            if (!isNaN(amount)) summary[gKey][sk] += amount;
          }
        });
      });

      return Object.keys(summary).map(key => {
        const item: any = { label: key };
        if (sumKeys.length === 1) item.value = summary[key][sumKeys[0]];
        Object.assign(item, summary[key]);
        return item;
      }).sort((a, b) => a.label.localeCompare(b.label)); // 날짜순 정렬을 위해 localeCompare 사용
    }
    case "query_workspace_table": {
      const targetTableStr = String(args.tableId || '');

      // ── [1] bank-product 테이블 실데이터 동적 페칭 분기 처리 ───────────────────────
      if (targetTableStr.startsWith('bank-product:')) {
        const parts = targetTableStr.split(':');
        const tableSlug = parts[2]; // 'ibk_b2b_receivables' 등 추출
        
        try {
          const { queryBankProductTable } = require('@/egdesk-helpers');
          
          const filtersArr: any[] = [];
          
          // 해당 테이블의 스키마 메타데이터 조회
          const { listBankProductTables } = require('@/egdesk-helpers');
          const allBankProdTables = await listBankProductTables().catch(() => null);
          const currentTableMeta = Array.isArray(allBankProdTables)
            ? allBankProdTables.find((t: any) => t.slug === tableSlug)
            : (allBankProdTables?.tables || []).find((t: any) => t.slug === tableSlug);

          // A. 날짜 필터 (startDate, endDate) 연동
          // 각 테이블 스키마에서 실제 존재하는 날짜 컬럼명을 동적으로 추출하여 필터에 매핑
          const dateColumnCandidates = ['registered_date', 'endorsement_date', 'received_date', 'transaction_date', 'date'];
          const actualDateColumn = currentTableMeta?.columns
            ? dateColumnCandidates.find(candidate => currentTableMeta.columns.some((col: any) => col.name === candidate))
            : 'registered_date'; // 기본 폴백

          if (actualDateColumn) {
            if (args.startDate) {
              filtersArr.push({ column: actualDateColumn, op: '>=', value: args.startDate });
            }
            if (args.endDate) {
              filtersArr.push({ column: actualDateColumn, op: '<=', value: args.endDate });
            }
          }
          
          // B. 추가 조건 필터 객체(args.filters) 연동
          if (args.filters && typeof args.filters === 'object') {
            Object.entries(args.filters).forEach(([key, val]) => {
              if (key === '__is_deleted') return; // 시스템 기본 삭제 플래그는 제외
              if (val !== undefined && val !== null && val !== '') {
                if (typeof val === 'object' && (val as any).op) {
                  filtersArr.push({
                    column: key,
                    op: (val as any).op,
                    value: (val as any).value
                  });
                } else {
                  filtersArr.push({
                    column: key,
                    op: '=',
                    value: val
                  });
                }
              }
            });
          }
          
          // C. 상태 필터 (status) 연동 및 지능형 Fallback 가드
          const hasStatusColumn = currentTableMeta?.columns?.some((col: any) => col.name === 'status');

          if (hasStatusColumn) {
            if (args.status) {
              filtersArr.push({ column: 'status', op: '=', value: args.status });
            } else if (args.filters && args.filters.status) {
              // Already handled in loop
            } else {
              // [지능형 Fallback 가드] 명시적인 status 필터가 없는 경우,
              // 대시보드 화면의 오염을 방지하기 위해 기본적으로 '완제' 상태의 과거 어음은 자동 소거하고
              // 현재 살아 있는 실 어음 건들만 노출하도록 스마트 필터링을 자동 탑재합니다!
              filtersArr.push({ column: 'status', op: '!=', value: '완제' });
            }
          }

          const productRes = await queryBankProductTable({
            tableSlug,
            filters: filtersArr.length > 0 ? filtersArr : undefined,
            limit: args.limit || 100,
            offset: args.offset || 0,
            // B2B 대출 실행 및 채권 거래에서 동일 식별자 중복 표시를 방지하기 위해 최신 데이터만 조회 옵션 설정
            latestOnly: tableSlug.includes('b2b') || tableSlug.includes('receivable') || tableSlug.includes('woori') ? true : undefined
          });
          const rows = Array.isArray(productRes) ? productRes : (productRes?.rows || productRes?.transactions || []);
          return await applyGuardrails(args.tableId, rows);
        } catch (e: any) {
          console.error(`Failed to query real bank-product table '${tableSlug}':`, e.message);
          return [];
        }
      }

      let targetTable = args.tableId;
      const filters: any = { __is_deleted: '0' };
      if (targetTableStr.includes('bank_transactions') || targetTableStr.includes('bank-table')) {
        targetTable = 'bank_transactions';
        delete filters.__is_deleted;
      } else if (targetTableStr.includes('card_transactions') || targetTableStr.includes('card-table')) {
        targetTable = 'card_transactions';
        delete filters.__is_deleted;
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
      const isFinance = (idStr === 'bank_transactions' || idStr.includes('bank') || idStr.includes('card')) && !idStr.includes('bank-product');
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
          let monthsCount = args.months || 12;
          if (!args.months && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
              monthsCount = Math.max(1, Math.round(diffDays / 30));
            }
          }
          return await runAITool('get_finance_monthly_summary', { tableId, months: monthsCount });
        } else {
          // 상세 목록은 bank_transactions 또는 card_approvals 자동 선택
          const toolName = (idStr.includes('card') || idStr.includes('approvals')) 
            ? 'query_card_transactions' 
            : 'query_bank_transactions';
          return await runAITool(toolName, { startDate, endDate, limit: limit || 100 });
        }
      } else if (isHometax) {
        // [Universal] 국세청(홈택스) 데이터 분기
        // 통계/집계(groupBy)인 경우 데이터 유실을 방지하기 위해 기본 limit을 5000으로 넉넉하게 설정합니다.
        const defaultLimit = groupBy ? 5000 : 100;
        const queryOptions = { startDate, endDate, limit: limit || defaultLimit, offset: offset || 0 };
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

        // [이슈 해결] 홈택스 쿼리는 결과 포맷에 따라 invoices 또는 receipts 배열에 실제 데이터가 있습니다.
        let rawRows: any[] = [];
        if (Array.isArray(hometaxResult)) {
          rawRows = hometaxResult;
        } else if (hometaxResult) {
          rawRows = hometaxResult.invoices || hometaxResult.receipts || hometaxResult.rows || [];
        }

        // 한글/영문 필드 양방향 매핑을 통해 AI 쿼리 유연성 극대화
        const hometaxFieldMappings: Record<string, string> = {
          '작성일자': 'date',
          '승인번호': 'approvalNo',
          '발급일자': 'issueDate',
          '전송일자': 'sendDate',
          '공급자사업자등록번호': 'supplierBusinessNumber',
          '공급자종사업장번호': 'supplierSubBusinessNumber',
          '공급자상호': 'supplierName',
          '공급자대표자명': 'supplierCEO',
          '공급자주소': 'supplierAddress',
          '공급받는자사업자등록번호': 'receiverBusinessNumber',
          '공급받는자종사업장번호': 'receiverSubBusinessNumber',
          '공급받는자상호': 'receiverName',
          '공급받는자대표자명': 'receiverCEO',
          '공급받는자주소': 'receiverAddress',
          '합계금액': 'totalAmount',
          '공급가액': 'supplyAmount',
          '세액': 'taxAmount',
          '전자세금계산서분류': 'invoiceCategory',
          '전자세금계산서종류': 'invoiceTypeDetail',
          '발급유형': 'issueType',
          '비고': 'remarks',
          '영수청구구분': 'claimType',
          '공급자이메일': 'supplierEmail',
          '공급받는자이메일1': 'receiverEmail1',
          '공급받는자이메일2': 'receiverEmail2',
          '품목일자': 'itemDate',
          '품목명': 'itemName',
          '품목규격': 'itemSpec',
          '품목수량': 'itemQty',
          '품목단가': 'itemPrice',
          '품목공급가액': 'itemSupplyAmount',
          '품목세액': 'itemTaxAmount',
          '품목비고': 'itemRemarks',
        };

        const rows = rawRows.map((row: any) => {
          const newRow = { ...row };
          // 양방향 매핑 복사
          Object.entries(hometaxFieldMappings).forEach(([kor, eng]) => {
            if (newRow[kor] !== undefined && newRow[eng] === undefined) {
              newRow[eng] = newRow[kor];
            } else if (newRow[eng] !== undefined && newRow[kor] === undefined) {
              newRow[kor] = newRow[eng];
            }
          });
          return newRow;
        });
        
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
