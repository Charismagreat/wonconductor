'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveFormTemplateAction } from '@/app/actions/form-studio';
import { Upload, Save, Play, Trash2, GripVertical, Settings2, ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { SourceSelectionModal } from '@/components/dashboard/SourceSelectionModal';

interface MappingItem {
  id: string;
  x: number;
  y: number;
  columnKey: string;
  fontSize: number;
}

interface Props {
  initialTemplate: any;
  tables: string[];
  tableSchemas: Record<string, string[]>;
}

export default function FormBuilderClient({ initialTemplate, tables, tableSchemas }: Props) {
  const router = useRouter();
  
  const [name, setName] = useState(initialTemplate?.name || '새 양식');
  const [sourceTable, setSourceTable] = useState(initialTemplate?.sourceTable || '');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(initialTemplate?.backgroundImageData || null);
  const [mappings, setMappings] = useState<MappingItem[]>(
    initialTemplate?.mappingConfig ? JSON.parse(initialTemplate.mappingConfig) : []
  );
  
  const [isSaving, setIsSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 현재 선택된 테이블의 컬럼 목록
  const columns = sourceTable ? tableSchemas[sourceTable] || [] : [];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragStart = (e: React.DragEvent, columnKey: string) => {
    e.dataTransfer.setData('text/plain', columnKey);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const columnKey = e.dataTransfer.getData('text/plain');
    if (!columnKey || !canvasRef.current) return;

    // 캔버스 내의 상대적 위치 계산 (퍼센트로 저장하여 반응형 대응 가능하게 하거나, 절대 픽셀 사용. 여기서는 퍼센트 사용)
    const rect = canvasRef.current.getBoundingClientRect();
    const xPixel = e.clientX - rect.left;
    const yPixel = e.clientY - rect.top;
    
    const xPercent = (xPixel / rect.width) * 100;
    const yPercent = (yPixel / rect.height) * 100;

    const newMapping: MappingItem = {
      id: Math.random().toString(36).substr(2, 9),
      x: xPercent,
      y: yPercent,
      columnKey,
      fontSize: 14,
    };

    setMappings([...mappings, newMapping]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // 드롭 허용
  };

  const removeMapping = (id: string) => {
    setMappings(mappings.filter(m => m.id !== id));
  };

  const updateFontSize = (id: string, size: number) => {
    setMappings(mappings.map(m => m.id === id ? { ...m, fontSize: size } : m));
  };

  const handleSave = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!name.trim()) return alert('양식 이름을 입력해주세요.');
    if (!backgroundImage) return alert('배경 이미지(양식 파일)를 업로드해주세요.');
    
    setIsSaving(true);
    try {
      const result = await saveFormTemplateAction({
        id: initialTemplate?.id,
        name,
        backgroundImageData: backgroundImage,
        mappingConfig: JSON.stringify(mappings),
        sourceTable,
        status
      });

      if (result.success) {
        alert(status === 'PUBLISHED' ? '양식이 출시되었습니다!' : '임시 저장되었습니다.');
        router.push('/dashboard/form-studio');
      } else {
        alert('저장 실패: ' + result.error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1 animate-in fade-in duration-500">
      {/* Left Panel: Toolbar & Data Sources */}
      <div className="xl:col-span-1 flex flex-col h-full min-h-[600px]">
        <div className="flex-1 bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center gap-4">
            <Link href="/dashboard/form-studio" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full font-bold text-lg text-slate-900 border-none focus:ring-0 p-0 placeholder:text-slate-300"
              placeholder="양식 이름"
            />
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-700 mb-3">양식 배경 (템플릿)</h3>
            <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200 border-dashed text-center">
               {!backgroundImage ? (
                  <span className="text-xs text-slate-500 font-bold">오른쪽 캔버스에서 이미지를 업로드하세요.</span>
               ) : (
                  <span className="text-xs text-blue-600 font-black">배경 이미지 업로드 완료</span>
               )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3">사용 가능한 필드 (Drag & Drop)</h3>
            <p className="text-xs text-slate-500 mb-4">아래 필드를 우측 양식의 빈칸으로 드래그하세요.</p>
            
            <div className="space-y-2">
              {columns.map(col => (
                <div 
                  key={col}
                  draggable
                  onDragStart={(e) => handleDragStart(e, col)}
                  className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <GripVertical size={16} className="text-slate-400 group-hover:text-blue-500" />
                  <span className="font-medium text-sm text-slate-700">{col}</span>
                </div>
              ))}
              
              {columns.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  선택된 소스에 컬럼이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 space-y-3 bg-slate-50">
          <button 
            onClick={() => handleSave('DRAFT')}
            disabled={isSaving}
            className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} />
            임시 저장
          </button>
          <button 
            onClick={() => handleSave('PUBLISHED')}
            disabled={isSaving}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Play size={18} />
            출시하기 (Publish)
          </button>
        </div>
      </div>
    </div>

      {/* Right Panel: Canvas Area */}
      <div className="xl:col-span-2 flex flex-col gap-8">
        
        {/* Top Bar: Data Source Context Bar (Chart Studio Style) */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSourceModalOpen(true)}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 group shrink-0"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform" />
              Data Source
            </button>
            
            <div className="flex flex-wrap gap-2 items-center">
              {!sourceTable ? (
                <div className="flex items-center gap-2 text-slate-300 ml-2">
                  <span className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">No table selected. Click 'Data Source'.</span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[11px] font-black border border-blue-100 animate-in fade-in slide-in-from-left-2">
                  {sourceTable}
                  <X size={12} className="cursor-pointer hover:text-red-500 transition-colors" onClick={() => setSourceTable('')} />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Canvas Scroll Area */}
        <div className="flex-1 overflow-auto bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 relative flex items-start justify-center p-8 pb-20">
          {!backgroundImage ? (
          <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl">
            <div className="p-12 bg-white border-2 border-dashed border-slate-300 rounded-[32px] text-center w-full shadow-sm hover:border-blue-400 transition-colors cursor-pointer"
                 onClick={() => fileInputRef.current?.click()}>
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500">
                <Upload size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">양식 파일 업로드</h2>
              <p className="text-slate-500 mb-8">견적서나 발주서의 빈 양식 이미지 파일(PNG, JPG)을 업로드하세요.</p>
              <button className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl">
                파일 선택
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/png, image/jpeg, image/webp"
                className="hidden" 
              />
            </div>
          </div>
        ) : (
          <div 
            ref={canvasRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="relative shadow-2xl bg-white select-none"
            style={{ width: '800px', minHeight: '1131px' }} // A4 proportions approximately
          >
            {/* Background Image */}
            <img 
              src={backgroundImage} 
              alt="Form Background" 
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ objectPosition: 'top center' }}
            />

            {/* Mapped Fields Overlay */}
            {mappings.map(mapping => (
              <div 
                key={mapping.id}
                className="absolute bg-blue-100/80 border-2 border-blue-500 text-blue-900 rounded-md px-2 py-1 shadow-sm flex items-center gap-2 group cursor-default"
                style={{ 
                  left: `${mapping.x}%`, 
                  top: `${mapping.y}%`,
                  transform: 'translate(-50%, -50%)', // Center on drop point
                  fontSize: `${mapping.fontSize}px`
                }}
              >
                <span className="font-bold whitespace-nowrap">[{mapping.columnKey}]</span>
                
                {/* Tooltip Controls (visible on hover) */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-20 flex flex-col gap-2 min-w-[120px]">
                  <div className="flex items-center justify-between gap-3 px-2 py-1 bg-slate-50 rounded-lg">
                    <span className="text-xs font-bold text-slate-500">크기</span>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); updateFontSize(mapping.id, Math.max(8, mapping.fontSize - 2)); }} className="text-slate-600 hover:text-blue-600">-</button>
                      <span className="text-xs font-medium w-4 text-center">{mapping.fontSize}</span>
                      <button onClick={(e) => { e.stopPropagation(); updateFontSize(mapping.id, Math.min(36, mapping.fontSize + 2)); }} className="text-slate-600 hover:text-blue-600">+</button>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeMapping(mapping.id); }}
                    className="flex items-center justify-center gap-2 w-full py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} /> 삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      <SourceSelectionModal 
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        allTables={tables.map(t => ({ id: t, name: t, displayName: t }))}
        selectedIds={sourceTable ? [sourceTable] : []}
        toggleTable={(id) => setSourceTable(prev => prev === id ? '' : id)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </div>
  );
}
