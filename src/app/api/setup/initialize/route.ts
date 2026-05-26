import { NextResponse } from 'next/server';
import { SystemConfigService } from '@/lib/services/system-config-service';
import { listTables, createTable, queryTable, insertRows } from '@/egdesk-helpers';
import { hashPassword, SYSTEM_TABLES } from '@/app/actions/shared';

/**
 * API to initialize the system settings for a new company.
 */
export async function POST(request: Request) {
    try {
        const { companyName, logoUrl, themeColor, businessContext, geminiApiKey, adminUsername, adminPassword } = body;

        if (!companyName) {
            return NextResponse.json({ error: 'Company Name is required' }, { status: 400 });
        }

        if (!adminUsername || !adminPassword) {
            return NextResponse.json({ error: 'Admin Username and Password are required' }, { status: 400 });
        }

        const success = await SystemConfigService.updateSettings({
            companyName,
            logoUrl: logoUrl || '',
            themeColor: themeColor || '#2563eb',
            businessContext: businessContext || '',
            geminiApiKey: geminiApiKey || '',
            isInitialized: true // Mark as initialized
        });

        if (!success) {
            return NextResponse.json({ error: 'Failed to update settings in database' }, { status: 500 });
        }

        // Initialize All System Tables
        await SystemConfigService.ensureSystemTables();

        // 3단계: 관리자 계정 생성 (테이블 생성 직후이므로 약간의 지연시간을 두고 재시도 로직 추가)
        let adminResult;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                adminResult = await queryTable('user', { filters: { username: adminUsername } });
                break; // 성공 시 루프 탈출
            } catch (e: any) {
                console.warn(`[InitializeAPI] user 테이블 조회 시도 ${retryCount + 1}/${maxRetries} 실패: ${e.message}`);
                retryCount++;
                if (retryCount >= maxRetries) throw e; // 마지막 시도도 실패하면 에러 투척
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기 후 재시도
            }
        }

        const adminRows = Array.isArray(adminResult) ? adminResult : (adminResult?.rows || []);

        if (adminRows.length === 0) {
            const hashed = hashPassword(adminPassword);
            await insertRows('user', [{
                username: adminUsername,
                password: hashed,
                role: 'ADMIN',
                fullName: 'System Administrator',
                isActive: 1,
                createdAt: new Date().toISOString()
            }]);
            console.log(`[InitializeAPI] Created admin user: ${adminUsername}`);
        } else {
            // Update existing admin if it exists
            const hashed = hashPassword(adminPassword);
            await updateRows('user', { 
                password: hashed,
                role: 'ADMIN',
                isActive: 1
            }, { filters: { username: adminUsername } });
            console.log(`[InitializeAPI] Updated existing admin user: ${adminUsername}`);
        }

        return NextResponse.json({ success: true, message: 'System initialized successfully' });

    } catch (error: any) {
        try {
            const fs = require('fs');
            const logPath = 'c:\\dev\\ExcelToDB\\api_error.log';
            const logContent = `[${new Date().toISOString()}] Initialize API Error: ${error.message}\nStack: ${error.stack}\n\n`;
            fs.appendFileSync(logPath, logContent);
        } catch (e) {}
        
        console.error('[InitializeAPI] Error Details:', error);
        return NextResponse.json({ 
            error: error.message || 'Internal Server Error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

