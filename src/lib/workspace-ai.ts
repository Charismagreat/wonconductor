import { GoogleGenerativeAI } from "@google/generative-ai";
import { queryTable } from "@/egdesk-helpers";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: "v1beta" });

export interface AdminRecommendation {
    tableName: string;
    columns: { name: string; type: string }[];
    advice: string;
}

export interface WorkspaceAiResult {
    reportId: string | null;
    reportName: string | null;
    extractedData: Record<string, any> | null;
    confidence: number;
    message: string;
    isMultiEntity?: boolean;
    columns?: any[];
    unclassifiedReason?: string;
    suggestedTitle?: string;
    suggestedSummary?: string;
    /** 분류 실패 시 AI가 관리자에게 추천하는 테이블 생성 정보 */
    _recommendation?: AdminRecommendation | null;
}

/**
 * 워크스페이스에서 입력된 데이터(텍스트/이미지)를 분석하여 
 * 적절한 보고서를 찾고 데이터를 추출합니다.
 */
export async function processWorkspaceInput(
    text: string, 
    imageBase64?: string, 
    mimeType?: string
): Promise<WorkspaceAiResult> {
    const fs = require('fs');
    const log = (msg: string) => {
        const time = new Date().toISOString();
        console.log(`[DEBUG_AI] ${msg}`);
        fs.appendFileSync('ai_debug_trace.txt', `[${time}] ${msg}\n`);
    };

    log(`>>> Analysis Start | Text: "${text}" | Image Attached: ${!!imageBase64}`);

    if (!apiKey) {
        log("ERROR: API Key is missing");
        throw new Error("AI API 키가 설정되지 않았습니다.");
    }

    log("Step 1: Querying Reports from DB...");
    const reportsRaw = await queryTable('dashboard_master', { limit: 500 });
    const allReports = Array.isArray(reportsRaw) ? reportsRaw : (reportsRaw as any)?.rows ?? [];
    const reports = allReports.filter((r: any) => !r.isDeleted && r.isDeleted !== '1' && r.isDeleted !== 1 && !r.__is_deleted && r.__is_deleted !== '1' && r.__is_deleted !== 1);
    log(`Step 1 Result: Found ${reports?.length || 0} reports`);

    if (!reports || reports.length === 0) {
        log("Step 1 Exit: No reports found in DB");
        return { 
            reportId: null, 
            reportName: null,
            extractedData: null,
            confidence: 0,
            message: "등록된 보고서가 없습니다. (데이터베이스에 보고서 정의가 존재하지 않음)"
        };
    }

    const reportList = reports.map((r: any) => {
        try {
            return {
                id: r.id,
                name: r.name,
                description: r.description || "",
                columns: JSON.parse(r.columns || "[]").map((c: any) => c.name)
            };
        } catch (e) {
            console.error(`Failed to parse columns for report: ${r.name}`, e);
            return {
                id: r.id,
                name: r.name,
                description: r.description || "",
                columns: []
            };
        }
    });

    console.log(`[AI Classification] Potential matches found:`, reportList.map((r: any) => r.name));

    log(`Step 2: Preparing AI Classification Prompt with ${reportList.length} reports...`);
    const classificationPrompt = `
        당신은 기업 사내 데이터 관리 도우미입니다. 사용자의 입력(텍스트 또는 이미지)을 분석하여 다음 보고서 목록 중 가장 적합한 보고서를 하나 골라주세요.
        
        보고서 목록:
        ${JSON.stringify(reportList, null, 2)}
        
        입력 유형: ${imageBase64 ? "이미지(사진) + 텍스트" : "텍스트 전용"}
        사용자 추가 메시지: "${text || "없음"}"
        
        응답 규칙:
        1. 이미지나 텍스트가 영수증, 결제내역, 카드 사용 내역과 관련이 있다면 반드시 '신용카드영수증' 또는 유사한 이름의 보고서를 선택하세요.
        2. 이미지 속에 '영수증', '승인번호', '합계', '금액' 등의 텍스트가 보인다면 지출 관련 보고서를 매칭하세요.
        3. 가장 관련성이 높은 보고서의 ID를 반환하세요.
        4. 한 장의 사진에 독립된 개체(예: 두 장 이상의 영수증, 여러 개의 명함 등)가 명합히 분리되어 2개 이상 감지될 경우 "isMultiEntity"를 true로 설정하세요.
        5. 확신도가 매우 낮거나(0.4 미만) 매칭되는 항목이 전혀 없을 경우에만 reportId를 null로 반환하세요.
        6. reportId가 null인 경우, 사용자가 올린 내용이 무엇인지 요약하여 'suggestedTitle'과 'suggestedSummary' 필드를 채워주세요. (예: "스타벅스 영수증", "명함 (홍길동)")
        7. 반드시 아래 JSON 형식으로만 응답하세요:
        { "reportId": "선택된 ID 또는 null", "confidence": 0.0~1.0, "isMultiEntity": true/false, "reason": "선택 이유", "suggestedTitle": "제목", "suggestedSummary": "요약" }
    `;

    let classification: { 
        reportId: string | null, 
        confidence: number, 
        isMultiEntity?: boolean, 
        reason?: string,
        suggestedTitle?: string,
        suggestedSummary?: string
    };
    let rawResponseText = "";
    try {
        log("Step 3: Sending request to Google Gemini API...");
        const contents: any[] = [classificationPrompt];
        if (imageBase64 && mimeType) {
            contents.push({ inlineData: { data: imageBase64, mimeType } });
        }
        const result = await model.generateContent(contents);
        rawResponseText = result.response.text();
        log(`Step 4: AI Responded. Raw Length: ${rawResponseText.length}`);

        try {
            const fs = require('fs');
            fs.appendFileSync('ai_classification_log.txt', `\n[${new Date().toISOString()}]\n${rawResponseText}\n`);
        } catch (e) { }

        const cleanedText = rawResponseText.replace(/```json|```/gi, "").trim();
        const firstBrace = cleanedText.indexOf("{");
        const lastBrace = cleanedText.lastIndexOf("}");
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            classification = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
            classification = { reportId: null, confidence: 0, isMultiEntity: false };
        }
        
        log(`Step 5 Parsing: Matching result - ID: ${classification.reportId}, Conf: ${classification.confidence}, Multi: ${classification.isMultiEntity}`);
    } catch (e: any) {
        log(`Step 3-5 Error: ${e.message}`);
        console.error("Classification failure:", e);
        classification = { reportId: null, confidence: 0, isMultiEntity: false, reason: e.message, suggestedTitle: "분류 실패", suggestedSummary: "AI 분석 중 오류가 발생했습니다." };
    }

    const unclassifiedData = {
        reportId: null,
        reportName: "분류되지 않은 항목",
        extractedData: null,
        confidence: classification.confidence,
        suggestedTitle: classification.suggestedTitle || "알 수 없는 문서",
        suggestedSummary: classification.suggestedSummary || "매칭되는 테이블을 찾을 수 없는 데이터입니다.",
        unclassifiedReason: classification.reason || "매칭되는 보고서 형식이 없습니다."
    };

    if (classification.isMultiEntity) {
        log("Step 5 Exit: Multiple entities detected in one image");
        return {
            ...unclassifiedData,
            isMultiEntity: true,
            message: "한 장의 사진에 여러 개의 영수증이나 명함이 감지되었습니다. 데이터 정확성을 위해 한 장당 하나의 개체만 촬영하여 업로드해 주세요."
        };
    }

    if (!classification.reportId || classification.confidence < 0.4) {
        // [3차 프롬프트] 관리자를 위한 테이블 생성 추천 — base64 재사용, 추가 비용 최소화
        log("Step 5-R: Generating admin recommendation for table creation...");
        const recommendation = await generateAdminRecommendation(imageBase64, mimeType);
        log(`Step 5-R Result: ${recommendation ? `tableName=${recommendation.tableName}` : 'null'}`);

        return {
            ...unclassifiedData,
            _recommendation: recommendation,
            message: `업로드하신 내용(영수증 등)을 기록할 적당한 항목(보고서)이 워크스페이스에 없습니다.\n(원인: ${classification.reason})`
        };
    }

    const selectedReport = reports.find((r: any) => String(r.id) === String(classification.reportId));
    if (!selectedReport) {
        console.error(`[AI Error] Match found but report could not be located in local list. Target ID: ${classification.reportId}`);
        return { reportId: null, reportName: null, extractedData: null, confidence: 0, message: "보고서 매칭 오류가 발생했습니다." };
    }
    const columns = JSON.parse(selectedReport.columns);

    // 3. 데이터 추출 (Extraction) - 시맨틱 매핑 강화
    log(`Step 6: Starting Data Extraction for report [${selectedReport.name}]...`);
    console.log(`[AI Extraction] Starting for ${selectedReport.name}...`);
    const extractionPrompt = `
        사용자의 입력(이미지 및 텍스트)을 분석하여 보고서 '${selectedReport.name}'의 컬럼 정의에 맞는 데이터를 추출하세요.
        
        컬럼 정의 (시맨틱 매핑 필요):
        ${columns.map((c: any) => `- ${c.name} (타입: ${c.type}${c.options ? `, 옵션: ${c.options.join(',')}` : ''}${c.isAutoGenerated ? ', 자동생성컬럼' : ''})`).join('\n')}
        
        중요 지침:
        1. 시맨틱 매핑: 이미지 속의 필드명이 컬럼명과 정확히 일치하지 않더라도 의미상 동일하면 매핑하세요. 
           (예: 영수증의 '일시' -> '승인일시', '금액' -> '사용금액', '상호' -> '가맹점명')
        2. 타입 변환:
           - 날짜: '2024년 04월 06일' 등은 반드시 'YYYY-MM-DD' 또는 'YYYY-MM-DD HH:mm:ss' 형식으로 변환하세요.
           - 숫자: '15,000원' 등은 통화 기호와 콤마를 제거하고 순수 숫자만 추출하세요.
        3. 필드가 자동생성컬럼(isAutoGenerated: true)인 경우 null을 반환하세요.
        4. 찾을 수 없는 필드는 null로 표시하세요.
        5. 결과는 반드시 JSON 객체 하나만 반환하세요. 설명이나 서술은 생략하세요.
    `;

    let extractedData: any = null;
    try {
        log("Step 7: Sending Extraction Request to Gemini 3...");
        const contents: any[] = [extractionPrompt];
        if (imageBase64 && mimeType) {
            contents.push({ inlineData: { data: imageBase64, mimeType } });
        }
        
        const result = await model.generateContent(contents);
        const responseText = result.response.text();
        log(`Step 8: Extraction Response Received (Length: ${responseText.length})`);
        console.log(`[AI Extraction Raw]:`, responseText);
        
        const cleanedText = responseText.replace(/```json|```/gi, "").trim();
        const firstBrace = cleanedText.indexOf("{");
        const lastBrace = cleanedText.lastIndexOf("}");
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            extractedData = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
            log(`Step 9: JSON Parsing Success. Extracted ${Object.keys(extractedData).length} fields.`);
        } else {
            log("Step 9 Error: Could not find JSON braces in response");
            extractedData = null;
        }
        console.log(`[AI Extraction Success]:`, extractedData);
    } catch (e) {
        console.error("Extraction failure:", e);
    }

    return {
        reportId: String(selectedReport.id),
        reportName: selectedReport.name,
        extractedData,
        confidence: classification.confidence,
        columns: columns,
        tableName: selectedReport.tableName,
        message: extractedData ? `[${selectedReport.name}]에 데이터를 기록했습니다.` : "데이터 추출에 실패했습니다."
    };
}

