'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { ColumnDefinition, TableData } from '@/lib/excel-parser';
import { RecommendationTable } from '@/lib/ai-vision';
import { uploadExcelAction } from '@/app/actions/file';
import { analyzeExcelScreenshotAction, analyzeDocumentAction } from '@/app/actions/ai';
import { isSubtotalRow } from '@/lib/data-utils';
import { 
    Upload, Check, AlertCircle, FileText, ChevronRight, Save, Camera, 
    Sparkles, Image as ImageIcon, Loader2, RotateCcw, Info, GripVertical, 
    Trash2, Edit3, Database as DatabaseIcon, FileDigit, Tag
} from 'lucide-react';

interface SelectedField {
    id: string;      // 원본 엑셀 컬럼명
    name: string;    // 사용자 커스텀 컬럼명
    isActive: boolean;
    isRequired: boolean;
    type: string;    // 데이터 타입 (string, number 등)
    options?: string[]; // 목록형인 경우 선택 옵션
}

interface ExtendedTableData extends TableData {
    originalSheetName: string;
    rawRows: any[][];
    headerRowIndex: number;
}

export function UploadWorkflow({ userId }: { userId: string }) {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'select' | 'processing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewTables, setPreviewTables] = useState<ExtendedTableData[]>([]);
  const [selectedFields, setSelectedFields] = useState<Record<string, SelectedField[]>>({}); // tableName -> array of field objects
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationTable[]>([]);
  const [excelHtml, setExcelHtml] = useState<string>('');
  const [aiExtractedRows, setAiExtractedRows] = useState<any[]>([]); // AI가 추출한 실제 데이터들
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  
  // Drag and Drop state
  const [dragInfo, setDragInfo] = useState<{ tableName: string; index: number } | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 용량 제한 체크 (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
        alert('파일 용량이 너무 큽니다. 10MB 이하의 파일을 업로드해 주세요.');
        return;
    }

    setStep('analyzing');
    setIsAnalyzing(true);
    setFile(selectedFile);

    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls') || selectedFile.name.endsWith('.csv');
    const isImageOrPdf = selectedFile.type.startsWith('image/') || selectedFile.type === 'application/pdf';

    if (isImageOrPdf) {
        // 프리뷰 생성
        if (selectedFile.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setFilePreviewUrl(e.target?.result as string);
            reader.readAsDataURL(selectedFile);
        } else {
            setFilePreviewUrl(null); // PDF는 일단 아이콘으로 대체
        }

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            const result = await analyzeDocumentAction(formData);

            // AI 분석 결과를 테이블 스탠다드 포맷으로 변환
            const table: ExtendedTableData = {
                name: result.tableName,
                originalSheetName: result.tableName,
                columns: result.columns.map(c => ({ name: c.name, type: c.type })),
                rows: result.extractedRows, // 여기에 실제 추철 데이터 저장
                rawRows: [],
                headerRowIndex: 0
            };

            setPreviewTables([table]);
            setAiExtractedRows(result.extractedRows);
            
            // SelectedField 구성
            const fields: SelectedField[] = [
                { id: '__data_id__', name: '데이터ID', isActive: true, isRequired: true, type: 'string' },
                ...result.columns.map(c => ({
                    id: c.name,
                    name: c.name,
                    isActive: true,
                    isRequired: c.isRequired,
                    type: c.type
                }))
            ];
            setSelectedFields({ [result.tableName]: fields });
            setRecommendations([{ tableName: result.tableName, columns: result.columns }]);
            
            setStep('select');
        } catch (err: any) {
            console.error('AI Analysis Error:', err);
            alert(err.message || '문서 분석에 실패했습니다. 파일을 다시 확인해 주세요.');
            setStep('upload');
        } finally {
            setIsAnalyzing(false);
        }
        return;
    }

    // 기존 엑셀 처리 로직
    try {
        const buffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        
        const tables: ExtendedTableData[] = [];
        let combinedHtml = `
            <style>
                .preview-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                .sheet-section { padding: 40px; border-bottom: 2px solid #ccc; background: white; }
                .sheet-title { font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #333; border-left: 8px solid #2563eb; padding-left: 15px; }
                table { border-collapse: collapse; width: 100%; border: 1px solid #ddd; }
                th, td { border: 1px solid #ddd; padding: 12px 15px; text-align: left; }
                th { background-color: #f8fafc; font-weight: bold; color: #1e293b; }
                tr:nth-child(even) { background-color: #f1f5f9; }
            </style>
            <div class="preview-container">
        `;
        
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            const limitedSheet = { ...sheet };
            const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z50');
            range.e.r = Math.min(range.e.r, 50); 
            limitedSheet['!ref'] = XLSX.utils.encode_range(range);
            
            const html = XLSX.utils.sheet_to_html(limitedSheet, { header: '', footer: '' });
            combinedHtml += `
                <div class="sheet-section">
                    <div class="sheet-title">Sheet: ${sheetName}</div>
                    ${html}
                </div>
            `;

            if (rawRows.length > 0) {
                let maxCols = 0;
                let headerRowIndex = 0;
                for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
                    if (isSubtotalRow(rawRows[i])) continue;
                    const cols = rawRows[i].filter(c => c !== null && c !== undefined && c !== '').length;
                    if (cols > maxCols) {
                        maxCols = cols;
                        headerRowIndex = i;
                    }
                }

                const header = (rawRows[headerRowIndex] as any[]).map(h => h?.toString().trim() || '').filter(h => !!h);
                tables.push({
                    name: sheetName,
                    originalSheetName: sheetName,
                    columns: header.map(h => ({ name: h, type: 'string' })),
                    rows: [],
                    rawRows,
                    headerRowIndex
                });
            }
        });

        combinedHtml += '</div>';
        setPreviewTables(tables);
        setExcelHtml(combinedHtml);

        setTimeout(async () => {
            if (previewRef.current) {
                try {
                    const dataUrl = await toPng(previewRef.current, {
                        backgroundColor: '#ffffff',
                        width: 1200,
                        cacheBust: true,
                        quality: 0.95,
                        style: { opacity: '1', visibility: 'visible' }
                    });

                    if (dataUrl.length < 5000) throw new Error('렌더링 실패');

                    const response = await fetch(dataUrl);
                    const blob = await response.blob();
                    const generatedImage = new File([blob], 'excel_preview.png', { type: 'image/png' });

                    const formDataForAI = new FormData();
                    formDataForAI.append('image', generatedImage);
                    const result = await analyzeExcelScreenshotAction(formDataForAI);
                    
                    setRecommendations(result.recommendedTables || []);
                    applyRecommendation(tables, result.recommendedTables || []);
                    
                    setStep('select');
                } catch (err) {
                    console.error('AI Analysis Error:', err);
                    alert('AI 분석 결과가 명확하지 않습니다. 수동으로 필드를 선택해 주세요.');
                    setStep('select');
                } finally {
                    setIsAnalyzing(false);
                }
            } else {
                setStep('select');
                setIsAnalyzing(false);
            }
        }, 1500);

    } catch (error: any) {
        console.error('File parsing error:', error);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
        setStep('upload');
        setIsAnalyzing(false);
    }
  };

  const applyRecommendation = (tables: ExtendedTableData[], recs: RecommendationTable[]) => {
    const newSelection: Record<string, SelectedField[]> = {};
    const updatedTables = [...tables];

    tables.forEach((table, idx) => {
        const rec = recs.find(r => r.tableName === table.name || r.tableName.includes(table.name)) || 
                    recs.find(r => table.name.includes(r.tableName));

        let bestRowIndex = table.headerRowIndex;
        if (rec) {
            let maxMatches = 0;
            for (let i = 0; i < Math.min(table.rawRows.length, 25); i++) {
                if (isSubtotalRow(table.rawRows[i])) continue;
                const row = table.rawRows[i].map(c => c?.toString().trim().toLowerCase() || '');
                const matches = rec.columns.filter((aiCol: any) => {
                    const aiLower = aiCol.name.toLowerCase();
                    return row.some(rowCol => rowCol.includes(aiLower) || aiLower.includes(rowCol));
                }).length;

                if (matches > maxMatches) {
                    maxMatches = matches;
                    bestRowIndex = i;
                }
            }
        }

        const newHeaderRow = table.rawRows[bestRowIndex] || [];
        const newHeaderNames = newHeaderRow.map(h => h?.toString().trim() || '').filter(h => !!h);
        
        updatedTables[idx] = {
            ...table,
            headerRowIndex: bestRowIndex,
            columns: newHeaderNames.map(h => ({ name: h, type: 'string' }))
        };

        const fields: SelectedField[] = [
            { id: '__data_id__', name: '데이터ID', isActive: true, isRequired: true, type: 'string' }
        ];

        newHeaderNames.forEach(h => {
            const colRec = rec?.columns.find((c: any) => 
              h.toLowerCase().includes(c.name.toLowerCase()) || 
              c.name.toLowerCase().includes(h.toLowerCase())
            );

            const originalColIdx = newHeaderRow.findIndex(cell => cell?.toString().trim() === h);
            let numberCount = 0;
            let dateCount = 0;
            let totalCount = 0;
            const dateRegex = /^\d{2,4}[-./ ]\d{1,2}[-./ ]\d{1,2}/;
            const dateKeywordRegex = /(일|날짜|Date|Time|Period|시각|일자|만기)/i;
            const currencyKeywordRegex = /(단가|금액|비용|가격|Price|Amount|원|달러|Fee|Cost|수입|지출)/i;

            for (let i = 1; i <= 20; i++) {
                const dataRow = table.rawRows[bestRowIndex + i];
                if (!dataRow) break;
                if (isSubtotalRow(dataRow)) continue;
                const val = dataRow[originalColIdx];
                if (val !== undefined && val !== null && val !== '') {
                    totalCount++;
                    const stringVal = val.toString().trim();
                    if (val instanceof Date || dateRegex.test(stringVal)) {
                        dateCount++;
                    } else if (typeof val === 'number') {
                        if (val > 30000 && val < 60000 && dateKeywordRegex.test(h)) {
                            dateCount += 0.8;
                        }
                        numberCount++;
                    } else {
                        const numericVal = stringVal.replace(/[,₩$¥€]/g, '').trim();
                        if (!isNaN(Number(numericVal)) && numericVal !== '') {
                            numberCount++;
                        }
                    }
                }
            }

            const isDateKeywordFound = dateKeywordRegex.test(h);
            const isCurrencyKeywordFound = currencyKeywordRegex.test(h);
            const isNumericRatio = totalCount > 0 && (numberCount / totalCount) > 0.8;

            let inferredType = 'string';
            if ((totalCount > 0 && (dateCount / totalCount) > 0.6) || (isDateKeywordFound && dateCount > 0)) {
                inferredType = 'date';
            } else if (isCurrencyKeywordFound && isNumericRatio) {
                inferredType = 'currency';
            } else if (isNumericRatio) {
                inferredType = 'number';
            } else if (colRec) {
                inferredType = colRec.type;
            }

            fields.push({
                id: h,
                name: h,
                isActive: !!colRec || (idx === 0),
                isRequired: colRec ? colRec.isRequired : true,
                type: inferredType
            });
        });

        newSelection[table.name] = fields;
    });

    setPreviewTables(updatedTables);
    setSelectedFields(newSelection);
  };

  const toggleField = (tableName: string, fieldId: string) => {
    if (fieldId === '__data_id__') return;
    setSelectedFields(prev => {
        const currentFields = [...(prev[tableName] || [])];
        const updated = currentFields.map(f => f.id === fieldId ? { ...f, isActive: !f.isActive } : f);
        return { ...prev, [tableName]: updated };
    });
  };

  const toggleRequired = (tableName: string, fieldId: string) => {
    if (fieldId === '__data_id__') return;
    setSelectedFields(prev => {
        const currentFields = [...(prev[tableName] || [])];
        const updated = currentFields.map(f => f.id === fieldId ? { ...f, isRequired: !f.isRequired } : f);
        return { ...prev, [tableName]: updated };
    });
  };

  const updateFieldType = (tableName: string, fieldId: string, type: string) => {
    setSelectedFields(prev => {
        const currentFields = [...(prev[tableName] || [])];
        const updated = currentFields.map(f => f.id === fieldId ? { ...f, type } : f);
        return { ...prev, [tableName]: updated };
    });
  };

  const updateFieldOptions = (tableName: string, fieldId: string, optionsStr: string) => {
    const options = optionsStr.split(/[;\n]/).map(s => s.trim()).filter(s => !!s);
    setSelectedFields(prev => {
        const currentFields = [...(prev[tableName] || [])];
        const updated = currentFields.map(f => f.id === fieldId ? { ...f, options } : f);
        return { ...prev, [tableName]: updated };
    });
  };

  const addField = (tableName: string) => {
    setSelectedFields(prev => {
        const currentFields = [...(prev[tableName] || [])];
        const newFieldId = `custom_field_${Date.now()}`;
        const newField: SelectedField = {
            id: newFieldId,
            name: '새 필드',
            isActive: true,
            isRequired: false,
            type: 'string'
        };
        return { ...prev, [tableName]: [...currentFields, newField] };
    });
  };

  const removeField = (tableName: string, fieldId: string) => {
    setSelectedFields(prev => {
        const currentFields = [...(prev[tableName] || [])];
        const updated = currentFields.filter(f => f.id !== fieldId);
        return { ...prev, [tableName]: updated };
    });
  };

  const updateTableName = (idx: number, newName: string) => {
    setPreviewTables(prev => {
        const oldName = prev[idx].name;
        const next = [...prev];
        next[idx] = { ...next[idx], name: newName };
        setSelectedFields(fieldsPrev => {
            if (!fieldsPrev[oldName]) return fieldsPrev;
            const updated = { ...fieldsPrev };
            updated[newName] = updated[oldName];
            delete updated[oldName];
            return updated;
        });
        return next;
    });
  };

  const updateFieldName = (tableName: string, fieldId: string, newName: string) => {
    setSelectedFields(prev => {
        const currentFields = [...(prev[tableName] || [])];
        const updated = currentFields.map(f => f.id === fieldId ? { ...f, name: newName } : f);
        return { ...prev, [tableName]: updated };
    });
  };

  const onDragStart = (tableName: string, index: number) => {
    setDragInfo({ tableName, index });
  };

  const onDragOver = (e: React.DragEvent, tableName: string, index: number) => {
    e.preventDefault();
    if (!dragInfo || dragInfo.tableName !== tableName || dragInfo.index === index) return;
    setSelectedFields(prev => {
        const fields = [...(prev[tableName] || [])];
        const draggedItem = fields[dragInfo.index];
        fields.splice(dragInfo.index, 1);
        fields.splice(index, 0, draggedItem);
        setDragInfo({ tableName, index });
        return { ...prev, [tableName]: fields };
    });
  };

  const onDragEnd = () => setDragInfo(null);

  const handleConfirm = async () => {
    if (!file) return;
    setStep('processing');
    
    // AI 추출 Rows가 있다면 그것을 포함하여 전송
    const finalConfigs = previewTables.map(t => {
        const fields = selectedFields[t.name] || [];
        return {
            sheetName: t.originalSheetName,
            tableName: t.name,
            headerRowIndex: t.headerRowIndex,
            // 활성화된 필드만, 사용자 지정 이름과 함께 전달
            selectedFields: fields.filter(f => f.isActive).map(f => ({
                id: f.id,
                name: f.name,
                isRequired: f.isRequired,
                type: f.type
            })),
            isAiGenerated: aiExtractedRows.length > 0,
            initialRows: aiExtractedRows, // 이미지/PDF 분석 시 추출된 데이터
            tags: tagsInput.split(',').map(t => t.trim()).filter(t => !!t)
        };
    });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('configsJson', JSON.stringify(finalConfigs));
    
    try {
        const result = await uploadExcelAction(formData, userId);
        if (result && result.totalRejected > 0) {
            alert(`⚠️ 업로드 완료 경고\n\n${result.totalRejected}개의 데이터가 필수값이 누락되어 추가되지 않고 생략되었습니다.\n\n[누락 예시]\n${result.rejectedReasons.join('\n')}`);
        } else {
            alert('업로드가 완료되었습니다.');
        }
        window.location.reload();
    } catch (error: any) {
        alert('업로드 중 오류가 발생했습니다: ' + error.message);
        setStep('select');
    }
  };

  return (
    <div className="w-full relative">
      <div 
        ref={previewRef}
        className="fixed top-0 left-0 w-[1200px] bg-white pointer-events-none -z-[100] overflow-visible"
        style={{ opacity: 0.01 }}
        dangerouslySetInnerHTML={{ __html: excelHtml }}
      />

      {step === 'upload' && (
        <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-gray-300 rounded-[32px] bg-white hover:bg-blue-50/50 hover:border-blue-400 transition-all cursor-pointer group">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl mb-4 group-hover:scale-110 transition-transform shadow-sm">
                <Upload size={32} />
            </div>
            <p className="mb-2 text-base text-gray-700 font-black tracking-tight">엑셀, 이미지 또는 PDF 파일을 업로드하세요</p>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-bold bg-gray-100 px-3 py-1.5 rounded-full">
                <Sparkles size={14} className="text-blue-500" />
                <span>AI가 구조를 전수 분석하여 테이블을 구축해드립니다 (최대 10MB)</span>
            </div>
          </div>
          <input type="file" className="hidden" accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
        </label>
      )}

      {step === 'analyzing' && (
        <div className="bg-white p-20 border border-slate-100 rounded-[40px] shadow-2xl animate-in fade-in zoom-in duration-500 max-w-2xl mx-auto text-center">
            <div className="flex flex-col items-center mb-10">
                <div className="p-5 bg-indigo-100 text-indigo-600 rounded-3xl mb-8 shadow-inner">
                    <Sparkles size={48} className="animate-pulse" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tighter">AI가 문서 전체를 정밀 분석 중입니다</h3>
                <p className="text-slate-500 leading-relaxed mb-10 font-bold">
                    Gemini AI가 문서의 모든 페이지를 훑어보며 데이터 구조를 설계하고 있습니다.<br/>
                    표 데이터와 모든 텍스트 정보를 DB 구조로 변환 중입니다. (다국어 지원)
                </p>
                <div className="w-full max-w-xs bg-slate-100 h-2.5 rounded-full overflow-hidden relative shadow-inner">
                    <div className="bg-indigo-600 h-full absolute top-0 animate-[loading_2s_ease-in-out_infinite] rounded-full" style={{ width: '40%' }}></div>
                </div>
            </div>
        </div>
      )}

      {step === 'select' && (
        <div className="bg-white p-10 border border-slate-100 rounded-[48px] shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 mb-12 pb-10 border-b border-slate-100">
            <div className="flex items-start gap-5">
              <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-[24px] shadow-xl ring-8 ring-blue-50">
                <Sparkles size={28} />
              </div>
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">데이터베이스 구성 승인</h3>
                <p className="text-slate-500 mt-1.5 font-bold">
                    AI가 분석한 문서 구조입니다. 필드명과 타입을 확인하고 DB 구축을 승인해 주세요.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex flex-col gap-1 w-full max-w-[180px]">
                <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                    <Tag size={12} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tags (쉼표 구분)</span>
                </div>
                <input 
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="text-[11px] font-bold text-blue-600 bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-500 focus:outline-none transition-all py-0.5 px-0 w-full"
                    placeholder="예: 영업, 2026, 중요"
                />
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => applyRecommendation(previewTables, recommendations)}
                  className="flex items-center gap-2 px-6 py-4 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-colors border-2 border-slate-100 uppercase tracking-widest text-xs"
                >
                  <RotateCcw size={18} />
                  RESET
                </button>
                <button 
                  onClick={handleConfirm}
                  className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all active:scale-95 group uppercase tracking-widest text-xs"
                >
                  <Save size={18} />
                  Build DB
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            {/* LEFT: Schema Configuration */}
            <div className="xl:col-span-7 space-y-12">
                {previewTables.map((table, tIdx) => {
                const tableFields = selectedFields[table.name] || [];
                const activeCount = tableFields.filter(f => f.isActive).length;

                return (
                    <div key={tIdx} className="space-y-8">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
                                <FileText size={24} />
                            </div>
                            <div>
                                <input 
                                    type="text" 
                                    value={table.name} 
                                    onChange={(e) => updateTableName(tIdx, e.target.value)}
                                    className="font-black text-2xl text-slate-900 bg-transparent border-b-2 border-transparent focus:border-blue-500 outline-none w-full md:w-96 transition-all tracking-tight"
                                    placeholder="테이블명 입력"
                                />
                                <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-[0.2em]">Active Fields {activeCount} / Total {tableFields.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {tableFields.map((field, fIdx) => (
                            <div
                                key={field.id}
                                draggable
                                onDragStart={() => onDragStart(table.name, fIdx)}
                                onDragOver={(e) => onDragOver(e, table.name, fIdx)}
                                onDragEnd={onDragEnd}
                                className={`
                                    flex items-center gap-5 p-5 rounded-3xl border-2 transition-all group
                                    ${field.isActive ? 'bg-white border-slate-100 shadow-md' : 'bg-slate-50 border-transparent opacity-40'}
                                    ${dragInfo?.tableName === table.name && dragInfo?.index === fIdx ? 'opacity-30 border-dashed border-blue-400' : ''}
                                `}
                            >
                            <div className="cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-slate-400 transition-colors">
                                <GripVertical size={20} />
                            </div>

                            <button 
                                onClick={() => toggleField(table.name, field.id)}
                                className={`
                                    w-7 h-7 rounded-xl flex items-center justify-center transition-all
                                    ${field.isActive ? 'bg-blue-600 text-white shadow-lg' : 'border-2 border-slate-200 hover:border-blue-400'}
                                    ${field.id === '__data_id__' ? 'cursor-not-allowed' : ''}
                                `}
                            >
                                {field.isActive && <Check size={16} strokeWidth={4} />}
                            </button>

                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={field.name}
                                        onChange={(e) => updateFieldName(table.name, field.id, e.target.value)}
                                        onDragStart={(e) => e.stopPropagation()}
                                        placeholder="필드명 입력"
                                        className={`
                                            bg-transparent font-black text-base outline-none border-b-2 border-transparent focus:border-blue-400 focus:bg-slate-50 focus:px-3 py-1.5 transition-all w-full tracking-tight text-ellipsis
                                            ${field.isActive ? 'text-slate-900' : 'text-slate-400'}
                                        `}
                                    />
                                </div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                                    {field.id === '__data_id__' ? 'System Field' : `Source ID: ${field.id}`}
                                </span>
                            </div>

                            <div className="hidden sm:flex items-center gap-4">
                                <select 
                                    value={field.type} 
                                    onChange={(e) => updateFieldType(table.name, field.id, e.target.value)}
                                    className={`
                                        text-[10px] font-black bg-slate-100 border-none rounded-xl px-3 py-2 outline-none text-slate-500 transition-all uppercase tracking-widest
                                        ${field.isActive ? 'hover:bg-blue-600 hover:text-white shadow-sm' : ''}
                                    `}
                                >
                                    <option value="string">STRING</option>
                                    <option value="number">NUMBER</option>
                                    <option value="date">DATE</option>
                                    <option value="currency">CURRENCY</option>
                                    <option value="boolean">BOOLEAN</option>
                                    <option value="select">SELECT</option>
                                    <option value="textarea">TEXTAREA</option>
                                    <option value="phone">PHONE</option>
                                    <option value="email">EMAIL</option>
                                    <option value="file">FILE</option>
                                </select>

                                <button 
                                    onClick={() => toggleRequired(table.name, field.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest
                                        ${field.isRequired ? 'bg-red-50 text-red-600 border border-red-100 shadow-sm' : 'bg-slate-100 text-slate-400 border border-transparent'}
                                        ${field.id === '__data_id__' ? 'cursor-not-allowed opacity-50' : 'hover:scale-105'}
                                    `}
                                >
                                    <AlertCircle size={14} />
                                    {field.isRequired ? 'Required' : 'Optional'}
                                </button>
                                {field.id.startsWith('custom_field_') && (
                                    <button
                                        onClick={() => removeField(table.name, field.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                        title="필드 삭제"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                            </div>
                        ))}
                    </div>
                    
                    <button 
                        onClick={() => addField(table.name)}
                        className="mt-4 flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-slate-200 text-slate-400 font-black rounded-3xl hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all uppercase tracking-widest text-xs group"
                    >
                        <Edit3 size={16} className="group-hover:scale-110 transition-transform" />
                        Add New Field
                    </button>
                    </div>
                );
                })}
            </div>

            {/* RIGHT: Data Preview & File Preview */}
            <div className="xl:col-span-5 space-y-10">
                {/* 1. File Preview */}
                <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-inner group">
                    <div className="flex items-center gap-3 mb-6">
                        <Camera size={20} className="text-slate-400" />
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Document Source Preview</h4>
                    </div>
                    <div className="aspect-[4/3] bg-white rounded-3xl border border-slate-200 overflow-hidden flex items-center justify-center relative shadow-sm">
                        {filePreviewUrl ? (
                            <img src={filePreviewUrl} alt="Preview" className="w-full h-full object-contain" />
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-slate-300">
                                <FileDigit size={64} strokeWidth={1} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{file?.name}</span>
                            </div>
                        )}
                        <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
                            Source Document
                        </div>
                    </div>
                </div>

                {/* 2. Extracted Data Preview (AI Rows) */}
                {aiExtractedRows.length > 0 && (
                    <div className="bg-blue-50/50 p-8 rounded-[40px] border border-blue-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <Sparkles size={20} className="text-blue-500" />
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">AI Extracted Data Sample</h4>
                        </div>
                        <div className="space-y-4">
                            {aiExtractedRows.slice(0, 5).map((row, rIdx) => (
                                <div key={rIdx} className="bg-white p-5 rounded-2xl border border-blue-50 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${rIdx * 100}ms` }}>
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.entries(row).slice(0, 4).map(([key, value]: [string, any]) => (
                                            <div key={key} className="min-w-0">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{key}</p>
                                                <p className="text-xs font-bold text-slate-800 truncate">{value?.toString() || '-'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {aiExtractedRows.length > 5 && (
                                <div className="text-center pt-2">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">And {aiExtractedRows.length - 5} more records identified...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
          </div>
          
          <div className="mt-16 bg-slate-900 p-12 rounded-[48px] flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent opacity-50"></div>
              <div className="relative z-10">
                <div className="w-20 h-20 bg-blue-600 text-white rounded-[32px] flex items-center justify-center shadow-2xl mb-8 mx-auto ring-8 ring-blue-500/20">
                    <DatabaseIcon size={40} />
                </div>
                <h4 className="text-3xl font-black text-white mb-3 tracking-tighter">데이터베이스 구축 준비 완료</h4>
                <p className="text-slate-400 mb-10 max-w-lg font-bold">
                    AI가 분석한 문서의 미세한 맥락까지 반영하여 비즈니스에 최적화된 고성능 데이터베이스를 생성합니다.<br/>
                    구축 시작 클릭 시 모든 데이터 연동이 즉시 완료됩니다.
                </p>
                <button 
                    onClick={handleConfirm}
                    className="flex items-center gap-4 px-20 py-6 bg-white text-slate-900 text-2xl font-black rounded-[28px] hover:bg-blue-50 shadow-2xl transition-all hover:-translate-y-2 active:scale-95 group tracking-tighter"
                >
                    지능형 DB 구축 시작하기
                    <ChevronRight size={28} className="group-hover:translate-x-1 transition-transform text-blue-600" />
                </button>
              </div>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center p-24 bg-white border border-slate-100 rounded-[56px] shadow-2xl text-center animate-in fade-in zoom-in duration-500">
          <div className="relative w-32 h-32 mb-10">
              <div className="absolute inset-0 border-[10px] border-slate-50 rounded-full"></div>
              <div className="absolute inset-0 border-[10px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                  <DatabaseIcon size={48} />
              </div>
          </div>
          <h3 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">엔터프라이즈 DB 최적화 중...</h3>
          <p className="text-slate-400 max-w-sm mx-auto leading-relaxed font-bold">
              선택하신 필드와 AI 추출 데이터를 결합하여 서비스 운영을 위한 지능형 데이터 스키마를 구성하고 있습니다.
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes loading {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
