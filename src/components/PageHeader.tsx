import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    description: string;
    icon: LucideIcon;
    rightElement?: React.ReactNode;
}

export default function PageHeader({ title, description, icon: Icon, rightElement }: PageHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
            <div className="animate-in fade-in slide-in-from-left duration-500">
                <h1 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3 font-[family-name:var(--font-geist-sans)]">
                    <span className="uppercase">{title}</span>
                    {Icon && (typeof Icon === 'function' || typeof Icon === 'object') && (
                        <Icon className="text-blue-600 shrink-0" size={24} />
                    )}
                </h1>
                <p className="text-slate-500 font-medium mt-2 leading-relaxed max-w-2xl text-xs md:text-sm font-[family-name:var(--font-geist-sans)]">
                    {description}
                </p>
            </div>
            {rightElement && (
                <div className="animate-in fade-in slide-in-from-right duration-700">
                    {rightElement}
                </div>
            )}
        </div>
    );
}
