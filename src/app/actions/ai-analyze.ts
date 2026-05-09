'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * 주어진 홈페이지 URL의 HTML을 긁어와서 AI에게 분석을 요청하는 서버 액션
 */
export async function analyzeCompanyWebsiteAction(url: string) {
  if (!url || !url.startsWith('http')) {
    return { success: false, error: '유효한 홈페이지 URL을 입력해주세요. (http:// 또는 https:// 포함)' };
  }

  try {
    // 1. URL에서 HTML 가져오기 (시간 초과 10초 설정)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // User-Agent를 브라우저처럼 설정하여 차단 확률 낮추기
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`홈페이지 접근 실패 (${response.status} ${response.statusText})`);
    }

    const htmlContent = await response.text();

    // 2. HTML에서 불필요한 태그 및 스크립트 제거 (간이 텍스트 추출)
    // <script> 와 <style> 내용물 전체 삭제
    let rawText = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    rawText = rawText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    
    // 네비게이션, 푸터 등도 어느정도 날리면 좋지만 정규식으론 한계가 있으므로 일단 무시
    // HTML 태그 제거
    rawText = rawText.replace(/<[^>]+>/g, ' ');
    
    // 연속된 공백 및 줄바꿈 정리
    rawText = rawText.replace(/\s+/g, ' ').trim();

    if (rawText.length < 50) {
      throw new Error('홈페이지에서 분석할 수 있는 텍스트를 충분히 찾지 못했습니다. (접근이 차단되었거나 이미지만 있는 홈페이지일 수 있습니다)');
    }

    // 너무 길면 토큰 제한 방지를 위해 앞부분 20,000자만 자름
    const truncatedText = rawText.substring(0, 20000);

    // 3. Gemini AI로 요약 요청
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
당신은 기업 비즈니스 모델 분석 전문가입니다.
아래 제공된 텍스트는 특정 회사의 홈페이지에서 긁어온 원본 텍스트입니다.
이 내용을 바탕으로 이 회사의 '비즈니스 컨텍스트(Business Context)'를 분석하여 요약해 주세요.

[요구사항]
- 1. 주요 비즈니스 모델 및 정체성 (어떤 회사인지)
- 2. 핵심 상품 또는 서비스
- 3. 주요 타겟 고객 (누구를 대상으로 하는지)
- 4. 속한 산업군 및 특징
위 내용들을 포함하여 자연스러운 3~4문단의 줄글 형태로 전문적이고 명확하게 요약해 주세요.
이 요약본은 향후 다른 AI가 이 회사의 데이터를 분석할 때 기초 배경지식(Context)으로 사용됩니다.
불필요한 인사말이나 부연 설명 없이, 요약된 본문 텍스트만 바로 출력하세요.

[홈페이지 텍스트]
${truncatedText}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return {
      success: true,
      context: responseText.trim()
    };

  } catch (error: any) {
    console.error('Website analysis error:', error);
    let errorMessage = error.message || '홈페이지를 분석하는 중 오류가 발생했습니다.';
    if (error.name === 'AbortError') {
      errorMessage = '홈페이지 응답 시간이 초과되었습니다 (10초).';
    }
    return { success: false, error: errorMessage };
  }
}
