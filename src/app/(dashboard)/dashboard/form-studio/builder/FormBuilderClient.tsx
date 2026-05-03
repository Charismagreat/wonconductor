'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveFormTemplateAction, analyzeFormMappingAction } from '@/app/actions/form-studio';
import { 
  Plus, Save, Trash2, Upload, Database, Image as ImageIcon, Sparkles, Wand2, Zap, Loader2, 
  ChevronLeft, ChevronRight, Settings, Maximize, MousePointer2, AlignLeft, AlignRight, 
  AlignStartVertical as AlignTop, AlignEndVertical as AlignBottom, LayoutGrid, ArrowLeft, ArrowRight,
  Pencil, Play, X, GripVertical
} from 'lucide-react';
import Link from 'next/link';
import { SourceSelectionModal } from '@/components/dashboard/SourceSelectionModal';

interface MappingItem {
  id: string;
  x: number;
  y: number;
  width: number; // 너비 (%)
  columnKey: string;
  fontSize: number;
  textAlign?: 'left' | 'center' | 'right';
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [builderMode, setBuilderMode] = useState<'classic' | 'modern'>('classic');
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // 히스토리 (Undo/Redo)
  const [past, setPast] = useState<MappingItem[][]>([]);
  const [future, setFuture] = useState<MappingItem[][]>([]);

