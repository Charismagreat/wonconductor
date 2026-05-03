'use client';

import React, { useState, useMemo } from 'react';
import { 
  Database, 
  Plus, 
  FileSpreadsheet, 
  ExternalLink, 
  ShieldCheck, 
  Wallet,
  History,
  Search,
  Filter,
  Check
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { NewTableSection } from '@/components/NewTableSection';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { DeleteReportButton } from '@/components/DeleteReportButton';
import BackupManager from '@/components/BackupManager';
import UpcomingEventsWidget from '@/components/dashboard/UpcomingEventsWidget';
import { CalendarEvent } from '@/lib/services/calendar-service';

interface DashboardHubClientProps {
  user: any;
  isStaff: boolean;
  reports: any[];
  events: CalendarEvent[];
  financeStats?: any;
  hometaxStats?: any;
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

export function DashboardHubClient({ user, isStaff, reports, events, financeStats, hometaxStats }: DashboardHubClientProps) {
  const pathname = usePathname();
  const [showManualModal, setShowManualModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'backups'>('reports');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체보기');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 데이터 전처리 및 태그 추출 로직
  const { processedReports, allTags } = useMemo(() => {
    const tagsSet = new Set<string>();
    
    const processed = reports.map(r => {
      let cat = '일반 테이블';
      const rTags: string[] = [];

      // 1. 카테고리 추출 및 태그 분리
      if (r.category) {
        if (r.category === 'System') cat = '시스템 테이블';
        else if (r.category === 'Finance') cat = '금융 테이블';
        else if (r.category === '일반 테이블') cat = '일반 테이블';
        else rTags.push(r.category); // 커스텀 카테고리는 태그로 이동
      }

      // 2. uiConfig 내의 데이터 추출
      if (r.uiConfig) {
        try {
          const config = JSON.parse(r.uiConfig);
          if (config.category && config.category !== 'System' && config.category !== 'Finance' && config.category !== '일반 테이블') {
            rTags.push(config.category);
          } else if (config.category === 'System') cat = '시스템 테이블';
          else if (config.category === 'Finance') cat = '금융 테이블';
          
          if (Array.isArray(config.tags)) {
            config.tags.forEach((t: string) => rTags.push(t));
          }
        } catch (e) {}
      }

      const uniqueTags = Array.from(new Set(rTags)).filter(Boolean);
      uniqueTags.forEach(t => tagsSet.add(t));

      return {
        ...r,
        normalizedCategory: cat,
        tags: uniqueTags
      };
    });

    return {
      processedReports: processed,
      allTags: Array.from(tagsSet).sort()
    };
  }, [reports]);

  // 카테고리는 고정 4종으로 통일
  const categories = ['전체보기', '시스템 테이블', '금융 테이블', '일반 테이블'];

  // 필터링 로직
  const filteredReports = useMemo(() => {
    return processedReports.filter(r => {
      // 카테고리 필터
      const matchesCategory = selectedCategory === '전체보기' || r.normalizedCategory === selectedCategory;
      
      // 태그 필터 (AND 조건 - 선택된 태그를 모두 포함해야 함)
      const matchesTags = selectedTags.length === 0 || selectedTags.every(t => r.tags.includes(t));

      // 검색어 필터
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        r.name.toLowerCase().includes(searchLower) || 
        (r.tableName && r.tableName.toLowerCase().includes(searchLower)) ||
        (r.description && r.description.toLowerCase().includes(searchLower));

      return matchesCategory && matchesTags && matchesSearch;
    });
  }, [processedReports, selectedCategory, selectedTags, searchQuery]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <main className="max-w-[1600px] mx-auto px-8 md:px-12 pt-6 pb-12 space-y-12 w-full overflow-y-auto">
        <PageHeader 
          title={isStaff ? "Employee Hub" : (pathname === '/dashboard' ? "Dashboard" : "My DB")}
          description={isStaff ? "부서별로 공유된 데이터 테이블과 입력 양식을 확인할 수 있습니다." : 
                      (activeTab === 'reports' ? "조직의 모든 데이터를 관리하고 분석할 수 있는 데이터 센터입니다." : "데이터베이스 전체를 시점별로 저장하고 복구할 수 있는 백업 센터입니다.")}
          icon={pathname === '/dashboard' ? Star : Database}
          rightElement={
            !isStaff && activeTab === 'reports' && (
              <button 
                onClick={() => setShowManualModal(true)}
                className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-slate-900 transition-all active:scale-95 shadow-xl shadow-blue-500/20 text-sm tracking-widest uppercase flex items-center gap-2"
              >
                <Plus size={16} />
                테이블 직접 만들기
              </button>
            )
          }
        />

        {/* Tab Navigation (Premium Style) */}
        {!isStaff && (
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-[22px] w-fit">
            <button 
              onClick={() => setActiveTab('reports')}
              className={`px-8 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'reports' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              MY DB Repository
            </button>
            <button 
              onClick={() => setActiveTab('backups')}
              className={`px-8 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'backups' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              System Snapshots
            </button>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'reports' ? (
          <>
            {!isStaff && (
              <NewTableSection 
                userId={user.id} 
                showManualModal={showManualModal} 
                setShowManualModal={setShowManualModal} 
              />
            )}
            
            {/* Upcoming Schedule Widget (NEW) - 대시보드에서만 표시 */}
            {pathname === '/dashboard' && <UpcomingEventsWidget events={events} />}

            {/* Smart Toolbox (Search & Filters) */}
            <section className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-900/5 space-y-10">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                    <Filter size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-tight tracking-tight">지능형 탐색</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total {reports.length} tables integrated</p>
                  </div>
                </div>

                <div className="relative flex-1 lg:max-w-md group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search by name, ID or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:bg-white transition-all outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Category Chips & Tag Cloud */}
              <div className="pt-6 border-t border-slate-50 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 relative ${
                        selectedCategory === cat 
                        ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20 ring-4 ring-slate-900/5' 
                        : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {selectedCategory === cat && <Check size={12} strokeWidth={3} className="text-blue-400" />}
                      {cat}
                    </button>
                  ))}
                </div>

                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <div className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Filter size={10} /> TAG FILTERS
                    </div>
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                          selectedTags.includes(tag)
                          ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>


            {/* Reports List */}
            <section className="max-w-[1600px] mx-auto">
              <div className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={24} className="text-blue-600" />
                  <div className="flex flex-col">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">{isStaff ? 'My Workspace' : 'MY DB Repository'}</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Authorized data objects only</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Results: <span className="text-blue-600 text-sm ml-1">{filteredReports.length}</span>
                    </span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredReports.map((report: any) => {
                   return (
                    <div key={report.id} className="relative group bg-white border border-slate-100 rounded-[32px] hover:border-blue-500/30 hover:shadow-2xl hover:shadow-slate-900/10 transition-all duration-500 overflow-hidden">
                      {/* Entire card is a link */}
                      <Link
                        href={
                          report.isSystemTable && report.id === 'user' ? '/users' :
                          (report.isSystemTable || report.isDirectTable) ? `/report/${report.id}` :
                            (isStaff ? `/report/${report.id}/input` : `/report/${report.id}`)
                        }
                        className="absolute inset-0 z-0"
                      />

                      <div className="p-7 relative z-10 pointer-events-none">
                        <div className="flex items-start gap-4 mb-6">
                          <div className={`p-3 rounded-2xl transition-all duration-500 shrink-0 ${
                              report.isFinanceTable ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white group-hover:scale-110 shadow-sm' :
                              report.isSystemTable ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white group-hover:scale-110 shadow-sm' :
                              report.isDirectTable ? 'bg-zinc-50 text-zinc-600' :
                              (isStaff ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white group-hover:scale-110 shadow-sm' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 shadow-sm')
                            }`}>
                            {report.isFinanceTable ? <Wallet size={20} /> :
                              report.isSystemTable ? <Database size={20} /> :
                              report.isDirectTable ? <Database size={20} /> :
                                (isStaff ? <ShieldCheck size={20} /> : <FileSpreadsheet size={20} />)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-black text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                    {report.name}
                                  </h3>
                                  {(() => {
                                    try {
                                      const config = typeof report.uiConfig === 'string' ? JSON.parse(report.uiConfig) : (report.uiConfig || {});
                                      if (config.isIntegrityProtected) {
                                        return (
                                          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded-md uppercase tracking-widest shadow-lg shadow-blue-500/20 shrink-0">
                                            <ShieldCheck size={10} strokeWidth={3} />
                                            Protected
                                          </div>
                                        );
                                      }
                                    } catch (e) {}
                                    return null;
                                  })()}
                                  {(() => {
                                    const isOwner = report.ownerId === user?.id || report.ownerId === 'system';
                                    const isAdmin = user?.role === 'ADMIN';
                                    const canEdit = (isOwner || isAdmin || user?.role === 'EDITOR') && !report.isReadOnly;
                                    return !canEdit;
                                  })() && (
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-black rounded-md uppercase tracking-widest border border-amber-100 shrink-0">
                                      Read Only
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-1 font-bold">
                                  {report.description || 'No description available for this table.'}
                                </p>
                                {report.tags && report.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {report.tags.map((t: string) => (
                                      <span key={t} className="text-[9px] font-bold text-blue-500 bg-blue-50/50 px-1.5 py-0.5 rounded-md">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className={`px-2 py-0.5 text-[8px] font-black rounded-md border uppercase tracking-tighter shrink-0 ${
                                  report.normalizedCategory === '금융 테이블' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  report.normalizedCategory === '시스템 테이블' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                  report.isDirectTable ? 'bg-zinc-50 text-zinc-600 border-zinc-200' :
                                  (isStaff ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100')
                                }`}>
                                  {report.normalizedCategory}
                                </span>
                                <div className="pointer-events-auto opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                  {!isStaff && !report.isReadOnly && (
                                    <DeleteReportButton reportId={report.id} reportName={report.name} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-5 border-t border-slate-50">
                          <LocalBadge color="blue" scale={0.95}>
                            REPO: {report.sheetName || 'MY DB'}
                          </LocalBadge>
                          {(report.tableName || report.id) && (
                            <LocalBadge color="slate" scale={0.95}>
                              SOURCE: {report.tableName || report.id}
                            </LocalBadge>
                          )}
                          <LocalBadge color="indigo" scale={0.95}>
                            {report._count?.rows ?? '0'} ROWS
                          </LocalBadge>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {filteredReports.length === 0 && (
                  <div className="col-span-full py-32 bg-slate-50 border border-dashed border-slate-200 rounded-[48px] flex flex-col items-center justify-center text-slate-400">
                    <Search size={64} className="mb-6 opacity-10" />
                    <p className="text-base font-bold text-slate-500 mb-2">검색 결과가 없습니다.</p>
                    <p className="text-sm font-medium opacity-60">다른 키워드나 카테고리를 선택해 보세요.</p>
                    <button 
                      onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                      className="mt-6 px-6 py-3 bg-white text-blue-600 text-xs font-black uppercase tracking-widest rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-all"
                    >
                      필터 초기화
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <BackupManager />
        )}
      </main>
    </div>
  );
}
