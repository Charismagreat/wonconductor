'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  Database, 
  Check, 
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { getUnifiedDataSourcesAction } from '@/app/actions/publishing';

interface DataSource {
  tableId: string;
  tableName: string;
  physicalTableName: string;
  type: 'system' | 'report' | 'table' | 'bank-product';
  templateId?: string;
  reason?: string;
  priority?: 'high' | 'medium' | 'low';
  schema?: any[];
}

interface DataSourceSelectorModalProps {
  onClose: () => void;
  onSelect: (selected: Array<{ id: string, name: string }>) => void;
  mode?: 'single' | 'multiple';
  initialSelectedIds?: string[];
  title?: string;
  description?: string;
}

export function DataSourceSelectorModal({ 
  onClose, 
  onSelect, 
  mode = 'multiple', 
  initialSelectedIds = [],
  title = "데이터 소스 탐색",
  description = "분석하거나 앱으로 발행할 데이터 소스를 선택하세요."
}: DataSourceSelectorModalProps) {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'financial' | 'reports'>('all');
  const [selectedSources, setSelectedSources] = useState<Array<{ id: string, name: string }>>([]);

  useEffect(() => {
    const loadSources = async () => {
      try {
        const data = await getUnifiedDataSourcesAction();
        setSources(data);
        
        // 초기 선택값 설정
        if (initialSelectedIds.length > 0 && data.length > 0) {
          const initial = data
            .filter(s => initialSelectedIds.includes(s.tableId))
            .map(s => ({ id: s.tableId, name: s.tableName }));
          setSelectedSources(initial);
        }
      } catch (error) {
        console.error("Failed to load data sources:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSources();
  }, [JSON.stringify(initialSelectedIds)]);

  const filteredSources = sources.filter(s => {
    const matchesSearch = s.tableName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         s.tableId?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'financial') {
        return matchesSearch && (s.type === 'system' || s.type === 'bank-product');
    }
    if (filter === 'reports') {
        return matchesSearch && s.type === 'report';
    }
    return matchesSearch;
  });

  const toggleSource = (id: string, name: string) => {
    if (mode === 'single') {
      setSelectedSources([{ id, name }]);
      return;
    }

    setSelectedSources(prev => {
      const isSelected = prev.some(s => s.id === id);
      if (isSelected) {
        return prev.filter(s => s.id !== id);
      } else {
        return [...prev, { id, name }];
      }
    });
  };

  const handleConfirm = () => {
    if (selectedSources.length === 0) return;
    onSelect(selectedSources);
  };

  const getTypeBadge = (type: string) => {
    switch(type) {
        case 'system': return { label: 'System', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
        case 'bank-product': return { label: 'Bank Product', color: 'bg-amber-50 text-amber-600 border-amber-100' };
        case 'report': return { label: 'Report', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
        default: return { label: 'Table', color: 'bg-slate-100 text-slate-500 border-slate-200' };
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl bg-white rounded-[40px] shadow-2xl shadow-slate-900/20 overflow-hidden flex flex-col max-h-[90vh] border border-white/20 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-50 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
              <Database size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-70">{description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all active:scale-90">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 space-y-4">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input 
              autoFocus
              type="text" 
              placeholder="테이블 이름, ID 또는 키워드로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-16 pr-8 py-5 bg-white border-2 border-transparent rounded-[24px] text-base font-bold focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all outline-none shadow-sm"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl shadow-sm">
              {[
                { id: 'all', label: '전체 소스', icon: <Database size={14} /> },
                { id: 'financial', label: '금융/자금', icon: <TrendingUp size={14} /> },
                { id: 'reports', label: '마이 리포트', icon: <FileText size={14} /> }
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setFilter(t.id as any)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    filter === t.id 
                    ? 'bg-slate-900 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
            
            {selectedSources.length > 0 && mode === 'multiple' && (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{selectedSources.length} items selected</span>
                <button 
                  onClick={() => setSelectedSources([])}
                  className="text-[10px] font-black text-slate-300 hover:text-rose-600 transition-colors uppercase tracking-widest underline underline-offset-4"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center gap-6 animate-pulse">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                <Sparkles size={32} />
              </div>
              <p className="font-black text-slate-400 uppercase tracking-widest text-xs">데이터 엔진 동기화 중...</p>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center text-center opacity-50">
              <Database size={48} className="text-slate-200 mb-6" />
              <p className="font-black text-slate-400 uppercase tracking-widest text-xs">일치하는 데이터 소스를 찾을 수 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 pb-12">
              {filteredSources.map((source, index) => {
                const isSelected = selectedSources.some(s => s.id === source.tableId);
                const badge = getTypeBadge(source.type);
                
                return (
                  <button 
                    key={`${source.tableId}-${index}`}
                    onClick={() => toggleSource(source.tableId, source.tableName)}
                    className={`group w-full p-4 border rounded-[24px] text-left flex items-center justify-between transition-all animate-in fade-in slide-in-from-bottom-2 duration-500 ${
                      isSelected 
                      ? 'bg-blue-50 border-blue-200 shadow-xl shadow-blue-500/10' 
                      : 'bg-white border-slate-100 hover:border-blue-500/40 hover:shadow-xl hover:shadow-slate-900/5'
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 ${
                        isSelected 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                        : 'bg-blue-50 text-blue-600 shadow-inner'
                      }`}>
                        {isSelected ? <Check size={24} strokeWidth={3} /> : (source.type === 'report' ? <Layers size={24} /> : <Database size={24} />)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black border border-slate-200 text-slate-500 uppercase tracking-tight">
                            ID: {source.tableId}
                          </span>
                          {source.schema && source.schema.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500 text-white uppercase tracking-tight shadow-sm shadow-blue-500/20">
                              {source.schema.length} Fields
                            </span>
                          )}
                        </div>
                        <h4 className={`text-base font-black tracking-tight transition-colors ${isSelected ? 'text-blue-900' : 'text-slate-900 group-hover:text-blue-600'}`}>{source.tableName}</h4>
                        {source.reason && (
                          <p className={`text-[10px] font-medium mt-0.5 italic opacity-80 line-clamp-1 max-w-xl ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                            {source.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                      isSelected 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30' 
                      : 'bg-white text-slate-100 border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100'
                    }`}>
                      <Check size={20} strokeWidth={3} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        {selectedSources.length > 0 && (
          <div className="p-8 bg-white border-t border-slate-100 flex items-center justify-between animate-in slide-in-from-bottom-full duration-500 sticky bottom-0">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3 overflow-hidden">
                {selectedSources.slice(0, 5).map((s, i) => (
                  <div key={`${s.id}-${i}`} className="inline-block h-10 w-10 rounded-full ring-4 ring-white bg-blue-100 border border-blue-200 flex items-center justify-center text-[10px] font-black text-blue-600">
                    {s.name.substring(0, 1)}
                  </div>
                ))}
                {selectedSources.length > 5 && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 ring-4 ring-white text-[10px] font-black text-white">
                    +{selectedSources.length - 5}
                  </div>
                )}
              </div>
              <p className="text-sm font-black text-slate-900">
                <span className="text-blue-600">{selectedSources.length}개</span>의 소스가 선택되었습니다.
              </p>
            </div>
            <div className="flex gap-4">
                <button 
                onClick={onClose}
                className="px-8 py-4 bg-white text-slate-400 border border-slate-100 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                Cancel
                </button>
                <button 
                onClick={handleConfirm}
                className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 group"
                >
                선택 완료
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
