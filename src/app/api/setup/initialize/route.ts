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
        const { companyName, logoUrl, themeColor, businessContext } = body;

        if (!companyName) {
            return NextResponse.json({ error: 'Company Name is required' }, { status: 400 });
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

        // Check if admin user exists
        let adminResult;
        try {
            adminResult = await queryTable('user', { filters: { username: 'admin' } });
        } catch (e: any) {
            throw new Error(`queryTable(user) failed at route: ${e.message}`);
        }

        const adminRows = Array.isArray(adminResult) ? adminResult : (adminResult?.rows || []);
        if (adminRows.length === 0) {
            const adminPassword = hashPassword('admin123');
            try {
            await insertRows('user', [{
                username: 'admin',
                password: adminPassword,
                role: 'ADMIN',
                fullName: 'System Administrator',
                isActive: 1,
                createdAt: new Date().toISOString()
            }]);
            } catch (e: any) {
                throw new Error(`insertRows(user) failed at route: ${e.message}`);
            }
            console.log('[InitializeAPI] Created default admin user');
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

