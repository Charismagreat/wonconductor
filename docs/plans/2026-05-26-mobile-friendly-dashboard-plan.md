# 데스크톱 전용 뷰포트 고정 및 모바일 UI 클린업 구현 계획서

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Next.js 전역 뷰포트에 1280px 가로폭 데스크톱 뷰포트를 항시 강제 적용하고, 최근 로그인 성능 및 반응형 튜닝 과정에 혼입되었던 모바일용 UI 분기(상태 변수, 햄버거 토글러, 딤드 백드롭, 모바일 X 버튼, 모바일 여백 스케일링)를 전면 소거(Clean up)하여 YAGNI 원칙에 따른 100% 데스크톱 전용 시스템으로 귀결시킨다.

**Architecture:**
- `src/app/layout.tsx`에 `export const viewport`를 주입하여 전역 가로폭을 `width=1280px`로 영구 고정한다.
- `DashboardLayoutClient.tsx`, `NavigationSidebar.tsx`, `DashboardHubClient.tsx`에 잔재하는 모바일 상태 변수 및 반응형 오프셋 분기 CSS를 지우고 순수한 PC 최적화 코드로 롤백한다.

**Tech Stack:** React, Next.js (App Router), Tailwind CSS

---

### Task 1: 전역 데스크톱 뷰포트 강제 고정 튜닝

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: layout.tsx 파일 내 전역 뷰포트 정의 및 내보내기**
전역 메타 뷰포트 설정을 Next.js 표준 객체인 `viewport` 변수로 고정 선언하여 모바일 웹 뷰포트 감지를 원천 차단하고 상시 가로 1280px 컴퓨터 해상도로 구동합니다:
```typescript
export const viewport = {
  width: 1280,
  initialScale: 0.35,      // 모바일 진입 시 전체 화면이 웅장하게 한눈에 들어오게 기본 배율 설정
  minimumScale: 0.1,
  maximumScale: 5.0,       // 자유로운 줌인/줌아웃(Pinch to Zoom) 지원
  userScalable: true,
};
```

**Step 2: 컴파일 검증 및 커밋**
```bash
git add src/app/layout.tsx
git commit -m "feat: 전역 뷰포트(width=1280, initial-scale=0.35) 고정 주입을 통한 100% 상시 데스크톱 뷰 구현"
```

---

### Task 2: DashboardLayoutClient 모바일 토글러 및 딤드 오버레이 제거 (Clean up)

**Files:**
- Modify: `src/components/DashboardLayoutClient.tsx`

**Step 1: 모바일 상태 변수 및 딤드 오버레이 제거**
- `isMobileOpen` 리액트 상태 및 body 스크롤 고정용 `useEffect` 훅을 완전히 지웁니다.
- 렌더링 영역 상단에 존재하던 글래스모픽 딤드 백드롭 `<div onClick={() => setIsMobileOpen(false)} ... />` 마크업을 삭제합니다.

**Step 2: 햄버거 메뉴 버튼 삭제 및 본문 마진 롤백**
- 글로벌 헤더 내 모바일용 토글 버튼 `<button onClick={() => setIsMobileOpen(true)} ...>` 삭제.
- 헤더 패딩을 원래의 웅장한 여백인 `px-8` 고정으로 롤백.
- main 태그의 좌측 마진을 반응형 `ml-0 md:ml-72` 에서 PC 전용인 **상시 `ml-72` (collapsed 시 `ml-20`) 고정**으로 원복.

**Step 3: 빌드 및 커밋**
```bash
npm run build
git add src/components/DashboardLayoutClient.tsx
git commit -m "cleanup: DashboardLayoutClient에서 모바일 햄버거 토글, 오버레이 백드롭 완전 제거 및 PC 고정 마진 복구"
```

---

### Task 3: NavigationSidebar 모바일 드로어 스타일 및 닫기 버튼 전면 소거 (Clean up)

**Files:**
- Modify: `src/components/NavigationSidebar.tsx`

**Step 1: 모바일 연동 속성 및 X 버튼 삭제**
- `NavigationSidebarProps`에서 `isMobileOpen`, `onClose` 프로퍼티 삭제.
- 로고 컨테이너 우측에 들어가던 모바일용 X 닫기 버튼 삭제.

**Step 2: 사이드바 드로어 변환 CSS 제거 및 접기 버튼 상시 복구**
- aside 태그의 모바일 슬라이딩 연출 클래스 `md:translate-x-0 ${isMobileOpen ? ... : '-translate-x-full'}` 전면 폐기.
- 접기/펼치기 화살표 버튼의 모바일 가드 `md:flex hidden`을 제거하여 모바일에서도 PC와 동일하게 사이드바를 마음껏 접고 펼 수 있도록 렌더링 복구.

**Step 3: 빌드 및 커밋**
```bash
git add src/components/NavigationSidebar.tsx
git commit -m "cleanup: NavigationSidebar 모바일 드로어 관련 속성/X버튼 제거 및 접기 토글러 상시 노출 복구"
```

---

### Task 4: DashboardHubClient 모바일 튜닝 여백 롤백 (Clean up)

**Files:**
- Modify: `src/app/(dashboard)/DashboardHubClient.tsx`

**Step 1: 패널 및 컨텐츠 여백 PC 전용으로 롤백**
- main 태그 좌우 패딩: `px-4 md:px-12` ➔ 원래의 시원한 **`px-8 md:px-12`**로 롤백.
- 지능형 탐색 필터 섹션 패딩/라운딩: `p-5 md:p-10 rounded-[24px]` ➔ **`p-10 rounded-[40px]`**의 웅장한 라운딩으로 롤백.
- 카드 아이템 패딩: `p-5 md:p-6` ➔ **`p-6`**으로 완전히 원복시켜 PC 기준의 완벽한 폰트 스페이싱 확보.

**Step 2: 최종 프로덕션 빌드 무결성 검증 및 푸시**
```bash
npm run build
git commit -am "cleanup: DashboardHubClient 반응형 축소 코드를 PC 오리지널 대용량 여백 스케일로 전면 롤백 완료"
git push origin main
```
