# Task Tracker

| 작업 내용 | 상태 | 비고 |
| :--- | :---: | :--- |
| `[x]` DashboardHubClient.tsx 내 `useMemo` 블록에 `dynamicStats` 비동기 병합 로직 이식 | 완료 | dynamicStats 내 systemTables, productTables 병합 및 중복제거 |
| `[x]` 탐색기 상단의 'Total {reports.length}' 부분을 병합 결과인 `{processedReports.length}` 로 수정 | 완료 | 올바른 전체 개수 표기 |
| `[x]` - 2~3가지 접근 방식 제안 | 완료 | N+1 쿼리 병목 해결 및 AI 도구 리팩토링 제안 |
| `[x]` - 상세 설계안 제시 및 승인 | 완료 | 일괄 조회 최적화 설계안 제시 및 승인 완료 |
| `[x]` - 설계 문서 작성 및 커밋 | 완료 | `docs/plans/2026-06-02-financehub-tool-calling-design.md` 작성 완료 |
| `[x]` - 구현 및 검증 | 완료 | dashboard-ai.ts 개선 및 API 호출 성공 테스트 통과 |
| `[x]` [어음 디버깅 Phase 1] 어음 관련 위젯 파일 식별 및 소스 분석 | 완료 | 받을어음, 배서어음 위젯의 구현체(ID: 21) 및 금융 상품 테이블 식별 완료 |
| `[x]` [어음 디버깅 Phase 2] 정렬 및 필터링 로직 조사 | 완료 | 배서어음 '지급필' 필터링 누락, 우리은행 B2B대출 상태값 누락, 위젯의 refreshMetadata 누락이 근본 원인임을 파악 완료 |
| `[x]` [어음 디버깅 Phase 3] 버그 가설 설정 및 최소 수정안 도출 | 완료 | `src/lib/ai-tools.ts`에 `get_bills_and_loans_summary` 도구를 정의하여 실시간 병합/필터링/정렬 구현 계획 수립 |
| `[x]` [어음 디버깅 Phase 4] 코드 수정 및 정적 빌드/동작 검증 | 완료 | `ai-tools.ts` 수정 및 `dashboard_chart` DB 업데이트 적용, 정적 빌드 테스트 통과 완료 |
| `[x]` [계좌 거래 디버깅 Phase 1] 계좌 306-063568-04-036 존재 여부 및 위젯 쿼리 로직 조사 | 완료 | 계좌 정보의 DB 적재 상태 및 위젯 쿼리 소스 분석 |
| `[x]` [계좌 거래 디버깅 Phase 2] 거래 내역 누락 원인 파악 및 필터 조사 | 완료 | 대출 계좌의 거래 데이터(ibk_loan_history 등)가 일반 계좌 거래 조회 헬퍼에서 누락됨을 파악 완료 |
| `[x]` [계좌 거래 디버깅 Phase 3] 가설 설정 및 최소 수정안 도출 | 완료 | query_bank_transactions 도구 내에서 대출 계좌 목록에 대해 대출 상세 테이블 조회 결과를 병합 정렬하도록 설계 완료 |
| `[x]` [계좌 거래 디버깅 Phase 4] 코드 수정 및 정적 빌드/동작 검증 | 완료 | `src/lib/ai-tools.ts` 수정 및 306-063568-04-036 계좌의 내역 연동 테스트 통과, Next.js 프로덕션 빌드 성공 완료 |

