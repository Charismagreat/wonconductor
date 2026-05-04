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
      <section className="bg-white p-2 rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
        <div className="bg-slate-50/80 p-8 lg:p-12 rounded-[32px] border border-slate-100/50 shadow-inner">
           <div className="w-full">
              <UploadWorkflow userId={userId} />
           </div>
        </div>
      </section>

      {showManualModal && <ManualTableModal onClose={() => setShowManualModal(false)} />}
    </div>
  );
}


