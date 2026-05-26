# 모바일 전용 위젯 "모아보기" 및 링크 보관함 구현 계획서 (Mobile Widget MoaView Plan)

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** 대시보드 핀 차트 갤러리 위에 체크박스를 띄워 위젯들을 선택하고, 오직 모바일 화면(width=device-width)으로만 강제 전환하여 보여주는 동적 쿼리 스트링 공유 링크(`/share/moaview?charts=...`) 생성 및 별칭 보관함(`localStorage` 영구 적재) 기능을 구현한다.

**Architecture:**
- `GalleryClient.tsx`에 `isMoaMode`, `selectedIds`, `savedLinks` 상태를 추가하여 체크박스 활성화 및 선택 동작을 핸들링한다.
- 갤러리 상단에 저장된 링크 목록 보관함인 " Saved Moa Closet" 칩 보드 UI를 제공한다.
- `src/app/share/[type]/page.tsx`에 `moaview` 서브 뷰 컴포넌트를 이식하고, 모아보기 접속 시 클라이언트 사이드에서 메타 뷰포트를 모바일용 `width=device-width`로 동적 Override 처리하는 모바일 전용 레이아웃을 렌더링한다.

**Tech Stack:** React, Next.js (App Router), Tailwind CSS

---

### Task 1: GalleryClient 모바일 모아보기 전용 상태 변수 및 보관함 UI 탑재

**Files:**
- Modify: `src/app/(dashboard)/dashboard/GalleryClient.tsx`
- Test: `src/tests/verify-moaview.test.ts` [NEW]

**Step 1: 모아보기 동작 관련 리액트 상태 정의**
`GalleryClient.tsx` 상단에 모아보기 모드 여부 `isMoaMode`, 선택된 차트 ID 배열 `selectedMoaIds`, 저장된 링크 배열 `savedMoaLinks`를 선언하고 마운트 시 `localStorage` 로딩 로직을 추가합니다:
```typescript
const [isMoaMode, setIsMoaMode] = useState(false);
const [selectedMoaIds, setSelectedMoaIds] = useState<string[]>([]);
const [savedMoaLinks, setSavedMoaLinks] = useState<any[]>([]);

useEffect(() => {
  const saved = localStorage.getItem('moaview-saved-links');
  if (saved) {
    try { setSavedMoaLinks(JSON.parse(saved)); } catch(e) {}
  }
}, []);
```

