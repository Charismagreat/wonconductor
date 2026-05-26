'use server';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { revalidatePath as flushCache } from 'next/cache';
import { queryTable, insertRows, updateRows } from '@/egdesk-helpers';
import { 
    hashPassword, 
    verifyPassword 
} from './shared';

/**
 * 터널링 환경(HTTPS) 또는 운영 환경(production) 여부를 감지하여 쿠키 Secure 옵션을 결정합니다.
 */
async function getIsSecure() {
    try {
        const headerStore = await headers();
        const proto = headerStore.get('x-forwarded-proto');
        const host = headerStore.get('host') || '';
        const forwardedHost = headerStore.get('x-forwarded-host') || '';
        const referer = headerStore.get('referer') || '';

        // 1. 프로토콜이 https이거나 referer가 https로 시작하는 경우 (터널링 HTTPS 우회 접속 등)
        const isHttps = proto === 'https' || referer.startsWith('https://');
        
        // 2. 호스트명, 포워딩 호스트, 혹은 referer에 터널링 도메인 징후가 있는 경우
        const isTunnel = 
            host.includes('loca.lt') || 
            host.includes('ngrok') || 
            host.includes('trycloudflare') || 
            host.includes('localto.net') ||
            forwardedHost.includes('loca.lt') ||
            forwardedHost.includes('ngrok') ||
            forwardedHost.includes('trycloudflare') ||
            forwardedHost.includes('localto.net') ||
            referer.includes('loca.lt') ||
            referer.includes('ngrok') ||
            referer.includes('trycloudflare') ||
            referer.includes('localto.net');

        const isSecure = isHttps || isTunnel || process.env.NODE_ENV === 'production';
        
        console.log(`[SERVER DEBUG] getIsSecure evaluated to ${isSecure} (isHttps: ${isHttps}, isTunnel: ${isTunnel})`);
        return isSecure;
    } catch (e) {
        console.error("[SERVER DEBUG] getIsSecure failed to read headers:", e);
        return process.env.NODE_ENV === 'production';
    }
}


/**
 * 사용자 세션을 가져옵니다.
 * [성능 고도화] 단일 렌더링 요청 생명주기(Request Life Cycle) 동안의 세션 쿼리 RTT 병목을 소멸시키기 위해
 * React.cache (Request Memoization)를 연동했습니다.
 */
export const getSessionAction = cache(async () => {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    console.log(`[SERVER DEBUG] Total Cookies Received: ${allCookies.length}`);
    allCookies.forEach(c => {
        console.log(`   - Cookie: name=${c.name}, value=${c.name.includes('id') ? c.value : '***'}`);
    });

    const sessionId = cookieStore.get('session_user_id')?.value;
    const sessionRole = cookieStore.get('session_user_role')?.value;

    console.log(`[SERVER DEBUG] Checking session: ID=${sessionId || 'NONE'}, ROLE=${sessionRole || 'NONE'}`);

    if (!sessionId || sessionId === '') {
        return null;
    }

    try {
        const result = await queryTable('user', { filters: { id: String(sessionId) } });
        const users = Array.isArray(result) ? result : (result?.rows || []);
        const user = users[0];

        if (!user || user.isActive === 0) {
            console.log(`[SERVER DEBUG] User not found or inactive for ID: ${sessionId}`);
            return null;
        }

        console.log(`[SERVER DEBUG] Session Verified Case: ${user.username} (${user.role})`);
        return user;
    } catch (err) {
        console.error("[SERVER DEBUG] Session fetch failed:", err);
        return null;
    }
});

/**
 * 로그인 처리를 수행합니다.
 */
