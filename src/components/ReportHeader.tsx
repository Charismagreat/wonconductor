'use client';

import React, { useState } from 'react';
import { FileText, Edit2, Check, X, Settings, ShieldCheck, Link, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { renameReportAction } from '@/app/actions/report';
import { ColumnDefinition } from '@/lib/excel-parser';
import { SchemaEditor } from './SchemaEditor';

interface ReportHeaderProps {
  reportId: string;
  initialName: string;
  sheetName: string;
  createdAt: string;
  isOwner: boolean;
  isAdmin?: boolean;
  canEdit?: boolean;
  isReadOnly?: boolean;
  initialColumns: ColumnDefinition[];
  initialTags?: string[];
  initialUiConfig?: any;
  rowCount?: number;
  tableName?: string;
  onToggleAccessManager?: () => void;
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
        className={`px-1.5 py-0.5 rounded text-[9px] font-black border uppercase tracking-tight inline-flex items-center gap-1 ${colors[color] || colors.blue}`}
        style={{ transform: `scale(${scale})`, transformOrigin: 'left center' }}
      >
        {children}
      </span>
    );
  };

export function ReportHeader({ 
  reportId, 
  initialName, 
  sheetName, 
  createdAt, 
  isOwner, 
  isAdmin, 
  canEdit,
  isReadOnly = false,
  initialColumns, 
  initialTags = [],
  initialUiConfig = {},
  rowCount,
  tableName,
  onToggleAccessManager
}: ReportHeaderProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    if (name.trim() === '' || name === initialName) {
      setIsEditing(false);
      setName(initialName);
      return;
    }

    setPending(true);
    try {
      await renameReportAction(reportId, name);
      setIsEditing(false);
    } catch (error) {
      alert('이름 변경 중 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  };

  const handleShare = async () => {
    const currentPath = window.location.pathname;
    const basePath = currentPath.replace(/\/(dashboard|report|share).*$/, '');
    const shareUrl = `${window.location.origin}${basePath}/report/${reportId}/input`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('URL 복사에 실패했습니다.');
    }
  };

  return (
    <>
      <section className="animate-in fade-in slide-in-from-top-4 duration-500 mb-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Left Side: Title & Info */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-4 animate-in zoom-in-95 duration-300">
                <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-500/20">
                  <FileText size={24} strokeWidth={2.5} />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    className="text-3xl font-bold text-slate-900 border-b-4 border-blue-500 bg-transparent outline-none py-1 w-full max-w-xl"
                    disabled={pending}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={handleSave}
                      disabled={pending}
                      className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all active:scale-90"
                    >
                      <Check size={20} strokeWidth={3} />
                    </button>
                    <button 
                      onClick={() => { setIsEditing(false); setName(initialName); }}
                      disabled={pending}
                      className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 transition-all active:scale-90"
                    >
                      <X size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="group relative">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => router.back()}
                    className="p-3 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-90 mr-2"
                    title="목록으로 돌아가기"
                  >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                  </button>
                  <h1 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3 font-[family-name:var(--font-geist-sans)] leading-tight">
                    {name}
                    <FileText className="text-blue-600 shrink-0" size={24} />
                    {isOwner && !isReadOnly && (
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                        title="이름 수정"
                      >
                        <Edit2 size={24} />
                      </button>
                    )}
                  </h1>
                  {isReadOnly && (
                    <div className="px-4 py-1.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-[0.25em] rounded-full border border-amber-200 shadow-sm animate-pulse shrink-0">
                      Read Only
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  <div className="text-slate-500 font-bold leading-relaxed max-w-2xl flex flex-wrap items-center gap-3">
                    <LocalBadge color="blue" scale={1.1}>
                        REPO: {sheetName}
                    </LocalBadge>
                    {(tableName || id) && (
                        <LocalBadge color="slate" scale={1.1}>
                            SOURCE: {tableName || id}
                        </LocalBadge>
                    )}
                    {initialTags.length > 0 && initialTags.map((tag, idx) => (
                      <div key={idx} className="bg-white text-blue-600 px-3 py-1 rounded-full text-[10px] font-black border border-blue-100 flex items-center gap-1.5 shadow-sm shrink-0">
                        <span className="w-1 h-1 bg-blue-400 rounded-full" />
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </div>
                    ))}
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                        <span>Synchronized at {new Date(createdAt).toLocaleString()}</span>
                        {rowCount !== undefined && (
                            <>
                                <span className="text-slate-200">|</span>
                                <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">{rowCount.toLocaleString()} Records Detected</span>
                            </>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            {!isReadOnly && canEdit && (
              <>
                {(isAdmin || isOwner) && (
                  <button 
                    onClick={onToggleAccessManager}
                    className="flex items-center gap-2 px-8 py-4 bg-white text-slate-500 font-black rounded-[20px] border border-slate-100 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50/50 transition-all shadow-xl shadow-slate-900/5 active:scale-95 text-xs uppercase tracking-widest"
                  >
                    <ShieldCheck size={18} strokeWidth={2.5} />
                    Permissions
                  </button>
                )}

                <button 
                  onClick={handleShare}
                  className={`
                    flex items-center gap-2 px-8 py-4 font-black rounded-[20px] transition-all text-xs uppercase tracking-widest active:scale-95 border
                    ${copied 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-500/30 scale-105' 
                        : 'bg-white border-slate-100 text-slate-500 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50/50 shadow-xl shadow-slate-900/5'
                    }
                  `}
                >
                  {copied ? (
                    <>
                      <Check size={18} strokeWidth={3} className="text-white" />
                      URL Copied!
                    </>
                  ) : (
                    <>
                      <Link size={18} strokeWidth={2.5} />
                      Share Link
                    </>
                  )}
                </button>
              </>
            )}
            
            {!isReadOnly && (isOwner || isAdmin) && (
              <button 
                onClick={() => setShowConfig(true)}
                className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-black rounded-[20px] hover:bg-blue-600 transition-all text-xs uppercase tracking-widest active:scale-95 shadow-2xl shadow-slate-900/20 group"
              >
                <Settings size={18} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-500" />
                Table Config
              </button>
            )}
          </div>
        </div>
      </section>

      {showConfig && (
        <SchemaEditor 
          reportId={reportId}
          initialName={name}
          initialColumns={initialColumns}
          initialTags={initialTags}
          initialUiConfig={initialUiConfig}
          onClose={() => setShowConfig(false)}
        />
      )}
    </>
  );
}
