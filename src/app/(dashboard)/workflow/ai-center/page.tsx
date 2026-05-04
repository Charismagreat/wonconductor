import PageHeader from "@/components/PageHeader";
import { BrainCircuit } from "lucide-react";
import { getSessionAction } from "@/app/actions/auth";
import { getWorkflowsByStatusAction } from "@/app/actions/ai-center-workflows";
import { redirect } from "next/navigation";
import { AICenterWorkflowsClient } from "@/components/AICenterWorkflowsClient";

export default async function AICenterWorkflowsPage() {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        redirect('/');
    }

    const [suggestedWorkflows, activeWorkflows] = await Promise.all([
        getWorkflowsByStatusAction('suggested'),
        getWorkflowsByStatusAction('active'),
    ]);

    return (
        <div className="px-8 md:px-12 pt-6 pb-12">
            <PageHeader
                title="AI CENTER"
                description="AI가 설계한 패턴 기반 워크플로우를 검토하고 활성화합니다. 활성화된 워크플로우는 새 데이터 등록 시 자동으로 실행됩니다."
                icon={BrainCircuit}
            />

            <main className="max-w-[1600px] mx-auto mt-12">
                <AICenterWorkflowsClient
                    suggestedWorkflows={suggestedWorkflows}
                    activeWorkflows={activeWorkflows}
                />
            </main>
        </div>
    );
}
