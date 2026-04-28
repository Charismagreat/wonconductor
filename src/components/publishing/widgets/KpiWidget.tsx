import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Target, Activity } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface KpiWidgetConfig {
  type: 'kpi';
  title: string;
  dataRef: string; // 'inflow', 'outflow', 'balance', 'count', etc.
  grid?: string; // e.g. 'col-span-12 md:col-span-4'
  color?: string; // 'emerald', 'rose', 'blue', 'indigo', 'slate', 'amber'
}

interface KpiWidgetProps {
  config: KpiWidgetConfig;
  value: number;
}

export function KpiWidget({ config, value }: KpiWidgetProps) {
  const colorMap: Record<string, { bg: string, text: string, icon: any, border: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: TrendingUp, border: 'border-emerald-100' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', icon: TrendingDown, border: 'border-rose-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: DollarSign, border: 'border-blue-100' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: Target, border: 'border-indigo-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: Activity, border: 'border-amber-100' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', icon: Activity, border: 'border-slate-100' },
  };

  // Determine standard color based on dataRef if not provided
  let defaultColor = 'slate';
  if (config.dataRef.toLowerCase().includes('in') || config.dataRef.toLowerCase().includes('deposit')) defaultColor = 'emerald';
  if (config.dataRef.toLowerCase().includes('out') || config.dataRef.toLowerCase().includes('withdraw')) defaultColor = 'rose';
  if (config.dataRef.toLowerCase().includes('bal')) defaultColor = 'blue';

  const style = colorMap[config.color || defaultColor] || colorMap.slate;
  const Icon = style.icon;

  const formatKRW = (val: number) => 
    new Intl.NumberFormat('ko-KR', { 
      style: config.dataRef.includes('count') ? 'decimal' : 'currency', 
      currency: 'KRW',
      maximumFractionDigits: 0 
    }).format(val);

  return (
    <div className={cn("p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between", config.grid || "col-span-12 md:col-span-4")}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-500 font-bold text-sm">{config.title}</h3>
        <div className={cn("p-2 rounded-xl border", style.bg, style.text, style.border)}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
      </div>
      <div>
        <p className={cn("text-3xl font-black tracking-tight text-slate-900")}>
          {formatKRW(value)}
          {config.dataRef.includes('count') && <span className="text-sm font-medium text-slate-500 ml-1">건</span>}
        </p>
      </div>
    </div>
  );
}
