import { GoogleGenerativeAI } from "@google/generative-ai";

import { SystemConfigService } from "./services/system-config-service";

// 글로벌 초기화 대신 각 함수 내에서 동적으로 초기화합니다.

export interface ColumnRecommendation {
  name: string;
  type: 'string' | 'number' | 'date' | 'currency' | 'select' | 'boolean' | 'textarea' | 'file' | 'email' | 'phone' | 'auto';
  isRequired: boolean;
  isUnique?: boolean;
  options?: string[];
  autoPrefix?: string;
  reason?: string;
}

export interface RecommendationTable {
  tableName: string;
  columns: ColumnRecommendation[];
  reason?: string;
}

export interface RecommendationResponse {
  columns?: ColumnRecommendation[];
  recommendedTables?: RecommendationTable[];
}

export interface ComplexDocumentResponse {
  tableName: string;
  columns: ColumnRecommendation[];
  extractedRows: any[];
  reason: string;
}

/**
 * 추천을 위한 샘플 데이터를 기반으로 최적의 스키마를 제안합니다.
 */
export async function recommendSchemaFromSample(currentColumns: any[], sampleRows: any[]): Promise<RecommendationResponse> {
  const apiKey = await SystemConfigService.getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 관리자 설정에서 API 키를 입력해주세요.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: "v1beta" });

  const prompt = `
    당신은 데이터베이스 설계 전문가입니다. 현재 테이블의 컬럼 이름과 실제 데이터 샘플을 보고, 각 컬럼에 가장 적합한 속성을 추천해 주세요.
    
    지원하는 타입(type) 종류:
    1. string: 일반 텍스트
    2. number: 숫자 (집계 가능)
    3. date: 날짜 (YYYY-MM-DD)
    4. currency: 통화/금액
    5. select: 정해진 목록 중 선택 (고유 값이 반복될 때 권장)
    6. boolean: 예/아니오 (체크박스)
    7. textarea: 50자 이상의 긴 문장이나 메모
    8. email: 이메일 주소
    9. phone: 전화번호
    10. file: 이미지, 영수증, 증빙 서류 등의 파일 첨부
    11. auto: 'DID-000001'과 같은 자동 생성 일련번호
    
    입력 정보:
    - 현재 컬럼명: ${currentColumns.map(c => c.name).join(', ')}
    - 데이터 샘플 (최대 20행): ${JSON.stringify(sampleRows)}
    
    분석 및 추천 가이드라인:
    - 각 컬럼의 이름과 실제 값들의 패턴을 분석하세요.
    - 값이 모두 채워져 있으면 isRequired를 true로 추천하세요.
    - 이메일(@)이나 전화번호 패턴이 보이면 전용 타입을 추천하세요.
    - 고유 값의 종류가 적고 반복적으로 등장하면 select 타입을 추천하고, 가능한 옵션 리스트(options)를 모두 추출하세요.
    - 예/아니오, Y/N 등의 데이터는 boolean으로 추천하세요.
    - 분석 사유(reason)를 한국어로 짧게 핵심만 포함하세요.
    
    응답은 반드시 아래 JSON 형식을 엄격히 지켜야 하며, 다른 텍스트는 절대 포함하지 마세요:
    {
      "columns": [
        { 
          "name": "컬럼명", 
          "type": "위 11가지 중 하나", 
          "isRequired": true/false, 
          "isUnique": true/false,
          "options": ["옵션1", "옵션2"] (select 타입인 경우만),
          "autoPrefix": "접두어" (auto 타입인 경우만),
          "reason": "추천 사유"
        }
      ]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI 응답에서 유효한 JSON을 찾을 수 없습니다.");
    return JSON.parse(jsonMatch[0]) as RecommendationResponse;
  } catch (error) {
    console.error("Gemini Schema Recommendation Error:", error);
    throw error;
  }
}

/**
 * Analyzes an Excel screenshot using Gemini Vision API to recommend database tables and columns.
 * 
 * @param imageBase64 Base64 encoded image data
 * @param mimeType Mime type of the image (e.g., "image/png", "image/jpeg")
 * @returns A JSON object containing recommended tables and columns
 */
export async function analyzeExcelImage(imageBase64: string, mimeType: string): Promise<RecommendationResponse> {
  const apiKey = await SystemConfigService.getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 관리자 설정에서 API 키를 입력해주세요.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: "v1beta" });

  const prompt = `
    이 이미지는 엑셀 파일의 내용을 시각적으로 렌더링한 스크린샷입니다.
    사용자가 서비스 운영을 위해 이 엑셀에서 데이터베이스 '테이블'로 변환할 핵심 정보를 찾고 있습니다.
    
    분석 가이드라인:
    1. 표(Table)의 경계가 뚜렷하게 나뉘어 있다면 각각 다른 테이블로 식별하세요.
    2. 데이터 행들 위에 있는 '머리글(Header)' 행을 정확히 찾으세요. (예: 날짜, 이름, 금액 등)
    3. 단순 서술형 텍스트나 제목만 있는 셀은 무시하고, 실제 관리 및 집계가 필요한 '열(Column)' 위주로 추천하세요.
    4. 각 컬럼의 데이터 성격(문자/숫자 등)과 필수 여부를 시각적으로 분석하여 추천하세요.
    5. 분석 사유를 한국어로 상세히 설명하세요.
    
    응답은 반드시 아래 JSON 형식을 엄격히 지켜야 하며, 다른 텍스트는 절대 포함하지 마세요:
    {
      "recommendedTables": [
        {
          "tableName": "식별된 테이블/시트 이름",
          "columns": [
            { "name": "컬럼명", "type": "string, number, date, 또는 currency", "isRequired": true 또는 false }
          ],
          "reason": "이 최적의 영역을 추천하는 비즈니스적 이유"
        }
      ]
    }
  `;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Markdown JSON blocks removal if present
    const cleanedText = text.replace(/```json|```/g, "").trim();
    
    // Find the first { and last } to extract JSON
    const firstBrace = cleanedText.indexOf("{");
    const lastBrace = cleanedText.lastIndexOf("}");
    
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("결과에서 유효한 JSON 데이터를 찾을 수 없습니다.");
    }
    
    const jsonStr = cleanedText.substring(firstBrace, lastBrace + 1);
    return JSON.parse(jsonStr) as RecommendationResponse;
  } catch (error) {
    console.error("Gemini Vision AI 에러:", error);
    throw new Error("AI 분석 중 오류가 발생했습니다: " + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Extracts data from an image (receipt, business card, etc.) based on a specific table schema.
 * 
 * @param imageBase64 Base64 encoded image data
 * @param mimeType Mime type of the image
 * @param columns Array of column definitions (name, type, options)
 * @returns A JSON object containing extracted field values
 */
export async function extractDataFromImage(imageBase64: string, mimeType: string, columns: any[], aiRulesPrompt: string = ''): Promise<any> {
  const apiKey = await SystemConfigService.getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 관리자 설정에서 API 키를 입력해주세요.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: "v1beta" });

  // [방어 로직] columns가 배열인지 확인
  const safeColumns = Array.isArray(columns) ? columns : [];

  const schemaInfo = safeColumns
    .filter(c => c && !c.isAutoGenerated)
    .map(c => `- ${c.name} (유형: ${c.type}${c.options ? `, 옵션: ${c.options.join(', ')}` : ''})`)
    .join('\n');

  const prompt = `
    이 이미지는 영수증, 명함, 또는 기타 문서의 사진입니다.
    이미지에서 텍스트를 분석하여 아래의 데이터베이스 스키마에 맞는 정보를 추출해 주세요.
    
    추출할 항목 리스트:
    ${schemaInfo}
    
    분석 및 응답 규칙:
    1. 문서 통합 분석: 이미지 속 문서의 종류(견적서, 영수증, 명함 등)와 전체적인 구조를 먼저 파악하세요.
    2. 데이터 필드 매핑: 
       - 제공된 '추출할 항목 리스트'의 각 필드명과 그 의미를 분석하세요.
       - 문서 내의 텍스트와 레이아웃을 바탕으로, 각 필드에 가장 적합한 정보를 매핑하여 추출하세요.
       - 필드명에 포함된 단어와 문서의 맥락을 결합하여 지능적으로 판단하세요.
    3. 데이터 구조화 및 평탄화 (Flattening): 
       - 문서에 여러 항목(예: 품목 리스트, 다중 인적사항 등)이 포함된 경우, 각 항목을 하나의 독립된 객체로 구성하여 **JSON 배열 ([{...}, {...}])** 형식으로 응답하세요.
       - 문서의 공통 상위 정보(날짜, 제목, 업체정보 등)는 각 항목 객체마다 중복 포함시켜, 각 행이 그 자체로 완전한 정보가 되도록 평탄화하세요.
    4. 출력 형식 및 정합성:
       - **JSON의 키(Key)는 반드시 제공된 항목 리스트의 '이름'과 토씨 하나 틀리지 않고 정확히 일치해야 합니다.**
       - 반드시 유효한 JSON 형식으로만 응답하세요.
       - 날짜(date): 'YYYY-MM-DD' 형식 (연도 없으면 2026년 사용).
       - 숫자/통화: 기호나 쉼표 없이 숫자만 반환.
    5. 정보 부재: 문서에서 해당 필드에 적합한 정보를 찾을 수 없는 경우 null을 반환하세요.
    ${aiRulesPrompt}
  `;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // 로깅 추가 (디버깅용)
    console.log("Raw AI Response:", text);

    // 마크다운 블록(```json 등) 제거 및 양쪽 공백 제거
    const cleanedText = text.replace(/```json|```/gi, "").trim();

    // JSON 추출 (객체 또는 배열)
    const firstBrace = cleanedText.indexOf("{");
    const firstBracket = cleanedText.indexOf("[");
    const firstChar = (firstBrace !== -1 && firstBracket !== -1) 
        ? Math.min(firstBrace, firstBracket) 
        : (firstBrace !== -1 ? firstBrace : firstBracket);

    const lastBrace = cleanedText.lastIndexOf("}");
    const lastBracket = cleanedText.lastIndexOf("]");
    const lastChar = Math.max(lastBrace, lastBracket);
    
    if (firstChar === -1 || lastChar === -1) {
      console.error("No JSON found in AI response:", text);
      throw new Error("AI 응답에서 유효한 데이터 형식을 찾을 수 없습니다.");
    }
    
    const jsonStr = cleanedText.substring(firstChar, lastChar + 1);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Vision Data Extraction Error:", error);
    if (error instanceof SyntaxError) {
        throw new Error("AI가 생성한 데이터 형식이 올바르지 않습니다. (JSON 파싱 에러)");
    }
    throw error;
  }
}

