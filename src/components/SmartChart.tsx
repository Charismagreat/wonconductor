'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';
import { 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  Star, 
  Info, 
  RotateCcw,
  Clock,
  Maximize2,
  Minimize2,
  Download,
  Share2
} from 'lucide-react';
import { toPng } from 'html-to-image';

interface SeriesConfig {
  key: string;
  name: string;
  color: string;
}

interface ChartConfig {
  type: 'bar' | 'line' | 'area' | 'pie' | 'table';
  data: any[];
  xAxis?: string;
  yAxis?: string;
  series: SeriesConfig[];
  title: string;
  showLabels?: boolean;
  sourceDescription?: string;
  refreshMetadata?: {
    tool: string;
    args: any;
    mapping: any;
  };
  layout?: {
    span?: 'half' | 'full';
  };
}

interface SmartChartProps {
  config: ChartConfig;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  currentVersion?: number;
  totalVersions?: number;
  onVersionChange?: (version: number) => void;
  onPin?: () => void;
  isPinned?: boolean;
  onRefresh?: () => void;
  refreshedAt?: string;
  isRefreshing?: boolean;
  chartId?: string;
  layout?: {
    span?: 'half' | 'full';
  };
  onLayoutChange?: (layout: { span: 'half' | 'full' }) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isBuildMode?: boolean;
  isBuildSelected?: boolean;
  onBuildSelect?: (selected: boolean) => void;
}

