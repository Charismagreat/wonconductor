'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Save, GripVertical, Edit3, LayoutDashboard } from 'lucide-react';
import { createManualReportAction } from '@/app/actions/report';
import { ColumnDefinition } from '@/lib/excel-parser';

interface ManualTableModalProps {
  onClose: () => void;
}

export function ManualTableModal({ onClose }: ManualTableModalProps) {
  const [name, setName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [sheetName, setSheetName] = useState('Table');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: '제목', type: 'string', isRequired: true }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      { name: `필드 ${columns.length + 1}`, type: 'string', isRequired: false }
    ]);
  };

  const handleUpdateColumn = (index: number, updates: Partial<ColumnDefinition>) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], ...updates };
    setColumns(updated);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length === 1) {
        alert('최소 하나의 필드는 필요합니다.');
        return;
    }
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('테이블 이름을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => !!t);
    try {
      await createManualReportAction(name, sheetName, columns, tags);
    } catch (error) {
      alert('테이블 생성 중 오류가 발생했습니다.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gray-50 px-8 py-6 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">새 테이블 직접 만들기</h3>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Create a new database from scratch</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">기본 정보</label>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 ml-1">테이블 명칭</label>
                <input 
                  type="text" 
                  placeholder="예: 고객 연락처, 주간 업무 일지 등"
                  className="w-full bg-gray-50 border border-transparent focus:border-blue-400 focus:bg-white rounded-2xl px-5 py-3 text-sm font-bold outline-none transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 ml-1">태그 (Tags, 쉼표 구분)</label>
                <input 
                  type="text" 
                  placeholder="예: 영업, 중요, 2026"
                  className="w-full bg-gray-50 border border-transparent focus:border-blue-400 focus:bg-white rounded-2xl px-5 py-3 text-sm font-bold outline-none transition-all text-blue-600"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Column Definition */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-1">
               <div className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                 <label className="text-xs font-black text-gray-400 uppercase tracking-widest">필드(컬럼) 정의</label>
               </div>
               <span className="text-[10px] font-bold text-gray-300">* 데이터 ID 필드는 자동으로 생성됩니다.</span>
            </div>

            <div className="space-y-3">
              {columns.map((col, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-2xl group hover:border-blue-200 transition-all">
                  <div className="flex-1 flex items-center gap-3">
                    <input 
                      type="text" 
                      value={col.name}
                      onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
                      placeholder="필드 이름"
                      className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-gray-800 placeholder:text-gray-300"
                    />
                    <select 
                      value={col.type} 
                      onChange={(e) => handleUpdateColumn(idx, { type: e.target.value as any })}
                      className="text-[10px] font-black bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none text-gray-500"
                    >
                      <option value="string">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="currency">Currency</option>
                      <option value="select">Select</option>
                    </select>
                    <button 
                      onClick={() => handleUpdateColumn(idx, { isRequired: !col.isRequired })}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${col.isRequired ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {col.isRequired ? '필수' : '선택'}
                    </button>
                  </div>
                  <button 
                    onClick={() => handleRemoveColumn(idx)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-white rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <button 
                onClick={handleAddColumn}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all font-bold text-sm"
              >
                <Plus size={18} />
                새 필드 추가
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-6 border-t flex items-center justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-all text-sm"
          >
            취소
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-100 disabled:opacity-50 transition-all text-sm flex items-center gap-2"
          >
            {isSaving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
            테이블 생성
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </div>
  );
}


