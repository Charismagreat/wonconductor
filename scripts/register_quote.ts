import { analyzeComplexDocument } from './lib/ai-vision';
import { insertRows } from './egdesk-helpers';
import * as fs from 'fs';
import * as path from 'path';

async function registerQuoteFromImage(imagePath: string) {
  try {
    console.log(`--- 분석 시작: ${imagePath} ---`);
    
    // 1. 이미지 로드 및 Base64 변환
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath) === '.pdf' ? 'application/pdf' : 'image/png';

    // 2. AI 분석 (Gemini Vision)
    // analyzeComplexDocument는 테이블 구조와 데이터를 함께 추출합니다.
    const analysisResult = await analyzeComplexDocument(base64Image, mimeType);
    
    console.log("AI 분석 완료:", analysisResult.reason);
    console.log("추출된 행 수:", analysisResult.extractedRows.length);

    // 3. 데이터 등록 (견적서_통합_관리 테이블)
    const targetTableId = 'tb_tb_69f498a1_pvh_x1dnq';
    
    // 데이터 형식 정제 (필요시)
    const rowsToInsert = analysisResult.extractedRows.map(row => {
      // 금액 필드가 문자열인 경우 숫자로 변환 등 추가 정제 로직
      return row;
    });

    if (rowsToInsert.length > 0) {
      const insertResult = await insertRows(targetTableId, rowsToInsert);
      console.log("DB 등록 성공:", insertResult);
    } else {
      console.log("등록할 데이터가 없습니다.");
    }

    return analysisResult;
  } catch (error) {
    console.error("견적서 등록 중 오류 발생:", error);
    throw error;
  }
}

// 실행 예시 (실제 파일 경로로 변경 필요)
// const testImagePath = path.join(__dirname, '../uploads/estimate_sample.png');
// registerQuoteFromImage(testImagePath);

export { registerQuoteFromImage };
