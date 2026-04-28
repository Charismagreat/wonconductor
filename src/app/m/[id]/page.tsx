import React from 'react';
import { getMicroAppConfigAction } from '@/app/actions/publishing';
import { TemplateRenderer } from '@/components/publishing/TemplateRenderer';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { getSessionAction } from '@/app/actions/auth';
import { notFound } from 'next/navigation';

export default async function MicroAppPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const config = await getMicroAppConfigAction(id);
  const user = await getSessionAction();

  if (!config) {
    notFound();
  }

  // Mock user if no session for guest access (if allowed by config)
  const displayUser = user || { name: 'Guest', role: 'VIEWER' };

  return (
    <MobileLayout 
      user={displayUser} 
      title={config.name} 
      hideNavigation={true}
      branding="APP STUDIO PUBLISHED"
      headerRightContent={
        <div className="px-2 py-1 bg-blue-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-blue-500/20">
          Live Data
        </div>
      }
    >
      <div className="p-4 sm:p-6 animate-in fade-in duration-700">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-900/5">

          
          <div className="p-0">
            <TemplateRenderer 
              id={id}
              templateId={config.templateId}
              sourceTableId={config.sourceTableId}
              mappingConfig={config.mappingConfig}
              uiSettings={config.uiSettings}
              appName={config.name}
            />
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
