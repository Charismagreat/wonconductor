'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { deleteFormTemplateAction } from '@/app/actions/form-studio';
import { useRouter } from 'next/navigation';

interface FormDeleteButtonProps {
  id: number;
  name: string;
}

export default function FormDeleteButton({ id, name }: FormDeleteButtonProps) {
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirm(`'${name}' 양식을 삭제하시겠습니까?`)) {
      try {
        const result = await deleteFormTemplateAction(id);
        if (result.success) {
          router.refresh();
        } else {
          alert('삭제 실패: ' + result.error);
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
      title="삭제하기"
    >
      <Trash2 size={16} />
    </button>
  );
}
