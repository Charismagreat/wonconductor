import fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf8');
const apiKeyMatch = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
if (apiKeyMatch) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKeyMatch[1].trim();
}

const egdeskTokenMatch = envContent.match(/NEXT_PUBLIC_EGDESK_API_KEY=(.*)/);
if (egdeskTokenMatch) {
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = egdeskTokenMatch[1].trim();
}

const egdeskUrlMatch = envContent.match(/NEXT_PUBLIC_EGDESK_API_URL=(.*)/);
if (egdeskUrlMatch) {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = egdeskUrlMatch[1].trim();
}

async function run() {
    // Dynamic import to let env vars load first
    const { processWorkspaceInput } = await import('./src/lib/workspace-ai.ts');
    
    // We pass an empty string because it will check DB and try to classify.
    // If we only pass "영수증 이미지", it will try to find a report.
    console.log("Testing processWorkspaceInput...");
    const res = await processWorkspaceInput("신용구매 스마트허브주유소 5,500원 결제 영수증", undefined, undefined);
    console.log(JSON.stringify(res, null, 2));
}
run();
