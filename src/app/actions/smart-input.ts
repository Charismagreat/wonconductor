'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { listTables, getTableSchema } from '@/egdesk-helpers';
import { INDUSTRY_TEMPLATES } from '@/lib/constants/industry-templates';
import { SystemConfigService } from '@/lib/services/system-config-service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Server Action to process multimodal input (Image/Voice/Text) and map to a table.
 */
export async function processSmartInput(params: {
    image?: string; // base64
    text?: string;
    currentTableId?: string; // Optional context: "I am already looking at this table"
}) {
    try {
        console.log('[SmartInput] Starting analysis...');

        // 1. Get Context: Existing tables vs Templates
        // Note: For brevity and context limit, we send names and descriptions
        const existingTables = await listTables();
        const templatesBrief = INDUSTRY_TEMPLATES.map(t => ({
            id: t.id,
            name: t.displayName,
            description: t.description
        }));

        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        // 2. Build the "World of Tables" prompt
        let prompt = `
            You are a professional business data analyst. 
            An employee is trying to report data using ${params.image ? 'a photo' : 'a voice message'}.
            
            Your mission:
            1. Identify which table (either from existing or standard templates) fits this data best.
            2. Extract columns matching the chosen table's schema into a JSON object.
            
            Existing User Tables: ${JSON.stringify(existingTables)}
            Industry Templates: ${JSON.stringify(templatesBrief)}
            
            ${params.text ? `Employee Command: "${params.text}"` : ''}
            
            Return format (JSON ONLY):
            {
                "match": {
                    "type": "existing" | "template",
                    "id": "tableName or template_id",
                    "displayName": "Table Name"
                },
                "data": { "column_name": "value", ... },
                "reasoning": "Brief explanation in Korean"
            }
            
            Guidelines:
            - If no existing table matches, choose a Template ID.
            - Extract values like dates (YYYY-MM-DD), numbers (REAL/INTEGER), and text carefully.
            - If metadata is present in schema, put extra info there as JSON string.
        `;

        const parts: any[] = [{ text: prompt }];
        if (params.image) {
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: params.image.split(',')[1] || params.image
                }
            });
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const resultText = response.text();
        
        // Clean up JSON response
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AI failed to reach a structured conclusion.');
        }

        const analysis = JSON.parse(jsonMatch[0]);

        // 3. If matched a template, fetch its full schema to help client components
        if (analysis.match.type === 'template') {
            const template = INDUSTRY_TEMPLATES.find(t => t.id === analysis.match.id);
            if (template) {
                analysis.match.schema = template.schema;
            }
        } else {
            // Match is existing - fetch real DB schema
            const schema = await getTableSchema(analysis.match.id);
            analysis.match.schema = schema;
        }

        console.log('[SmartInput] Analysis complete:', analysis.match.displayName);
        return { success: true, analysis };

    } catch (error: any) {
        console.error('[SmartInput] Error:', error);
        return { success: false, error: error.message };
    }
}
