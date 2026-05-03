'use client';

import React from 'react';
import { X, Search, Table as TableIcon, BarChart3, ChevronRight, Check } from 'lucide-react';

interface SourceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTables: any[];
  selectedIds: string[];
  toggleTable: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const LocalBadge = ({ children, color = 'blue', scale = 1.0 }: { children: React.ReactNode, color?: string, scale?: number }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    slate: 'bg-slate-100 text-slate-500 border-slate-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <span 
      className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-tight inline-flex items-center gap-1 ${colors[color] || colors.blue}`}
      style={{ transform: `scale(${scale})`, transformOrigin: 'left center' }}
    >
      {children}
    </span>
  );
};

export function SourceSelectionModal({
  isOpen,
  onClose,
  allTables,
  selectedIds,
  toggleTable,
  searchQuery,
  setSearchQuery,
}: SourceSelectionModalProps) {
  if (!isOpen) return null;

  const filteredTables = allTables.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.sheetName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.displayName && t.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.physicalTableName && t.physicalTableName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <TableIcon size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">Select Data Sources</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">분석할 테이블을 선택해 주세요</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all text-slate-400 hover:text-slate-900"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-6 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search tables by name, ID or source..."
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Table List */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {filteredTables.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-300 font-bold italic">No tables found matching your search.</p>
              </div>
            ) : (
              filteredTables.map(table => (
                <button
                  key={table.id}
                  onClick={() => toggleTable(table.id)}
                  className={`w-full flex items-center gap-4 p-5 rounded-[28px] transition-all group border ${
                    selectedIds.includes(table.id) 
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-500/30 translate-x-2' 
                    : 'bg-white border-slate-50 hover:bg-slate-50 text-slate-600 hover:translate-x-1'
                  }`}
                >
                  <div className={`p-4 rounded-2xl transition-colors shrink-0 ${
                    selectedIds.includes(table.id) ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'
                  }`}>
                    {selectedIds.includes(table.id) ? <Check size={20} /> : <BarChart3 size={20} />}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className={`text-sm font-black truncate mb-1.5 ${selectedIds.includes(table.id) ? 'text-white' : 'text-slate-900'}`}>
                      {table.displayName || table.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                       {(table.physicalTableName || table.name || table.id) && (
                         <LocalBadge color="slate" scale={0.9}>
                           SOURCE: {table.physicalTableName || table.name || table.id}
                         </LocalBadge>
                       )}
                       
                       {table.isSystemTable && (
                         <LocalBadge color={selectedIds.includes(table.id) ? 'rose' : 'blue'} scale={0.9}>
                           SYSTEM
                         </LocalBadge>
                       )}
                    </div>
                  </div>
                  <ChevronRight size={18} className={`transition-transform shrink-0 ${selectedIds.includes(table.id) ? 'rotate-90' : 'opacity-0 group-hover:opacity-100'}`} />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Selected</span>
             <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-black shadow-lg shadow-blue-500/20">
               {selectedIds.length}
             </span>
          </div>
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            Done
          </button>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
