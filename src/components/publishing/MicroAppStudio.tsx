'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Database, 
  ExternalLink, 
  Trash2, 
  Rocket,
  Eye,
  CheckCircle2,
  Sparkles,
  Palette,
  Settings,
  Edit2,
  Edit3,
  Check,
  X,
  ShieldCheck,
  FileText,
  Search,
  Layout,
  Bot,
  RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  addSourcesToProjectAction, 
  removeSourceFromProjectAction,
  removeAllSourcesFromProjectAction,
  publishProjectAction,
  updateMicroAppProjectAction
} from '@/app/actions/micro-app';
import { getAISuggestedProjectSetupAction } from '@/app/actions/publishing';
import { SourceSelectorModal } from './SourceSelectorModal';
import { TemplateRenderer } from './TemplateRenderer';

interface MicroAppStudioProps {
  project: any;
  user: any;
}

export function MicroAppStudio({ project, user }: MicroAppStudioProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPublishChoiceModalOpen, setIsPublishChoiceModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(project.name);
  const [pending, setPending] = useState(false);
  const [isAIPromptModalOpen, setIsAIPromptModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(project.tags?.join(', ') || '');
  const [customHtml, setCustomHtml] = useState(project.uiSettings.customHtml || '');
  const [customCss, setCustomCss] = useState(project.uiSettings.customCss || '');
  const [tableDisplayName, setTableDisplayName] = useState(project.uiSettings?.tableDisplayName || '');
  const [sourceSchemas, setSourceSchemas] = useState<any[]>([]);
  const router = useRouter();
  
  // 소스 스키마 정보 가져오기
  useEffect(() => {
    let active = true;
    const fetchSchemas = async () => {
      if (project.sources.length > 0) {
        const { getProjectSourceSchemasAction } = await import('@/app/actions/publishing');
        const res = await getProjectSourceSchemasAction(project.sources.map((s: any) => s.id));
        if (active && res.success) {
          setSourceSchemas(res.schemas);
        }
      }
    };
    fetchSchemas();
    return () => { active = false; };
  }, [project.sources]);

  useEffect(() => {
    setIsMounted(true);
    console.log(`[MicroAppStudio] Project Loaded: "${project.name}" (ID: ${project.id})`);
  }, [project.id, project.name]);

  const handleSaveName = async () => {
    if (name.trim() === '' || name === project.name) {
      setIsEditingName(false);
      setName(project.name);
      return;
    }

    setPending(true);
    try {
      await updateMicroAppProjectAction(project.id, { name });
      setIsEditingName(false);
    } catch (error) {
      alert('이름 변경 중 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  };

  const handleAddTag = async (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (e.type === 'blur' || (e.type === 'keydown' && (e as React.KeyboardEvent).key === 'Enter')) {
      const tagInput = e.currentTarget as HTMLInputElement;
      const tagValue = tagInput.value.trim().replace(/^#/, '');
      if (tagValue && !project.tags.includes(tagValue)) {
        const newTags = [...project.tags, tagValue];
        setPending(true);
        try {
          const res = await updateMicroAppProjectAction(project.id, { tags: newTags });
          if (res.success) {
            tagInput.value = '';
            router.refresh();
          } else {
            alert(`태그 추가 실패: ${res.error}`);
          }
        } catch (error: any) {
          alert('태그 추가 중 통신 오류가 발생했습니다.');
        } finally {
          setPending(false);
        }
      } else if (tagValue === '') {
        // 비어있는 상태로 Blur 시 입력창 초기화
        tagInput.value = '';
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const newTags = project.tags.filter((t: string) => t !== tagToRemove);
    setPending(true);
    try {
      const res = await updateMicroAppProjectAction(project.id, { tags: newTags });
      if (res.success) {
        router.refresh();
      } else {
        alert(`태그 삭제 실패: ${res.error}`);
      }
    } catch (error: any) {
      alert('태그 삭제 중 통신 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  };

  const handleDesignRefresh = async () => {
    if (!window.confirm('현재 데이터 매핑은 유지한 채, 디자인 스타일(테마, 설명 등)만 새롭게 제안받으시겠습니까?')) return;
    
    setPending(true);
    try {
      const { getAIDesignRefreshAction } = await import('@/app/actions/publishing');
      const suggestion = await getAIDesignRefreshAction(project.id);
      
      if (suggestion.success) {
        alert(`디자인 리프레시 완료: ${suggestion.data.uiSettings.description}`);
        
        await updateMicroAppProjectAction(project.id, {
          uiSettings: { 
            ...suggestion.data.uiSettings, 
            tags: project.tags 
          }
        });
        router.refresh();
      } else {
        alert(`디자인 추천 실패: ${suggestion.error}`);
      }
    } catch (e) {
      alert('디자인 리프레시 중 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  };

  const handleAISuggest = async () => {
    if (project.sources.length === 0) {
      alert('AI 디자인 추천을 받으려면 최소 하나 이상의 데이터 소스를 먼저 추가해야 합니다.');
      return;
    }

    setIsAIPromptModalOpen(false);
    console.log('[MicroAppStudio] AI Suggestion Started');
    setPending(true);
    try {
      // 입력받은 프롬프트를 태그로 변환하여 서버에 저장
      const newTags = aiPrompt.split(',').map((t: string) => t.trim()).filter(Boolean);
      await updateMicroAppProjectAction(project.id, { tags: newTags });
      
      const suggestion = await getAISuggestedProjectSetupAction(project.id);
      console.log('[MicroAppStudio] AI Suggestion Result:', suggestion);
      
      if (suggestion.success) {
        alert(`AI 추천 완료: ${suggestion.data.uiSettings.description}\n\n추천된 디자인과 매핑이 프로젝트에 적용되었습니다. 이제 발행 버튼을 눌러 발행하세요!`);
        
        // AI 추천 설정을 프로젝트에 저장 (태그 정보 포함)
        await updateMicroAppProjectAction(project.id, {
          templateId: suggestion.data.templateId,
          mappingConfig: suggestion.data.mappingConfig,
          uiSettings: { 
            ...suggestion.data.uiSettings, 
            tags: project.tags 
          }
        });
      } else {
        console.error('[MicroAppStudio] AI Suggestion Failed:', suggestion.error);
        alert(`AI 추천 실패: ${suggestion.error || '알 수 없는 오류가 발생했습니다.'}`);
      }
      
      router.refresh();
    } catch (e) {
      alert('AI 추천 중 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    if (!confirm('이 데이터 소스를 프로젝트에서 제거하시겠습니까?')) return;
    try {
      await removeSourceFromProjectAction(project.id, sourceId);
    } catch (e) {
      alert('소스 제거에 실패했습니다.');
    }
  };

  const handleResetSources = async () => {
    if (!confirm('연결된 모든 데이터 소스를 제거하시겠습니까? 이 작업은 취소할 수 없습니다.')) return;
    
    setPending(true);
    try {
      const res = await removeAllSourcesFromProjectAction(project.id);
      if (res.success) {
        router.refresh();
      } else {
        alert('초기화에 실패했습니다.');
      }
    } catch (e) {
      alert('초기화 중 오류가 발생했습니다.');
    } finally {
      setPending(false);
    }
  };

  const handlePublish = async () => {
    if (project.sources.length === 0) {
      alert('최소 하나 이상의 데이터 소스가 필요합니다.');
      return;
    }

    if (project.status === 'PUBLISHED') {
      setIsPublishChoiceModalOpen(true);
    } else {
      await executePublish(false);
    }
  };

  const executePublish = async (asNew: boolean) => {
    setIsPublishChoiceModalOpen(false);
    setIsPublishing(true);
    try {
      if (asNew) {
        const { duplicateAndPublishProjectAction } = await import('@/app/actions/micro-app');
        const res = await duplicateAndPublishProjectAction(project.id);
        if (res.success) {
          alert('새로운 앱으로 복제 및 발행되었습니다!');
          router.push('/publishing');
        } else {
          alert(`새 앱 발행 실패: ${res.error}`);
        }
      } else {
        const res = await publishProjectAction(project.id);
        if (res.success) {
          alert('앱이 성공적으로 발행되었습니다!');
          router.push('/publishing');
        } else {
          alert(`발행 실패: ${res.error}`);
        }
      }
    } catch (e) {
      alert('발행 중 통신 오류가 발생했습니다.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleAddSources = async (sources: any[]) => {
    await addSourcesToProjectAction(project.id, sources);
    setIsModalOpen(false);
    router.refresh();
  };

  const openInMyDB = (tableId: string) => {
    window.open(`/report/${tableId}`, '_blank');
  };

  if (!isMounted) return null;

  return (
    <main className="max-w-[1600px] mx-auto px-8 md:px-12 pt-6 pb-32 space-y-10 animate-in fade-in duration-700">
      
      {/* 1. Header Area - Matched with MY DB Table View */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex flex-col gap-2 w-full max-w-xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-4">
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    placeholder="앱 이름 (예: 자금보고서 #CEO #심플)"
                    className="text-3xl font-bold text-slate-900 border-b-4 border-blue-500 bg-transparent outline-none py-1 w-full"
                    disabled={pending}
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={handleSaveName} disabled={pending} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-90"><Check size={20} strokeWidth={3} /></button>
                    <button onClick={() => { setIsEditingName(false); setName(project.name); }} disabled={pending} className="p-3 bg-slate-100 text-slate-400 rounded-2xl transition-all active:scale-90"><X size={20} strokeWidth={3} /></button>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-blue-500/70 flex items-center gap-1.5 px-1">
                  <Sparkles size={12} />
                  이름 뒤에 #태그를 넣어보세요. AI가 디자인과 정보를 맞춤형으로 추천합니다.
                </p>
              </div>
            ) : (
              <div className="group">
                <div className="flex items-center gap-4">
                  <Link 
                    href="/publishing"
                    className="p-3 bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-90 mr-2"
                    title="앱 스튜디오 목록으로 돌아가기"
                  >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                  </Link>
                  <h1 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3 font-[family-name:var(--font-geist-sans)] leading-tight uppercase">
                    {project.name}
                    <Rocket className="text-blue-600 shrink-0" size={24} />
                    <button onClick={() => setIsEditingName(true)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100" title="이름 수정"><Edit2 size={24} /></button>
                  </h1>
                  <div className="px-4 py-1.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-[0.25em] rounded-full border border-amber-200 shadow-sm shrink-0">
                    Project Draft
                  </div>
                </div>

                
                <div className="flex items-center gap-4 mt-6">
                  <div className="text-slate-500 font-bold leading-relaxed flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-xl">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Environment</span>
                        <span className="text-slate-900 font-black text-xs uppercase">Micro App Studio</span>
                    </div>
                    <span className="text-slate-300 font-normal">|</span>
                    <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                        <span>Last modified at {new Date(project.updatedAt).toLocaleDateString()}</span>
                        <span className="text-slate-200">|</span>
                        <span className="text-blue-600">{project.sources.length} Data Sources Connected</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* 2. Main Content Card */}
      <section className="space-y-6">
        <div className="bg-white rounded-[48px] border border-slate-100 shadow-2xl shadow-slate-900/5 overflow-hidden">
          
          {/* Top Action Bar Inside Card - Matched with Table Export/Search bar */}
          <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6 bg-white">
            <div className="relative flex-1 max-w-md group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="Connected source search..."
                    className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                    readOnly
                />
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
                <button 
                  onClick={() => setIsModalOpen(true)}
                  disabled={pending}
                  className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus size={18} />
                  데이터 소스 추가
                </button>
            </div>
          </div>

          {/* Source List Section */}
          <div className="p-0">
            {/* Main Single View */}
            <div className="space-y-0">
                {/* 1. Template Selection & Preview (Moved UP) */}
                <div className="p-6 md:p-8 space-y-6 bg-slate-50/30 border-b border-slate-100">


                  {/* Template Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                      <Layout className="text-slate-400" size={18} />
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Template Selection & Publish</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { id: 'cash-report', name: '추천 템플릿', icon: '✨', desc: 'AI 기반 전문가 분석 & 금융 리포트' },
                        { id: 'custom-app', name: '범용 리포트', icon: '📊', desc: '모든 테이블 범용 시각화' },
                        { id: 'custom-html', name: '커스텀 HTML', icon: '🌐', desc: '직접 제작한 HTML/CSS' }
                      ].map(t => (
                        <div
                          key={t.id}
                          className={`p-6 rounded-[24px] border-2 transition-all flex flex-col relative overflow-hidden group bg-white ${project.templateId === t.id ? 'border-blue-600 shadow-xl shadow-blue-900/10' : 'border-slate-100 hover:border-blue-200 shadow-sm'}`}
                        >
                          <button
                            onClick={async () => {
                              await updateMicroAppProjectAction(project.id, { templateId: t.id });
                              router.refresh();
                            }}
                            className="text-left w-full"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="text-2xl group-hover:scale-110 transition-transform">{t.icon}</div>
                              <div className="flex items-center gap-2">
                                <div className="text-base font-black text-slate-900">{t.name}</div>
                                {t.id === 'cash-report' && (
                                  <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-md uppercase tracking-widest">Premium</span>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-4 pl-1">{t.desc}</div>
                          </button>
                          
                          <div className="mt-auto flex items-center gap-2 w-full pt-2">
                            {/* AI Magic Buttons (Only for Premium Template when selected) */}
                            {project.templateId === t.id && t.id === 'cash-report' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setIsAIPromptModalOpen(true); }}
                                disabled={pending}
                                title="AI 최적화 세팅 (매핑 & 디자인 추천)"
                                className="flex-1 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 animate-in fade-in zoom-in duration-300"
                              >
                                <Sparkles size={12} className="text-indigo-500" />
                                <span className="hidden sm:inline">AI 추천</span>
                              </button>
                            )}

                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                await updateMicroAppProjectAction(project.id, { templateId: t.id });
                                handlePublish();
                              }}
                              disabled={isPublishing}
                              className={`flex-[2] py-2.5 px-2 w-full rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${project.templateId === t.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-900 text-white hover:bg-blue-600'}`}
                            >
                              <Rocket size={14} className="shrink-0" />
                              <span className="truncate">{isPublishing ? 'Publishing...' : 'Publish'}</span>
                            </button>
                          </div>

                          {project.templateId === t.id && (
                            <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Source List (Moved DOWN) */}
                <div className="p-4 md:p-8 border-b border-slate-50">
                  <div className="flex items-center justify-between mb-6 px-2">
                    <div className="flex items-center gap-3">
                      <Database className="text-slate-400" size={18} />
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Connected Sources</h4>
                    </div>
                    {project.sources.length > 0 && (
                      <button 
                        onClick={handleResetSources}
                        disabled={pending}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-600 hover:text-white transition-all border border-orange-100 disabled:opacity-50 group"
                      >
                        <RotateCcw size={14} className="group-hover:-rotate-90 transition-transform duration-500" />
                        Reset Sources
                      </button>
                    )}
                  </div>
                  {project.sources.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-slate-50 rounded-[24px] flex items-center justify-center mb-4 text-slate-200 border border-slate-100 shadow-inner">
                              <Database size={32} />
                          </div>
                          <h4 className="text-lg font-black text-slate-900 mb-1">데이터 소스를 추가해 주세요</h4>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-70">No sources detected</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {project.sources.map((source: any, index: number) => (
                              <div 
                                  key={`${source.id}-${index}`}
                                  className="p-4 flex items-center justify-between gap-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-lg hover:border-indigo-100 transition-all group w-full"
                              >
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 bg-white text-slate-300 rounded-xl flex items-center justify-center font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm border border-slate-100">
                                          {index + 1}
                                      </div>
                                      <div>
                                          <h4 className="text-sm font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">{source.name}</h4>
                                      </div>
                                  </div>
                                  <button 
                                      onClick={() => handleRemoveSource(source.id)}
                                      className="w-8 h-8 flex items-center justify-center text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  >
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
                </div>

                {/* 3. Mapping Configuration */}
                <div className="p-8 md:p-12 space-y-12 bg-slate-50/30">
                  <div className="pt-0">
                    <div className="flex items-center gap-3 px-2 mb-6">
                      <Settings className="text-slate-400" size={18} />
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Data Mapping Configuration</h4>
                    </div>
                    
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
                      <div className="p-8 space-y-8">
                        {project.sources.length === 0 ? (
                          <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                             <Database size={32} className="mb-4" />
                             <p className="text-xs font-black uppercase tracking-widest">No sources connected for mapping</p>
                          </div>
                        ) : (
                          project.sources.map((source: any) => {
                                      const schema = sourceSchemas.find(s => s.id === source.id);
                                      const currentMappings = project.mappingConfig || [];
                                      
                                      return (
                                        <div key={source.id} className="space-y-6">
                                          <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                              <div className="w-2 h-6 bg-blue-600 rounded-full" />
                                              <h5 className="font-black text-slate-900 text-sm">{source.name} <span className="text-[10px] text-slate-400 font-medium ml-2 uppercase tracking-widest">Source Table</span></h5>
                                            </div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                              {currentMappings.filter((m: any) => !m.sourceTableId || m.sourceTableId === source.id).length} Columns Active
                                            </div>
                                          </div>
                                          
                                          <div className="flex flex-wrap gap-3">
                                            {/* 스키마 기반 모든 컬럼 나열 */}
                                            {schema ? (
                                              schema.columns.map((col: any) => {
                                                const mapping = currentMappings.find((m: any) => m.sourceColumn === col.name && (!m.sourceTableId || m.sourceTableId === source.id));
                                                const isActive = !!mapping;
                                      
                                      return (
                                        <div 
                                          key={col.name}
                                          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all animate-in zoom-in-95 ${isActive ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/5' : 'bg-white border-slate-100 opacity-60 hover:opacity-100 hover:border-slate-300'}`}
                                        >
                                          <button 
                                            onClick={async () => {
                                              let newMapping;
                                              if (isActive) {
                                                // 제거
                                                newMapping = currentMappings.filter((m: any) => !(m.sourceColumn === col.name && (!m.sourceTableId || m.sourceTableId === source.id)));
                                              } else {
                                                // 추가 (displayName을 영문 ID가 아닌 한글 표시 이름으로 설정)
                                                newMapping = [...currentMappings, { 
                                                  sourceTableId: source.id,
                                                  sourceColumn: col.name, 
                                                  displayName: col.displayName || col.name, 
                                                  type: col.type || 'text' 
                                                }];
                                              }
                                              await updateMicroAppProjectAction(project.id, { mappingConfig: newMapping });
                                              router.refresh();
                                            }}
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                                          >
                                            {isActive ? <Check size={14} strokeWidth={4} /> : <Plus size={14} />}
                                          </button>
                                          
                                          <div className="flex flex-col min-w-[60px]">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{col.name}</span>
                                            {isActive ? (
                                              <div className="flex items-center gap-2 mt-1">
                                                <input 
                                                  type="text" 
                                                  value={mapping.displayName}
                                                  onChange={async (e) => {
                                                    const newMapping = [...currentMappings];
                                                    const idx = newMapping.findIndex(m => m.sourceColumn === col.name);
                                                    if (idx !== -1) {
                                                      newMapping[idx] = { ...newMapping[idx], displayName: e.target.value };
                                                      await updateMicroAppProjectAction(project.id, { mappingConfig: newMapping });
                                                      router.refresh();
                                                    }
                                                  }}
                                                  className="text-xs font-black text-blue-700 bg-transparent border-none p-0 focus:ring-0 w-[100px]"
                                                />
                                                <select
                                                  value={mapping.type || col.type || 'text'}
                                                  onChange={async (e) => {
                                                    const newMapping = [...currentMappings];
                                                    const idx = newMapping.findIndex(m => m.sourceColumn === col.name);
                                                    if (idx !== -1) {
                                                      newMapping[idx] = { ...newMapping[idx], type: e.target.value };
                                                      await updateMicroAppProjectAction(project.id, { mappingConfig: newMapping });
                                                      router.refresh();
                                                    }
                                                  }}
                                                  className="text-[9px] font-black text-slate-500 bg-slate-50 border border-slate-200 rounded p-0.5 outline-none focus:ring-2 focus:ring-blue-500/20"
                                                >
                                                  <option value="text">텍스트</option>
                                                  <option value="number">숫자</option>
                                                  <option value="currency">금액(₩)</option>
                                                  <option value="date">날짜</option>
                                                  <option value="boolean">논리형(Y/N)</option>
                                                </select>
                                              </div>
                                            ) : (
                                              <span className="text-xs font-black text-slate-400">{col.displayName || col.name}</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="flex items-center gap-2 py-4 px-2">
                                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">Loading table schema...</span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 italic px-2">
                                  * 컬럼의 아이콘을 클릭하여 리포트에 추가하거나 제거할 수 있습니다. 활성화된 컬럼은 이름과 데이터 타입(금액, 숫자 등)을 직접 수정할 수 있습니다.
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Custom HTML/CSS Editor (Only visible when custom-html template is selected) */}
                  {project.templateId === 'custom-html' && (
                    <div className="pt-12 border-t border-slate-100">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                            <Bot size={16} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Custom Code Injection Mode</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                              외부 HTML/CSS를 적용하고 <code className="mx-1 px-1 py-0.5 bg-slate-100 text-blue-500 rounded font-mono text-[9px]">{"{{columnName}}"}</code>으로 매핑하세요.
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            setPending(true);
                            try {
                              await updateMicroAppProjectAction(project.id, {
                                uiSettings: { 
                                  ...project.uiSettings, 
                                  customHtml, 
                                  customCss 
                                }
                              });
                              router.refresh();
                            } catch (e) {
                              alert('저장 중 오류가 발생했습니다.');
                            } finally {
                              setPending(false);
                            }
                          }}
                          disabled={pending}
                          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0 shadow-md shadow-blue-500/20"
                        >
                          <CheckCircle2 size={14} />
                          Apply Custom Code
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between px-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HTML Architecture</label>
                            <span className="text-[9px] font-bold text-emerald-500 uppercase">React-Safe DSL</span>
                          </div>
                          <textarea 
                            value={customHtml}
                            onChange={(e) => setCustomHtml(e.target.value)}
                            placeholder="<!-- Paste your HTML here -->"
                            className="w-full h-[400px] p-8 bg-slate-900 text-emerald-400 font-mono text-xs rounded-[40px] border border-slate-800 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-inner resize-y"
                          />
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between px-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Styling (CSS)</label>
                            <span className="text-[9px] font-bold text-blue-400 uppercase">Scoped Styles</span>
                          </div>
                          <textarea 
                            value={customCss}
                            onChange={(e) => setCustomCss(e.target.value)}
                            placeholder="/* Paste your CSS here */"
                            className="w-full h-[400px] p-8 bg-slate-900 text-blue-300 font-mono text-xs rounded-[40px] border border-slate-800 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-inner resize-y"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Preview */}
                  <div className="pt-12 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-8 px-2">
                      <div className="flex items-center gap-3">
                        <Eye className="text-slate-400" size={18} />
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Preview</h4>
                      </div>
                      <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">WYSIWYG Mode</span>
                    </div>
                    <div className="bg-white rounded-[48px] border border-slate-100 shadow-2xl overflow-hidden min-h-[600px]">
                      {/* Custom Table Display Name Input (Red Box Area) */}
                      <div className="p-6 border-b border-slate-50 flex flex-col gap-2 bg-slate-50/50 relative">
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-blue-500/20">
                          Live Data
                        </div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Edit3 size={12} />
                          리포트 테이블 표시명 (선택)
                        </label>
                        <input 
                          type="text"
                          placeholder="기본 데이터 소스 이름 대신 표시할 제목을 입력하세요 (예: 1분기 영업실적 요약)"
                          value={tableDisplayName}
                          onChange={(e) => setTableDisplayName(e.target.value)}
                          onBlur={async () => {
                            if (tableDisplayName !== project.uiSettings?.tableDisplayName) {
                              await updateMicroAppProjectAction(project.id, {
                                uiSettings: { ...project.uiSettings, tableDisplayName }
                              });
                            }
                          }}
                          className="w-full max-w-md bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                        />
                      </div>

                      <TemplateRenderer 
                        templateId={project.templateId}
                        sourceTableId={project.sources.map((s: any) => s.id).join(',')}
                        mappingConfig={project.mappingConfig}
                        uiSettings={{ ...project.uiSettings, tableDisplayName }}
                        appName={project.name}
                        id={project.id}
                      />
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>
      </section>

      {/* 3. Footer Guardrail - Refined Style */}
      <footer className="pt-12 text-center opacity-40">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Enterprise Intelligent Orchestration Engine</p>
      </footer>

      {isModalOpen && (
        <SourceSelectorModal 
          onClose={() => setIsModalOpen(false)} 
          onSelect={handleAddSources}
        />
      )}

      {/* AI Prompt Modal */}
      {isAIPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Bot size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">AI 대시보드 디자이너</h3>
                <p className="text-xs font-bold text-slate-400">데이터 구조에 맞는 최적의 매핑과 디자인을 생성합니다.</p>
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                AI에게 전달할 핵심 키워드 (선택)
              </label>
              <textarea
                autoFocus
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="예: CEO 보고용 자금일보, 깔끔한 톤앤매너, 핵심 요약 위주"
                className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none"
              />
            </div>
            
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsAIPromptModalOpen(false)}
                className="px-6 py-3 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-100 transition-all uppercase tracking-widest"
              >
                취소
              </button>
              <button 
                onClick={handleAISuggest}
                disabled={pending}
                className="px-8 py-3 rounded-xl font-black text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all uppercase tracking-widest flex items-center gap-2"
              >
                <Sparkles size={16} />
                AI 추천 시작
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Publish Choice Modal */}
      {isPublishChoiceModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                <Rocket size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">앱 발행 옵션</h3>
                <p className="text-xs font-bold text-slate-400">이미 발행된 앱입니다. 어떻게 저장할까요?</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-8">
              <button 
                onClick={() => executePublish(false)}
                className="w-full text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all"><Edit2 size={16} /></div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">기존 앱에 덮어쓰기</h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">현재 수정사항을 원본 앱에 그대로 저장합니다.</p>
                  </div>
                </div>
              </button>
              
              <button 
                onClick={() => executePublish(true)}
                className="w-full text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all"><Plus size={16} /></div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">새로운 앱으로 발행</h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">현재 상태를 복제하여 독립적인 새 앱을 만듭니다.</p>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={() => setIsPublishChoiceModalOpen(false)}
                className="px-6 py-3 rounded-xl font-black text-xs text-slate-500 hover:bg-slate-100 transition-all uppercase tracking-widest"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
