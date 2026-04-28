'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Table as TableIcon, 
  Search, 
  ChevronRight, 
  Sparkles, 
  Send,
  BarChart3,
  PieChart,
  X,
  Bot,
  RotateCcw
} from 'lucide-react';
import { 
  getVisualizationRecommendationAction, 
  savePinnedChartAction,
  saveAIStudioSessionAction,
  getAIStudioSessionAction,
  clearAIStudioSessionAction
} from '@/app/actions/ai';
import { SmartChart } from '@/components/SmartChart';

// 저장소 키 (하위 호환성 및 로그 확인용)
const STORAGE_KEY = 'egdesk_ai_studio_state';

interface DashboardClientProps {
  allTables: any[];
  user: any;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'suggestion' | 'chart';
  chartConfig?: any;
}

export function DashboardClient({ allTables, user }: DashboardClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '안녕하세요! 테이블 분석 AI 스튜디오에 오신 것을 환영합니다. 분석하고 싶은 테이블을 왼쪽 목록에서 선택해 주세요. 선택하신 데이터의 특성에 맞춰 최적의 시각화와 분석 방향을 제안해 드릴게요.',
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [charts, setCharts] = useState<Array<{ id: string, versions: any[], currentVersion: number, layout?: { span: 'half' | 'full' } }>>([]);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isLoaded = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  // 대화 내용이나 타이핑 상태가 바뀔 때마다 하단 스크롤
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping]);

  // [Persistence] 서버에서 상태 복원
  useEffect(() => {
    let isMounted = true;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session load timeout')), 5000)
    );

    async function loadSession() {
      try {
        // 타임아웃과 경쟁하여 너무 오래 걸리면 포기
        const savedState = await Promise.race([
          getAIStudioSessionAction(),
          timeoutPromise
        ]);

        if (isMounted && savedState) {
          const { selectedIds: sIds, chatHistory: cHist, charts: cCharts } = savedState as any;
          if (sIds) setSelectedIds(sIds);
          if (cHist) setChatHistory(cHist);
          if (cCharts) setCharts(cCharts);
          console.log('AI Studio session restored from server.');
        }
      } catch (e) {
        console.warn('AI Studio session load skipped or failed:', e);
      } finally {
        if (isMounted) {
          isLoaded.current = true;
        }
      }
    }
    loadSession();
    return () => { isMounted = false; };
  }, []);

  // [Persistence] 상태 변경 시 서버에 자동 저장 (Debounced)
  useEffect(() => {
    if (!isLoaded.current) return;

    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        const result = await saveAIStudioSessionAction({
          selectedIds,
          chatHistory,
          charts
        });
        if (!result.success) {
          console.error('Failed to save session, will retry on next change.');
        }
      } catch (e) {
        console.error('Error during session auto-save:', e);
      } finally {
        setIsSaving(false);
      }
    }, 1000); // 1초 디바운스로 단축

    return () => clearTimeout(timer);
  }, [selectedIds, chatHistory, charts]);

  const resetSession = async () => {
    if (confirm('현재 진행 중인 분석 내용을 모두 초기화하고 새로 시작하시겠습니까?')) {
      setSelectedIds([]);
      setChatHistory([{
        role: 'assistant',
        content: '안녕하세요! 테이블 분석 AI 스튜디오에 오신 것을 환영합니다. 분석하고 싶은 테이블을 왼쪽 목록에서 선택해 주세요. 선택하신 데이터의 특성에 맞춰 최적의 시각화와 분석 방향을 제안해 드릴게요.',
      }]);
      setCharts([]);
      setSelectedChartId(null);
      
      try {
        await clearAIStudioSessionAction();
        // 로컬 스토리지 하위 호환성 정리
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Failed to clear session on server:', e);
      }
    }
  };

  const filteredTables = allTables.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.sheetName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTable = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSend = async (customPrompt?: string) => {
    let textToSend = customPrompt || input;
    if (!textToSend.trim() || selectedIds.length === 0) return;
    
    // 선택된 차트 정보를 프롬프트에 포함
    const selectedChartInstance = charts.find(c => c.id === selectedChartId);
    if (selectedChartId && selectedChartInstance) {
      const currentConfig = selectedChartInstance.versions[selectedChartInstance.currentVersion];
      textToSend = `[대상 차트: "${currentConfig.title}"] ${textToSend}`;
    }
    
    const userMsg: ChatMessage = { role: 'user', content: textToSend };
    setChatHistory(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    
    try {
      const data = await getVisualizationRecommendationAction(
        selectedIds, 
        [...chatHistory, userMsg].map(m => ({ role: m.role, content: m.content }))
      );
      
      if (data.chartConfigs && data.chartConfigs.length > 0) {
        if (selectedChartId) {
          // [혁신] 선택된 차트 인스턴스에 새 버전 추가 (In-place Evolution)
          setCharts(prev => prev.map(c => {
            if (c.id === selectedChartId) {
              const incomingConfigs = data.chartConfigs || [];
              const newVersions = [...c.versions, ...incomingConfigs];
              return {
                ...c,
                versions: newVersions,
                currentVersion: newVersions.length - 1
              };
            }
            return c;
          }));
        } else {
          // 새 차트 인스턴스 생성
          const newInstances = data.chartConfigs.map((config: any) => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            versions: [config],
            currentVersion: 0,
            layout: (config.type === 'table' ? { span: 'full' } : { span: 'half' }) as { span: 'half' | 'full' }
          }));
          setCharts(prev => [...newInstances, ...prev]);
        }
      }

      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: data.content
      }]);
    } catch (error) {
      console.error('AI Analysis Error:', error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: '죄송합니다. 분석 중 오류가 발생했습니다. 테이블 선택 상태를 확인하시고 다시 한 번 말씀해 주세요.'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleVersionChange = (id: string, version: number) => {
    setCharts(prev => prev.map(c => 
      c.id === id ? { ...c, currentVersion: version - 1 } : c
    ));
  };

  const handleLayoutChange = (id: string, layout: { span: 'half' | 'full' }) => {
    setCharts(prev => prev.map(c => 
      c.id === id ? { ...c, layout } : c
    ));
  };

  const handlePinChart = async (id: string, config: any, layout?: any) => {
    try {
      const res = await savePinnedChartAction(id, { ...config, layout });
      const newId = res.success && res.id ? String(res.id) : id;
      
      if (newId !== id) {
          setCharts(prev => prev.map(c => c.id === id ? { ...c, id: newId } : c));
      }
      setPinnedIds(prev => [...prev, newId]);
      alert('차트가 리포트 갤러리에 고정되었습니다!');
    } catch (error) {
      console.error('Pin Error:', error);
      alert('고정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteChart = (id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id));
    if (selectedChartId === id) {
      setSelectedChartId(null);
    }
  };

  const currentTargetedChart = charts.find(c => c.id === selectedChartId);
  const currentTargetedConfig = currentTargetedChart?.versions[currentTargetedChart.currentVersion];

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-12rem)]">
      {/* 1. Left Sidebar: Table Picker */}
      <aside className="w-full lg:w-80 flex flex-col gap-6">
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <TableIcon size={16} className="text-blue-600" />
              Analyze Data Sources
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search tables..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-100 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[500px] p-2 space-y-1">
            {filteredTables.map(table => (
              <button
                key={table.id}
                onClick={() => toggleTable(table.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group ${
                  selectedIds.includes(table.id) 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  selectedIds.includes(table.id) ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white'
                }`}>
                  <BarChart3 size={14} />
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-xs font-black truncate">{table.displayName || table.name}</p>
                  <p className={`text-[9px] tracking-tighter opacity-60 ${
                    selectedIds.includes(table.id) ? 'text-blue-100' : 'text-slate-400'
                  }`}>
                    <span className="uppercase">ID:</span> {table.id}
                  </p>
                </div>
                {selectedIds.includes(table.id) && <ChevronRight size={14} />}
              </button>
            ))}
          </div>
          
          <div className="p-6 bg-slate-50 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Tables</p>
              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[9px] font-black">{selectedIds.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedIds.length === 0 ? (
                 <span className="text-[10px] font-medium text-slate-300 italic">No tables selected</span>
              ) : (
                selectedIds.map(id => {
                  const table = allTables.find(t => t.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-600 rounded-lg text-[9px] font-black">
                      {table?.displayName || table?.name || id}
                      <X size={10} className="cursor-pointer shrink-0" onClick={() => toggleTable(id)} />
                    </span>
                  );
                })
              )}
            </div>
            {selectedIds.length > 0 && (
              <button 
                onClick={() => handleSend("현재 선택한 테이블들의 데이터를 분석해서 시각화 차트를 추천해줘.")}
                disabled={isTyping}
                className="w-full mt-4 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                {isTyping ? 'Analyzing...' : 'Auto-Generate Charts'}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Main Area: AI Analysis Studio */}
      <div className="flex-1 flex flex-col gap-8">
         {/* Content View */}
         <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* 2a. Chat Interface */}
            <div className="xl:col-span-1 bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden max-h-[750px]">
               <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                      <Bot size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">AI Assistant</h3>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 ${isSaving ? 'bg-amber-500' : 'bg-green-500'} rounded-full animate-pulse`} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {isSaving ? 'Saving...' : 'Synced'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={resetSession}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-2"
                    title="새 분석 시작 (초기화)"
                  >
                    <RotateCcw size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Reset</span>
                  </button>
                </div>

               <div 
                 ref={chatContainerRef}
                 className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
               >
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                         msg.role === 'user' 
                         ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-500/20' 
                         : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'
                       }`}>
                          <ReactMarkdown 
                             remarkPlugins={[remarkGfm]}
                             components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-4 rounded-2xl border border-slate-200 shadow-sm">
                                    <table className="w-full text-xs text-left border-collapse bg-white">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                thead: ({ children }) => <thead className="bg-slate-50 font-black text-blue-600 uppercase tracking-widest">{children}</thead>,
                                th: ({ children }) => <th className="px-4 py-3 border-b border-slate-200">{children}</th>,
                                td: ({ children }) => <td className="px-4 py-2 border-b border-slate-100 last:border-b-0">{children}</td>,
                                strong: ({ children }) => <strong className="font-black text-blue-700">{children}</strong>,
                                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                                li: ({ children }) => <li className="text-slate-600">{children}</li>
                             }}
                           >
                             {msg.content}
                           </ReactMarkdown>
                       </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-slate-50 p-4 rounded-3xl rounded-tl-none border border-slate-100 flex gap-1">
                        <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce" />
                        <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
               </div>

               <div className="p-6 bg-slate-50 border-t border-slate-100">
                  {/* Targeted Chart Indicator */}
                  {selectedChartId && currentTargetedChart && (
                    <div className="mb-3 px-4 py-2 bg-blue-600 rounded-xl flex items-center justify-between shadow-lg animate-in slide-in-from-bottom-2">
                       <div className="flex items-center gap-2 overflow-hidden">
                          <BarChart3 size={12} className="text-white shrink-0" />
                          <span className="text-[10px] font-black text-white uppercase truncate">Editing: {currentTargetedConfig?.title}</span>
                       </div>
                       <button onClick={() => setSelectedChartId(null)} className="p-1 hover:bg-white/20 rounded-full text-white transition-colors">
                          <X size={12} />
                       </button>
                    </div>
                  )}

                  <div className="relative group">
                    <textarea 
                      placeholder={selectedIds.length === 0 ? "Select tables first" : "Ask AI to visualize or analyze..."}
                      disabled={selectedIds.length === 0}
                      rows={2}
                      className="w-full p-4 pr-14 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-blue-100 transition-all resize-none shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <button 
                      onClick={() => handleSend()}
                      disabled={!input.trim() || selectedIds.length === 0}
                      className="absolute right-3 bottom-3 p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                  <p className="mt-3 text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest">Shift + Enter for new line</p>
               </div>
            </div>

            {/* 2b. Visualization Area */}
            <div className="xl:col-span-2 space-y-8">
               {selectedIds.length === 0 ? (
                 <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-[40px] border border-dashed border-slate-200 text-center p-12">
                   <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                     <PieChart size={48} className="text-slate-200" />
                   </div>
                   <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight uppercase tracking-widest">Ready to Analyze</h3>
                   <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm">
                     왼쪽 목록에서 분석하고 싶은 테이블을 선택하면 AI가 데이터를 검토하여 최적의 시각화를 추천해 드립니다.
                   </p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                    {charts.length === 0 && !isTyping && (
                      <div className="md:col-span-2 h-[400px] flex flex-col items-center justify-center bg-white rounded-[40px] border border-dashed border-slate-100 text-center">
                         <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 animate-bounce">
                           <Sparkles size={24} />
                         </div>
                         <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Ready to Visualize</h4>
                         <p className="text-xs text-slate-400 font-medium">채팅을 통해 분석을 시작하거나 왼쪽 하단의 'Auto-Generate'를 눌러보세요.</p>
                      </div>
                    )}
                    
                    {charts.map((chart) => (
                      <div 
                        key={chart.id} 
                        className={chart.layout?.span === 'full' ? 'md:col-span-2' : 'md:col-span-1'}
                      >
                        <SmartChart 
                          config={chart.versions[chart.currentVersion]} 
                          isSelected={selectedChartId === chart.id}
                          currentVersion={chart.currentVersion + 1}
                          totalVersions={chart.versions.length}
                          onVersionChange={(v) => handleVersionChange(chart.id, v)}
                          onPin={() => handlePinChart(chart.id, chart.versions[chart.currentVersion], chart.layout)}
                          isPinned={pinnedIds.includes(chart.id)}
                          onSelect={() => setSelectedChartId(prev => prev === chart.id ? null : chart.id)}
                          onDelete={() => handleDeleteChart(chart.id)}
                          layout={chart.layout}
                          onLayoutChange={(newLayout) => handleLayoutChange(chart.id, newLayout)}
                        />
                      </div>
                    ))}

                    {isTyping && (
                      <div className="md:col-span-2 bg-white/50 backdrop-blur-sm p-12 rounded-[40px] border border-dashed border-blue-200 flex flex-col items-center justify-center">
                         <div className="relative w-12 h-12 mb-4">
                            <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
                            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
                         </div>
                         <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">AI가 데이터를 분석하며 차트를 구성 중입니다...</p>
                      </div>
                    )}
                 </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
