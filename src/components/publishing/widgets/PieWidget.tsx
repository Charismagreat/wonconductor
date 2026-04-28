import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface PieWidgetConfig {
  type: 'pie';
  title: string;
  groupBy: string; // e.g. 'category', 'bankName'
  dataRef: string; // e.g. 'amount', 'outflow'
  grid?: string;
}

interface PieWidgetProps {
  config: PieWidgetConfig;
  data: any[];
}

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#0ea5e9', '#8b5cf6', '#14b8a6', '#ec4899'];

export function PieWidget({ config, data }: PieWidgetProps) {
  const formatKRW = (val: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(val);

  return (
    <div className={cn("p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col h-[400px]", config.grid || "col-span-12 md:col-span-4")}>
      <div className="mb-2">
        <h3 className="text-slate-800 font-black text-lg">{config.title}</h3>
      </div>
      <div className="flex-grow w-full relative">
        {data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium">데이터가 없습니다.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey={config.dataRef}
                nameKey={config.groupBy}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '12px 16px', fontWeight: 'bold' }}
                formatter={(value: number) => [`${formatKRW(value)}`, '']}
              />
              <Legend 
                layout="horizontal" 
                verticalAlign="bottom" 
                align="center" 
                iconType="circle"
                wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
