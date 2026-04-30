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
  RotateCcw,
  Copy,
  Check
} from 'lucide-react';
import { 
  getVisualizationRecommendationAction, 
  savePinnedChartAction,
  saveAIStudioSessionAction,
  getAIStudioSessionAction,
  clearAIStudioSessionAction
} from '@/app/actions/ai';
import { SmartChart } from '@/components/SmartChart';
import { SourceSelectionModal } from '@/components/dashboard/SourceSelectionModal';
import { Plus } from 'lucide-react';

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
  traces?: any[];
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
  const [activeTraces, setActiveTraces] = useState<any[] | null>(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 입력 내용에 따라 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

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
    if (!isLoaded.current || !user) return;

    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        // 데이터 경량화: 너무 큰 트레이스 결과는 요약하여 저장
        const lightChatHistory = chatHistory.map(msg => ({
          ...msg,
          traces: msg.traces?.map(t => ({
            ...t,
            result: typeof t.result === 'object' 
              ? JSON.parse(JSON.stringify(t.result).substring(0, 2000) + (JSON.stringify(t.result).length > 2000 ? '..."}' : ''))
              : String(t.result).substring(0, 2000)
          }))
        }));

        const result = await saveAIStudioSessionAction({
          selectedIds,
          chatHistory: lightChatHistory,
          charts
        });
        if (!result.success) {
          console.warn('Session auto-save failed:', result.error);
        }
      } catch (e) {
        console.warn('Session auto-save network error (will retry later):', e);
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
        content: data.content,
        traces: data.traces
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

  const handleCancelAnalysis = () => {
    setIsTyping(false);
    // 실제 서버 요청을 물리적으로 끊는 것은 AbortController가 필요하지만, 
    // 여기서는 UI 상태를 즉시 복구하여 사용자가 다른 작업을 할 수 있게 합니다.
    console.log('AI Analysis cancelled by user.');
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
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 min-h-[calc(100vh-12rem)] animate-in fade-in duration-500">
      {/* 1. Left Column: Full Height Chat Interface */}
      <div className="xl:col-span-1 flex flex-col h-full min-h-[600px]">
        <div className="flex-1 bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden">
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
                                p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
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

                           {/* Thought Trace (Option C) */}
                           {msg.traces && msg.traces.length > 0 && (
                             <div className="mt-4 pt-4 border-t border-slate-200/50">
                               <button 
                                 onClick={() => setActiveTraces(msg.traces || null)}
                                 className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest group"
                               >
                                 <Sparkles className="w-3 h-3 group-hover:animate-pulse" />
                                 <span>AI Thought Trace ({msg.traces.length} steps)</span>
                                 <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                               </button>
                             </div>
                           )}
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
                      ref={textareaRef}
                      placeholder={selectedIds.length === 0 ? "Select tables first" : "Ask AI to visualize or analyze..."}
                      disabled={selectedIds.length === 0}
                      rows={1}
                      className="w-full p-4 pr-14 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-blue-100 transition-all resize-none shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px] overflow-y-auto custom-scrollbar"
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
      </div>
      {/* 2. Right Column: Data Source + Charts */}
      <div className="xl:col-span-2 flex flex-col gap-8">
        {/* 2a. Data Source Context Bar */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSourceModalOpen(true)}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 group shrink-0"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform" />
              Data Source
            </button>
            
            <div className="flex flex-wrap gap-2 items-center">
              {selectedIds.length === 0 ? (
                <div className="flex items-center gap-2 text-slate-300 ml-2">
                  <span className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">No tables selected. Click 'Data Source'.</span>
                </div>
              ) : (
                selectedIds.map(id => {
                  const table = allTables.find(t => t.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[11px] font-black border border-blue-100 animate-in fade-in slide-in-from-left-2">
                      {table?.displayName || table?.name || id}
                      <X size={12} className="cursor-pointer hover:text-red-500 transition-colors" onClick={() => toggleTable(id)} />
                    </span>
                  );
                })
              )}
            </div>
          </div>
          
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 shrink-0">
               <button 
                onClick={() => handleSend("현재 선택한 테이블들의 데이터를 분석해서 시각화 차트를 추천해줘.")}
                disabled={isTyping}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-900/10 flex items-center gap-3"
              >
                {isTyping ? <RotateCcw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {isTyping ? 'Analyzing...' : 'Auto-Generate'}
              </button>
            </div>
          )}
        </div>

        {/* 2b. Visualization Area */}
        <div className="space-y-8 h-full">
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
                      <div className="md:col-span-2 bg-white/50 backdrop-blur-sm p-12 rounded-[40px] border border-dashed border-blue-200 flex flex-col items-center justify-center animate-in fade-in duration-300">
                         <div className="relative w-16 h-16 mb-6">
                            <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
                            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin" />
                         </div>
                         <p className="text-xs font-black text-blue-600 uppercase tracking-widest animate-pulse mb-8">AI가 데이터를 분석하며 차트를 구성 중입니다...</p>
                         
                         <button 
                          onClick={handleCancelAnalysis}
                          className="px-6 py-2.5 bg-white text-red-500 border border-red-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all shadow-sm flex items-center gap-2"
                         >
                           <X size={14} />
                           Cancel Analysis
                         </button>
                      </div>
                    )}
                 </div>
               )}
            </div>
         </div>
      
      {/* 3. AI Trace Modal */}
      {activeTraces && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">AI Thought Trace</h3>
                  <p className="text-[10px] font-medium text-slate-400">Step-by-step analysis and tool execution logs</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTraces(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-900"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {activeTraces.map((trace: any, tIdx: number) => (
                <div key={tIdx} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg">
                      STEP #{tIdx + 1}
                    </div>
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-[10px] font-black text-slate-300">{trace.duration}ms</span>
                  </div>
                  
                  <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                        <Bot size={14} />
                        {trace.toolName}
                      </h4>
                    </div>

                    {trace.context && (
                      <div className="p-3 bg-blue-100/50 border border-blue-200 rounded-2xl text-blue-700 text-xs font-bold flex items-start gap-2">
                         <div className="mt-0.5 shrink-0">ℹ️</div>
                         {trace.context}
                      </div>
                    )}

                    {trace.sql && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Executed SQL Query</div>
                        <pre className="bg-slate-900 text-blue-300 p-4 rounded-2xl overflow-x-auto text-xs font-mono shadow-inner border border-slate-800 leading-relaxed">
                          {trace.sql}
                        </pre>
                      </div>
                    )}

                    <div className="flex flex-col gap-6">
                      <div className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parameters</div>
                        <pre className="bg-white p-4 rounded-2xl border border-slate-200 overflow-x-auto text-[10px] font-mono max-h-[300px]">
                          {JSON.stringify(trace.args, null, 2)}
                        </pre>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Result Summary</div>
                          <button 
                            onClick={(e) => {
                              const text = typeof trace.result === 'object' ? JSON.stringify(trace.result, null, 2) : String(trace.result);
                              navigator.clipboard.writeText(text);
                              const btn = e.currentTarget;
                              const originalInner = btn.innerHTML;
                              btn.innerHTML = 'COPIED!';
                              btn.classList.add('text-green-600');
                              setTimeout(() => {
                                btn.innerHTML = originalInner;
                                btn.classList.remove('text-green-600');
                              }, 2000);
                            }}
                            className="flex items-center gap-1.5 px-2 py-1 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                          >
                            <Copy size={10} />
                            <span className="text-[9px] font-black uppercase">Copy Data</span>
                          </button>
                        </div>
                        <pre className="bg-white p-4 rounded-2xl border border-slate-200 overflow-x-auto text-[10px] font-mono max-h-[500px]">
                          {typeof trace.result === 'object' 
                            ? JSON.stringify(trace.result, null, 2).substring(0, 5000) + (JSON.stringify(trace.result).length > 5000 ? '...' : '')
                            : String(trace.result)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setActiveTraces(null)}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 4. Source Selection Modal */}
      <SourceSelectionModal 
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        allTables={allTables}
        selectedIds={selectedIds}
        toggleTable={toggleTable}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </div>
  );
}
