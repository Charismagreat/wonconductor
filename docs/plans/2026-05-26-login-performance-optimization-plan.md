# 로그인 성능 최적화 구현 계획 (Login Performance Optimization Implementation Plan)

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** 로그인 진입 및 로그인 완료 처리의 RTT(대기 시간)를 비약적으로 단축하고 프리미엄 UI 인터랙션을 보강합니다.

**Architecture:** 
1. `logoutAction`에 쿠키 검증 로직을 추가하여 세션이 이미 없는 경우 서버 사이드 `revalidatePath` 호출을 즉시 우회(Fast-path skip)합니다.
2. `loginAction` 내의 동기식 파일 쓰기(`fs.appendFileSync`)를 제거하여 CPU 블로킹 I/O를 배제합니다.
3. `LoginPage`의 로딩 연출에 부드러운 글래스모피즘 딤드 필터 및 큐빅 베지어 트랜지션을 적용해 프리미엄 사용자 경험을 제공합니다.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS / Vanilla CSS, Lucide React

---

### Task 1: logoutAction Fast-Path 최적화

**Files:**
- Modify: [auth.ts](file:///c:/Users/user/Desktop/ExcelToDB/src/app/actions/auth.ts)

**Step 1: 구현 코드 확인 및 설계 적용**

`src/app/actions/auth.ts` 파일의 `logoutAction`을 다음과 같이 수정합니다.

```typescript
export async function logoutAction() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_user_id')?.value;
    const sessionRole = cookieStore.get('session_user_role')?.value;

    // [성능 개선] 활성화된 세션 쿠키가 없다면, 무거운 캐시 무효화 작업을 생략하고 0ms 만에 즉시 조기 반환합니다.
    if (!sessionId && !sessionRole) {
        console.log('[서버 디버그] 활성화된 세션 쿠키 없음. 로그아웃 작업을 초고속 스킵합니다.');
        return { success: true };
    }
    
    console.log('[서버 디버그] 기존 세션 감지됨: 로그아웃 및 캐시 파기를 시작합니다...');
    
    // ... 이하 기존 로그아웃 옵션 설정 및 쿠키 세팅, revalidatePath 실행 유지
```

**Step 2: 수동 검증 및 동작 확인**
- 브라우저로 비로그인 상태에서 `/login` 페이지에 진입한 후, 로딩 지연이 완전히 사라졌는지(0.1초 미만으로 진입되는지) 개발자 도구의 Network 탭에서 확인합니다.

---

### Task 2: loginAction 동기식 디버그 로깅 제거

**Files:**
- Modify: [auth.ts](file:///c:/Users/user/Desktop/ExcelToDB/src/app/actions/auth.ts)

**Step 1: 동기식 파일 쓰기 구문 제거**

`src/app/actions/auth.ts` 내의 `loginAction` 함수에서 호출되는 `fs.appendFileSync` 블록을 주석 처리하거나 완전히 제거합니다.

```typescript
// 제거 또는 주석 처리 대상:
/*
try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(process.cwd(), 'auth_error.log');
    const debugLog = `[${new Date().toISOString()}] DEBUG: queryTable result for [${trimmedUsername}]: ${JSON.stringify(result)}\n`;
    fs.appendFileSync(logPath, debugLog);
} catch (e) {}
*/
```
동일하게 에러 발생(`catch (err)`) 시점의 `fs.appendFileSync` 블록도 제거하거나 비동기화하여 블로킹 디스크 쓰기 동작을 완전히 차단합니다.

**Step 2: 수동 검증 및 로그 파일 블로킹 여부 테스트**
- `admin_user`로 로그인을 테스트하여 에러 없이 대시보드로 이동하는지 확인하고, 파일 시스템 블로킹으로 인한 대기가 발생하지 않는지 검증합니다.

---

### Task 3: 프리미엄 로그인 로딩 UI 구현

**Files:**
- Modify: [page.tsx](file:///c:/Users/user/Desktop/ExcelToDB/src/app/login/page.tsx)

**Step 1: CSS 애니메이션 및 로딩 상태 글래스모피즘 인터랙션 보강**

`src/app/login/page.tsx` 파일 내에서 `isLoading` 일 때 폼 전체에 블러(`backdrop-blur-[2px]`) 효과와 부드러운 페이드 효과가 나타나도록 UI를 수정합니다.
버튼 트랜지션에 `cubic-bezier(0.4, 0, 0.2, 1)` 트랜지션을 명시적으로 강화하고, 입력 필드들이 비활성화될 때의 인터랙션을 세밀하게 개선합니다.

```typescript
// Form 내부의 입력 input 태그에 disabled={isLoading} 부여 및 Tailwind/CSS 스타일 바인딩 보강
<input
  id="username"
  type="text"
  disabled={isLoading}
  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) font-bold text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
  // ...
```

**Step 2: 통합 브라우저 및 동작 검증**
- 실제 로그인 페이지에 진입하여 아이디와 패스워드를 입력한 뒤 로그인 버튼을 누를 때, 세련된 비활성화 효과와 로딩 인디케이터가 매끄럽게 등장하는지 브라우저에서 최종 확인합니다.
