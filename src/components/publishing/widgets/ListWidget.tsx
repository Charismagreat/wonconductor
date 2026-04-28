import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ListWidgetConfig {
  type: 'list';
  title: string;
  columns: string[]; // e.g. ['date', 'description', 'amount', 'bankName']
  grid?: string;
}

interface ListWidgetProps {
  config: ListWidgetConfig;
  data: any[];
}

export function ListWidget({ config, data }: ListWidgetProps) {
  const formatValue = (key: string, val: any) => {
    if (typeof val === 'number') {
      if (key.toLowerCase().includes('count')) return val.toLocaleString();
      return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val);
    }
    return val;
  };

  const getLabel = (col: string) => {
    const labels: Record<string, string> = {
      date: '일시',
      description: '내용',
      amount: '금액',
      inflow: '입금액',
      outflow: '출금액',
      bankName: '금융기관',
      accountNumber: '계좌/카드',
      category: '카테고리',
      status: '상태'
    };
    return labels[col] || col;
  };

  return (
    <div className={cn("p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col max-h-[400px] overflow-hidden", config.grid || "col-span-12")}>
      <div className="mb-4">
        <h3 className="text-slate-800 font-black text-lg">{config.title}</h3>
      </div>
      <div className="flex-grow overflow-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 bg-slate-50/80 sticky top-0 backdrop-blur-sm">
            <tr>
              {config.columns.map(col => (
                <th key={col} className="px-4 py-3 font-bold whitespace-nowrap">
                  {getLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.slice(0, 50).map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                {config.columns.map((col, j) => {
                  const isNumber = typeof row[col] === 'number';
                  const isAmount = col === 'amount' || col === 'inflow' || col === 'outflow';
                  return (
                    <td 
                      key={`${i}-${j}`} 
                      className={cn(
                        "px-4 py-3 text-slate-700",
                        isNumber ? "font-mono text-right font-medium" : "",
                        isAmount && row[col] > 0 ? "text-emerald-600" : "",
                        isAmount && row[col] < 0 ? "text-rose-600" : ""
                      )}
                    >
                      {formatValue(col, row[col])}
                    </td>
                  );
                })}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={config.columns.length} className="px-4 py-8 text-center text-slate-400 font-medium">
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
