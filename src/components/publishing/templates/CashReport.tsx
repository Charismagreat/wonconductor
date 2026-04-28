import React, { useMemo, useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Wallet, TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight,
  Building2, History, CreditCard, ChevronRight, Database
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CashReportProps {
  data: any; // Can be array or { accounts, transactions }
  mapping: {
    date: string;
    inflow: string;
    outflow: string;
    description: string;
    bankName?: string;
    accountNumber?: string;
    category?: string;
  };
  uiSettings: any;
  appName: string;
  id: string;
}

export function CashReport({ id, data, mapping, uiSettings, appName }: CashReportProps) {
  const [rawData, setRawData] = useState<any[]>([]);
  const [serverAccounts, setServerAccounts] = useState<any[]>([]);

  // 1. Data Normalization
  useEffect(() => {
    if (!data) return;

    if (Array.isArray(data)) {
      setRawData(data);
      setServerAccounts([]);
    } else if (data.transactions && Array.isArray(data.transactions)) {
      setRawData(data.transactions);
      setServerAccounts(data.accounts || []);
    } else if (data.accounts) {
      setRawData([]);
      setServerAccounts(data.accounts);
    }
  }, [data]);

  const { summary, accountBalances, transactions } = useMemo(() => {
    // Utility to find any numeric value in an object based on likely keys
    const findNumeric = (obj: any, key: string, fallbackKeywords: string[]) => {
      if (!obj) return 0;

      // 잔액 관련 키워드가 포함된 경우에만 balance/cur_bal 필드 우선 확인
      const isBalanceSearch = fallbackKeywords.some(kw => ['bal', '잔액'].some(b => kw.toLowerCase().includes(b)));

      if (isBalanceSearch) {
        if (obj.balance !== undefined && obj.balance !== null) {
          const val = obj.balance;
          if (typeof val === 'number') return val;
          const cleaned = String(val).replace(/[^0-9.-]/g, '');
          if (cleaned) return Number(cleaned);
        }
        if (obj.cur_bal !== undefined && obj.cur_bal !== null) {
          const val = obj.cur_bal;
          if (typeof val === 'number') return val;
          const cleaned = String(val).replace(/[^0-9.-]/g, '');
          if (cleaned) return Number(cleaned);
        }
      }
      
      // 1. 명시적으로 매핑된 키 확인
      if (key && obj[key] !== undefined) {
        const val = obj[key];
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return Number(val.replace(/[^0-9.-]/g, '')) || 0;
      }

      // 2. 키워드 기반 지능형 폴백
      for (const k of Object.keys(obj)) {
        if (fallbackKeywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) {
          const val = obj[k];
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const cleaned = val.replace(/[^0-9.-]/g, '');
            if (cleaned) return Number(cleaned);
          }
        }
      }
      return 0;
    };

    // Utility to find any string value in an object based on likely keys
    const findString = (obj: any, key: string | undefined, fallbackKeywords: string[]) => {
      if (!obj) return '';
      
      // 1. Check the explicitly mapped key first
      if (key && obj[key] && typeof obj[key] === 'string' && obj[key].length > 1) {
        return obj[key].trim();
      }

      // 2. Intelligent fallback with priority
      const priorities: Record<string, string[]> = {
        bank: ['bankName', 'bank_name', 'bank', 'bank_nm', 'orgName', 'org_name', 'bankId', 'bankDisplayName', 'ORG_NM', 'ORG_NAME'],
        acc: ['accountNumber', 'account_number', 'accNo', 'account_no', 'acc_no', 'resAccount', 'resAccountDisplay', 'ACCOUNT_NUMBER'],
        desc: ['description', 'content', 'remark', 'print_content', 'resAccountName', 'tran_nm', 'PRINT_CONTENT', 'TRAN_NM']
      };

      for (const type of Object.keys(priorities)) {
        if (fallbackKeywords.some(k => type.includes(k.toLowerCase()))) {
          for (const pKey of priorities[type]) {
            if (obj[pKey] && typeof obj[pKey] === 'string' && obj[pKey].length > 1) {
              let val = obj[pKey].trim();
              
              // 은행 명칭 정규화 (Beautifier)
              if (type === 'bank') {
                const bankMap: Record<string, string> = {
                  'hana': '하나은행',
                  'kb': '국민은행',
                  'shinhan': '신한은행',
                  'woori': '우리은행',
                  'sc': 'SC제일은행',
                  'ibk': 'IBK기업은행',
                  'kdb': 'KDB산업은행',
                  'nh': 'NH농협은행',
                  'kakaobank': '카카오뱅크',
                  'kbank': '케이뱅크',
                  'toss': '토스뱅크',
                  'post': '우체국',
                  'saemaul': '새마을금고',
                  'cu': '신협',
                  'suhyup': '수협'
                };
                const lowerVal = val.toLowerCase();
                if (bankMap[lowerVal]) return bankMap[lowerVal];
                // 'hana_bank' 같은 경우 처리
                for (const [id, name] of Object.entries(bankMap)) {
                  if (lowerVal.includes(id)) return name;
                }
              }
              if (val.toLowerCase() !== 'checking' && val.toLowerCase() !== 'null') return val;
            }
          }
        }
      }
      return '';
    };


    // If we have server-side account balances, use them for the summary
    if (serverAccounts.length > 0) {
      const balanceKeywords = ['bal', 'amt', 'amount'];
      const bankKeywords = ['bank', 'org'];
      const accKeywords = ['acc', 'no', 'number'];

      const processedAccounts = serverAccounts.map(acc => {
        let balance = findNumeric(acc, mapping.balance || 'balance', balanceKeywords);
        const bankName = findString(acc, mapping.bankName, bankKeywords) || '기타';
        const accNo = findString(acc, mapping.accountNumber, accKeywords) || '';

        // [Self-healing] 계좌 요약 잔액이 0인 경우, 상세 거래 내역(rawData)에서 최신 잔액을 찾아 보정합니다.
        if (balance === 0 && rawData.length > 0) {
          const cleanAccNo = accNo.replace(/[^0-9]/g, '');
          const accountTxs = rawData.filter(r => {
            const rAccNo = (findString(r, mapping.accountNumber, accKeywords) || '').replace(/[^0-9]/g, '');
            return rAccNo && cleanAccNo && rAccNo === cleanAccNo;
          });

          if (accountTxs.length > 0) {
            // 날짜/시간 기반 정렬하여 가장 최신 거래의 잔액 필드를 가져옴
            const sortedTxs = [...accountTxs].sort((a, b) => {
              const dateA = a[mapping.date] || a.date || '';
              const dateB = b[mapping.date] || b.date || '';
              return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
            
            const latestTx = sortedTxs[0];
            const txBalance = findNumeric(latestTx, mapping.balance || 'balance', ['bal', 'balance', 'cur_bal', '잔액']);
            if (txBalance !== 0) balance = txBalance;
          }
        }

        return { bankName, accNo, balance };
      });

      const totalBalance = processedAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      
      const processedTransactions = rawData.map(item => {
        let inflow = findNumeric(item, mapping.inflow, ['inflow', 'deposit', 'inAmt', 'in_amt', 'deposit_amt', 'IN_AMT', '입금', '입금액', '입금금액']);
        let outflow = findNumeric(item, mapping.outflow, ['outflow', 'withdrawal', 'outAmt', 'out_amt', 'withdraw_amt', 'OUT_AMT', '출금', '출금액', '출금금액']);
        
        if (inflow === 0 && outflow === 0) {
          const genericAmt = findNumeric(item, 'amount', ['amount', 'amt', '승인금액', '결제금액', '금액']);
          if (genericAmt > 0) {
             if (item.noteType === 'received' || String(item.type).includes('deposit') || String(item.category).includes('수입')) inflow = genericAmt;
             else outflow = genericAmt;
          }
        }

        let dateVal = item[mapping.date] || item.date || item.TRAN_DATE || item.transactionDate || item.tranDate || item.date_time || item.transaction_datetime || item.issueDate || item.approvalDate || item.paymentDate || '';
        if (typeof dateVal === 'string' && dateVal.length === 8 && !dateVal.includes('-')) {
            dateVal = `${dateVal.substring(0, 4)}-${dateVal.substring(4, 6)}-${dateVal.substring(6, 8)}`;
        }
        // 시간 정보 결합
        const timeVal = item.time || item.TRAN_TIME || '';
        if (timeVal && typeof dateVal === 'string' && !dateVal.includes(':')) {
            dateVal = `${dateVal.split(' ')[0]} ${timeVal}`;
        }

        return {
          date: dateVal,
          description: item[mapping.description] || item.description || item.PRINT_CONTENT || item.content || item.remark || item.print_content || '내역 없음',
          inflow,
          outflow,
          amount: inflow > 0 ? inflow : -outflow,
          bank: findString(item, mapping.bankName, ['bank', 'org', 'name', 'nm', 'ORG_NM', '은행']) || '기타',
          category: item[mapping.category || ''] || item.category || '일반'
        };
      });

      const totalIn = processedTransactions.reduce((sum, t) => sum + t.inflow, 0);
      const totalOut = processedTransactions.reduce((sum, t) => sum + t.outflow, 0);

      return {
        summary: { totalIn, totalOut, balance: totalBalance },
        accountBalances: processedAccounts.map(acc => ({
          name: `${acc.bankName} (${acc.accNo})`,
          balance: acc.balance,
          count: rawData.filter(r => {
             const rBank = findString(r, mapping.bankName, ['bank']) || '기타';
             return rBank === acc.bankName;
          }).length
        })),
        transactions: processedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      };
    }

    // Fallback: Calculate from raw table data (for Excel uploads or DB tables)
    if (!rawData || rawData.length === 0) return { 
      summary: { totalIn: 0, totalOut: 0, balance: 0 }, 
      accountBalances: [], 
      transactions: [] 
    };

    const balances: Record<string, { name: string, balance: number, count: number, lastDate: string }> = {};
    let totalIn = 0;
    let totalOut = 0;

    const processed = rawData.map(item => {
      let inflow = findNumeric(item, mapping.inflow, ['inflow', 'deposit', 'inAmt', 'deposit_amt', '입금', '입금액', '입금금액']);
      let outflow = findNumeric(item, mapping.outflow, ['outflow', 'withdrawal', 'outAmt', 'out_amt', 'withdraw_amt', '출금', '출금액', '출금금액']);
      
      if (inflow === 0 && outflow === 0) {
        const genericAmt = findNumeric(item, 'amount', ['amount', 'amt', '승인금액', '결제금액', '금액']);
        if (genericAmt > 0) {
           if (item.noteType === 'received' || String(item.type).includes('deposit') || String(item.category).includes('수입')) inflow = genericAmt;
           else outflow = genericAmt;
        }
      }

      const rowBalance = findNumeric(item, 'BALANCE', ['balance', 'cur_bal', '잔액', '현잔액', '거래후잔액']);
      
      const bank = findString(item, mapping.bankName, ['bank', 'org', 'name', '은행']) || '기타 계좌';
      const accNum = findString(item, mapping.accountNumber, ['acc', 'no', 'number', '계좌']) || '';
      
      let date = item[mapping.date] || item.date || item.transactionDate || item.tranDate || item.date_time || item.transaction_datetime || item.issueDate || item.approvalDate || item.paymentDate || '';
      if (typeof date === 'string' && date.length === 8 && !date.includes('-')) {
        date = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
      }
      const time = item.time || item.TRAN_TIME || '';
      if (time && typeof date === 'string' && !date.includes(':')) {
        date = `${date.split(' ')[0]} ${time}`;
      }

      const key = `${bank}-${accNum}`;

      totalIn += inflow;
      totalOut += outflow;

      // 가장 최신의 잔액을 유지 (날짜와 시간까지 포함된 정밀 비교)
      if (!balances[key] || new Date(date).getTime() >= new Date(balances[key].lastDate).getTime()) {
        if (!balances[key]) {
          balances[key] = { name: bank + (accNum ? ` (${accNum})` : ''), balance: 0, count: 0, lastDate: date };
        }
        if (rowBalance !== 0) {
          balances[key].balance = rowBalance;
        } else if (balances[key].balance === 0) {
          balances[key].balance += (inflow - outflow);
        }
        balances[key].lastDate = date;
      }
      
      balances[key].count += 1;

      return {
        date,
        description: item[mapping.description] || item.description || item.content || item.remark || '내역 없음',
        inflow,
        outflow,
        amount: inflow > 0 ? inflow : -outflow,
        bank: bank,
        category: item[mapping.category || ''] || item.category || '일반'
      };
    });

    const finalTotalBalance = Object.values(balances).reduce((sum, b) => sum + b.balance, 0);

    return {
      summary: { totalIn, totalOut, balance: finalTotalBalance },
      accountBalances: Object.values(balances),
      transactions: processed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  }, [rawData, serverAccounts, mapping]);

  const formatKRW = (val: number) => 
    new Intl.NumberFormat('ko-KR', { 
      style: 'currency', 
      currency: 'KRW',
      maximumFractionDigits: 0 
    }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{appName}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              최종 업데이트: {new Date().toLocaleString()}
            </p>
            <div className="h-4 w-[1px] bg-slate-200" />
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              데이터 소스: <span className="text-emerald-600 font-bold">{uiSettings?.tableDisplayName || data?._sourceName || '실시간 연동'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex -space-x-2">
            {[1,2,3].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                <Building2 className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
          <span className="text-xs font-bold text-slate-600 pr-2">{accountBalances.length}개 계좌 연결됨</span>
        </div>
      </div>

      {/* Main Dashboard Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Total Balance Card */}
          <div className="bg-blue-600 rounded-[40px] p-10 text-white shadow-2xl shadow-blue-600/30 relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                  <Wallet className="w-8 h-8" />
                </div>
                <div className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest">
                  Total Liquid Assets
                </div>
              </div>
              <div>
                <p className="text-blue-100 font-bold text-sm uppercase tracking-wider mb-2">현재 통합 가용 자금</p>
                <h2 className="text-5xl font-black tracking-tighter">{formatKRW(summary.balance)}</h2>
              </div>
              <div className="flex gap-8 pt-4 border-t border-white/10">
                <div>
                  <p className="text-blue-200 text-[10px] font-black uppercase mb-1">총 입금 합계</p>
                  <p className="text-lg font-bold">+{formatKRW(summary.totalIn)}</p>
                </div>
                <div>
                  <p className="text-blue-200 text-[10px] font-black uppercase mb-1">총 출금 합계</p>
                  <p className="text-lg font-bold">-{formatKRW(summary.totalOut)}</p>
                </div>
              </div>
            </div>
            {/* Abstract Background Shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-white/20 transition-all duration-1000" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
          </div>

          {/* Account List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accountBalances.map((acc, idx) => (
              <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 hover:border-blue-500/30 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                    <Building2 className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs font-bold text-slate-400 mb-1">{acc.name}</p>
                <p className="text-xl font-black text-slate-900">{formatKRW(acc.balance)}</p>
              </div>
            ))}
            {accountBalances.length === 0 && (
              <div className="md:col-span-2 py-10 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-sm font-bold text-slate-400">연결된 계좌 정보가 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Timeline */}
        <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl flex flex-col h-full min-h-[500px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              거래 타임라인
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Feed</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {transactions.slice(0, 15).map((tx, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    tx.inflow > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                  )}>
                    {tx.inflow > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate pr-2">{tx.description}</p>
                    <p className="text-[10px] font-medium text-slate-500">{tx.date} • {tx.bank}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn(
                    "text-sm font-black",
                    tx.amount > 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {tx.amount > 0 ? '+' : '-'}{formatKRW(Math.abs(tx.amount))}
                  </p>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="py-20 text-center opacity-30">
                <p className="text-sm font-medium">기록된 거래가 없습니다.</p>
              </div>
            )}
          </div>
          
          <button className="mt-6 w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all">
            전체 거래 내역 조회
          </button>
        </div>
      </div>

      {/* Analytics Insight Area (Conditional Pie Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* 기존 선형 차트 (태그 조건부 제외 - 공백 무시 및 유연한 매칭) */}
        {!(uiSettings.tags?.some((t: string) => 
          (t.replace(/\s+/g, '').includes('현금흐름') && (t.includes('제외') || t.includes('!'))) ||
          (t.replace(/\s+/g, '').includes('현금흐름심층분석') && (t.includes('제외') || t.includes('!')))
        )) && (
          <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900">현금 흐름 심층 분석</h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={transactions.slice(0, 30).reverse()}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => formatKRW(val)}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 파이 차트 (태그 조건부) */}
        <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900">자산 구성 분석</h3>
            </div>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-tighter">Asset Mix</span>
          </div>
          
          <div className="flex-1 min-h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accountBalances.map(acc => ({ name: acc.name, value: acc.balance }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {accountBalances.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={[
                      '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'
                    ][index % 7]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => formatKRW(val)}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 전자어음 관리 섹션 (태그 조건부) */}
      {(uiSettings.tags?.some((t: string) => t.replace(/\s+/g, '').includes('전자어음')) || appName.includes('어음')) && (
        <div className="bg-slate-50 rounded-[40px] p-10 border border-slate-200 border-dashed">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900">전자어음 보유 현황</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Note Balance</p>
              <p className="text-2xl font-black text-rose-600">₩452,000,000</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { company: '(주)미래상사', amount: 150000000, date: '2026-05-15', status: 'D-21' },
              { company: '대명건설(주)', amount: 220000000, date: '2026-06-02', status: 'D-39' },
              { company: '현대인더스트리', amount: 82000000, date: '2026-04-30', status: 'D-6' },
            ].map((note, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black">{note.status}</span>
                  <p className="text-sm font-black text-slate-900">{formatKRW(note.amount)}</p>
                </div>
                <p className="text-xs font-bold text-slate-600 mb-1">{note.company}</p>
                <p className="text-[10px] font-medium text-slate-400">만기일: {note.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
