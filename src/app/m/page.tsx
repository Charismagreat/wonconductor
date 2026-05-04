import React from 'react';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { DynamicDashboard } from '@/components/mobile/DynamicDashboard';
import { TimelineFeed } from '@/components/mobile/TimelineFeed';
import { getSessionAction } from '@/app/actions/auth';
import { getPublicSystemSettingsAction } from '@/app/actions/system';
import { redirect } from 'next/navigation';

export default async function MobileDashboardPage() {
  const session = await getSessionAction();
  if (!session) {
    redirect('/login');
  }

  const settings = await getPublicSystemSettingsAction();
  const companyName = settings?.companyName || 'Won Conductor';

  return (
    <MobileLayout user={session} branding={companyName}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-700">
        <DynamicDashboard user={session} />
        <TimelineFeed />
        
        {/* Extra Padding for Bottom Navigation */}
        <div className="h-6" />
      </div>
    </MobileLayout>
  );
}
