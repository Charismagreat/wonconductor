import { BottomNav } from '@/components/workspace/BottomNav';
import { SmartFAB } from '@/components/workspace/SmartFAB';
import UserMenu from '@/components/workspace/UserMenu';

import { getSessionAction } from '@/app/actions/auth';
import { getPublicSystemSettingsAction } from '@/app/actions/system';
import { redirect } from 'next/navigation';

export default async function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getSessionAction();
    if (!user) {
        redirect('/login');
    }

    const settings = await getPublicSystemSettingsAction();
    const companyName = settings?.companyName || 'Won Conductor';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col relative w-full overflow-hidden mobile-shell">
            {/* Header: Unified with User Name & Logout */}
            <header className="fixed top-0 w-full bg-white bg-opacity-90 backdrop-blur-md border-b border-gray-100 z-40 h-14 flex items-center justify-between px-6">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        {companyName}
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <UserMenu user={user} />
                </div>
            </header>

            {/* Main Content Scroll Area */}
            <main className="flex-1 overflow-y-auto mt-14 pb-20 no-scrollbar">
                <div className="max-w-lg mx-auto w-full px-4 pt-2 pb-6">
                    {children}
                </div>
            </main>

            {/* Smart FAB */}
            <SmartFAB />
            
            <BottomNav />
        </div>
    );
}