const COLORS = ['#2563eb', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'];

const formatValue = (val: any) => {
  if (typeof val === 'number') {
    return val.toLocaleString();
  }
  return val;
};

export function SmartChart({ 
  config, 
  isSelected, 
  onSelect, 
  onDelete,
  currentVersion = 1,
  totalVersions = 1,
  onVersionChange,
  onPin,
  isPinned = false,
  onRefresh,
  refreshedAt,
  isRefreshing = false,
  chartId,
  layout = { span: 'half' },
  onLayoutChange,
  onMoveUp,
  onMoveDown,
  isBuildMode = false,
  isBuildSelected = false,
  onBuildSelect
}: SmartChartProps) {
  // [고도화] 타입 추론 Fallback: AI가 타입을 누락한 경우 데이터 구조를 보고 판단
  let effectiveType = config.type;
  if (!effectiveType) {
    if (config.layout?.span === 'full' || (!config.xAxis && !config.series)) {
      effectiveType = 'table';
    } else {
      effectiveType = 'bar';
    }
  }

  const { data, xAxis, series = [], title, showLabels = true, sourceDescription } = config;
  const type = effectiveType;
  const [showInfo, setShowInfo] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleDownloadImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!chartRef.current) return;
    
    try {
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (node) => {
          if (node.hasAttribute && node.hasAttribute('data-html2canvas-ignore')) {
            return false;
          }
          return true;
        }
      });
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${title.replace(/\s+/g, '_')}_${new Date().getTime()}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to capture image:', err);
      alert('이미지 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!chartId) {
      alert('이 차트는 아직 공유할 수 없습니다. (대시보드에 고정 후 시도해 주세요)');
      return;
    }
    const currentPath = window.location.pathname;
    const basePath = currentPath.replace(/\/(dashboard|report|share).*$/, '');
    const shareUrl = `${window.location.origin}${basePath}/share/${chartId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert(`공유 링크가 클립보드에 복사되었습니다!\n(로그인 없이 열람 가능: ${shareUrl})`);
    }).catch(() => {
      alert('링크 복사에 실패했습니다.');
    });
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 border border-dashed rounded-3xl text-slate-400 text-xs font-bold uppercase tracking-widest">
        No Data to Visualize
      </div>
    );
  }

  const renderChart = () => {
    // 차트일 때, x축 값이 series에 포함되어 버리면 숫자가 아닌 문자열 바를 렌더링하려다 라이브러리가 크래시됨
    // 따라서 type이 table이 아닌 경우에는 xAxis 키를 series에서 걸러냄
    const chartSeries = type === 'table' ? series : series.filter(s => s.key !== xAxis);
    
    // 데이터 중 null/undefined 보완
    const safeData = data.map(d => ({
      ...d,
      [xAxis || '']: d[xAxis || ''] ?? '알 수 없음'
    }));

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={safeData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey={xAxis} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
              />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', padding: '12px' }}
                formatter={(value: any) => [formatValue(value), '']}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              {chartSeries.map((s, i) => (
                <Bar 
                  key={`${s.key}-${i}`} 
                  dataKey={s.key} 
                  name={s.name} 
                  fill={s.color || COLORS[i % COLORS.length]} 
                  radius={[4, 4, 0, 0]} 
                  barSize={32}
                >
                  {safeData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || s.color || COLORS[i % COLORS.length]} 
                    />
                  ))}
                  {showLabels && (
                    <LabelList 
                      dataKey={s.key} 
                      position="top" 
                      formatter={formatValue}
                      style={{ fontSize: 10, fontWeight: 700, fill: '#334155' }}
                      offset={10}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={safeData} margin={{ top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey={xAxis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                formatter={(value: any) => [formatValue(value), '']}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
              {chartSeries.map((s, i) => (
                <Line 
                  key={`${s.key}-${i}`} 
                  type="monotone" 
                  dataKey={s.key} 
                  name={s.name} 
                  stroke={s.color || COLORS[i % COLORS.length]} 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 0, fill: s.color || COLORS[i % COLORS.length] }} 
                  activeDot={{ r: 6, strokeWidth: 0 }}
                >
                  {showLabels && (
                    <LabelList 
                      dataKey={s.key} 
                      position="top" 
                      formatter={formatValue}
                      style={{ fontSize: 10, fontWeight: 700, fill: '#334155' }}
                      offset={12}
                    />
                  )}
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={safeData} margin={{ top: 20 }}>
              <defs>
                {chartSeries.map((s, i) => (
                  <linearGradient key={`grad-${s.key}-${i}`} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color || COLORS[i % COLORS.length]} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={s.color || COLORS[i % COLORS.length]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey={xAxis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                formatter={(value: any) => [formatValue(value), '']}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
              {chartSeries.map((s, i) => (
                <Area 
                  key={`${s.key}-${i}`} 
                  type="monotone" 
                  dataKey={s.key} 
                  name={s.name} 
                  stroke={s.color || COLORS[i % COLORS.length]} 
                  fillOpacity={1} 
                  fill={`url(#grad-${s.key})`} 
                  strokeWidth={3}
                >
                  {showLabels && (
                    <LabelList 
                      dataKey={s.key} 
                      position="top" 
                      formatter={formatValue}
                      style={{ fontSize: 10, fontWeight: 700, fill: '#334155' }}
                      offset={12}
                    />
                  )}
                </Area>
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={safeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey={chartSeries[0]?.key || 'value'}
                nameKey={xAxis || 'name'}
                label={({ name, percent, value }) => `${name}\n(${formatValue(value)})`}
              >
                {safeData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color || COLORS[index % COLORS.length]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                formatter={(val: any) => [formatValue(val), '']}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        );

      case 'table':
        // 1. 컬럼 헤더 및 순서 결정 (series가 있으면 이를 따르고, 없으면 데이터 키를 사용)
        const columnConfigs = series.length > 0 ? series : [];
        const headers = columnConfigs.length > 0 
          ? columnConfigs.map(s => s.key)
          : (data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'color') : []);

        const getHeaderName = (key: string) => {
          const s = columnConfigs.find(ser => ser.key === key);
          return s ? s.name : (key.charAt(0).toUpperCase() + key.slice(1));
        };

        return (
          <div className="w-full h-full overflow-auto rounded-2xl border border-slate-100 bg-slate-50/10">
            <table className="w-full text-xs text-left border-collapse min-w-max">
              <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 shadow-sm border-b border-slate-100">
                <tr>
                  {headers.map(header => (
                    <th key={header} className="px-6 py-4 font-black text-blue-600 uppercase tracking-widest whitespace-nowrap">
                      {getHeaderName(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50/50 transition-colors bg-white/40 group/row">
                    {headers.map(header => {
                      // 지능형 폴백(Fallback): 현재 열(header)에 데이터가 없으면 매핑에서 원본 키를 찾아 시도함
                      let cellValue = row[header];
                      if (cellValue === undefined && config.refreshMetadata?.mapping) {
                        const sourceKey = config.refreshMetadata.mapping[header];
                        if (sourceKey && row[sourceKey] !== undefined) {
                          cellValue = row[sourceKey];
                        }
                      }
                      
                      return (
                        <td key={`${i}-${header}`} className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap group-hover/row:text-blue-900 transition-colors">
                          {formatValue(cellValue)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div ref={chartRef} className={`bg-white p-8 rounded-[40px] border transition-all duration-300 flex flex-col h-[500px] animate-in fade-in zoom-in duration-500 relative group/card ${
      isSelected 
      ? 'ring-4 ring-blue-500/20 border-blue-500 shadow-2xl shadow-blue-500/30' 
      : 'border-slate-100 shadow-xl shadow-slate-200/30 hover:shadow-2xl hover:shadow-slate-200/50'
    }`}>
      {/* Loading Overlay */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 rounded-[40px] flex items-center justify-center animate-in fade-in">
          <div className="flex flex-col items-center gap-3">
            <RotateCcw size={24} className="text-blue-600 animate-spin" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">데이터 갱신 중...</span>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest truncate">
              {title}
            </h3>
            {sourceDescription && (
              <div className="relative">
                <button 
                  onMouseEnter={() => setShowInfo(true)}
                  onMouseLeave={() => setShowInfo(false)}
                  className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <Info size={14} />
                </button>
                {showInfo && (
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-4 bg-slate-900 text-white text-[11px] font-medium rounded-2xl shadow-xl z-20 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-2 text-blue-400">
                      <Clock size={12} />
                      <span className="font-black uppercase tracking-widest text-[9px]">데이터 추출 로직</span>
                    </div>
                    {sourceDescription}
                    <div className="absolute left-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900" />
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {mounted && refreshedAt ? (
              <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                <Clock size={10} />
                최근 갱신: {new Date(refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            ) : null}
            {isSelected && (
              <span className="px-2 py-0.5 bg-blue-600 text-[9px] text-white rounded-full font-black animate-pulse">수정 대기 중</span>
            )}
          </div>
          
          {/* Version Navigation */}
          {totalVersions > 1 && (
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 mt-2 self-start" data-html2canvas-ignore>
               <button 
                 disabled={currentVersion <= 1}
                 onClick={() => onVersionChange?.(currentVersion - 1)}
                 className="p-0.5 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
               >
                 <ChevronLeft size={10} className="text-slate-600" />
               </button>
               <span className="text-[9px] font-black text-blue-600 w-8 text-center uppercase">V{currentVersion}</span>
               <button 
                 disabled={currentVersion >= totalVersions}
                 onClick={() => onVersionChange?.(currentVersion + 1)}
                 className="p-0.5 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
               >
                 <ChevronRight size={10} className="text-slate-600" />
               </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0" data-html2canvas-ignore>
           {isBuildMode ? (
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 onBuildSelect?.(!isBuildSelected);
               }}
               className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                 isBuildSelected 
                 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-110' 
                 : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
               }`}
             >
               <Check size={24} strokeWidth={4} />
             </button>
           ) : (
             <>
               <button 
                 onClick={handleShare}
                 className="p-1.5 bg-slate-50 text-slate-400 hover:bg-violet-50 hover:text-violet-600 rounded-xl transition-all"
                 title="Share Chart Link"
               >
                 <Share2 size={14} />
               </button>
               <button 
                 onClick={handleDownloadImage}
                 className="p-1.5 bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
                 title="Download as Image (PNG)"
               >
                 <Download size={14} />
               </button>
               {onRefresh && (
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     onRefresh();
                   }}
                   disabled={isRefreshing}
                   className="p-1.5 bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all disabled:opacity-50"
                   title="Update Data"
                 >
                   <RotateCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                 </button>
               )}
               {onPin && (
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     onPin();
                   }}
                   className={`p-1.5 rounded-xl transition-all ${
                     isPinned 
                     ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100 shadow-sm' 
                     : 'bg-slate-50 text-slate-400 hover:bg-yellow-50 hover:text-yellow-500'
                   }`}
                   title={isPinned ? "Unpin from Gallery" : "Pin to Gallery"}
                 >
                   <Star size={14} fill={isPinned ? 'currentColor' : 'none'} />
                 </button>
               )}
                {onMoveUp && (
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       onMoveUp();
                     }}
                     className="p-1.5 bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all"
                     title="위로 이동"
                   >
                     <ChevronUp size={14} />
                   </button>
                )}
                {onMoveDown && (
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       onMoveDown();
                     }}
                     className="p-1.5 bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all"
                     title="아래로 이동"
                   >
                     <ChevronDown size={14} />
                   </button>
                )}
                {onLayoutChange && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onLayoutChange({ span: layout.span === 'full' ? 'half' : 'full' });
                    }}
                    className="p-1.5 bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
                    title={layout.span === 'full' ? "Reduce Width" : "Full Width"}
                  >
                    {layout.span === 'full' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                )}
               {onSelect && (
                 <button 
                   onClick={onSelect}
                   className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${
                     isSelected 
                     ? 'bg-red-50 text-red-500 hover:bg-red-100' 
                     : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                   }`}
                 >
                   {isSelected ? '선택 취소' : '수정 선택'}
                 </button>
               )}
               {onDelete && (
                 <button 
                   onClick={onDelete}
                   className="p-1.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                   title="Delete Chart"
                 >
                   <Trash2 size={14} />
                 </button>
               )}
             </>
           )}
        </div>
      </div>
      <div className="flex-1 w-full min-h-[300px]">
          {renderChart()}
      </div>
    </div>
  );
}


