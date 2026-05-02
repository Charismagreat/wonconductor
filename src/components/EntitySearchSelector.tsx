'use client';

import React from 'react';
import { Search, Plus, Check, Loader2, AlertCircle } from 'lucide-react';
import { searchMasterAction, createMasterAction } from '@/app/actions/master';

interface Entity {
    id: string | number;
    [key: string]: any;
}

interface EntitySearchSelectorProps {
    value: string | number;
    initialName?: string;
    onChange: (id: string | number, name: string) => void;
    placeholder?: string;
    isMatched?: boolean;
    masterTable: string;
    lookupField?: string;
    entityLabel: string; // '거래처', '사원' 등 UI 표시용
}

export function EntitySearchSelector({ 
    value, 
    initialName, 
    onChange, 
    placeholder, 
    isMatched,
    masterTable,
    lookupField = 'name',
    entityLabel
}: EntitySearchSelectorProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState(initialName || '');
    const [results, setResults] = React.useState<Entity[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [selectedName, setSelectedName] = React.useState(initialName || '');
    const containerRef = React.useRef<HTMLDivElement>(null);

    // 검색 실행
    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 1) {
            setResults([]);
            return;
        }
        setIsLoading(true);
        const data = await searchMasterAction(masterTable, query, lookupField);
        setResults(data);
        setIsLoading(false);
    };

    // 선택 처리
    const handleSelect = (item: Entity) => {
        const name = item[lookupField] || item.name || String(item.id);
        setSelectedName(name);
        setSearchQuery(name);
        onChange(item.id, name);
        setIsOpen(false);
    };

    // 신규 등록 처리
    const handleCreateNew = async () => {
        if (!searchQuery.trim()) return;
        setIsLoading(true);
        const res = await createMasterAction(masterTable, searchQuery.trim(), lookupField);
        if (res.success && res.item) {
            handleSelect(res.item as Entity);
        }
        setIsLoading(false);
    };

    // 외부 클릭 시 닫기
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={containerRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer transition-all
                    ${isOpen ? 'border-blue-500 ring-2 ring-blue-50' : 'border-gray-200 hover:border-gray-300'}
                    ${isMatched && !value ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                      isMatched ? 'bg-blue-50/50 border-blue-100 text-blue-700' : 'bg-white'}
                `}
            >
                <span className="truncate">
                    {selectedName || (value ? `ID: ${value}` : placeholder || `${entityLabel} 선택`)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isMatched && value && <Check size={12} className="text-blue-500" />}
                    {!value && <AlertCircle size={12} className="text-amber-500" />}
                    <Search size={14} className="text-gray-400" />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="p-2 border-b bg-gray-50/50">
                        <input 
                            autoFocus
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                            placeholder={`${entityLabel} 이름 검색...`}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-4 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-blue-500" /></div>
                        ) : results.length > 0 ? (
                            results.map(item => (
                                <div 
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 group"
                                >
                                    <div className="text-xs font-bold text-gray-700 group-hover:text-blue-700">
                                        {item[lookupField] || item.name || `ID: ${item.id}`}
                                    </div>
                                    {item.businessNumber && <div className="text-[10px] text-gray-400 font-medium">{item.businessNumber}</div>}
                                    {item.email && <div className="text-[10px] text-gray-400 font-medium">{item.email}</div>}
                                </div>
                            ))
                        ) : searchQuery.trim().length > 0 ? (
                            <div className="p-4 text-center">
                                <p className="text-[10px] font-bold text-gray-400 mb-2">검색 결과가 없습니다</p>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleCreateNew(); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black hover:bg-blue-700 transition-all shadow-sm"
                                >
                                    <Plus size={12} /> '{searchQuery}' 신규 등록
                                </button>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-[10px] font-bold text-gray-300 uppercase tracking-widest">Type to search {entityLabel}</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
