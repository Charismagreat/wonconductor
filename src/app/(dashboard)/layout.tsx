import React from 'react';
import { getSessionAction } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import DashboardLayoutClient from '@/components/DashboardLayoutClient';
import { BrandingProvider } from '@/components/providers/BrandingProvider';
import { queryTable } from '@/egdesk-helpers';

import { SystemConfigService } from '@/lib/services/system-config-service';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionAction();
  if (!user) {
    redirect('/login');
  }

  // Check if system is initialized. If not, redirect to setup (except on setup page itself)
  const settings = await SystemConfigService.getSettings();
  if (!settings || !settings.isInitialized) {
    redirect('/setup');
  }

  // VIEWER 권한은 대시보드 접근 불가 -> 워크스페이스로 리다이렉트
  if (user.role === 'VIEWER') {
    redirect('/workspace');
  }

  const { listMicroAppsAction } = await import('@/app/actions/publishing');
  const microApps = await listMicroAppsAction();

  return (
    <BrandingProvider settings={settings}>
      <DashboardLayoutClient
        user={user}
        microApps={microApps}
      >
        {children}
      </DashboardLayoutClient>
    </BrandingProvider>
  );
}