**Step 2: 저장된 모아보기 링크 보관함 (Saved Moa Closet) UI 구현**
갤러리 최상단에 저장된 링크를 클립보드에 재복사하고 삭제할 수 있는 수려한 글래스모픽 칩 리스트를 배치합니다:
```tsx
{savedMoaLinks.length > 0 && (
  <div className="mb-8 p-6 bg-white border border-slate-100 rounded-[32px] shadow-xl shadow-slate-900/5">
    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Saved Mobile Closets (보관함)</h3>
    <div className="flex flex-wrap gap-2">
      {savedMoaLinks.map((link) => (
        <div key={link.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl group hover:border-blue-500/30 transition-all">
          <button 
            onClick={() => {
              navigator.clipboard.writeText(link.url);
              alert(`"${link.name}" 모바일 링크가 클립보드에 복사되었습니다!`);
            }}
            className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors"
          >
            📂 {link.name}
          </button>
          <button 
            onClick={() => {
              if (confirm('이 보관 링크를 삭제하시겠습니까?')) {
                const filtered = savedMoaLinks.filter(l => l.id !== link.id);
                setSavedMoaLinks(filtered);
                localStorage.setItem('moaview-saved-links', JSON.stringify(filtered));
              }
            }}
            className="text-red-400 hover:text-red-600 transition-colors text-xs font-bold"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 3: 컴파일 검증 및 커밋**
```bash
git add src/app/(dashboard)/dashboard/GalleryClient.tsx
git commit -m "feat: GalleryClient에 모아보기 전용 리액트 상태 변수 및 모바일 링크 보관함 UI 탑재"
```

---

### Task 2: GalleryClient 차트 리스트 카드 위 체크박스 오버레이 구현

**Files:**
- Modify: `src/app/(dashboard)/dashboard/GalleryClient.tsx`

**Step 1: 개별 차트 래퍼 위에 체크박스 오버레이 마크업 구현**
`isMoaMode`가 활성화되었을 때 개별 차트 카드 우측 상단에 둥글고 세련된 체크박스를 띄워 클릭 시 토글 선택할 수 있게 튜닝합니다:
```tsx
{isMoaMode && (
  <div className="absolute top-4 left-4 z-20 pointer-events-auto">
    <input 
      type="checkbox" 
      checked={selectedMoaIds.includes(p.id)}
      onChange={() => {
        setSelectedMoaIds(prev => 
          prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
        );
      }}
      className="w-6 h-6 rounded-lg border-slate-200 text-blue-600 cursor-pointer shadow-md focus:ring-blue-500/20 hover:scale-110 transition-transform"
    />
  </div>
)}
```
각 스마트차트를 감싸는 div에 `relative` 및 `isMoaMode` 시 터치 영역을 침범하지 않도록 포인터 이벤트 레이어 처리를 수행합니다.

**Step 2: 빌드 검증 및 커밋**
```bash
npm run build
git add src/app/(dashboard)/dashboard/GalleryClient.tsx
git commit -m "feat: GalleryClient 내 개별 차트 카드 위에 동적 모아보기 선택 체크박스 오버레이 탑재"
```

---

### Task 3: GalleryClient 헤더 '모아보기 링크 생성' 및 별칭 입력 모달 개발

**Files:**
- Modify: `src/app/(dashboard)/dashboard/GalleryClient.tsx`

**Step 1: 모아보기 생성 컨트롤 플로팅 바 배치**
체크박스가 최소 하나 이상 선택되었을 때, 하단이나 상단에 **"모바일 링크 생성"**을 지휘할 세련된 컨트롤러 바가 등장하도록 렌더링합니다:
```tsx
{isMoaMode && (
  <div className="mb-6 flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-in slide-in-from-top-4 duration-300">
    <p className="text-xs font-bold text-blue-800">
      현재 <strong>{selectedMoaIds.length}개</strong>의 차트 위젯이 선택되었습니다.
    </p>
    <div className="flex items-center gap-2">
      <button 
        onClick={handleGenerateMoaLink}
        disabled={selectedMoaIds.length === 0}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-all shadow-md shadow-blue-500/20"
      >
        모바일 링크 생성
      </button>
      <button 
        onClick={() => { setIsMoaMode(false); setSelectedMoaIds([]); }}
        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-xl text-xs uppercase tracking-widest transition-all"
      >
        취소
      </button>
    </div>
  </div>
)}
```

**Step 2: 링크 생성 및 별칭 프롬프트 저장 핸들러 구현**
버튼을 클릭하면 링크의 이름(별칭)을 묻는 브라우저 prompt 창을 띄워, 이를 `savedMoaLinks` 및 `localStorage`에 완벽히 수록하고 클립보드 복사를 제공하는 `handleGenerateMoaLink` 함수를 선언합니다:
```typescript
const handleGenerateMoaLink = () => {
  if (selectedMoaIds.length === 0) return;
  const alias = prompt('생성할 모바일 모아보기 링크의 이름(별칭)을 입력해 주세요:', '나만의 모바일 대시보드');
  if (!alias) return;

  const origin = window.location.origin;
  const moaUrl = `${origin}/share/moaview?charts=${selectedMoaIds.join(',')}`;

  const newLink = {
    id: `moa_${new Date().getTime()}`,
    name: alias,
    url: moaUrl,
    createdAt: new Date().toISOString()
  };

  const updated = [newLink, ...savedMoaLinks];
  setSavedMoaLinks(updated);
  localStorage.setItem('moaview-saved-links', JSON.stringify(updated));

  navigator.clipboard.writeText(moaUrl);
  alert(`"${alias}" 보관함 저장 및 클립보드 복사가 완료되었습니다!\n이제 카카오톡이나 슬랙으로 공유하여 스마트폰 최적화 화면으로 보실 수 있습니다.`);
  
  setIsMoaMode(false);
  setSelectedMoaIds([]);
};
```

**Step 3: 빌드 및 커밋**
```bash
git add src/app/(dashboard)/dashboard/GalleryClient.tsx
git commit -m "feat: 모바일 모아보기 링크 생성 컨트롤러 바 및 별칭 수집 클립보드 복사 로직 구현"
```

---

### Task 4: dashboard/page.tsx 내 '새 차트 만들기' 버튼을 '모아보기'로 교체 연동

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/GalleryClient.tsx`

