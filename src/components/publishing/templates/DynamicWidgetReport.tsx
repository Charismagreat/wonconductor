import React, { useMemo } from 'react';
import { Database, Clock } from 'lucide-react';
import { KpiWidget, type KpiWidgetConfig } from '../widgets/KpiWidget';
import { ChartWidget, type ChartWidgetConfig } from '../widgets/ChartWidget';
import { PieWidget, type PieWidgetConfig } from '../widgets/PieWidget';
import { ListWidget, type ListWidgetConfig } from '../widgets/ListWidget';
import { extractDate, extractAmount, findString, findNumeric } from '../utils/data-utils';

export type WidgetConfig = KpiWidgetConfig | ChartWidgetConfig | PieWidgetConfig | ListWidgetConfig;

interface DynamicWidgetReportProps {
  id: string;
  data: any; // Can be array of transactions or object { transactions, datasets, ... }
  mapping: any[]; // Array of column mappings
  uiSettings: {
    theme?: string;
    title?: string;
    description?: string;
    layout?: WidgetConfig[];
  };
  appName: string;
}

export function DynamicWidgetReport({ id, data, mapping, uiSettings, appName }: DynamicWidgetReportProps) {
  // 1. Data Normalization
  const { normalizedTransactions, summary } = useMemo(() => {
    if (!data) return { normalizedTransactions: [], summary: {} };

    let rawTransactions: any[] = [];
    if (Array.isArray(data)) rawTransactions = data;
    else if (data.transactions && Array.isArray(data.transactions)) rawTransactions = data.transactions;

    // We build a single unified dataset that all widgets can easily query
    const txs = rawTransactions.map(item => {
      const date = extractDate(item);
      const { inflow, outflow, amount } = extractAmount(item);
      
      const bankName = findString(item, undefined, ['bank', 'org', 'name', '은행']) || '기타';
      const category = item.category || '일반';
      const description = item.description || item.content || item.remark || item.PRINT_CONTENT || '내역 없음';
      const balance = findNumeric(item, 'BALANCE', ['balance', 'cur_bal', '잔액', '현잔액']);

      // Include all original properties in case a widget references a specific raw column
      return {
        ...item,
        date,
        inflow,
        outflow,
        amount,
        bankName,
        category,
        description,
        balance
      };
    });

    // Compute basic aggregates for KPIs
    let totalInflow = 0;
    let totalOutflow = 0;
    let totalBalance = 0;

    txs.forEach(t => {
      totalInflow += t.inflow || 0;
      totalOutflow += t.outflow || 0;
      if (t.balance) totalBalance = t.balance; // rough latest balance
    });

    return {
      normalizedTransactions: txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      summary: { inflow: totalInflow, outflow: totalOutflow, balance: totalBalance, count: txs.length }
    };
  }, [data]);

  // Aggregate Data for Charts and Pies
  const { dailyData, categoryData } = useMemo(() => {
    // 1. Daily Aggregation for Line/Area/Bar charts
    const dailyMap: Record<string, { date: string, inflow: number, outflow: number, amount: number, balance: number }> = {};
    
    // Process in chronological order for balance carry-over
    [...normalizedTransactions].reverse().forEach(t => {
      const d = t.date.split(' ')[0]; // YYYY-MM-DD
      if (!d) return;
      if (!dailyMap[d]) {
        dailyMap[d] = { date: d, inflow: 0, outflow: 0, amount: 0, balance: 0 };
      }
      dailyMap[d].inflow += t.inflow || 0;
      dailyMap[d].outflow += t.outflow || 0;
      dailyMap[d].amount += t.amount || 0;
      if (t.balance) dailyMap[d].balance = t.balance;
    });

    // 2. Category Aggregation for Pie charts
    const catMap: Record<string, { category: string, inflow: number, outflow: number, amount: number }> = {};
    normalizedTransactions.forEach(t => {
      const c = t.category || '기타';
      if (!catMap[c]) catMap[c] = { category: c, inflow: 0, outflow: 0, amount: 0 };
      catMap[c].inflow += t.inflow || 0;
      catMap[c].outflow += t.outflow || 0;
      catMap[c].amount += Math.abs(t.amount || 0); // Pie charts need absolute values
    });

    return {
      dailyData: Object.values(dailyMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      categoryData: Object.values(catMap).sort((a, b) => b.amount - a.amount) // Sort descending by amount
    };
  }, [normalizedTransactions]);

  const layout = uiSettings?.layout || [];

  const renderWidget = (widget: WidgetConfig, index: number) => {
    switch (widget.type) {
      case 'kpi':
        // Value mapping for KPI
        const val = summary[widget.dataRef as keyof typeof summary] || 0;
        return <KpiWidget key={`w-${index}`} config={widget} value={val} />;
      
      case 'chart':
        return <ChartWidget key={`w-${index}`} config={widget} data={dailyData} />;
      
      case 'pie':
        // Pie widget needs a dataRef to know which value to chart (e.g. amount, outflow)
        return <PieWidget key={`w-${index}`} config={widget} data={categoryData} />;
      
      case 'list':
        return <ListWidget key={`w-${index}`} config={widget} data={normalizedTransactions} />;
        
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{uiSettings?.title || appName}</h1>
          {uiSettings?.description && (
            <p className="text-slate-500 mt-2 text-lg font-medium">{uiSettings.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <p className="text-slate-400 font-medium flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-blue-500" />
              최종 업데이트: {new Date().toLocaleString()}
            </p>
            <div className="h-4 w-[1px] bg-slate-200" />
            <p className="text-slate-400 font-medium flex items-center gap-2 text-sm">
              <Database className="w-4 h-4 text-emerald-500" />
              데이터 소스: <span className="text-slate-600 font-bold">{data?._sourceName || '실시간 연동'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Grid Layout */}
      {layout.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-8 lg:grid-cols-12 gap-6">
          {layout.map((widget, i) => renderWidget(widget, i))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
          <p className="text-slate-400 font-medium text-lg">AI가 생성한 레이아웃이 없습니다. (uiSettings.layout 비어있음)</p>
        </div>
      )}
    </div>
  );
}
