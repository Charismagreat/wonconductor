# EGDesk 데이터 마이그레이션 및 ID 시스템 분석 (전수 조사 결과)

이 문서는 프로젝트 내에서 ID를 직접 생성하고 부여하는 모든 로직과 파일을 기록합니다.

---

## 🆔 전수 조사: ID 생성 및 부여 로직 (All Files)

프로젝트 내에서 서버 외부(애플리케이션 레이어)에서 ID를 생성하는 모든 위치를 조사한 결과입니다.

### 1. 공통 ID 유틸리티 (Core Generators)
- **`src/app/actions/shared.ts`**: 프로젝트 표준 ID 생성 (`crypto.randomUUID()`, `generateId`, `generateSafeId`, `generateNumericId`).
- **`src/lib/db-utils.ts`**: 물리 테이블 이름(`tb_...`) 생성 시 타임스탬프 기반 고유 Suffix 부여.

### 2. 서버 액션 (Server Actions) - 도메인별 ID 부여
- **`src/app/actions/report.ts`**: 신규 리포트 생성 시 ID 부여.
- **`src/app/actions/publishing.ts`**: 대시보드 차트 및 앱 발행 시 ID 부여.
- **`src/app/actions/micro-app.ts`**: 마이크로 앱 설정 고유 ID 부여.
- **`src/app/actions/organization.ts`**: 부서(Department) 등록 시 ID 부여.
- **`src/app/actions/user.ts`**: 사용자(User) 등록 및 관리 시 ID 부여.
- **`src/app/actions/notification.ts`**: 시스템 알림 생성 시 ID 부여.
- **`src/app/actions/workflow-steering.ts`**: AI 워크플로우 제어 레코드 ID 부여.
- **`src/app/actions/guardrail.ts`**: 데이터 가드레일(검증 규칙) ID 부여.
- **`src/app/actions/file.ts`**: 업로드된 파일 메타데이터 ID 부여.
- **`src/app/actions/ai.ts`**: AI 분석 세션 및 응답 데이터 ID 부여.
- **`src/app/actions/auth.ts`**: 세션 및 인증 관련 고유 식별자 관리.
- **`src/app/workspace/actions.ts`**: 워크스페이스 아이템 관리 시 ID 부여.
- **`src/app/workspace/todo/actions.ts`**: 할 일(TODO) 아이템 생성 시 ID 부여.

### 3. 서비스 레이어 (Service Layer) - 백엔드 로직
- **`src/lib/services/row-service.ts`**: 가상 리포트 행(Row) 추가 시 고유 ID 부여.
- **`src/lib/services/history-service.ts`**: 데이터 변경 이력(History) 레코드 ID 부여.
- **`src/lib/services/db-sync-service.ts`**: 데이터베이스 동기화 시 식별자 처리.
- **`src/lib/services/demo-service.ts`**: 데모 데이터 생성 시 각 엔티티에 고유 ID 부여.
- **`src/lib/notifications.ts`**: 알림 유틸리티 내 고유 ID 처리.

---

## 🔗 테이블 간 ID 참조 관계 (Linkages)

특정 테이블의 `id`가 변경될 경우 영향을 받는 참조 필드 목록입니다.

### 1. `user` 테이블 (사용자 ID) 참조
- `report.ownerId`: 리포트 소유자 연결
- `report_access.userId`: 리포트 접근 권한 부여 대상
- `report_row.creatorId / updaterId`: 행 생성/수정자 기록
- `notification.userId`: 알림 수신 대상
- `action_task.assigneeId`: 업무 담당자 지정
- `dashboard_chart.userId`: 차트 설정 소유자
- `micro_app_config.createdBy`: 앱 설정 생성자

### 2. `report` 테이블 (리포트 ID) 참조
- `report_access.reportId`: 특정 리포트의 권한 설정
- `report_row.reportId`: 리포트에 속한 가상 행 데이터
- `workflow_steering.reportId`: AI 워크플로우 대상 리포트
- `workflow_template.triggerReportId`: 워크플로우 실행 트리거 리포트
- `action_task.reportId`: 특정 리포트와 연결된 업무
- `input_guardrail.reportId`: 리포트별 데이터 검증 규칙
- `dashboard_chart.config` (JSON 내부): 차트 데이터 소스 리포트 ID
- `micro_app_config.sourceTableId`: 마이크로 앱의 원천 리포트 ID
- `source_view_settings.id`: 리포트별 뷰(컬럼 순서 등) 설정