export async function loginAction(username: string, password?: string) {
    const trimmedUsername = username.trim();

    try {
        const result = await queryTable('user', { filters: { username: trimmedUsername } });
        
        // [성능 개선] 성능 저하를 방지하기 위해 동기식 파일 디스크 쓰기(appendFileSync) 디버그 로깅을 제거합니다.
        // 디버그성 출력은 필요한 경우 콘솔 출력을 사용합니다.
        /*
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'auth_error.log');
            const debugLog = `[${new Date().toISOString()}] DEBUG: queryTable result for [${trimmedUsername}]: ${JSON.stringify(result)}\n`;
            fs.appendFileSync(logPath, debugLog);
        } catch (e) {}
        */

        const users = Array.isArray(result) ? result : (result?.rows || []);
        const user = users[0];
        
        if (!user || user.isActive === 0) {
            throw new Error('존재하지 않거나 비활성화된 계정입니다. (복구된 admin 계정으로 로그인해 주세요)');
        }

        // 비밀번호 검증
        if (user.password && password) {
            console.log(`[AUTH_DEBUG] Verifying password for ${trimmedUsername}`);
            const isValid = verifyPassword(password, user.password);
            console.log(`[AUTH_DEBUG] Result: ${isValid ? 'SUCCESS' : 'FAILURE'}`);
            
            if (!isValid) {
                throw new Error('비밀번호가 일치하지 않습니다.');
            }
        } else if (user.password && !password) {
            console.log(`[AUTH_DEBUG] Password missing for ${trimmedUsername}`);
            throw new Error('비밀번호를 입력해 주세요.');
        }

        const cookieStore = await cookies();
        
        const isSecure = await getIsSecure();
        const cookieOptions = {
            httpOnly: true,
            secure: isSecure,
            // 터널링 환경이나 HTTPS 환경(Secure가 true인 환경)에서는 SameSite=None을 사용하여
            // Electron 앱 웹뷰나 크로스 도메인 환경에서의 쿠키 유실을 원천 차단합니다.
            sameSite: isSecure ? ('none' as const) : ('lax' as const),
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/' 
        };

        cookieStore.set('session_user_id', String(user.id), cookieOptions);
        cookieStore.set('session_user_role', user.role, cookieOptions);

        return { success: true, user };
    } catch (err: any) {
        // [성능 개선] 예외 상황 발생 시 동기 파일 블로킹 방지를 위해 파일 쓰기 대신 표준 console.error를 적극 활용합니다.
        /*
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'auth_error.log');
            // We need to try to get the result from the scope if possible, but it might not be defined.
            // So we just log what we have.
            const logContent = `[${new Date().toISOString()}] Login Error for [${trimmedUsername}]: ${err.message}\nStack: ${err.stack}\n\n`;
            fs.appendFileSync(logPath, logContent);
        } catch (e) {}
        */
        
        console.error('[LoginAction] Error:', err);
        throw err; // Re-throw to be handled by the UI
    }
}


/**
 * 로그아웃 처리를 수행합니다.
 */
export async function logoutAction() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_user_id')?.value;
    const sessionRole = cookieStore.get('session_user_role')?.value;

    // [성능 개선] 활성화된 세션 쿠키가 없다면, 무거운 캐시 무효화 작업을 생략하고 0ms 만에 즉시 조기 반환합니다.
    if (!sessionId && !sessionRole) {
        console.log('[서버 디버그] 활성화된 세션 쿠키 없음. 로그아웃 작업을 초고속 스킵합니다.');
        return { success: true };
    }
    
    console.log('[SERVER DEBUG] Initiating logout: setting expiration...');

    const isSecure = await getIsSecure();
    const options = { 
        path: '/', 
        expires: new Date(0), 
        httpOnly: true, 
        secure: isSecure, 
        sameSite: isSecure ? ('none' as const) : ('lax' as const)
    };
    
    try {
        // 모든 세션 쿠키를 과거 날짜로 명시적 만료 처리
        cookieStore.set('session_user_id', '', options);
        cookieStore.set('session_user_role', '', options);
        
        cookieStore.delete('session_user_id');
        cookieStore.delete('session_user_role');
        
        console.log('[SERVER DEBUG] Logout headers sent: Force expiration.');
        
        // 캐시 무효화 (별칭 사용)
        flushCache('/', 'layout');
    } catch (e) {
        console.error('[SERVER DEBUG] Error during logout clearing:', e);
    }
    
    return { success: true };
}
