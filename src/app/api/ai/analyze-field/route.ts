import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { queryTable } from '@/egdesk-helpers';
import { addRowAction } from '@/app/actions/row';
import { getSessionAction } from '@/app/actions/auth';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: "v1beta" });

export async function POST(req: NextRequest) {
    try {
        const session = await getSessionAction();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;
        const imageFile = formData.get('image') as File | null;
        const deptId = formData.get('deptId') as string;

        if (!audioFile) {
            return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
        }

        // 1. Convert files to Base64 for Gemini
        const audioBase64 = Buffer.from(await audioFile.arrayBuffer()).toString('base64');
        const imageBase64 = imageFile ? Buffer.from(await imageFile.arrayBuffer()).toString('base64') : null;

        // 2. Fetch available tables to help AI decide context
        const reports = await queryTable('dashboard_master', { limit: 20 });
        const reportContext = reports.map(r => `- ${r.name} (ID: ${r.id}, Description: ${r.description})`).join('\n');

        // 3. AIS Prompt Construction
        const prompt = `
            사용자는 제조 현장에서 근무 중인 실무자입니다. 
            방금 전달된 음성(필수)과 사진(선택)을 분석하여 적절한 데이터베이스 행(Row) 데이터를 생성해 주세요.

            [사용 가능한 테이블 목록]
            ${reportContext}

            [분석 가이드라인]
            1. 음성의 내용을 텍스트로 정확히 추출하고, 화자의 의도를 파악하세요.
            2. 사진이 있다면 음성 내용과 사진 속 정보를 결합하세요. (예: "이 제품 불량입니다" + 제품 사진 속의 품번 식별)
            3. 위 목록 중 가장 적합한 '테이블(Report)'을 하나 선택하여 ID를 지정하세요.
            4. 해당 테이블에 들어갈 필드 데이터(키-값 쌍)를 생성하세요. 
            5. 날짜는 "YYYY-MM-DD" 형식을 사용하고, 숫자는 따옴표 없는 숫자로 표현하세요.
            6. "memo" 또는 "note" 컬럼이 있다면 음성 원본 텍스트 전체를 포함해 주세요.

            반드시 아래 JSON 형식으로만 응답하세요:
            {
                "reportId": "선택한 테이블 ID",
                "data": { "컬럼명": "값", ... },
                "summary": "AI가 요약한 상황 한 줄 (한국어)"
            }
        `;

        const parts: any[] = [
            { text: prompt },
            { inlineData: { data: audioBase64, mimeType: audioFile.type } }
        ];

        if (imageBase64 && imageFile) {
            parts.push({ inlineData: { data: imageBase64, mimeType: imageFile.type } });
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        // Parse JSON safely
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI 응답에서 유효한 데이터를 찾지 못했습니다.");
        const aiResult = JSON.parse(jsonMatch[0]);

        // 4. Actually insert the data using our action (this will also trigger the workflow)
        const insertRes = await addRowAction(aiResult.reportId, aiResult.data);

        return NextResponse.json({
            success: true,
            aiSummary: aiResult.summary,
            reportId: aiResult.reportId,
            insertedData: aiResult.data,
            insertResponse: insertRes
        });

    } catch (err: any) {
        console.error("Field Analysis Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
