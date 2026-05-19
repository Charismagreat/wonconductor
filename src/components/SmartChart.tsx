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
  Share2,
  X,
  Check,
  Palette
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
  onConfigChange?: (config: ChartConfig) => void;
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
  onBuildSelect,
  onConfigChange
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
  const [showOthersDetails, setShowOthersDetails] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);

  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [customColor, setCustomColor] = React.useState('');
  const [localColor, setLocalColor] = React.useState(series[0]?.color || '#3b82f6');
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [tempTitle, setTempTitle] = React.useState(title || '시각화 차트');
  const [editingLegendKey, setEditingLegendKey] = React.useState<string | null>(null);
  const [tempLegendName, setTempLegendName] = React.useState('');
  const [editingHeaderKey, setEditingHeaderKey] = React.useState<string | null>(null);
  const [tempHeaderName, setTempHeaderName] = React.useState('');

  const [localTitle, setLocalTitle] = React.useState(title || '시각화 차트');
  const [localSeriesList, setLocalSeriesList] = React.useState(series || []);

  React.useEffect(() => {
    if (title) {
      setLocalTitle(title);
      setTempTitle(title);
    }
  }, [title]);

  React.useEffect(() => {
    if (series && series.length > 0) {
      setLocalSeriesList(series);
      if (series[0]?.color) {
        setLocalColor(series[0]?.color);
      }
    }
  }, [JSON.stringify(series)]);

  const handleTitleSave = () => {
    if (!isEditingTitle) return;
    setIsEditingTitle(false);
    if (!tempTitle.trim()) return;
    setLocalTitle(tempTitle.trim());
    if (!onConfigChange || tempTitle.trim() === title) return;
    onConfigChange({
      ...config,
      title: tempTitle.trim()
    });
  };

  const handleLegendSave = (key: string) => {
    if (editingLegendKey !== key) return;
    setEditingLegendKey(null);
    if (!tempLegendName.trim()) return;
    const updatedSeries = localSeriesList.map(s => 
      s.key === key ? { ...s, name: tempLegendName.trim() } : s
    );
    setLocalSeriesList(updatedSeries);
    if (!onConfigChange) return;
    onConfigChange({
      ...config,
      series: updatedSeries
    });
  };

  const handleTableHeaderSave = (key: string, newName: string) => {
    if (!newName.trim()) return;
    
    const exists = localSeriesList.some(s => s.key === key);
    let updatedSeries = [];
    
    if (exists) {
      updatedSeries = localSeriesList.map(s => 
        s.key === key ? { ...s, name: newName.trim() } : s
      );
    } else {
      const columnConfigs = localSeriesList.length > 0 ? localSeriesList : [];
      const headers = columnConfigs.length > 0 
        ? columnConfigs.map(s => s.key)
        : (data && data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'color') : []);

      updatedSeries = headers.map(hKey => {
        const matching = localSeriesList.find(s => s.key === hKey);
        if (hKey === key) {
          return { key: hKey, name: newName.trim(), color: matching?.color || '#3b82f6' };
        }
        return matching || { key: hKey, name: hKey.charAt(0).toUpperCase() + hKey.slice(1), color: '#3b82f6' };
      });
    }
    
    setLocalSeriesList(updatedSeries);
    if (!onConfigChange) return;
    onConfigChange({
      ...config,
      series: updatedSeries
    });
  };

  const handleColorChange = (newColor: string) => {
    setLocalColor(newColor);
    const updatedSeries = localSeriesList.map(s => ({
      ...s,
      color: newColor
    }));
    setLocalSeriesList(updatedSeries);
    if (!onConfigChange) return;
    onConfigChange({
      ...config,
      series: updatedSeries
    });
  };

  // 데이터의 총합(자산/사용액 등)을 자동으로 계산
  const totalAmount = React.useMemo(() => {
    if (!data || data.length === 0) return 0;
    
    // 금액 관련 키 식별 (공급가액, 합계, 세액 추가)
    const keys = Object.keys(data[0]);
    const amountKey = keys.find(k => /amount|value|금액|잔액|승인금액|출금|입금|공급가액|합계|세액/i.test(k)) || 'value';
    
    return data.reduce((sum, item) => {
      // 행의 값들 중 '합계', '소계', '총계', '누계', 'total', 'subtotal' 등이 들어있는지 정교하게 검사
      const isTotalRow = Object.values(item).some(val => {
        if (typeof val !== 'string') return false;
        const normalized = val.trim().toLowerCase();
        return normalized.includes('합계') || 
               normalized.includes('소계') || 
               normalized.includes('총계') || 
               normalized.includes('누계') || 
               normalized === 'total' || 
               normalized === 'subtotal' || 
               normalized === 'sum';
      });

      if (isTotalRow) return sum; // 합계 요약 행은 뱃지 총합에서 원천 배제!

      const rawVal = Number(item[amountKey]) || 0;
      
      // 마이너스 통장 계좌인 경우, 잔액 대신 가용 한도(약정금액 - 사용액)를 합산하여 표시
      const isMinusAcc = rawVal < 0 || String(item.계좌명 || item.name || '').includes('마이너스') || (item.약정금액 !== undefined && item.약정금액 !== null);
      if (isMinusAcc && item.약정금액) {
        const availableLimit = Number(item.약정금액) + rawVal;
        return sum + availableLimit;
      }
      return sum + Math.abs(rawVal);
    }, 0);
  }, [data]);

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
    const rawSeries = type === 'table' ? localSeriesList : localSeriesList.filter(s => s.key !== xAxis);
    const chartSeries = rawSeries.map((s, idx) => ({
      ...s,
      color: idx === 0 ? localColor : s.color
    }));
    
    // [자가 치유] 차트용 데이터 빌드 시 합계/소계 행 필터링 (표 뷰 'table'이 아닐 때만 제외하여 그래프 비율 왜곡 방지)
    const filteredData = type === 'table' ? data : data.filter(d => {
      return !Object.values(d).some(val => {
        if (typeof val !== 'string') return false;
        const normalized = val.trim().toLowerCase();
        return normalized.includes('합계') || 
               normalized.includes('소계') || 
               normalized.includes('총계') || 
               normalized.includes('누계') || 
               normalized === 'total' || 
               normalized === 'subtotal' || 
               normalized === 'sum';
      });
    });

    // 데이터 중 null/undefined 보완 및 [자가 치유] 차트 시리즈 Key 누락 보정
    const safeData = filteredData.map(d => {
      const newRow = { 
        ...d,
        [xAxis || '']: d[xAxis || ''] ?? '알 수 없음'
      };
      
      // 만약 series가 필요로 하는 key가 row에 없고, 
      // 그 대신 value나 공급가액 등의 대표값이 존재한다면, 
      // 해당 key로 값을 복사해 주어 Recharts가 바를 완벽하게 그리도록 보장합니다.
      chartSeries.forEach(s => {
        if (newRow[s.key] === undefined) {
          const fallbackVal = d.value !== undefined ? d.value : (d.공급가액 !== undefined ? d.공급가액 : d.totalAmount);
          if (fallbackVal !== undefined) {
            newRow[s.key] = fallbackVal;
          }
        }
      });
      
      return newRow;
    });

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={safeData} margin={{ top: 30, right: 10, left: 10, bottom: 10 }}>
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
            <LineChart data={safeData} margin={{ top: 30, right: 10, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey={xAxis} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                formatter={(value: any) => [formatValue(value), '']}
              />
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
            <AreaChart data={safeData} margin={{ top: 30, right: 10, left: 10, bottom: 10 }}>
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

      case 'pie': {
        const valKey = chartSeries[0]?.key || 'value';
        const nameKey = xAxis || 'name';
        
        // Recharts 및 퍼센티지 연산을 위해 양수 절댓값 데이터 준비 (마이너스 통장인 경우 잔액 대신 '사용가능한도(한도 - 사용액)'를 적용)
        const processedData = safeData.map(item => {
          const rawVal = Number(item[valKey]) || 0;
          const isMinusAcc = rawVal < 0 || String(item[nameKey]).includes('마이너스') || (item.약정금액 !== undefined && item.약정금액 !== null);
          const chartValue = (isMinusAcc && item.약정금액) ? (Number(item.약정금액) + rawVal) : Math.abs(rawVal);
          
          return {
            ...item,
            [valKey]: chartValue,
            _originalValue: rawVal,
            _isMinusAccount: isMinusAcc
          };
        });

        const totalSum = processedData.reduce((sum, item) => sum + (item[valKey] || 0), 0);
        
        // 3% 미만의 자잘한 비중은 "기타" 그룹으로 통합하여 겹침 방지
        const threshold = totalSum * 0.03;
        const majorSlices: any[] = [];
        const othersList: any[] = [];
        let othersSum = 0;
        
        processedData.forEach(item => {
          const val = item[valKey];
          if (val >= threshold) {
            majorSlices.push(item);
          } else {
            othersSum += val;
            othersList.push(item);
          }
        });
        
        if (othersSum > 0) {
          majorSlices.push({
            [nameKey]: '기타',
            [valKey]: othersSum,
            _originalValue: othersSum,
            color: '#94a3b8' // 프리미엄 슬레이트 그레이 컬러 적용
          });
        }
        
        // 금액이 큰 순으로 정렬하여 배치
        const pieData = majorSlices.sort((a, b) => (Number(b[valKey]) || 0) - (Number(a[valKey]) || 0));
        
        return (
          <div className="w-full h-full flex flex-col md:flex-row gap-6 items-center relative">
            {/* 좌측 상단 고정 KPI 요약 카드 (사용자 지정 레드 서클 위치) */}
            {totalAmount !== 0 && (
              <div className="absolute left-2 top-2 z-10 p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/50 rounded-2xl flex flex-col gap-1 transition-all duration-300" data-html2canvas-ignore>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  <span>
                    {title.includes('카드') || title.includes('사용') 
                      ? '총 사용액 요약' 
                      : (title.includes('매출') || title.includes('세금계산서') && !title.includes('매입') ? '총 매출액' : 
                         (title.includes('매입') || title.includes('exempt_invoices') ? '총 매입액' : '총 통합 자금'))}
                  </span>
                </span>
                <span className="text-lg font-black text-slate-800 font-mono tracking-tight leading-none">
                  {totalAmount.toLocaleString()}원
                </span>
                <span className="text-[8px] font-bold text-slate-400">
                  {title.includes('카드') || title.includes('사용') 
                    ? '카드 승인 내역 합산' 
                    : (title.includes('매출') || title.includes('세금계산서') && !title.includes('매입') ? '매출 증빙 합산' : 
                       (title.includes('매입') || title.includes('exempt_invoices') ? '매입 증빙 합산' : `통합 계좌 가용자산`))}
                </span>
              </div>
            )}
            
            {/* 좌측: 도넛 파이 차트 */}
            <div className="flex-1 w-full h-full min-h-[250px] transition-all duration-300">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey={valKey}
                    nameKey={nameKey}
                    label={({ name, payload }) => {
                      if (payload?._isMinusAccount && payload?.사용가능한도 !== undefined && payload?.사용가능한도 !== null) {
                        return `${name}\n(${formatValue(payload.사용가능한도)})`;
                      }
                      const val = payload?._originalValue !== undefined ? payload._originalValue : payload?.[valKey];
                      return `${name}\n(${formatValue(val)})`;
                    }}
                    isAnimationActive={false} // 리사이징 시 라벨 깜빡임 및 소실 현상 완벽 방지
                  >
                    {pieData.map((entry, index) => {
                      // 마이너스 계좌는 강렬하고 전문적인 경고성 다크 레드 컬러 적용
                      const isNegativeAcc = entry._originalValue < 0;
                      const fillColor = isNegativeAcc ? '#dc2626' : (entry.color || COLORS[index % COLORS.length]);
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={fillColor} 
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    formatter={(val: any, name: any, entry: any) => {
                      const payload = entry?.payload || {};
                      const originalVal = payload?._originalValue !== undefined ? payload._originalValue : val;
                      
                      const lines = [`현재잔액: ${formatValue(originalVal)}원`];
                      if (payload.약정금액) {
                        lines.push(`약정금액: ${payload.약정금액.toLocaleString()}원`);
                      }
                      if (payload.사용가능한도 !== undefined && payload.사용가능한도 !== null) {
                        lines.push(`가용한도: ${payload.사용가능한도.toLocaleString()}원`);
                      }
                      if (payload.관리점) {
                        lines.push(`지점: ${payload.관리점}`);
                      }
                      return [lines.join(' | '), ''];
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* 우측: 정적 고정 '기타 상세 구성' 패널 */}
            {othersList.length > 0 && showOthersDetails ? (
              <div className="w-full md:w-72 h-[280px] bg-slate-50/80 border border-slate-100 rounded-3xl p-5 flex flex-col shrink-0 relative animate-in fade-in slide-in-from-right-4" data-html2canvas-ignore>
                {/* 닫기(접기) 버튼 */}
                <button
                  onClick={() => setShowOthersDetails(false)}
                  className="absolute right-4 top-4 p-1 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                  title="상세 내역 접기"
                >
                  <X size={12} className="stroke-[2.5]" />
                </button>

                <div className="flex justify-between items-center pb-2 pr-6 mb-3 border-b border-slate-200/50 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-3 bg-slate-400 rounded-full" />
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">기타 자금 구성 ({othersList.length})</span>
                  </div>
                  <span className="text-[10px] font-black text-blue-600">총 {othersSum.toLocaleString()}원</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin">
                  {othersList.sort((a,b) => (Number(b[valKey]) || 0) - (Number(a[valKey]) || 0)).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1.5 border-b border-slate-100 last:border-0">
                      <div className="flex flex-col gap-0.5 max-w-[150px]">
                        <span className="truncate text-slate-800 font-bold">{item[nameKey]}</span>
                        {item.관리점 && (
                          <span className="text-[8px] font-medium text-slate-400">지점: {item.관리점}</span>
                        )}
                        {item.약정금액 && (
                          <span className="text-[8px] font-medium text-red-500/80">약정: {item.약정금액.toLocaleString()}원</span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className={`font-mono font-bold shrink-0 ${item._originalValue < 0 ? 'text-red-500 font-bold' : 'text-slate-500 font-bold'}`}>
                          {formatValue(item._originalValue !== undefined ? item._originalValue : item[valKey])}원
                        </span>
                        {item.사용가능한도 !== undefined && item.사용가능한도 !== null && (
                          <span className="text-[8px] font-bold text-blue-500 font-mono">가용: {item.사용가능한도.toLocaleString()}원</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : othersList.length > 0 ? (
              // 접혔을 때 펼치기 위한 플로팅 캡슐 버튼
              <div className="absolute right-4 bottom-12 z-20 animate-in fade-in slide-in-from-bottom-2" data-html2canvas-ignore>
                <button
                  onClick={() => setShowOthersDetails(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-full text-[10px] font-black text-slate-500 hover:text-slate-800 transition-all shadow-sm"
                  title="상세 내역 펼치기"
                >
                  <ChevronLeft size={10} className="text-blue-500 stroke-[3]" />
                  <span>기타 상세 구성</span>
                </button>
              </div>
            ) : null}
          </div>
        );
      }

      case 'table':
        // 1. 컬럼 헤더 및 순서 결정 (localSeriesList가 있으면 이를 따르고, 없으면 데이터 키를 사용)
        const columnConfigs = localSeriesList.length > 0 ? localSeriesList : [];
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
                  {headers.map(header => {
                    const headerName = getHeaderName(header);
                    return (
                      <th 
                        key={header} 
                        className="px-6 py-4 font-black text-blue-600 uppercase tracking-widest whitespace-nowrap group/th relative"
                      >
                        {editingHeaderKey === header && onConfigChange ? (
                          <input
                            type="text"
                            value={tempHeaderName}
                            onChange={(e) => setTempHeaderName(e.target.value)}
                            onBlur={() => {
                              if (editingHeaderKey === header) {
                                handleTableHeaderSave(header, tempHeaderName);
                                setEditingHeaderKey(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleTableHeaderSave(header, tempHeaderName);
                                setEditingHeaderKey(null);
                              }
                              if (e.key === 'Escape') setEditingHeaderKey(null);
                            }}
                            autoFocus
                            className="px-2 py-0.5 bg-slate-50 border border-blue-500 rounded-lg text-xs font-bold outline-none text-slate-700 w-28"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span 
                              className={`cursor-pointer hover:text-blue-800 transition-colors`}
                              onClick={() => {
                                if (!onConfigChange) return;
                                setEditingHeaderKey(header);
                                setTempHeaderName(headerName);
                              }}
                              title={onConfigChange ? "클릭하여 컬럼명 수정" : undefined}
                            >
                              {headerName}
                            </span>
                            {onConfigChange && (
                              <span
                                onClick={() => {
                                  setEditingHeaderKey(header);
                                  setTempHeaderName(headerName);
                                }}
                                className="opacity-0 group-hover/th:opacity-100 p-0.5 text-slate-400 hover:text-blue-800 rounded transition-all cursor-pointer"
                                title="컬럼명 수정"
                              >
                                <Palette size={10} className="w-2.5 h-2.5 rotate-45" />
                              </span>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
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
                      
                      const isAmountHeader = /amount|deposit|withdrawal|value|금액|잔액|승인금액|출금|입금/i.test(header);
                      const isNegative = isAmountHeader && typeof cellValue === 'number' && cellValue < 0;
                      
                      return (
                        <td 
                          key={`${i}-${header}`} 
                          className={`px-6 py-4 font-medium whitespace-nowrap transition-colors ${
                            isNegative 
                              ? 'text-red-500 font-bold group-hover/row:text-red-600' 
                              : 'text-slate-600 group-hover/row:text-blue-900'
                          }`}
                        >
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
            {isEditingTitle && onConfigChange ? (
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') {
                    setTempTitle(localTitle || '시각화 차트');
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="text-sm font-black text-slate-900 border-b border-blue-500 outline-none px-1 py-0.5 max-w-[200px] sm:max-w-[300px]"
              />
            ) : (
              <div className="flex items-center gap-1.5 group/title">
                <h3 
                  className={`text-sm font-black text-slate-900 uppercase tracking-widest truncate ${onConfigChange ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
                  onClick={() => onConfigChange && setIsEditingTitle(true)}
                  title={onConfigChange ? "클릭하여 제목 수정" : undefined}
                >
                  {localTitle}
                </h3>
                {onConfigChange && (
                  <span 
                    onClick={() => setIsEditingTitle(true)} 
                    className="opacity-0 group-hover/title:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-all cursor-pointer"
                    title="제목 수정"
                    data-html2canvas-ignore
                  >
                    <Palette size={10} className="w-2.5 h-2.5 rotate-45" />
                  </span>
                )}
              </div>
            )}
            {totalAmount !== 0 && (
              <span className="shrink-0 px-2.5 py-1 bg-blue-50/80 text-blue-600 font-black text-[10px] rounded-full border border-blue-100/50 tracking-wider flex items-center gap-1.5 shadow-sm animate-in fade-in zoom-in duration-300">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                <span>
                  {title.includes('카드') || title.includes('사용') 
                    ? '총 사용액' 
                    : (title.includes('매출') || title.includes('세금계산서') && !title.includes('매입') ? '총 매출액' : 
                       (title.includes('매입') || title.includes('exempt_invoices') ? '총 매입액' : '총 자금'))}
                </span>
                <span className="font-mono">{totalAmount.toLocaleString()}원</span>
              </span>
            )}
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
               {onConfigChange && (
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setShowColorPicker(prev => !prev);
                   }}
                   className={`p-1.5 rounded-xl transition-all ${
                     showColorPicker 
                     ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100/50' 
                     : 'bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600'
                   }`}
                   title="차트 색상 변경"
                 >
                   <Palette size={14} />
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

      {/* Color Picker Panel */}
      {showColorPicker && onConfigChange && (
        <div 
          className="flex flex-wrap items-center gap-3 p-3 mb-6 bg-slate-50 border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-2 z-10" 
          onClick={e => e.stopPropagation()}
          data-html2canvas-ignore
        >
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">테마 컬러</span>
          <div className="flex items-center gap-2">
            {[
              { color: '#3b82f6', label: 'Classic Blue' },
              { color: '#0f766e', label: 'Teal Green' },
              { color: '#ea580c', label: 'Orange' },
              { color: '#e11d48', label: 'Rose Red' },
              { color: '#8b5cf6', label: 'Violet' },
              { color: '#475569', label: 'Charcoal' }
            ].map(preset => (
              <button
                key={preset.color}
                onClick={() => handleColorChange(preset.color)}
                className="w-5 h-5 rounded-full border border-white shadow-sm hover:scale-110 active:scale-95 transition-all relative"
                style={{ backgroundColor: preset.color }}
                title={preset.label}
              >
                {series[0]?.color === preset.color && (
                  <Check size={10} className="text-white absolute inset-0 m-auto font-bold" />
                )}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-slate-200 mx-1" />
          {/* Color Wheel input */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">맞춤 설정</span>
            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-slate-200 shadow-sm cursor-pointer hover:scale-110 active:scale-95 transition-all">
              <input
                type="color"
                value={localColor}
                onInput={(e) => {
                  setLocalColor((e.target as HTMLInputElement).value);
                }}
                onChange={(e) => {
                  handleColorChange((e.target as HTMLInputElement).value);
                }}
                className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] cursor-pointer outline-none border-none p-0 bg-transparent"
              />
            </div>
            <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider bg-white px-2 py-1 rounded-md border border-slate-100/50">
              {localColor}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 w-full min-h-[300px]">
          {renderChart()}
      </div>

      {/* Pure React Custom Legend Panel */}
      {type !== 'table' && (
        <div className="flex flex-wrap items-center justify-center gap-6 pt-6 mt-4 border-t border-slate-50/50 w-full" data-html2canvas-ignore>
          {localSeriesList.map((s, idx) => {
            const color = s.color || COLORS[idx % COLORS.length];
            const name = s.name || s.key;
            
            return (
              <div key={s.key} className="flex items-center gap-2 group/legend">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-all group-hover/legend:scale-110" style={{ backgroundColor: color }} />
                
                {editingLegendKey === s.key && onConfigChange ? (
                  <input
                    type="text"
                    value={tempLegendName}
                    onChange={(e) => setTempLegendName(e.target.value)}
                    onBlur={() => handleLegendSave(s.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLegendSave(s.key);
                      if (e.key === 'Escape') setEditingLegendKey(null);
                    }}
                    autoFocus
                    className="px-2 py-0.5 bg-slate-50 border border-blue-500 rounded-lg text-[10px] font-bold outline-none text-slate-700 w-24 shadow-sm animate-in zoom-in-95 duration-100"
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span 
                      className={`text-[10px] font-black text-slate-500 uppercase tracking-wider ${onConfigChange ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
                      onClick={() => {
                        if (!onConfigChange) return;
                        setEditingLegendKey(s.key);
                        setTempLegendName(name);
                      }}
                      title={onConfigChange ? "클릭하여 범례명 수정" : undefined}
                    >
                      {name}
                    </span>
                    {onConfigChange && (
                      <span
                        onClick={() => {
                          setEditingLegendKey(s.key);
                          setTempLegendName(name);
                        }}
                        className="opacity-0 group-hover/legend:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-all cursor-pointer"
                        title="범례명 수정"
                      >
                        <Palette size={8} className="w-2.5 h-2.5 rotate-45" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


