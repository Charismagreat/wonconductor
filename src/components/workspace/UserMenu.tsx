'use client';

import React, { useState } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import LogoutButton from '../LogoutButton';

interface UserMenuProps {
    user: any;
}

export default function UserMenu({ user }: UserMenuProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold">
                    {user.fullName?.charAt(0) || user.username?.charAt(0)}
                </div>
                <span className="text-sm font-bold text-gray-700">
                    {user.fullName || user.username}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[100] animate-in fade-in zoom-in duration-200">
                    <LogoutButton 
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors justify-start shadow-none" 
                    />
                </div>
            )}
            
            {/* Overlay to close on click outside */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[90]" 
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
