'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveFormSubmissionAction } from '@/app/actions/form-studio';
import { ArrowLeft, Save, Download, Loader2, User, FileText, Menu, X } from 'lucide-react';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props {
  template: any;
  sourceData: any[];
}

export default function FormFillClient({ template, sourceData }: Props) {
  const router = useRouter();
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | ''>('');
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 모바일 편의를 위해 기본값 false
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  
  const viewMode = (template.formType?.toLowerCase() || 'classic') as 'classic' | 'modern' | 'html';
  
  const mappings: any[] = template?.mappingConfig ? JSON.parse(template.mappingConfig) : [];
  const webLayout: any = template?.webLayoutConfig && template.formType !== 'HTML' ? JSON.parse(template.webLayoutConfig) : { sections: [] };
  const htmlContent = template.formType === 'HTML' ? template.webLayoutConfig : '';

  // 화면 크기에 맞춰 스케일 자동 조절 로직 (너비와 높이 모두 고려)
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !printRef.current) return;
      
      const containerWidth = containerRef.current.clientWidth; 
      const formWidth = viewMode === 'html' ? 800 : 850; 
      
      // 너비 기준 스케일 계산
      let newScale = 1;
      if (containerWidth < formWidth) {
        newScale = containerWidth / formWidth;
      }
      
      setScale(newScale);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 350); 
    
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode, isSidebarOpen]);

  const handleRowSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRowIndex(e.target.value === '' ? '' : parseInt(e.target.value));
  };

  const selectedRow = selectedRowIndex !== '' ? sourceData[selectedRowIndex] : null;

  useEffect(() => {
    if (viewMode === 'html' && printRef.current) {
      const inputs = printRef.current.querySelectorAll('input, textarea, select');
      inputs.forEach((input: any) => {
        const name = input.getAttribute('name');
        if (name) {
          const value = selectedRow ? (selectedRow[name] ?? '') : (manualInputs[name] ?? '');
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
  }, [viewMode, selectedRow, manualInputs, htmlContent]);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    
    try {
      const originalElement = printRef.current;
      const isHtml = viewMode === 'html';
      
      // 1. 클론 생성을 위한 임시 컨테이너 (화면 밖으로 배치)
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = isHtml ? '1000px' : '850px';
      document.body.appendChild(tempContainer);
      
      // 2. 요소 복제 및 스타일 정규화
      const clonedElement = originalElement.cloneNode(true) as HTMLDivElement;
      
      // 내부 .paper 또는 첫 번째 div가 실제 문서 영역인 경우가 많음
      const paperElement = isHtml ? (clonedElement.querySelector('.paper') || clonedElement.querySelector('div')) : null;
      const targetElement = (isHtml && paperElement) ? paperElement : clonedElement;
      
      // 클론과 타겟 요소의 모든 여백/그림자 강제 제거
      const stripStyles = (el: HTMLElement) => {
        el.style.margin = '0';
        el.style.padding = '0';
        el.style.boxShadow = 'none';
        el.style.border = 'none';
        el.style.borderRadius = '0';
        el.style.transform = 'none';
      };
      
      stripStyles(clonedElement);
      if (isHtml && paperElement) stripStyles(paperElement as HTMLElement);
      
      clonedElement.style.width = isHtml ? '1000px' : '850px';
      clonedElement.style.height = isHtml ? 'auto' : `${850 * 1.414}px`;
      clonedElement.style.display = 'block';
      clonedElement.style.overflow = 'visible';
      
      // HTML 모드일 경우 Input 값 수동 복사
      if (isHtml) {
        const originalInputs = originalElement.querySelectorAll('input, textarea, select');
        const clonedInputs = clonedElement.querySelectorAll('input, textarea, select');
        originalInputs.forEach((input: any, index: number) => {
          if (clonedInputs[index]) (clonedInputs[index] as any).value = input.value;
        });
      }
      
      tempContainer.appendChild(clonedElement);
      
      // 3. 타겟 요소를 기준으로 캡처 (여백 방지)
      const canvas = await html2canvas(targetElement as HTMLElement, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: isHtml ? 1000 : 850,
        width: isHtml ? (targetElement as HTMLElement).offsetWidth : 850,
        height: isHtml ? (targetElement as HTMLElement).offsetHeight : 850 * 1.414,
      });
      
      // 4. 임시 컨테이너 제거
      document.body.removeChild(tempContainer);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = isHtml ? (canvas.height * imgWidth) / canvas.width : pageHeight;
      
      // PDF 삽입 (여백 없이 꽉 채움)
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      pdf.save(`${template.name}_${new Date().getTime()}.pdf`);
      
    } catch (error) {
      console.error('PDF 다운로드 오류:', error);
      alert('PDF 변환 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-full bg-white relative overflow-hidden -mx-4 -mt-6 w-[calc(100%+2rem)]">
      {/* Page Header: Sticky at the top of the content area */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/workspace/forms" className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all active:scale-90">
            <ArrowLeft size={20} />
          </Link>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-xl transition-all ${isSidebarOpen ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-slate-900 truncate max-w-[120px] xs:max-w-none">{template.name}</h1>
            <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest">{template.formType}</span>
          </div>
        </div>

        <button 
          onClick={handleDownloadPDF}
          disabled={isDownloading}
          className="px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          <span>PDF</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-30 animate-in fade-in duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`absolute top-0 left-0 bottom-0 w-72 bg-white p-6 overflow-y-auto shrink-0 z-40 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-slate-100 custom-scrollbar`}>
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">데이터 선택</h3>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400"><X size={18} /></button>
            </div>
            
            <div className="flex flex-col gap-4">
              <select 
                value={selectedRowIndex}
                onChange={handleRowSelect}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 transition-all appearance-none cursor-pointer"
              >
                <option value="">데이터 선택...</option>
                {sourceData.map((row, idx) => {
                  const priorityKeys = ['견적번호', '관리번호', '번호', '성명', '이름', '거래처명', '명칭', 'title', 'name'];
                  let label = '';
                  for (const key of priorityKeys) {
                    if (row[key]) {
                      label = String(row[key]);
                      break;
                    }
                  }
                  if (!label) label = Object.values(row)[0] || `항목 #${idx + 1}`;
                  return (
                    <option key={idx} value={idx}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-400 leading-relaxed font-medium">데이터를 선택하면 양식에 즉시 반영됩니다.</p>
            </div>
          </div>
        </div>

        {/* Form Canvas Area: No padding, White background for edge-to-edge */}
        <div 
          ref={containerRef} 
          className="flex-1 overflow-auto p-0 flex items-start justify-center custom-scrollbar bg-white"
        >
          <div 
            ref={printRef}
            className="relative bg-white shrink-0 transition-all duration-500 ease-out origin-top"
            style={{ 
              width: viewMode === 'html' ? '800px' : '850px',
              transform: `scale(${scale})`,
              aspectRatio: viewMode === 'html' ? 'auto' : '1 / 1.414',
              containerType: 'inline-size',
              marginBottom: `${60 * scale}px`
            }}
          >
            {viewMode === 'html' ? (
              <div 
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: htmlContent }} 
              />
            ) : (
              <>
                {template.backgroundImageData && (
                  <img 
                    src={template.backgroundImageData} 
                    alt="Form Background" 
                    className="absolute inset-0 w-full h-full object-fill"
                    crossOrigin="anonymous"
                  />
                )}

                {viewMode === 'classic' && mappings.map(mapping => {
                  const rawValue = selectedRow ? (selectedRow[mapping.columnKey] ?? '') : '';
                  const value = String(rawValue || manualInputs[mapping.id] || '');
                  const isNumeric = value !== '' && !isNaN(Number(value.replace(/,/g, '')));
                  const displayValue = isNumeric ? Number(value.replace(/,/g, '')).toLocaleString() : value;
                  const alignment = mapping.textAlign || (isNumeric ? 'right' : 'left');
                  const width = mapping.width || 15;

                  return (
                    <div 
                      key={mapping.id}
                      className="absolute"
                      style={{ 
                        left: `${mapping.x}%`, 
                        top: `${mapping.y}%`,
                        transform: 'translate(0, -50%)',
                        width: `${width}%`,
                      }}
                    >
                      <div
                        style={{ 
                          fontSize: `${mapping.fontSize * 0.125}cqw`,
                          whiteSpace: 'nowrap',
                          color: '#000',
                          lineHeight: '1',
                          padding: '0 0.5cqw',
                          textAlign: alignment,
                          display: 'flex',
                          justifyContent: alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start',
                          fontWeight: '500'
                        }}
                      >
                        {displayValue}
                      </div>
                    </div>
                  );
                })}
                
                {viewMode === 'modern' && (
                  <div className="absolute inset-0 p-[5cqw] flex flex-col gap-[3cqw] overflow-auto custom-scrollbar">
                    {webLayout.sections.map((section: any, sIdx: number) => (
                      <div key={sIdx} className="flex flex-col gap-[1.5cqw]">
                        <div className="flex items-center gap-[1.5cqw]">
                          <h4 className="text-[1.2cqw] font-black text-slate-800 uppercase tracking-widest min-w-fit">{section.title}</h4>
                          <div className="h-px bg-slate-200 flex-1" />
                        </div>
                        <div className="grid grid-cols-4 gap-[1.5cqw]">
                          {section.fields.map((field: any, fIdx: number) => {
                            const value = selectedRow ? (selectedRow[field.columnKey] ?? '') : (manualInputs[field.columnKey] ?? '');
                            return (
                              <div 
                                key={fIdx} 
                                className={`flex flex-col gap-[0.5cqw] ${
                                  field.colSpan === 4 ? 'col-span-4' : 
                                  field.colSpan === 3 ? 'col-span-3' :
                                  field.colSpan === 2 ? 'col-span-2' : 'col-span-1'
                                }`}
                              >
                                <label className="text-[0.8cqw] font-black text-slate-400 uppercase tracking-widest ml-[0.2cqw]">
                                  {field.label}
                                </label>
                                <div className="w-full px-[1.2cqw] py-[1cqw] bg-slate-50 border-[0.1cqw] border-slate-200 rounded-[0.8cqw] text-[1.1cqw] font-bold text-slate-800">
                                  {value || <span className="opacity-20 text-[0.9cqw]">미입력</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
