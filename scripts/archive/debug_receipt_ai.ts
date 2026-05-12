import fs from 'fs';
import path from 'path';

// .env.local에서 API 키 수동 로드
const envContent = fs.readFileSync('.env.local', 'utf8');
const apiKeyMatch = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
if (apiKeyMatch) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKeyMatch[1].trim();
}

import { processWorkspaceInput } from './src/lib/workspace-ai';

async function debugReceiptAi() {
    // 1. 실제 실패가 뜬 이미지 파일 경로 (사용자께서 제공해주신 이미지 기반)
    const imagePath = 'C:\\Users\\CHARISMA\\.gemini\\antigravity\\brain\\848f5921-3434-48b0-bf50-36a6127167f4\\media__1775481488860.png';
    
    if (!fs.existsSync(imagePath)) {
        console.error("테스트용 이미지 파일을 찾을 수 없습니다:", imagePath);
        return;
    }

    console.log("=== [Debug] AI 영수증 식별 테스트 시작 ===");
    console.log("Image Path:", imagePath);

    try {
        // 2. 이미지를 Base64로 변환
        const buffer = fs.readFileSync(imagePath);
        const imageBase64 = buffer.toString('base64');
        const mimeType = 'image/png';

        // 3. AI 로직 실행 (테스트용이므로 텍스트 없이 이미지만 전달)
        const result = await processWorkspaceInput("", imageBase64, mimeType);

        console.log("=== [Debug] AI 판별 결과 ===");
        console.log("Report ID:", result.reportId);
        console.log("Report Name:", result.reportName);
        console.log("Confidence:", result.confidence);
        console.log("Message:", result.message);
        console.log("Extracted Data:", JSON.stringify(result.extractedData, null, 2));

    } catch (err) {
        console.error("디버그 런타임 오류:", err);
    }
}

debugReceiptAi();
