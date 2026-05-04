export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import { listFormTemplatesAction } from '@/app/actions/form-studio';
import { FormListClient } from '@/components/workspace/FormListClient';

export default async function WorkspaceFormsPage() {
  const result = await listFormTemplatesAction('PUBLISHED');
  const templates = result.success && result.templates ? result.templates : [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4">
      <FormListClient initialTemplates={templates} />
    </div>
  );
}
