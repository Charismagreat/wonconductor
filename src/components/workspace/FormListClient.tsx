'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, ArrowLeft, Search, Star, Clock } from 'lucide-react';

interface Props {
  initialTemplates: any[];
}

export function FormListClient({ initialTemplates }: Props) {
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [recents, setRecents] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);
  
  // 로컬 스토리지 로드 (Client-side only)
  useEffect(() => {
    setMounted(true);
    const savedFavorites = localStorage.getItem('form_favorites');
    const savedRecents = localStorage.getItem('form_recents');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedRecents) setRecents(JSON.parse(savedRecents));
  }, []);

  const toggleFavorite = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    const newFavorites = favorites.includes(id) 
      ? favorites.filter(fid => fid !== id)
      : [...favorites, id];
    setFavorites(newFavorites);
    localStorage.setItem('form_favorites', JSON.stringify(newFavorites));
  };

  const addToRecents = (id: number) => {
    const newRecents = [id, ...recents.filter(rid => rid !== id)].slice(0, 5);
    setRecents(newRecents);
    localStorage.setItem('form_recents', JSON.stringify(newRecents));
  };

  const filteredTemplates = initialTemplates
    .filter(tpl => tpl.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aFav = favorites.includes(a.id);
      const bFav = favorites.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

  const recentTemplates = recents
    .map(id => initialTemplates.find(tpl => tpl.id === id))
    .filter(tpl => tpl !== undefined);

  if (!mounted) return <div className="animate-pulse space-y-6">
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 bg-white border border-slate-200 rounded-2xl shadow-sm" />
      <div className="flex-1 h-11 bg-white border border-slate-200 rounded-2xl shadow-sm" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="h-[140px] bg-white border border-slate-200 rounded-2xl shadow-sm" />
      <div className="h-[140px] bg-white border border-slate-200 rounded-2xl shadow-sm" />
    </div>
  </div>;

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <Link 
          href="/workspace" 
          className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-95 shrink-0"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="찾으시는 양식 이름을 입력하세요..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-bold placeholder:text-slate-400 shadow-sm"
          />
        </div>
      </div>

      {/* Recent Forms Chips */}
      {!search && recentTemplates.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 shrink-0">
            <Clock size={12} />
            <span>최근 사용</span>
          </div>
          {recentTemplates.map((tpl: any) => (
            <Link 
              key={tpl.id}
              href={`/workspace/forms/${tpl.id}`}
              onClick={() => addToRecents(tpl.id)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-bold text-slate-700 hover:border-blue-400 hover:text-blue-600 transition-all shrink-0 shadow-sm"
            >
              {tpl.name}
            </Link>
          ))}
        </div>
      )}

      {/* Main List */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[24px] border border-slate-200 shadow-sm">
          <FileText size={48} className="text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">
            {search ? `'${search}'에 대한 결과가 없습니다` : '사용 가능한 양식이 없습니다'}
          </h3>
          <p className="text-slate-500 mt-1 text-center text-sm">
            {search ? '검색어를 확인하시거나 다른 이름을 입력해 보세요.' : '관리자가 폼 스튜디오에서 양식을 배포하면 이곳에서 문서를 작성할 수 있습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTemplates.map((tpl: any) => {
            const isFavorite = favorites.includes(tpl.id);
            return (
              <Link 
                href={`/workspace/forms/${tpl.id}`} 
                key={tpl.id}
                onClick={() => addToRecents(tpl.id)}
                className="group flex bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all h-[140px] shadow-sm relative"
              >
                <div className="w-1/3 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                  {tpl.backgroundImageData ? (
                    <img src={tpl.backgroundImageData} alt={tpl.name} className="w-full h-full object-cover object-top opacity-70 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <FileText className="text-slate-300" size={32} />
                  )}
                  {/* Favorite Star Overlay */}
                  <button 
                    onClick={(e) => toggleFavorite(e, tpl.id)}
                    className={`absolute top-2 left-2 p-1.5 rounded-lg backdrop-blur-md transition-all z-10 ${isFavorite ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white/80 text-slate-400 hover:text-orange-500 opacity-0 group-hover:opacity-100'}`}
                  >
                    <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
                  </button>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-800 truncate pr-2">{tpl.name}</h3>
                      {isFavorite && <Star size={14} className="text-orange-500 fill-orange-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      연결: {tpl.sourceTable || '기본'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      문서 작성하기 <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