### 3. `department` 테이블 (부서 ID) 참조
- `user.departmentId`: 사용자의 소속 부서
- `report_access.departmentId`: 부서 단위 리포트 권한 부여

---

## 📊 아키텍처 개편 대상 및 진행 상태

| 순서 | 대상 테이블 | 상태 | 주요 수정 내용 |
|:---:|:---|:---:|:---|
| 0 | `workspace_item` | **DB 개편 완료** | ID 자동 부여 적용 및 데이터 복원 완료 |
| 1 | `notification` | **DB 개편 완료** | 4건 복원, 정수형 ID 적용 완료 |
| 2 | `department` | **DB 개편 완료** | 9건 복원, 정수형 ID 적용 완료 |
| 3 | `user` | **DB 개편 완료** | 10건 복원, 부서 ID 동기화 및 정수형 ID 적용 |
| 4 | `micro_app_projects` | **DB 개편 완료** | 4건 복원, 정수형 ID 적용 완료 |
| 5 | `micro_app_config` | **DB 개편 완료** | 2건 복원, 프로젝트 ID 동기화 완료 |
| 6 | `dashboard_chart` | **DB 개편 완료** | 11건 복원, 정수형 ID 적용 완료 |
| 7 | `action_task` | **DB 개편 완료** | 0건, 정수형 ID 적용 완료 |
| 8 | `action_task_history` | **DB 개편 완료** | 0건, 정수형 ID 적용 완료 |
| 9 | `workflow_template` | **DB 개편 완료** | 0건, 정수형 ID 적용 완료 |
| 10 | `workflow_instance` | **DB 개편 완료** | 0건, 정수형 ID 적용 완료 |
| 11 | `workflow_steering` | **DB 개편 완료** | 0건, 정수형 ID 적용 완료 |
| 12 | `source_view_settings` | **DB 개편 완료** | 2건 복원, ID 정수화 및 슬러그를 `sourceId`로 분리 |
| 13 | `input_guardrail` | **DB 개편 완료** | 0건, 정수형 ID 적용 완료 |
| 14 | `report` | **DB 개편 완료** | 109건 복원, ID 정수화 및 기존 ID는 `reportId`로 보존 |
| 15 | `report_row` | **DB 개편 완료** | 0건, 정수형 ID 적용 완료 |
| 16 | `report_row_history` | **DB 개편 완료** | 0건, 정수형 ID 적용 완료 |

---

## 📊 리포트 ID 동기화 결과
리포트 ID가 UUID에서 정수로 변경됨에 따라 다음 테이블들의 데이터를 보정했습니다:
- **`workspace_item`**: `reportId` 컬럼 보정 완료
- **`dashboard_chart`**: `config` JSON 내 리포트 ID 치환 완료
- **`micro_app_config`**: `sourceTableId` 컬럼 보정 완료
- **`source_view_settings`**: `sourceId`와 리포트 연결 구조 보정 완료


---

## 🛠 `workspace_item` 아키텍처 개편 로그

### [2026-04-27] Phase 0: DB 아키텍처 개편 완료
1. **데이터 추출**: 완료 (`workspace_item_backup.json`)
2. **테이블 삭제**: 완료
3. **스키마 재구축**: 완료 (서버 자동 ID 생성 방식 - `INTEGER PRIMARY KEY` 유도)
4. **데이터 복원**: 완료 (서버 부여 신규 ID: `1`)
5. **결과 검증**: 완료 (DB 쿼리를 통해 정수형 ID 확인)

### [Next Step] 로직 개편
- `src/app/workspace/actions.ts` 내 `generateWorkspaceId()` 제거 및 서버 반환 ID 처리 로직 구현.

---

- **최종 업데이트**: 2026-04-27 15:58
- **현재 작업**: 서버 액션 로직 수정 준비 중