/**
 * 이미지 또는 PDF 문서 전체를 분석하여 테이블 스키마와 실제 데이터를 모두 추출합니다.
 */
export async function analyzeComplexDocument(base64: string, mimeType: string): Promise<ComplexDocumentResponse> {
  const apiKey = await SystemConfigService.getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 관리자 설정에서 API 키를 입력해주세요.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: "v1beta" });

  const prompt = `
    당신은 고급 데이터 엔지니어이자 문서 분석 전문가입니다.
    제공된 문서(이미지 또는 PDF)를 정밀 분석하여 이를 데이터베이스 '테이블'로 변환하기 위한 최적의 구조와 실제 데이터를 추출하세요.
    
    분석 및 추출 가이드라인:
    1. 문서 성격 파악: 영수증, 발주서, 명단 리스트, 명함, 계약서 등 문서의 종류를 파악하여 적절한 테이블 이름을 정하세요.
    2. 단일 테이블 평탄화(Flattening) 전략 강제 적용:
       - 문서에 공통 헤더 정보(예: 견적/문서 번호, 작성 일자, 거래처명 등)와 다수의 상세 품목 표(Line Items)가 함께 있는 경우, 이를 분리하지 말고 반드시 **1개의 넓은 단일 테이블(Flat Table)**로 통합하여 설계하세요.
       - 상세 품목의 각 줄(Row)을 추출할 때마다, 공통 헤더 정보를 동일하게 중복 복사하여 채워 넣어야 합니다. (예: 표에 품목이 5개 있다면 추출되는 5개의 배열 객체 모두에 동일한 견적번호와 날짜가 포함되어야 합니다.)
    3. 전수 분석 (Full Analysis): 이미지나 PDF의 모든 내용을 훑어보고, 표 데이터와 일반 텍스트 정보를 유실 없이 추출하여 위 평탄화 규칙에 맞게 구성하세요.
    4. 스키마 설계: 
       - columns 배열에는 공통 헤더용 컬럼들과 상세 품목용 컬럼들이 모두 포함되어야 합니다.
       - 타입 종류: string, number, date, currency, select, boolean, textarea, email, phone.
    5. 다국어 지원: 문서에 포함된 모든 텍스트를 언어에 상관없이 정확히 인식하여 추출하세요.
    
    응답 및 규칙:
    - 반드시 아래 JSON 형식을 엄격히 지켜야 하며, 다른 설명 텍스트는 절대 포함하지 마세요.
    - 날짜(date)는 'YYYY-MM-DD' 형식을 따르세요. 연도가 없으면 2026년을 기본값으로 사용하세요.
    - 숫자/통화는 기호나 쉼표 없이 숫자만 반환하세요.
    - 정보를 찾을 수 없는 필드는 null 처리하세요.
    
    응답 JSON 구조:
    {
      "tableName": "추천 테이블 이름 (예: 지출_결의서, 고객_명단)",
      "columns": [
        { "name": "컬럼명", "type": "데이터타입", "isRequired": true/false, "reason": "추천 사유" }
      ],
      "extractedRows": [
        { "컬럼명1": "값1", "컬럼명2": "값2", ... },
        ...
      ],
      "reason": "문서 분석 결과 요약 (한국어)"
    }
  `;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    const cleanedText = text.replace(/```json|```/gi, "").trim();
    const firstBrace = cleanedText.indexOf("{");
    const lastBrace = cleanedText.lastIndexOf("}");
    
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("AI 응답에서 유효한 데이터를 추출할 수 없습니다.");
    }
    
    const jsonStr = cleanedText.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonStr);

    // 필드 검증 (최소 구성 요소 확인)
    if (!parsed.tableName || !parsed.columns || !parsed.extractedRows) {
        throw new Error("AI 분석 결과의 구조가 불완전합니다.");
    }

    return parsed as ComplexDocumentResponse;
  } catch (error) {
    console.error("Gemini Complex Document Analysis Error:", error);
    throw error;
  }
}
