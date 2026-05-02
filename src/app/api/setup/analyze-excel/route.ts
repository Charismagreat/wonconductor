import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as XLSX from 'xlsx';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * API to analyze an uploaded Excel file and suggest a DB schema using AI.
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // 1. Read Excel file
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Get rows as JSON (first row as headers)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = jsonData[0] as string[];
        const samples = jsonData.slice(1, 6); // Up to 5 sample rows

        if (!headers || headers.length === 0) {
            return NextResponse.json({ error: 'Failed to extract headers from Excel' }, { status: 400 });
        }

        // 2. Prompt Gemini to generate schema
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        
        const prompt = `
            Analyze the following Excel sheet structure and suggest a database table schema.
            The goal is to create a physical table representing this data.
            
            Headers: ${JSON.stringify(headers)}
            Sample Data: ${JSON.stringify(samples)}
            
            Return ONLY a JSON array of column definitions in the following format:
            [
              {
                "name": "snake_case_column_name",
                "displayName": "Friendly Name in Korean",
                "type": "TEXT" | "INTEGER" | "REAL" | "DATE",
                "notNull": true | false
              }
            ]
            
            Guidelines:
            - Decide types (TEXT, INTEGER, REAL, DATE) based on sample data.
            - Ensure column names are clean snake_case.
            - Translate display names to natural Korean if possible.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Clean up JSON response from AI
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('AI failed to generate a valid JSON schema');
        }
        const schema = JSON.parse(jsonMatch[0]);

        return NextResponse.json({ 
            success: true, 
            tableName: file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
            displayName: file.name.split('.')[0],
            schema 
        });

    } catch (error: any) {
        console.error('[AnalyzeExcelAPI] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
