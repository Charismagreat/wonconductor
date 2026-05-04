'use client';

import React, { useState } from 'react';
import { Plus, X, Mic, Camera, Search } from 'lucide-react';
import { AiInputOverlay } from './AiInputOverlay';
import { submitWorkspaceDataAction } from '@/app/workspace/actions';

export function SmartFAB() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);
    const [activeMode, setActiveMode] = useState<'camera' | 'mic' | 'file' | null>(null);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    
    const handleOpenOverlay = (mode: 'camera' | 'mic' | 'file') => {
        setActiveMode(mode);
        setIsOverlayOpen(true);
        setIsMenuOpen(false); // 메뉴 닫기
    };

    const handleCloseOverlay = () => {
        setIsOverlayOpen(false);
        setActiveMode(null);
    };

    const handleSubmit = async (text: string, files: File[], lat?: number, lng?: number) => {
        try {
            const formData = new FormData();
            formData.append('text', text);
            files.forEach(file => {
                formData.append('image', file);
            });
            
            if (lat) formData.append('lat', lat.toString());
            if (lng) formData.append('lng', lng.toString());
            
            const result = await submitWorkspaceDataAction(formData);
            return result; // 결과를 반환하여 Overlay에서 처리하게 함
        } catch (error: any) {
            console.error('Submit handling error:', error);
            return { success: false, message: error.message || '요청 처리 중 오류가 발생했습니다.' };
        }
    };

    return (
        <>
            {/* Backdrop Blur when menu is open */}
            {isMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-30 animate-in fade-in duration-300"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
                {/* Expandable Menu Buttons */}
                <div className={`flex flex-col items-center space-y-4 mb-6 transition-all duration-300 transform ${
                    isMenuOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-50 pointer-events-none'
                }`}>
                    {/* Camera Button */}
                    <div className="flex items-center group">
                        <span className="mr-3 px-3 py-1.5 bg-white/90 backdrop-blur shadow-sm rounded-lg text-[11px] font-bold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                            카메라 촬영
                        </span>
                        <button
                            onClick={() => handleOpenOverlay('camera')}
                            className="w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        >
                            <Camera size={20} />
                        </button>
                    </div>

                    {/* Mic Button */}
                    <div className="flex items-center group">
                        <span className="mr-3 px-3 py-1.5 bg-white/90 backdrop-blur shadow-sm rounded-lg text-[11px] font-bold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                            음성 보고
                        </span>
                        <button
                            onClick={() => handleOpenOverlay('mic')}
                            className="w-12 h-12 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        >
                            <Mic size={20} />
                        </button>
                    </div>

                    {/* File Button */}
                    <div className="flex items-center group">
                        <span className="mr-3 px-3 py-1.5 bg-white/90 backdrop-blur shadow-sm rounded-lg text-[11px] font-bold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                            파일 찾기
                        </span>
                        <button
                            onClick={() => handleOpenOverlay('file')}
                            className="w-12 h-12 bg-slate-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        >
                            <Search size={20} />
                        </button>
                    </div>
                </div>

                {/* Main FAB: Explicit Vibrant Colors */}
                <button
                    onClick={toggleMenu}
                    className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-[0_10px_40px_rgba(37,99,235,0.4)] transition-all duration-300 transform active:scale-90 z-50 ${
                        isMenuOpen 
                        ? 'bg-slate-800' 
                        : 'bg-blue-600'
                    }`}
                >
                    <div className="transition-transform duration-300">
                       {isMenuOpen ? (
                         <X size={28} className="text-white stroke-[3]" />
                       ) : (
                         <Plus size={34} className="text-white stroke-[3]" />
                       )}
                    </div>
                    
                    {!isMenuOpen && (
                        <div className="absolute inset-0 rounded-full border-4 border-blue-400 opacity-30 animate-ping" style={{ animationDuration: '2s' }} />
                    )}
                </button>
            </div>

            <AiInputOverlay 
                isOpen={isOverlayOpen} 
                onClose={handleCloseOverlay} 
                onSubmit={handleSubmit}
                initialMode={activeMode}
            />
        </>
    );
}

