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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const printRef = useRef<HTMLDivElement>(null);
  const mappings: any[] = template?.mappingConfig ? JSON.parse(template.mappingConfig) : [];

  const handleRowSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRowIndex(e.target.value === '' ? '' : parseInt(e.target.value));
  };

  const selectedRow = selectedRowIndex !== '' ? sourceData[selectedRowIndex] : null;

  const handleManualInputChange = (id: string, value: string) => {
    setManualInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveFormSubmissionAction({
        templateId: template.id,
        userId: 'currentUser', // TODO: 실제 로그인 유저 연동
        customerData: JSON.stringify(selectedRow || {}),
        manualInputs: JSON.stringify(manualInputs)
      });
      if (result.success) {
        alert('문서가 저장되었습니다.');
      } else {
        alert('저장 실패: ' + result.error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    
    try {
      const element = printRef.current;
      
      // 캡처를 위해 일시적으로 너비를 800px로 고정 (폰트 스케일링 일치 목적)
      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      const originalAspectRatio = element.style.aspectRatio;
      
      element.style.width = '800px';
      element.style.maxWidth = 'none';
      element.style.aspectRatio = '1 / 1.414';
      
      // html2canvas 옵션 최적화
      const canvas = await html2canvas(element, { 
        scale: 2, // 3은 너무 무거울 수 있으므로 2로 조정하되 품질 유지
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
      });
      
      // 스타일 복구
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.aspectRatio = originalAspectRatio;
      
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210; // A4 가로 (mm)
      const pageHeight = 297; // A4 세로 (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // 이미지가 한 페이지보다 길 경우 여러 페이지로 나누지 않고 한 페이지에 맞춤 (또는 비율대로 출력)
      // 여기서는 단일 페이지 견적서 기준이므로 비율에 맞춰 첫 페이지에 삽입
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${template.name}_${new Date().getTime()}.pdf`);
      
    } catch (error) {
      console.error('PDF 다운로드 오류:', error);
      alert('PDF 변환 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header Panel */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/workspace/forms" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-lg transition-colors ${isSidebarOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <Menu size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">{template.name}</h1>
            <p className="text-xs text-slate-500 font-medium">연결된 소스: {template.sourceTable || '없음'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-2"
          >
            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            PDF 다운로드
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: Data Selection Only (Toggleable Overlay) */}
        <div className={`absolute top-0 left-0 bottom-0 w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto shrink-0 z-30 transition-all duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <User size={16} className="text-blue-500" />
              데이터 대상 선택
            </h3>
            <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">조회할 데이터를 아래 목록에서 선택하세요. 양식의 빈칸이 자동으로 채워집니다.</p>
          <select 
            value={selectedRowIndex}
            onChange={handleRowSelect}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">데이터 선택...</option>
            {sourceData.map((row, idx) => {
              // 우선적으로 표시할 필드명 후보
              const priorityKeys = ['견적번호', '관리번호', '번호', '성명', '이름', '거래처명', '명칭', 'title', 'name'];
              let label = '';
              
              for (const key of priorityKeys) {
                if (row[key]) {
                  label = String(row[key]);
                  break;
                }
              }
              
              if (!label) {
                label = Object.values(row)[0] || `항목 #${idx + 1}`;
              }

              // 보조 정보 (이름이나 날짜 등 다른 값이 있다면 괄호 안에 표시)
              const subValue = Object.values(row).find(v => v !== label && typeof v === 'string' && String(v).length > 0);

              return (
                <option key={idx} value={idx}>
                  {label} {subValue ? `(${subValue})` : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Right Canvas: Print Area */}
        <div className="flex-1 bg-slate-100 overflow-auto p-8 flex items-start justify-center">
          <div 
            ref={printRef}
            className="relative bg-white shadow-xl shrink-0 mx-auto"
            style={{ 
              width: '100%', 
              maxWidth: '800px', 
              aspectRatio: '1 / 1.414',
              containerType: 'inline-size' 
            }}
          >
            {/* Background Image */}
            {template.backgroundImageData && (
              <img 
                src={template.backgroundImageData} 
                alt="Form Background" 
                className="absolute inset-0 w-full h-full object-fill"
                crossOrigin="anonymous"
              />
            )}

            {/* Overlay Inputs */}
            {mappings.map(mapping => {
              // 선택된 행에 값이 있으면 사용, 없으면 수기 입력값 사용
              const autoValue = selectedRow ? String(selectedRow[mapping.columnKey] || '') : '';
              const value = autoValue || manualInputs[mapping.id] || '';

              return (
                <div 
                  key={mapping.id}
                  className="absolute"
                  style={{ 
                    left: `${mapping.x}%`, 
                    top: `${mapping.y}%`,
                    transform: 'translate(0, -50%)',
                  }}
                >
                  <div
                    style={{ 
                      // 800px 기준 비율 계산: (mapping.fontSize / 800) * 100 = fontSize * 0.125 cqw
                      fontSize: `${mapping.fontSize * 0.125}cqw`,
                      whiteSpace: 'nowrap',
                      color: '#000',
                      lineHeight: '1',
                      padding: '0 0.5cqw',
                      margin: '0',
                      fontFamily: 'inherit',
                      fontWeight: '500'
                    }}
                  >
                    {value || `[${mapping.columnKey}]`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
