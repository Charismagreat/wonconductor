'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveFormTemplateAction } from '@/app/actions/form-studio';
import { Upload, Save, Play, Trash2, GripVertical, Settings2, ArrowLeft, ArrowRight, Plus, X, Zap, Image as ImageIcon, Pencil } from 'lucide-react';
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
  tables: any[];
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
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<'overwrite' | 'new'>('overwrite');
  const [newFormName, setNewFormName] = useState(name);

  // Sync newFormName when base name changes
  useEffect(() => {
    setNewFormName(name);
  }, [name]);
  const [draggingMappingId, setDraggingMappingId] = useState<string | null>(null);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<'classic' | 'modern'>('classic');

  // 키보드 제어 로직
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedMappingId) return;

      // 입력 중일 때는 무시 (예: 이름 수정 등)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const moveStep = 0.125; // 약 1px (800px 기준)
      const verticalStep = 0.088; // 약 1px (1131px 기준)

      setMappings(prev => prev.map(m => {
        if (m.id !== selectedMappingId) return m;

        switch (e.key) {
          case 'ArrowLeft': return { ...m, x: Math.max(0, m.x - moveStep) };
          case 'ArrowRight': return { ...m, x: Math.min(100, m.x + moveStep) };
          case 'ArrowUp': return { ...m, y: Math.max(0, m.y - verticalStep) };
          case 'ArrowDown': return { ...m, y: Math.min(100, m.y + verticalStep) };
          case 'Delete':
          case 'Backspace':
            setTimeout(() => removeMapping(m.id), 0);
            return m;
          default: return m;
        }
      }));

      // 방향키 입력 시 스크롤 방지
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMappingId]);

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

  const handleDragStart = (e: React.DragEvent, columnKey: string, mappingId?: string) => {
    e.dataTransfer.setData('text/plain', columnKey);
    if (mappingId) {
      setDraggingMappingId(mappingId);
    } else {
      setDraggingMappingId(null);
    }
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

    if (draggingMappingId) {
      // 기존 매핑 이동
      setMappings(mappings.map(m => 
        m.id === draggingMappingId 
          ? { ...m, x: xPercent, y: yPercent } 
          : m
      ));
      setDraggingMappingId(null);
    } else {
      // 새 매핑 추가
      const newMapping: MappingItem = {
        id: Math.random().toString(36).substr(2, 9),
        x: xPercent,
        y: yPercent,
        columnKey,
        fontSize: 14,
      };
      setMappings([...mappings, newMapping]);
    }
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

  const handleSave = async () => {
    if (!name.trim()) return alert('양식 이름을 입력해주세요.');
    if (!backgroundImage) return alert('배경 이미지(양식 파일)를 업로드해주세요.');
    setIsPublishModalOpen(true);
  };

  const confirmPublish = async () => {
    try {
      const template = {
        mappings,
        backgroundImage,
        sourceTable
      };
      
      // Use new name if in 'new' mode, otherwise use current name
      const finalName = publishMode === 'new' ? newFormName : name;
      // If 'new' mode, pass null as ID to create a new entry
      const finalId = publishMode === 'new' ? null : initialTemplate?.id;

      const result = await saveFormTemplateAction(finalId, finalName, template);
      if (result.success) {
        alert(publishMode === 'new' ? '새 양식이 성공적으로 생성되었습니다.' : '양식이 성공적으로 업데이트되었습니다.');
        setIsPublishModalOpen(false);
        if (publishMode === 'new') {
          router.push('/dashboard/form-studio');
        }
      }
    } catch (error) {
      console.error('Publish failed:', error);
      alert('처리에 실패했습니다.');
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1 animate-in fade-in duration-500">
      {/* Left Panel: Toolbar & Data Sources */}
      <div className="xl:col-span-1 flex flex-col h-full min-h-[600px]">
        <div className="flex-1 bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center gap-4 group/title">
            <Link href="/dashboard/form-studio" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex-1 flex items-center gap-2">
              <Pencil size={14} className="text-slate-300 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-bold text-lg text-slate-900 border-none focus:ring-0 p-0 placeholder:text-slate-300 bg-transparent w-full"
                placeholder="양식 이름"
              />
            </div>
          </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Data Source Selection Moved to Sidebar */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-700 mb-3">데이터 소스 연결</h3>
            <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-[24px] border border-slate-200">
              <button 
                onClick={() => setIsSourceModalOpen(true)}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 group"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                Data Source 선택
              </button>
              
              {sourceTable && (
                <div className="flex items-center justify-between px-4 py-3 bg-white border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                  <span className="text-[11px] font-black text-blue-700 truncate mr-2">
                    {tables.find(t => t.id === sourceTable)?.name || sourceTable}
                  </span>
                  <X 
                    size={14} 
                    className="text-blue-300 cursor-pointer hover:text-red-500 transition-colors shrink-0" 
                    onClick={() => setSourceTable('')} 
                  />
                </div>
              )}

              {!sourceTable && (
                <p className="text-[10px] text-slate-400 font-bold text-center py-1">
                  연결된 테이블이 없습니다.
                </p>
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
      </div>
    </div>

      {/* Right Panel: Canvas Area */}
      <div className="xl:col-span-2 flex flex-col gap-8">
        
        {/* Top Bar: Data Source Context Bar & Action Buttons */}
        <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
          <div className="flex flex-wrap items-center gap-6 flex-1">
            {/* Mode Switcher Tabs */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 shadow-inner shrink-0">
              <button 
                onClick={() => setBuilderMode('classic')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  builderMode === 'classic' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ImageIcon size={14} />
                CLASSIC
              </button>
              <button 
                onClick={() => setBuilderMode('modern')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  builderMode === 'modern' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Zap size={14} />
                MODERN (AI)
              </button>
            </div>

            <div className="h-8 w-[1px] bg-slate-100 mx-2 hidden md:block" />
            
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {builderMode === 'classic' ? 'Visual Mapping Mode Active' : 'AI Dynamic Mode Active'}
              </span>
            </div>
          </div>

          {/* Action Buttons Moved from Sidebar */}
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSave}
              className="px-8 py-3 bg-blue-600 text-white font-black rounded-2xl flex items-center gap-3 shadow-lg shadow-blue-500/30 hover:scale-105 transition-all"
            >
              <Play size={18} fill="white" />
              폼 생성
            </button>
          </div>
        </div>

        {/* Canvas Scroll Area */}
        <div className="flex-1 overflow-auto bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 relative flex items-start justify-center p-8 pb-20">
          {builderMode === 'classic' ? (
            !backgroundImage ? (
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
                onClick={() => setSelectedMappingId(null)}
                className="relative shadow-2xl bg-white select-none shrink-0 mx-auto cursor-crosshair"
                style={{ width: '100%', maxWidth: '800px', aspectRatio: '1 / 1.414' }}
              >
                {/* Background Image */}
                <img 
                  src={backgroundImage} 
                  alt="Form Background" 
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                />

                {/* Mapped Fields Overlay */}
                {mappings.map(mapping => (
                  <div 
                    key={mapping.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, mapping.columnKey, mapping.id)}
                    onClick={(e) => { e.stopPropagation(); setSelectedMappingId(mapping.id); }}
                    className={`absolute rounded-md px-2 py-1 shadow-sm flex items-center gap-2 group cursor-move transition-all ${
                      selectedMappingId === mapping.id 
                        ? 'bg-blue-600 text-white border-2 border-white ring-2 ring-blue-500 z-30 shadow-blue-500/30' 
                        : 'bg-blue-100/80 border-2 border-blue-500 text-blue-900 z-20 hover:bg-blue-200'
                    }`}
                    style={{ 
                      left: `${mapping.x}%`, 
                      top: `${mapping.y}%`,
                      transform: 'translate(0, -50%)',
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
                    className="w-full py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={12} />
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
            )
          ) : (
            /* MODERN (AI) MODE CANVAS */
            <div className="flex-1 bg-white rounded-[40px] border border-slate-100 shadow-xl p-12 flex flex-col items-center justify-center text-center gap-8 min-h-[600px] w-full max-w-5xl mx-auto">
              <div className="w-32 h-32 bg-blue-50 rounded-[40px] flex items-center justify-center text-blue-500 animate-pulse">
                <Zap size={64} fill="currentColor" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-800 mb-4">AI 스마트 웹앱 빌더</h2>
                <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                  업로드된 양식을 분석하여 반응형 웹 페이지로 자동 변환합니다.<br/>
                  현재 AI 엔진이 배경 이미지를 분석할 준비가 되었습니다.
                </p>
              </div>
              <button className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/30 hover:scale-105 transition-all flex items-center gap-3">
                <Zap size={20} />
                AI 분석 및 자동 생성 시작
              </button>
              <div className="grid grid-cols-3 gap-6 w-full max-w-2xl mt-8">
                {['반응형 디자인', '실시간 데이터', '인터랙티브'].map(feature => (
                  <div key={feature} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold text-slate-400">
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Publish Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-10">
              <h2 className="text-2xl font-black text-slate-800 mb-2">폼 생성 옵션</h2>
              <p className="text-slate-500 mb-8 font-medium">양식을 저장하거나 새로운 양식으로 게시할 수 있습니다.</p>
              
              <div className="grid grid-cols-1 gap-4 mb-8">
                <button 
                  onClick={() => setPublishMode('overwrite')}
                  className={`flex flex-col items-start p-6 rounded-[28px] border-2 transition-all text-left group ${
                    publishMode === 'overwrite' 
                      ? 'border-blue-600 bg-blue-50/50 shadow-md shadow-blue-500/10' 
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                      publishMode === 'overwrite' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Save size={20} />
                    </div>
                    <span className={`font-black text-sm uppercase tracking-widest ${
                      publishMode === 'overwrite' ? 'text-blue-600' : 'text-slate-400'
                    }`}>기존 양식 업데이트</span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold leading-relaxed ml-[52px]">
                    현재 작업 중인 '{name}' 양식의 설정을 그대로 덮어씌웁니다.
                  </p>
                </button>

                <button 
                  onClick={() => setPublishMode('new')}
                  className={`flex flex-col items-start p-6 rounded-[28px] border-2 transition-all text-left group ${
                    publishMode === 'new' 
                      ? 'border-blue-600 bg-blue-50/50 shadow-md shadow-blue-500/10' 
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                      publishMode === 'new' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Plus size={20} />
                    </div>
                    <span className={`font-black text-sm uppercase tracking-widest ${
                      publishMode === 'new' ? 'text-blue-600' : 'text-slate-400'
                    }`}>새로운 양식으로 생성</span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold leading-relaxed ml-[52px]">
                    기존 양식은 유지하고 별도의 이름을 가진 새 양식을 생성합니다.
                  </p>
                </button>
              </div>

              {publishMode === 'new' && (
                <div className="mb-8 p-6 bg-slate-50 rounded-[28px] border border-slate-100 animate-in slide-in-from-top-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">새 양식 이름</label>
                  <div className="relative">
                    <Pencil size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      value={newFormName}
                      onChange={(e) => setNewFormName(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all"
                      placeholder="새로운 양식 이름을 입력하세요"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsPublishModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={confirmPublish}
                  className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SourceSelectionModal 
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        allTables={tables}
        selectedIds={sourceTable ? [sourceTable] : []}
        toggleTable={(id) => setSourceTable(prev => prev === id ? '' : id)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </div>
  );
}
