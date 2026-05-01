import React from 'react';
import { getSystemSettingsAction } from '@/app/actions/system';
import SettingsClient from './SettingsClient';
import { redirect } from 'next/navigation';
import { getSessionAction } from '@/app/actions/auth';
import PageHeader from '@/components/PageHeader';
import { Settings } from 'lucide-react';

export const metadata = {
  title: '시스템 환경 설정 - EGDesk',
  description: '시스템 환경 설정 관리',
};

export default async function SettingsPage() {
  const session = await getSessionAction();
  if (!session || session.role !== 'ADMIN') {
    redirect('/login');
  }

  const initialSettings = await getSystemSettingsAction();

  return (
    <div className="px-8 md:px-12 pt-6 pb-12">
      <PageHeader 
        title="SYSTEM SETTINGS" 
        description="대시보드의 시스템 브랜딩 및 전역 환경을 설정합니다."
        icon={Settings}
      />

      <main className="max-w-[1600px] mx-auto mt-12 space-y-12">
        <SettingsClient initialSettings={initialSettings} />
      </main>
    </div>
  );
}
