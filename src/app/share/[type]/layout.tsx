import React from 'react';

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* 간단한 헤더 (공간 확보를 위해 소거 완료) */}

        <main>
          {children}
        </main>

        <footer className="mt-20 text-center text-slate-400 text-sm pb-12">
          <p>© {new Date().getFullYear()} EasyDesk. All rights reserved.</p>
          <p className="mt-1 font-medium italic opacity-75">Transforming raw data into actionable insights.</p>
        </footer>
      </div>
    </div>
  );
}
