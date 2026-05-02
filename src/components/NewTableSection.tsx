'use client';

import React, { useState } from 'react';
import { Plus, Upload, Database, Layout, ArrowRight } from 'lucide-react';
import { UploadWorkflow } from './UploadWorkflow';
import { ManualTableModal } from './ManualTableModal';

export function NewTableSection({ 
  userId, 
  showManualModal = false, 
  setShowManualModal 
}: { 
  userId: string;
  showManualModal?: boolean;
  setShowManualModal: (show: boolean) => void;
}) {

  return (
    <div className="space-y-12">
      {/* METHOD 1: EXCEL SMART INGESTION */}
      <section className="bg-white p-10 border border-gray-100 rounded-[40px] shadow-sm overflow-hidden relative group animate-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2 bg-blue-50 rounded-xl">
             <Upload size={20} className="text-blue-600" />
          </div>
          <div>
             <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-0.5">System Protocol 01</h2>
             <h3 className="text-lg font-black text-gray-900 tracking-tight">Excel Asset Ingestion</h3>
          </div>
        </div>
        
        <div className="bg-gray-50/80 p-8 lg:p-12 rounded-[32px] border border-gray-100/50 shadow-inner">
           <div className="w-full">
              <UploadWorkflow userId={userId} />
           </div>
        </div>
      </section>

      {showManualModal && <ManualTableModal onClose={() => setShowManualModal(false)} />}
    </div>
  );
}


