import React, { useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ChartWidgetConfig {
  type: 'chart';
  subType: 'area' | 'bar' | 'line';
  title: string;
  xAxis: string; // usually 'date'
  series: string[]; // e.g. ['inflow', 'outflow', 'amount', 'balance']
  grid?: string;
}

interface ChartWidgetProps {
  config: ChartWidgetConfig;
  data: any[];
}

export function ChartWidget({ config, data }: ChartWidgetProps) {
  // 간단한 색상 매핑
  const seriesColors: Record<string, { stroke: string, fill: string }> = {
    inflow: { stroke: '#10b981', fill: '#d1fae5' }, // emerald
    outflow: { stroke: '#f43f5e', fill: '#ffe4e6' }, // rose
    balance: { stroke: '#3b82f6', fill: '#dbeafe' }, // blue
    amount: { stroke: '#8b5cf6', fill: '#ede9fe' }, // violet
  };

  const getColors = (key: string, index: number) => {
    const k = key.toLowerCase();
    if (k.includes('in') || k.includes('deposit')) return seriesColors.inflow;
    if (k.includes('out') || k.includes('withdraw')) return seriesColors.outflow;
    if (k.includes('bal')) return seriesColors.balance;
    if (k.includes('amount') || k.includes('amt')) return seriesColors.amount;
    
    // Fallback colors for unknown series
    const fallbacks = [
      { stroke: '#0ea5e9', fill: '#e0f2fe' },
      { stroke: '#f59e0b', fill: '#fef3c7' },
      { stroke: '#14b8a6', fill: '#ccfbf1' },
      { stroke: '#ec4899', fill: '#fce7f3' }
    ];
    return fallbacks[index % fallbacks.length];
  };

  const formatKRW = (val: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val);

  const ChartComponent = config.subType === 'bar' ? BarChart : config.subType === 'line' ? LineChart : AreaChart;

  return (
    <div className={cn("p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col h-[400px]", config.grid || "col-span-12")}>
      <div className="mb-6">
        <h3 className="text-slate-800 font-black text-lg">{config.title}</h3>
      </div>
      <div className="flex-grow w-full">
        <ResponsiveContainer width="100%" height="100%">
          {/* @ts-ignore */}
          <ChartComponent data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
            <defs>
              {config.series.map((s, i) => {
                const colors = getColors(s, i);
                return (
                  <linearGradient key={`color-${s}`} id={`color-${s}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.stroke} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={colors.stroke} stopOpacity={0}/>
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey={config.xAxis} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={(value) => {
                if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
                if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
                return value.toLocaleString();
              }}
              dx={-10}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '12px 16px', fontWeight: 'bold' }}
              formatter={(value: number) => [`${formatKRW(value)}원`, '']}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            
            {config.series.map((s, i) => {
              const colors = getColors(s, i);
              if (config.subType === 'bar') {
                return <Bar key={s} dataKey={s} fill={colors.stroke} radius={[4, 4, 0, 0]} barSize={20} />;
              }
              if (config.subType === 'line') {
                return <Line key={s} type="monotone" dataKey={s} stroke={colors.stroke} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />;
              }
              // Area is default
              return (
                <Area 
                  key={s}
                  type="monotone" 
                  dataKey={s} 
                  stroke={colors.stroke} 
                  fillOpacity={1} 
                  fill={`url(#color-${s})`} 
                  strokeWidth={3}
                />
              );
            })}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
