import { NextResponse } from 'next/server';
import { SystemConfigService } from '@/lib/services/system-config-service';
import { listTables, createTable, queryTable, insertRows } from '@/egdesk-helpers';
import { hashPassword, SYSTEM_TABLES } from '@/app/actions/shared';

/**
 * API to initialize the system settings for a new company.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { companyName, logoUrl, themeColor, businessContext, adminUsername, adminPassword } = body;

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
            isInitialized: true // Mark as initialized
        });

        if (!success) {
            return NextResponse.json({ error: 'Failed to update settings in database' }, { status: 500 });
        }

        // Initialize All System Tables
        await SystemConfigService.ensureSystemTables();

        // Check if admin user exists (if username changed, it won't find it)
        const adminResult = await queryTable('user', { filters: { username: adminUsername } });
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

