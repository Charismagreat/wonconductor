import React from 'react';
import KnowledgeEditor from '@/components/admin/KnowledgeEditor';
import { getKnowledgeListAction } from '@/app/actions/knowledge';

export const dynamic = 'force-dynamic';

export default async function GuardrailSettingsPage() {
  const res = await getKnowledgeListAction();
  
  return (
    <div className="container mx-auto py-10">
      <KnowledgeEditor />
    </div>
  );
}
