import { getSessionAction } from "@/app/actions/auth";
import { getOrganizationDataAction } from "@/app/actions/organization";
import { OrganizationManager } from "@/components/OrganizationManager";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import PageHeader from '@/components/PageHeader';

export default async function OrganizationPage() {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') {
        redirect('/');
    }

    const { departments, members } = await getOrganizationDataAction();

    return (
        <main className="w-full mx-auto pt-6 pb-12 px-8 md:px-12 space-y-6">
            <OrganizationManager 
                initialDepartments={departments}
                initialMembers={members}
            />
        </main>
    );
}
