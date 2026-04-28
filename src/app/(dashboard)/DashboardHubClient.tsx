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

export function DashboardHubClient({ user, isStaff, reports, events, financeStats, hometaxStats }: DashboardHubClientProps) {
  const pathname = usePathname();
  const [showManualModal, setShowManualModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'backups'>('reports');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체보기');

  // 카테고리 추출 및 정리
  const categories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('전체보기');
    reports.forEach(r => {
      // 1. 직접 부여된 category 확인
      if (r.category) {
        cats.add(r.category === 'System' ? '시스템 테이블' : r.category === 'Finance' ? '금융 테이블' : r.category);
      } 
      // 2. uiConfig 내의 category 확인
      else if (r.uiConfig) {
        try {
          const config = JSON.parse(r.uiConfig);
          if (config.category) cats.add(config.category);
          else cats.add('일반 테이블');
        } catch (e) { cats.add('일반 테이블'); }
      } else {
        cats.add('일반 테이블');
      }
    });
    return Array.from(cats).sort((a, b) => {
      if (a === '전체보기') return -1;
      if (b === '전체보기') return 1;
      return a.localeCompare(b);
    });
  }, [reports]);

  // 필터링 로직
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // 카테고리 필터
      let rCat = r.category || '일반 테이블';
      if (rCat === 'System') rCat = '시스템 테이블';
      else if (rCat === 'Finance') rCat = '금융 테이블';

      if (!r.category && r.uiConfig) {
        try {
          const config = JSON.parse(r.uiConfig);
          if (config.category) rCat = config.category;
        } catch (e) {}
      }

      const matchesCategory = selectedCategory === '전체보기' || rCat === selectedCategory;
      
      // 검색어 필터
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        r.name.toLowerCase().includes(searchLower) || 
        (r.tableName && r.tableName.toLowerCase().includes(searchLower)) ||
        (r.description && r.description.toLowerCase().includes(searchLower));

      return matchesCategory && matchesSearch;
    });
  }, [reports, selectedCategory, searchQuery]);

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
            
            {/* Upcoming Schedule Widget (NEW) */}
            <UpcomingEventsWidget events={events} />

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

              {/* Category Chips */}
              <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-50">
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
                   let rawCat = report.category || '일반 테이블';
                   if (!report.category && report.uiConfig) {
                     try { rawCat = JSON.parse(report.uiConfig).category || '일반 테이블'; } catch(e) {}
                   }
                   const rCat = rawCat === 'System' ? '시스템 테이블' : rawCat === 'Finance' ? '금융 테이블' : rawCat;
                   
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
                                  {report.isReadOnly && (
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[8px] font-black rounded-md uppercase tracking-widest border border-rose-100 shrink-0">
                                      Locked
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-1 font-bold">
                                  {report.description || 'No description available for this table.'}
                                </p>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className={`px-2 py-0.5 text-[8px] font-black rounded-md border uppercase tracking-tighter shrink-0 ${
                                  report.isFinanceTable ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  report.isSystemTable ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                  report.isDirectTable ? 'bg-zinc-50 text-zinc-600 border-zinc-200' :
                                  (isStaff ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100')
                                }`}>
                                  {rCat}
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
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg text-[9px] font-bold text-slate-500 border border-slate-100">
                            <span className="text-blue-600 font-black">ID:</span> {report.id}
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-bold shadow-lg shadow-blue-500/10">
                            <span className="opacity-80">REPO:</span> {report.sheetName || 'MY DB'}
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/50 rounded-lg text-[9px] font-bold text-blue-600">
                            <span className="font-black">{report._count?.rows ?? '0'}</span> Rows
                          </div>
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
