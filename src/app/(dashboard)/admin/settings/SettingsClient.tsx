'use client';

import React, { useState } from 'react';
import { updateSystemSettingsAction } from '@/app/actions/system';
import { analyzeCompanyWebsiteAction } from '@/app/actions/ai-analyze';
import { SystemSettings } from '@/lib/services/system-config-service';
import { Save, AlertCircle, CheckCircle2, Loader2, Globe, Sparkles, Key, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SettingsClientProps {
  initialSettings: SystemSettings | null;
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [formData, setFormData] = useState({
    companyName: initialSettings?.companyName || 'EGDesk',
    themeColor: initialSettings?.themeColor || '#2563eb',
    businessContext: initialSettings?.businessContext || '',
    geminiApiKey: initialSettings?.geminiApiKey || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleAnalyzeWebsite = async () => {
    if (!websiteUrl.trim()) {
      setErrorMessage('분석할 홈페이지 URL을 입력해주세요.');
      setSaveStatus('error');
      return;
    }

    let url = websiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
      setWebsiteUrl(url);
    }

    setIsAnalyzing(true);
    setSaveStatus('idle');
    try {
      const result = await analyzeCompanyWebsiteAction(url);
      if (result.success && result.context) {
        setFormData(prev => ({
          ...prev,
          businessContext: prev.businessContext 
            ? prev.businessContext + '\n\n' + result.context 
            : result.context
        }));
      } else {
        throw new Error(result.error || '분석에 실패했습니다.');
      }
    } catch (error: any) {
      setSaveStatus('error');
      setErrorMessage(error.message || '홈페이지 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hasChanges = 
    formData.companyName !== (initialSettings?.companyName || 'EGDesk') ||
    formData.themeColor !== (initialSettings?.themeColor || '#2563eb') ||
    formData.businessContext !== (initialSettings?.businessContext || '') ||
    formData.geminiApiKey !== (initialSettings?.geminiApiKey || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasChanges) return;

    if (!formData.companyName.trim()) {
      setErrorMessage('회사 이름을 입력해주세요.');
      setSaveStatus('error');
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const result = await updateSystemSettingsAction({
        companyName: formData.companyName,
        themeColor: formData.themeColor,
        businessContext: formData.businessContext,
        geminiApiKey: formData.geminiApiKey
      });

      if (result.success) {
        setSaveStatus('success');
        router.refresh();
      } else {
        throw new Error('저장에 실패했습니다.');
      }
    } catch (error: any) {
      setSaveStatus('error');
      setErrorMessage(error.message || '시스템 설정을 저장하는 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 p-8 md:p-12 overflow-hidden relative">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full opacity-50 pointer-events-none" />

      <div className="max-w-3xl relative z-10">
        <div className="mb-10">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">BRANDING & CONFIGURATION</h2>
          <p className="text-slate-500 mt-2 text-sm">회사 이름과 대시보드 테마 색상 등 전역 시스템 설정을 변경할 수 있습니다.</p>
        </div>

        {saveStatus === 'success' && (
          <div className="mb-8 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 size={20} className="text-emerald-500" />
            <p className="text-sm font-bold">시스템 설정이 성공적으로 저장되었습니다. 페이지 새로고침 시 즉시 반영됩니다.</p>
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle size={20} className="text-red-500" />
            <p className="text-sm font-bold">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">회사 이름 (Company Name)</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none placeholder:text-slate-400"
                  placeholder="예: EGDesk Corp."
                  required
                />
                <p className="mt-2 text-xs text-slate-500">대시보드 좌측 상단 및 주요 리포트에 표시될 회사 이름입니다.</p>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">테마 색상 (Theme Color)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    name="themeColor"
                    value={formData.themeColor}
                    onChange={handleChange}
                    className="w-14 h-14 p-1 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    name="themeColor"
                    value={formData.themeColor}
                    onChange={handleChange}
                    className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none min-w-0"
                    placeholder="#2563eb"
                    pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">대시보드 브랜드 색상.</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700">비즈니스 컨텍스트 (Business Context)</label>
              </div>
              
              {/* 홈페이지 분석 영역 추가 */}
              <div className="mb-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                <p className="text-xs font-bold text-indigo-700 mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  AI 홈페이지 자동 분석
                </p>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
                    <input
                      type="text"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="회사 홈페이지 또는 서비스 소개 페이지 URL 입력 (예: https://example.com)"
                      className="w-full pl-11 pr-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyzeWebsite}
                    disabled={isAnalyzing}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        분석 중...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        AI 요약
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-indigo-600/70">
                  입력하신 홈페이지 주소를 AI가 방문하여 회사의 핵심 비즈니스 모델을 3초 만에 요약해 줍니다.
                </p>
              </div>

              <textarea
                name="businessContext"
                value={formData.businessContext}
                onChange={handleChange}
                rows={4}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none placeholder:text-slate-400 resize-none"
                placeholder="AI에게 제공될 우리 회사의 비즈니스 개요, 용어, 혹은 분석 지침을 입력하세요."
              />
              <p className="mt-2 text-xs text-slate-500">AI가 데이터를 분석하거나 프롬프트를 처리할 때 참고할 배경 지식입니다. (직접 수정 가능)</p>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <Key size={18} className="text-blue-600" />
                <label className="block text-sm font-bold text-slate-700">Google Gemini AI API Key</label>
              </div>
              <div className="relative group">
                <input
                  type={showApiKey ? "text" : "password"}
                  name="geminiApiKey"
                  value={formData.geminiApiKey}
                  onChange={handleChange}
                  className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none placeholder:text-slate-400"
                  placeholder="AI 기능을 사용하기 위한 Google Gemini API 키를 입력하세요."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Google AI Studio에서 발급받은 API 키를 입력해주세요. 이 키는 회사의 비즈니스 분석 및 AI 추천 기능에 사용됩니다.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSaving || !hasChanges}
              className={`flex items-center gap-2 px-8 py-4 text-white font-bold rounded-2xl transition-all ${
                isSaving || !hasChanges
                  ? 'bg-slate-300 cursor-not-allowed opacity-70'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95'
              }`}
            >
              {isSaving ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Save size={20} />
              )}
              {isSaving ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