**Step 1: page.tsx 헤더 라이트 엘리먼트를 GalleryClient가 전담하도록 튜닝**
서버 컴포넌트인 `page.tsx` 내부의 우측 헤더 버튼을 삭제하고, 이를 `GalleryClient` 컴포넌트 안으로 내장시키거나 `GalleryClient`가 최상단 제어 패널을 함께 품도록 개편합니다.
`page.tsx`의 헤더 rightElement를 갤러리 컨트롤 영역으로 위임합니다:
```tsx
// page.tsx의 rightElement 삭제 및 GalleryClient에 핀 차트가 존재할 때 갤러리 최상단에 토글러 배치
```
`GalleryClient.tsx` 의 최상단에 "모아보기" 트리거 버튼을 PC 전용 룩으로 배치합니다:
```tsx
<div className="flex justify-between items-center mb-8">
  <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Interactive Widgets</h2>
  {!isMoaMode && (
    <button 
      onClick={() => setIsMoaMode(true)}
      className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
    >
      모아보기
    </button>
  )}
</div>
```

**Step 2: 빌드 및 커밋**
```bash
npm run build
git add src/app/(dashboard)/dashboard/page.tsx src/app/(dashboard)/dashboard/GalleryClient.tsx
git commit -m "refactor: 새 차트 만들기 버튼을 모아보기 버튼으로 교체하고 갤러리 상단에 피벗 연동 완료"
```

---

### Task 5: share/[type]/page.tsx 모바일 전용 모아보기 렌더링 분기 신설 및 뷰포트 Override 이식

**Files:**
- Modify: `src/app/share/[type]/page.tsx`
- Create: `src/components/mobile/MoaViewClient.tsx` [NEW]

**Step 1: MoaViewClient.tsx 신규 파일 생성**
모바일 반응형 뷰포트를 강제 적용하고, 전달받은 차트 ID 목록을 1열 카드 피드로 쾌적하게 렌더링하는 전용 컴포넌트를 작성합니다. `RULE[user_global]`에 맞춰 데이터 시각화 시 koreanize-matplotlib는 차트 이미지 렌더링 시 보장되므로, 여기서는 단순 렌더링만 햅틱으로 전담합니다:
```typescript
// MoaViewClient.tsx 설계
// 1. useEffect를 통해 브라우저 메타 viewport를 width=device-width로 강제 Override.
// 2. 언마운트 시 layout.tsx의 width=1280px 데스크톱 뷰포트로 안전 복구.
// 3. 네비게이션이 소멸된 깔끔한 Full-Screen 반응형 1열 그리드(grid-cols-1 gap-6) 렌더링.
```

**Step 2: share/[type]/page.tsx 분기 통합**
`params.type === 'moaview'`인 경우, 쿼리 스트링에서 `charts` 목록을 받아와 `pinnedCharts` 필터 후 `<MoaViewClient charts={selectedCharts} />`를 활성화하여 내보냅니다:
```typescript
if (type === 'moaview') {
  const searchParams = new URL(request.url).searchParams; // Next.js App Router 쿼리 파라미터 수집
  // 또는 searchParams를 Props로 직접 받아 바인딩
}
```

**Step 3: 최종 빌드 및 푸시**
```bash
npm run build
git add src/app/share/[type]/page.tsx src/components/mobile/MoaViewClient.tsx
git commit -m "feat: share 모아보기 모바일 전용 라우트 분기 및 뷰포트 Override 클라이언트 컴포넌트 이식 완성"
git push origin main
```
