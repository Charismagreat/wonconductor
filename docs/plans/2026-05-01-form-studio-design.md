# Form Studio (폼 스튜디오) 시스템 설계 문서

## 1. 목적 (Purpose)
관리자(대시보드앱)가 고유의 문서 양식(예: 견적서 이미지/PDF)을 등록하고 DB 컬럼과 시각적으로 매핑한 뒤, 사원(워크스페이스앱)이 이를 활용하여 고객 및 품목 정보를 입력하면 자동으로 완성된 문서를 생성 및 PDF로 발송/출력할 수 있도록 하는 기능.

## 2. 사용자 역할 분리 (User Roles & Flows)

### 2.1 관리자 (대시보드앱 - CEO DASHBOARD)
- **위치**: `APP STUDIO` 내 `FORM STUDIO` 탭
- **업무 플로우**:
  1. 빈 견적서 양식(이미지/PDF) 업로드
  2. 연결할 데이터 소스(예: 고객 DB, 품목 DB) 선택
  3. 좌측의 DB 컬럼 칩을 우측 양식 이미지 위 빈칸으로 드래그 앤 드롭 (X, Y 좌표 기반 시각적 매핑)
  4. 매핑 완료 후 "출시(PUBLISH)" 버튼 클릭

### 2.2 사원 (워크스페이스앱 - Won Conductor)
- **위치**: 워크스페이스 내 `자동 완성 문서` 혹은 `작업` 메뉴
- **업무 플로우**:
  1. 관리자가 출시한 견적서 양식 선택
  2. 고객명, 품목, 수량 등을 드롭다운이나 검색을 통해 선택 (데이터 소스 기반)
  3. 맵핑된 위치에 자동으로 데이터가 채워짐
  4. 특이사항 등 수기가 필요한 나머지 빈칸을 직접 키보드로 입력
  5. 완성된 문서를 DB에 저장 (이력 관리)
  6. PDF로 다운로드하거나 이메일로 바로 발송

## 3. 데이터 구조 (Data Architecture)

### 3.1 `form_templates` 테이블 (관리자용)
- `id`: 양식 고유 ID (PK)
- `name`: 양식 이름 (예: "2026 표준 견적서")
- `backgroundImageData`: 업로드된 원본 이미지 (Base64)
- `mappingConfig`: `{ x, y, width, height, fontSize, columnKey, tableId }` 배열 (JSON)
- `status`: 'DRAFT' | 'PUBLISHED'

### 3.2 `form_submissions` 테이블 (사원용)
- `id`: 제출 기록 고유 ID (PK)
- `templateId`: 연관된 폼 템플릿 ID
- `userId`: 작성자(사원) ID
- `customerData`: 선택된 고객 데이터 요약 (JSON)
- `itemsData`: 선택된 품목 및 수량 배열 (JSON)
- `manualInputs`: 수기로 입력한 기타 텍스트 데이터 (JSON)
- `pdfUrl`: (선택) 생성된 PDF의 저장 경로

## 4. 기술 스택 (Tech Stack)
- **매핑 UI**: HTML5 Drag and Drop API 또는 가벼운 React 좌표 기반 드래그 시스템
- **렌더링**: Canvas 위 텍스트 오버레이 방식
- **PDF 출력**: `html2canvas` + `jspdf` 조합으로 최종 뷰를 캡처하여 고품질 PDF 생성
