'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveFormSubmissionAction } from '@/app/actions/form-studio';
import { ArrowLeft, Save, Download, Loader2, User, FileText } from 'lucide-react';
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
      
      // html2canvas로 캡처
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      // A4 비율 계산
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
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
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/workspace/forms" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900">{template.name}</h1>
            <p className="text-xs text-slate-500 font-medium">연결된 소스: {template.sourceTable || '없음'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            진행상태 저장
          </button>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Data Selection */}
        <div className="w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto shrink-0 z-10">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <User size={16} className="text-blue-500" />
              데이터 대상 선택
            </h3>
            <p className="text-xs text-slate-500 mb-3">아래 목록에서 대상을 선택하면 양식의 빈칸이 자동으로 채워집니다.</p>
            <select 
              value={selectedRowIndex}
              onChange={handleRowSelect}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">직접 입력 (선택 안함)</option>
              {sourceData.map((row, idx) => (
                <option key={idx} value={idx}>
                  {Object.values(row)[0] || `항목 #${idx + 1}`} - {Object.values(row)[1] || ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <FileText size={16} className="text-blue-500" />
              수기 입력 항목
            </h3>
            <p className="text-xs text-slate-500 mb-4">우측 화면의 빈칸을 직접 클릭하여 입력할 수도 있습니다.</p>
            
            <div className="space-y-4">
              {mappings.map(mapping => {
                const autoValue = selectedRow ? String(selectedRow[mapping.columnKey] || '') : '';
                return (
                  <div key={mapping.id}>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{mapping.columnKey}</label>
                    <input 
                      type="text"
                      value={autoValue || manualInputs[mapping.id] || ''}
                      onChange={(e) => handleManualInputChange(mapping.id, e.target.value)}
                      disabled={!!autoValue}
                      placeholder="입력..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm disabled:opacity-60 disabled:bg-slate-100"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Canvas: Print Area */}
        <div className="flex-1 bg-slate-100 overflow-auto p-8 flex items-start justify-center">
          <div 
            ref={printRef}
            className="relative bg-white shadow-xl"
            style={{ width: '800px', minHeight: '1131px' }} // A4 proportions roughly
          >
            {/* Background Image */}
            {template.backgroundImageData && (
              <img 
                src={template.backgroundImageData} 
                alt="Form Background" 
                className="absolute inset-0 w-full h-full object-contain"
                style={{ objectPosition: 'top center' }}
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
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleManualInputChange(mapping.id, e.target.value)}
                    style={{ fontSize: `${mapping.fontSize}px` }}
                    className={`bg-transparent outline-none border-b border-dashed border-transparent hover:border-blue-300 focus:border-blue-500 font-medium text-slate-900 transition-colors px-1 w-auto ${autoValue ? 'pointer-events-none' : ''}`}
                    placeholder={`[${mapping.columnKey}]`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
