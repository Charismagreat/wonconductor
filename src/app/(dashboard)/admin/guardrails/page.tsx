import React from 'react';
import KnowledgeEditor from '@/components/admin/KnowledgeEditor';
import { getKnowledgeListAction } from '@/app/actions/knowledge';

export const dynamic = 'force-dynamic';

export default async function GuardrailSettingsPage() {
  const res = await getKnowledgeListAction();
  
  return (
    <main className="w-full mx-auto pt-6 pb-12 px-8 md:px-12 space-y-6">
      <KnowledgeEditor />
    </main>
  );
}