  const saveHistory = (currentMappings: MappingItem[]) => {
    setPast(prev => [...prev.slice(-19), currentMappings]); // 최대 20개 저장
    setFuture([]); // 새로운 동작 시 Redo 스택 초기화
  };

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setFuture(prev => [mappings, ...prev]);
    setMappings(previous);
    setPast(newPast);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(prev => [...prev, mappings]);
    setMappings(next);
    setFuture(newFuture);
  };

  // Sync newFormName when base name changes
  useEffect(() => {
    setNewFormName(name);
  }, [name]);
  const [draggingMappingId, setDraggingMappingId] = useState<string | null>(null);
  const [selectedMappingIds, setSelectedMappingIds] = useState<string[]>([]);
  const [movingMappingIds, setMovingMappingIds] = useState<string[]>([]);
  const [dragOffset, setDragOffset] = useState<{ x: number, y: number } | null>(null);

  // Refs for instantaneous state access in high-frequency event handlers
  const mappingsRef = useRef(mappings);
  const selectedIdsRef = useRef(selectedMappingIds);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const isSelectingRef = useRef(false);
  const movingIdsRef = useRef<string[]>([]);
  const resizingIdRef = useRef<string | null>(null);
  const lastMousePosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const selectionStartPosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  useEffect(() => { mappingsRef.current = mappings; }, [mappings]);
  useEffect(() => { selectedIdsRef.current = selectedMappingIds; }, [selectedMappingIds]);

  // 키보드 제어 로직 (useRef를 사용하여 성능 최적화)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        redo();
        return;
      }

      const selectedIds = selectedIdsRef.current;
      if (selectedIds.length === 0) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const moveStep = 0.125; 
      const verticalStep = 0.088;

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        saveHistory(mappingsRef.current);
        
        setMappings(prev => {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            return prev.filter(m => !selectedIds.includes(m.id));
          }

          return prev.map(m => {
            if (!selectedIds.includes(m.id)) return m;
            const multiplier = e.shiftKey ? 10 : 1;
            
            switch (e.key) {
              case 'ArrowLeft': return { ...m, x: Math.max(0, Math.min(100, m.x - moveStep * multiplier)) };
              case 'ArrowRight': return { ...m, x: Math.max(0, Math.min(100, m.x + moveStep * multiplier)) };
              case 'ArrowUp': return { ...m, y: Math.max(0, Math.min(100, m.y - verticalStep * multiplier)) };
              case 'ArrowDown': return { ...m, y: Math.max(0, Math.min(100, m.y + verticalStep * multiplier)) };
              default: return m;
            }
          });
        });

        if (e.key === 'Delete' || e.key === 'Backspace') {
          setSelectedMappingIds([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newMapping: any = {
      id: `m-${Date.now()}`,
      columnKey,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      fontSize: 14
    };

    saveHistory(mappings);
    setMappings(prev => [...prev, newMapping]);
    setSelectedMappingIds([newMapping.id]);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; 
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    lastMousePosRef.current = { x, y };

    // 1. 좌표 기반으로 어떤 항목이 클릭되었는지 수동 판정 (Hit Detection)
    const clickedMapping = mappingsRef.current.find(m => {
      const xDiff = x - m.x;
      const yDiff = Math.abs(y - m.y);
      // 박스 영역 안인지 확인 (x는 시작점~시작점+너비, y는 중심축 기준 +- 3%)
      return xDiff >= 0 && xDiff <= (m.width || 15) && yDiff < 4; 
    });

    if (clickedMapping) {
      const xFromRight = (clickedMapping.x + (clickedMapping.width || 15)) - x;
      
      // 오른쪽 끝 2% 영역을 클릭하면 리사이징 시작
      if (xFromRight < 2 && xFromRight > -1) {
        isResizingRef.current = true;
        resizingIdRef.current = clickedMapping.id;
        isDraggingRef.current = false;
      } else {
        let currentSelection = [...selectedIdsRef.current];
        if (!currentSelection.includes(clickedMapping.id)) {
          if (e.shiftKey || e.metaKey || e.ctrlKey) {
            currentSelection = [...currentSelection, clickedMapping.id];
          } else {
            currentSelection = [clickedMapping.id];
          }
          setSelectedMappingIds(currentSelection);
        }
        isDraggingRef.current = true;
        isResizingRef.current = false;
        movingIdsRef.current = currentSelection;
      }
      return;
    }

    // 2. 아무 항목도 클릭되지 않은 경우 (드래그 선택 시작)
    isSelectingRef.current = true;
    isDraggingRef.current = false;
    selectionStartPosRef.current = { x, y };
    setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
    
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      setSelectedMappingIds([]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // 1. 리사이징 처리
    if (isResizingRef.current && resizingIdRef.current) {
      const deltaX = x - lastMousePosRef.current.x;
      setMappings(prev => prev.map(m => {
        if (m.id !== resizingIdRef.current) return m;
        return { ...m, width: Math.max(2, (m.width || 15) + deltaX) };
      }));
      lastMousePosRef.current = { x, y };
      return;
    }

    // 2. 항목 드래그 이동
    if (isDraggingRef.current && movingIdsRef.current.length > 0) {
      const deltaX = x - lastMousePosRef.current.x;
      const deltaY = y - lastMousePosRef.current.y;
      
      if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
        setMappings(prev => prev.map(m => {
          if (!movingIdsRef.current.includes(m.id)) return m;
          return { 
            ...m, 
            x: Math.max(0, Math.min(100, m.x + deltaX)), 
            y: Math.max(0, Math.min(100, m.y + deltaY)) 
          };
        }));
        lastMousePosRef.current = { x, y };
      }
      return;
    }

    // 2. 드래그 영역 선택
    if (isSelectingRef.current) {
      setSelectionBox({
        startX: selectionStartPosRef.current.x,
        startY: selectionStartPosRef.current.y,
        currentX: x,
        currentY: y
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // 1. 드래그/리사이징 종료
    if (isDraggingRef.current || isResizingRef.current) {
      saveHistory(mappingsRef.current); // 동작 완료 후 히스토리 저장
    }
    isDraggingRef.current = false;
    isResizingRef.current = false;
    movingIdsRef.current = [];
    resizingIdRef.current = null;

    // 2. 드래그 영역 선택 종료
    if (isSelectingRef.current) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const currentX = ((e.clientX - rect.left) / rect.width) * 100;
      const currentY = ((e.clientY - rect.top) / rect.height) * 100;
      
      const finalX1 = Math.min(selectionStartPosRef.current.x, currentX);
      const finalX2 = Math.max(selectionStartPosRef.current.x, currentX);
      const finalY1 = Math.min(selectionStartPosRef.current.y, currentY);
      const finalY2 = Math.max(selectionStartPosRef.current.y, currentY);

      // 박스 크기가 유의미할 때만 선택 처리 (단순 클릭 시 선택 해제 방지)
      if (Math.abs(finalX2 - finalX1) > 0.5 || Math.abs(finalY2 - finalY1) > 0.5) {
        const inBoxIds = mappingsRef.current
          .filter(m => m.x >= finalX1 && m.x <= finalX2 && m.y >= finalY1 && m.y <= finalY2)
          .map(m => m.id);

        if (inBoxIds.length > 0) {
          setSelectedMappingIds(prev => Array.from(new Set([...prev, ...inBoxIds])));
        }
      }
      
      isSelectingRef.current = false;
      setSelectionBox(null);
    }
  };

  const updateFontSizeBulk = (delta: number) => {
    if (selectedMappingIds.length === 0) return;
    saveHistory(mappings);
    setMappings(prev => prev.map(m => {
      if (!selectedMappingIds.includes(m.id)) return m;
      return { ...m, fontSize: Math.max(8, Math.min(72, m.fontSize + delta)) };
    }));
  };

  const updateWidthBulk = (delta: number) => {
    if (selectedMappingIds.length === 0) return;
    saveHistory(mappings);
    setMappings(prev => prev.map(m => {
      if (!selectedMappingIds.includes(m.id)) return m;
      return { ...m, width: Math.max(2, (m.width || 15) + delta) };
    }));
  };

  const updateTextAlignBulk = (align: 'left' | 'center' | 'right') => {
    if (selectedMappingIds.length === 0) return;
    saveHistory(mappings);
    setMappings(prev => prev.map(m => {
      if (!selectedMappingIds.includes(m.id)) return m;
      return { ...m, textAlign: align };
    }));
  };

  const handleAlignment = (type: 'left' | 'right' | 'top' | 'bottom' | 'v-distribute' | 'h-distribute') => {
    if (selectedMappingIds.length < 2) return;
    saveHistory(mappings);

    const selectedItems = mappings.filter(m => selectedMappingIds.includes(m.id));
    
    let newMappings = [...mappings];
    
    if (type === 'left') {
      const minX = Math.min(...selectedItems.map(m => m.x));
      newMappings = mappings.map(m => selectedMappingIds.includes(m.id) ? { ...m, x: minX } : m);
    } else if (type === 'right') {
      const maxX = Math.max(...selectedItems.map(m => m.x));
      newMappings = mappings.map(m => selectedMappingIds.includes(m.id) ? { ...m, x: maxX } : m);
    } else if (type === 'top') {
      const minY = Math.min(...selectedItems.map(m => m.y));
      newMappings = mappings.map(m => selectedMappingIds.includes(m.id) ? { ...m, y: minY } : m);
    } else if (type === 'bottom') {
      const maxY = Math.max(...selectedItems.map(m => m.y));
      newMappings = mappings.map(m => selectedMappingIds.includes(m.id) ? { ...m, y: maxY } : m);
    } else if (type === 'v-distribute') {
      const sorted = [...selectedItems].sort((a, b) => a.y - b.y);
      const minY = sorted[0].y;
      const maxY = sorted[sorted.length - 1].y;
      const gap = (maxY - minY) / (sorted.length - 1);
      
      newMappings = mappings.map(m => {
        if (!selectedMappingIds.includes(m.id)) return m;
        const index = sorted.findIndex(s => s.id === m.id);
        return { ...m, y: minY + (gap * index) };
      });
    }

    setMappings(newMappings);
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
    
    // Set default publish mode based on existence of initial template
    setPublishMode(initialTemplate?.id ? 'overwrite' : 'new');
    setIsPublishModalOpen(true);
  };

  const handleAutoMapping = async () => {
    if (!backgroundImage) {
      alert('먼저 양식 이미지를 업로드해 주세요.');
      return;
    }
    if (!sourceTable) {
      alert('먼저 데이터 소스를 선택해 주세요.');
      return;
    }

    const availableFields = tableSchemas[sourceTable] || [];
    if (availableFields.length === 0) {
      alert('사용 가능한 필드가 없습니다.');
      return;
    }

    if (!confirm('AI가 이미지와 필드를 분석하여 자동으로 매핑을 시도합니다. 기존 매핑이 덮어씌워질 수 있습니다. 진행하시겠습니까?')) {
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeFormMappingAction(backgroundImage, availableFields);
      if (result.success && result.proposals) {
        const newMappings = result.proposals.map((p: any, idx: number) => ({
          id: Date.now() + idx,
          columnKey: p.columnKey,
          x: p.x,
          y: p.y,
          fontSize: p.fontSize || 14
        }));
        setMappings(newMappings);
        alert(`AI 분석 완료: ${newMappings.length}개의 필드가 매핑되었습니다.`);
      } else {
        alert('AI 분석 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Auto-mapping failed:', error);
      alert('분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const confirmPublish = async () => {
    if (isPublishing) return;
    
    // Validation
    const finalName = publishMode === 'new' ? newFormName : name;
    if (!finalName.trim()) {
      alert('양식 이름을 입력해주세요.');
      return;
    }

    setIsPublishing(true);
    try {
      const finalId = publishMode === 'new' ? null : initialTemplate?.id;

      const payload = {
        id: finalId || undefined,
        name: finalName,
        backgroundImageData: backgroundImage,
        mappingConfig: JSON.stringify(mappings),
        sourceTable: sourceTable,
        status: 'PUBLISHED' as const
      };

      console.log('Publishing with payload:', payload);

      const result = await saveFormTemplateAction(payload);
      
      if (result.success) {
        alert(publishMode === 'new' ? '새 양식이 성공적으로 생성되었습니다.' : '양식이 성공적으로 업데이트되었습니다.');
        setIsPublishModalOpen(false);
        if (publishMode === 'new') {
          router.push('/dashboard/form-studio');
        }
      } else {
        alert('저장 실패: ' + (result.error || '알 수 없는 오류가 발생했습니다.'));
      }
    } catch (error: any) {
      console.error('Publish failed:', error);
      alert('처리 중 시스템 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsPublishing(false);
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

        <div className="px-8 py-8 flex-1 overflow-y-auto custom-scrollbar">
          {/* Data Source Selection Moved to Sidebar */}
          <div className="mb-10">
            <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-600 rounded-full" />
              데이터 소스 연결
            </h3>
            <div className="flex flex-col gap-4 mb-8">
              <button 
                onClick={() => setIsSourceModalOpen(true)}
                className={`w-full py-5 rounded-[28px] font-black text-sm transition-all flex items-center justify-center gap-3 group shadow-sm ${
                  sourceTable 
                    ? 'bg-blue-50 text-blue-600 border-2 border-blue-100 hover:bg-blue-100' 
                    : 'bg-slate-50 border-2 border-dashed border-slate-200 text-slate-500 hover:border-blue-400 hover:bg-blue-50/50'
                }`}
              >
                <Database size={18} className="group-hover:rotate-12 transition-transform" />
                {sourceTable ? 'DATA SOURCE 변경' : 'DATA SOURCE 선택'}
              </button>
            </div>
              
            {sourceTable && (
              <div className="flex items-center justify-between px-5 py-4 bg-blue-50/50 border border-blue-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">Connected Source</span>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-sm font-black text-blue-900 truncate">
                      {tables.find(t => t.id === sourceTable)?.name || sourceTable}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-black rounded-full shrink-0">
                      {tables.find(t => t.id === sourceTable)?.physicalTableName || sourceTable}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSourceTable('')}
                  className="p-2 hover:bg-blue-100 rounded-lg text-blue-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {!sourceTable && (
              <p className="text-[11px] text-slate-400 font-bold text-center py-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                연결된 테이블이 없습니다.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                사용 가능한 필드
              </h3>
              {sourceTable && backgroundImage && (
                <button
                  onClick={handleAutoMapping}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[11px] font-black hover:bg-indigo-100 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> 분석 중...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} /> AI 자동 매핑
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-bold mb-6 ml-3">아래 필드를 우측 양식의 빈칸으로 드래그하세요.</p>
            
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
              onClick={() => fileInputRef.current?.click()}
              className={`px-6 py-3 font-black rounded-2xl flex items-center gap-3 shadow-lg transition-all hover:scale-105 ${
                backgroundImage 
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100' 
                  : 'bg-indigo-600 text-white shadow-indigo-500/30 hover:bg-indigo-700'
              }`}
            >
              <Upload size={18} />
              {backgroundImage ? '이미지 교체' : '이미지 업로드'}
            </button>
            
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
        <div className="flex-1 overflow-auto bg-slate-50/50 rounded-[40px] border border-slate-100 shadow-inner relative flex items-start justify-center p-12 pb-32 min-h-[800px] z-0 custom-scrollbar">
          {!backgroundImage ? (
            <div className="flex flex-col items-center justify-center w-full max-w-3xl py-20 animate-in fade-in zoom-in-95 duration-500 my-auto">
              <div 
                className="p-20 bg-white border-4 border-dashed border-indigo-100 rounded-[56px] text-center w-full shadow-xl hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group relative overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="w-28 h-28 bg-indigo-50 rounded-[32px] flex items-center justify-center mx-auto mb-10 text-indigo-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <Upload size={48} strokeWidth={2.5} />
                  </div>
                  <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">양식 이미지를 업로드하세요</h2>
                  <p className="text-slate-500 mb-12 text-xl font-medium max-w-md mx-auto leading-relaxed">
                    A4 규격의 견적서, 발주서 양식을<br/>
                    이곳에 업로드하여 설계를 시작하세요.
                  </p>
                  <div className="inline-flex items-center gap-3 px-10 py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl shadow-indigo-500/40 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 transition-all text-lg">
                    <Plus size={24} />
                    양식 파일 선택하기
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden" 
                />
              </div>
            </div>
          ) : builderMode === 'classic' ? (
            <div className="flex flex-col gap-4 w-full items-center">
              {/* Alignment & Text Properties Toolbar (Visible when items selected) */}
              {selectedMappingIds.length >= 1 && (
                <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-lg flex items-center gap-6 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Font</span>
                    <button onClick={() => updateFontSizeBulk(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors" title="글꼴 작게"><ChevronLeft size={16} /></button>
                    <span className="text-sm font-bold w-6 text-center">{mappings.find(m => selectedMappingIds.includes(m.id))?.fontSize || 14}</span>
                    <button onClick={() => updateFontSizeBulk(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors" title="글꼴 크게"><ChevronRight size={16} /></button>
                  </div>

                  <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Width</span>
                    <button onClick={() => updateWidthBulk(-1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors" title="너비 좁게"><ArrowLeft size={16} /></button>
                    <span className="text-sm font-bold w-10 text-center">{Math.round(mappings.find(m => selectedMappingIds.includes(m.id))?.width || 15)}%</span>
                    <button onClick={() => updateWidthBulk(1)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors" title="너비 넓게"><ArrowRight size={16} /></button>
                  </div>

                  <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Text Align</span>
                    <button 
                      onClick={() => updateTextAlignBulk('left')} 
                      className={`p-2 rounded-lg transition-colors ${mappings.find(m => selectedMappingIds.includes(m.id))?.textAlign === 'left' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <AlignLeft size={18} />
                    </button>
                    <button 
                      onClick={() => updateTextAlignBulk('center')} 
                      className={`p-2 rounded-lg transition-colors ${mappings.find(m => selectedMappingIds.includes(m.id))?.textAlign === 'center' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <LayoutGrid size={18} className="rotate-45" /> {/* Use as center proxy if AlignCenter not imported */}
                    </button>
                    <button 
                      onClick={() => updateTextAlignBulk('right')} 
                      className={`p-2 rounded-lg transition-colors ${mappings.find(m => selectedMappingIds.includes(m.id))?.textAlign === 'right' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <AlignRight size={18} />
                    </button>
                  </div>

                  {selectedMappingIds.length >= 2 && (
                    <>
                      <div className="flex items-center gap-2 border-r border-slate-100 pr-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Align</span>
                        <button onClick={() => handleAlignment('left')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors" title="좌측 정렬"><AlignLeft size={18} /></button>
                        <button onClick={() => handleAlignment('right')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors" title="우측 정렬"><AlignRight size={18} /></button>
                        <button onClick={() => handleAlignment('top')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors" title="상단 정렬"><AlignTop size={18} /></button>
                        <button onClick={() => handleAlignment('bottom')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors" title="하단 정렬"><AlignBottom size={18} /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Distribute</span>
                        <button onClick={() => handleAlignment('v-distribute')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors" title="세로 간격 동일하게"><LayoutGrid size={18} /></button>
                      </div>
                    </>
                  )}
                  
                  <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {selectedMappingIds.length}개 선택됨
                  </div>
                </div>
              )}

              <div 
                ref={canvasRef}
                className="relative shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-white select-none shrink-0 mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 border border-slate-200"
                style={{ 
                  width: '100%', 
                  maxWidth: '850px', 
                  aspectRatio: '1 / 1.414',
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {/* Interaction Overlay (Captures ALL mouse events) */}
                <div 
                  className="absolute inset-0 z-40 cursor-crosshair"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onClick={(e) => { 
                    // Manual selection is handled in MouseDown, but we can prevent default
                    e.preventDefault();
                    if (e.target === e.currentTarget && !e.shiftKey) {
                       // Optional: clear selection if background clicked? 
                       // But handleMouseDown already does this.
                    }
                  }}
                />

                <div className="absolute inset-0 pointer-events-none">
                  <div className="relative w-full h-full">
                    {/* Selection Marquee */}
                    {selectionBox && (
                      <div 
                        className="absolute border-2 border-blue-500 bg-blue-500/10 z-50 pointer-events-none"
                        style={{
                          left: `${Math.min(selectionBox.startX, selectionBox.currentX)}%`,
                          top: `${Math.min(selectionBox.startY, selectionBox.currentY)}%`,
                          width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}%`,
                          height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}%`,
                        }}
                      />
                    )}

                    {/* Background Image */}
                    {backgroundImage && (
                      <img 
                        src={backgroundImage} 
                        alt="Form Background" 
                        className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0"
                      />
                    )}

                    {/* Mapped Fields Overlay */}
                    {mappings.map(mapping => {
                      // 숫자인지 판단 (컬럼명 기준)
                      const isNumeric = /금액|수량|단가|세액|합계|가격|번호|비율/.test(mapping.columnKey);
                      const alignment = mapping.textAlign || (isNumeric ? 'right' : 'left');
                      const width = mapping.width || 15;
                      
                      return (
                        <div 
                          key={mapping.id}
                          data-mapping-id={mapping.id}
                          className={`absolute rounded-md px-2 py-1 shadow-sm flex items-center group transition-all select-none pointer-events-none ${
                            selectedMappingIds.includes(mapping.id) 
                              ? 'bg-blue-600 text-white border-2 border-white ring-2 ring-blue-500 z-30 shadow-blue-500/30' 
                              : 'bg-blue-100/80 border-2 border-blue-500 text-blue-900 z-20 hover:bg-blue-200'
                          }`}
                          style={{ 
                            left: `${mapping.x}%`, 
                            top: `${mapping.y}%`,
                            transform: 'translate(0, -50%)',
                            fontSize: `${mapping.fontSize}px`,
                            width: `${width}%`,
                            justifyContent: alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start',
                            textAlign: alignment
                          }}
                        >
                          <span className="font-bold whitespace-nowrap pointer-events-none">[{mapping.columnKey}]</span>
                          
                          {/* Resizing Handle (Right edge) */}
                          {selectedMappingIds.includes(mapping.id) && (
                            <div className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize bg-white/20 hover:bg-white/40 pointer-events-auto" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
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
                {initialTemplate?.id && (
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
                )}

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
                  disabled={isPublishing}
                  className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    '확인'
                  )}
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