/**
 * [내부 함수] 분류 실패 시 관리자에게 테이블 생성을 추천합니다.
 * 기존 이미지 base64를 재사용하여 추가 API 호출 비용을 최소화합니다.
 */
async function generateAdminRecommendation(
    imageBase64?: string,
    mimeType?: string
): Promise<AdminRecommendation | null> {
    if (!apiKey) return null;

    const recommendationPrompt = `
        이 이미지(또는 텍스트)는 기존 보고서와 매칭되지 않았습니다.
        이미지를 분석하여 이 데이터를 저장하기 위해 관리자가 만들어야 할 테이블 정보를 추천해 주세요.

        응답 규칙:
        1. 테이블 이름은 한국어로 작성하세요. (예: "신용카드영수증", "출장비용")
        2. 컬럼 목록은 이미지에서 보이는 실제 필드를 기반으로 추천하세요.
        3. 컬럼 타입은 "TEXT", "NUMBER", "DATE" 중 하나만 사용하세요.
        4. adminAdvice는 1~2문장으로 관리자가 취해야 할 조치를 안내합니다.
        5. 반드시 아래 JSON 형식으로만 응답하세요:
        {
            "tableName": "테이블명",
            "columns": [{"name": "컬럼명", "type": "TEXT"}],
            "advice": "관리자 조치 안내 1~2문장"
        }
    `;

    try {
        const contents: any[] = [recommendationPrompt];
        if (imageBase64 && mimeType) {
            contents.push({ inlineData: { data: imageBase64, mimeType } });
        }

        const result = await model.generateContent(contents);
        const responseText = result.response.text();

        const cleanedText = responseText.replace(/```json|```/gi, '').trim();
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            const parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
            // 최소 유효성 검사
            if (parsed.tableName && Array.isArray(parsed.columns) && parsed.advice) {
                return parsed as AdminRecommendation;
            }
        }
    } catch (err) {
        console.error('[generateAdminRecommendation] AI 추천 생성 실패 (silent skip):', err);
    }

    return null;
}
