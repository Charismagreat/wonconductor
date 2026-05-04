'use client';

import React, { useState, useEffect } from 'react';
import { 
  Rocket, 
  Plus, 
  ExternalLink, 
  Search, 
  Grid, 
  List,
  Layout,
  Wallet,
  Calendar,
  Settings,
  ArrowRight,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  createMicroAppProjectAction, 
  deleteMicroAppProjectAction,
  deleteMicroAppAction 
} from '@/app/actions/micro-app';
import { 
  Trash2, 
  Edit3,
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

interface PublishingHubClientProps {
  initialApps: any[];
  initialProjects: any[];
  user: any;
}

export function PublishingHubClient({ initialApps, initialProjects, user }: PublishingHubClientProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredApps = initialApps.filter(app => 
    (app.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProjects = initialProjects.filter(p => 
    p.status !== 'PUBLISHED' && (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = async () => {
    const name = window.prompt('새 마이크로 앱의 이름을 입력하세요:', '새 마이크로 앱');
    if (!name) return;

    setIsCreating(true);
    try {
      const res = await createMicroAppProjectAction(name);
      if (res.success) {
        router.push(`/publishing/edit/${res.id}`);
      }
    } catch (e) {
      alert('프로젝트 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`'${name}' 프로젝트를 삭제하시겠습니까?`)) return;
    
    try {
      await deleteMicroAppProjectAction(id);
    } catch (e) {
      alert('프로젝트 삭제에 실패했습니다.');
    }
  };

  const handleDeleteApp = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`'${name}' 앱 발행을 취소하고 삭제하시겠습니까?\n(원본 프로젝트는 유지됩니다.)`)) return;
    
    try {
      await deleteMicroAppAction(id);
    } catch (e) {
      alert('앱 삭제에 실패했습니다.');
    }
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <PageHeader 
        title="APP STUDIO"
        description="AI를 통해 전사 데이터를 기반으로 비즈니스 앱을 조립하고 안전하게 퍼블리싱합니다."
        icon={Rocket}
        rightElement={
          <div className="flex flex-wrap items-center gap-4 w-full md:w-fit">
            <div className="relative flex-1 md:w-80 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="앱 또는 프로젝트 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:bg-white transition-all outline-none"
              />
            </div>

            <button 
              onClick={handleCreateProject}
              disabled={isCreating}
              className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              {isCreating ? '생성 중...' : '새 앱 프로젝트'}
            </button>
          </div>
        }
      />
      



      {/* 3. Projects Section (Drafts) */}
      <section>
        <div className="flex items-center mb-8">
          <div className="w-1.5 h-6 bg-amber-500 rounded-full mr-4" />
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mr-3">제작 중인 프로젝트</h2>
          <span className="px-3 py-1 bg-slate-100 text-slate-500 text-sm font-bold rounded-full">{filteredProjects.length}</span>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="p-16 bg-white rounded-[40px] border border-dashed border-slate-100 text-center">
            <p className="text-slate-400 font-bold text-sm">현재 제작 중인 프로젝트가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div 
                key={project.id}
                className="group bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-500/30 transition-all flex flex-col gap-4 relative"
              >
                {/* 상단: 아이콘 + 텍스트 + 배지/버튼 */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Settings size={20} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-sm font-black text-slate-800 truncate">{project.name}</h3>
                      <p className="text-[10px] text-slate-400 font-medium truncate">
                        {(() => {
                          const sources = project.sources;
                          if (!sources) return 0;
                          if (Array.isArray(sources)) return sources.length;
                          try {
                            const parsed = JSON.parse(sources);
                            return Array.isArray(parsed) ? parsed.length : 0;
                          } catch (e) {
                            return 0;
                          }
                        })()}개의 데이터 소스 연결됨
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[8px] font-black uppercase tracking-widest">Draft</span>
                    <button 
                      onClick={(e) => handleDeleteProject(e, project.projectId, project.name)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mt-auto">
                  <span className="flex items-center gap-1.5"><Calendar size={10} /> {new Date(project.updatedAt).toLocaleDateString()}</span>
                  <Link href={`/publishing/edit/${project.projectId}`} className="text-amber-600 hover:underline flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    STUDIO 입장 <ArrowRight size={10} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Published Apps Section */}
      <section>
        <div className="flex items-center mb-8">
          <div className="w-1.5 h-6 bg-blue-500 rounded-full mr-4" />
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mr-3">발행된 마이크로 앱</h2>
          <span className="px-3 py-1 bg-slate-100 text-slate-500 text-sm font-bold rounded-full">{filteredApps.length}</span>
        </div>

        {filteredApps.length === 0 ? (
          <div className="p-16 bg-white rounded-[40px] border border-dashed border-slate-100 text-center">
            <p className="text-slate-400 font-bold text-sm">발행된 앱이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map((app) => (
              <div 
                key={app.id} 
                className="group bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all flex flex-col gap-4"
              >
                {/* 상단: 아이콘 + 텍스트 + 배지/버튼 */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors group-hover:scale-105 ${
                      app.templateId === 'cash-report' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {app.templateId === 'cash-report' ? <Wallet size={20} /> : <Layout size={20} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors truncate">{app.name}</h3>
                      <p className="text-[10px] text-slate-400 font-medium truncate">
                        {app.templateId === 'cash-report' ? '프리미엄 리포트' : '커스텀 리포트'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-md text-[8px] font-black uppercase tracking-widest">Live</span>
                    <button 
                      onClick={(e) => handleDeleteApp(e, app.projectId, app.name)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="앱 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mt-auto">
                  <span className="flex items-center gap-1.5"><Calendar size={10} /> {new Date(app.createdAt).toLocaleDateString()}</span>
                  <div className="flex items-center gap-4">
                    <Link href={`/publishing/edit/${app.projectId}`} className="text-slate-400 hover:text-blue-600 flex items-center gap-1 transition-colors">
                      <Edit3 size={12} /> 수정
                    </Link>
                    <Link 
                      href={`/m/${app.id}`} 
                      target="_blank"
                      className="text-blue-600 flex items-center gap-1 hover:underline font-black"
                    >
                      열기 <ExternalLink size={10} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer Insight */}
      <footer className="pt-12 border-t border-slate-100 text-center opacity-60">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Enterprise Intelligent Orchestration</p>
      </footer>
    </div>
  );
}
