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
    (t.displayName && t.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-2xl max-h-[80vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
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
              placeholder="Search tables by name or ID..."
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Table List */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {filteredTables.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-slate-300 font-bold italic">No tables found matching your search.</p>
              </div>
            ) : (
              filteredTables.map(table => (
                <button
                  key={table.id}
                  onClick={() => toggleTable(table.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-[24px] transition-all group ${
                    selectedIds.includes(table.id) 
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30 translate-x-2' 
                    : 'hover:bg-slate-50 text-slate-600 hover:translate-x-1'
                  }`}
                >
                  <div className={`p-3 rounded-xl transition-colors ${
                    selectedIds.includes(table.id) ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'
                  }`}>
                    {selectedIds.includes(table.id) ? <Check size={18} /> : <BarChart3 size={18} />}
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-sm font-black truncate">{table.displayName || table.name}</p>
                    <p className={`text-[10px] tracking-tight opacity-60 font-bold ${
                      selectedIds.includes(table.id) ? 'text-blue-100' : 'text-slate-400'
                    }`}>
                      <span className="uppercase">ID:</span> {table.id} {table.sheetName ? `• ${table.sheetName}` : ''}
                    </p>
                  </div>
                  <ChevronRight size={18} className={`transition-transform ${selectedIds.includes(table.id) ? 'rotate-90' : 'opacity-0 group-hover:opacity-100'}`} />
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
