# 09. KPI 자동 집계

스웜 종료 시 자동으로 공격 측 KPI를 집계해 요약 파일을 생성합니다. 집계 기준은 공격 측 KPI 스펙 문서(`spec/attack_kpi.md`)에 정의된 A.1~A.8 지표입니다.

## 집계 트리거

| 시점 | 동작 |
|------|------|
| 모든 에이전트 terminal 진입 | 자동으로 집계 실행 |
| 에이전트 중단 시 | 중단 시점까지의 로그로 집계 |
| 사용자 개입 | `scripts/summarize_logs.py`로 수동 재집계 가능 |

## 출력 파일

| 파일 | 형식 | 용도 |
|------|------|------|
| `summary_<swarm_id>_<ts>.json` | 기계 판독용 JSON | 스웜 간 합산 재계산 시 참조 |
| `summary_<swarm_id>_<ts>.txt` | 사람 판독용 텍스트 | 요약 확인, 발표자료 인용 |

경로: `logs/attack/<env>/<run_id>/`

## 지표 전체

### A.1 — Hold 도달률 (핵심 지표)

| 항목 | 계산 |
|------|------|
| **Hold 도달률** | `PAYMENT_PAGE_REACHED 발생 에이전트 수 / 총 에이전트 수` |
| **총 확보 좌석 수** | `PAYMENT_PAGE_REACHED.booked_party_size` 합 |

### A.2 — 단계별 퍼널

| 단계 | 계산 | 의미 |
|------|------|------|
| 대기열 통과율 | `QUEUE_PASSED / QUEUE_ENTERED` | 대기열에서 이탈한 비율 |
| VQA 통과율 | `CHALLENGE_PASSED / CHALLENGE_DETECTED` | 보안 챌린지 풀이 성공률 |
| 구역 선택 성공률 | `SECTION_SELECTED / (SECTION_SELECTED + BLOCKED + FAILED)` | 구역 진입 성공률 |
| Hold 성공률(조건부) | `PAYMENT_PAGE_REACHED / SECTION_SELECTED` | 구역 진입 후 좌석 확보율 |

### A.3 — VQA 상세

VQA 팝업 1회 = 최대 5 서브 라운드. 각 서브 라운드 결과는 `CHALLENGE_SUB_ROUND_RESULT` 이벤트로 기록.

| 항목 | 계산 |
|------|------|
| 팝업 총 발생 | `CHALLENGE_UI_SOLVER_START` 건수 |
| 팝업당 평균 실패 | `CHALLENGE_PASSED.challenge_attempts_used - 1` 평균 |
| 첫 시도 성공률 | `challenge_attempts_used == 1`인 비율 |
| 서브 라운드 총 실패 | `result ∉ {success, transitioning}` 카운트 |
| 실패 원인 분포 | 결과별 집계 (fail, drop_timeout, drag_verify_failed 등) |
| 팝업 자체 실패율 | `CHALLENGE_FAILED / CHALLENGE_DETECTED` |

### A.4 — TERMINAL 사유 분포

| 사유 | 계산 |
|------|------|
| DONE 비율 | `TERMINAL(DONE) / 전체 TERMINAL` |
| BLOCKED 비율 | `TERMINAL(BLOCKED) / 전체 TERMINAL` |
| ABORT 비율 | `TERMINAL(ABORT) / 전체 TERMINAL` |

### A.5 — 시간 지표

모든 시간 지표는 중앙값(median)과 p90을 함께 계산.

| 항목 | 계산 |
|------|------|
| Hold 소요시간 (E2E) | `PAYMENT_PAGE_REACHED.ts_ms - RUN_START.ts_ms` |
| VQA 풀이시간 | `CHALLENGE_PASSED.ts_ms - CHALLENGE_START_CLICKED.ts_ms` |
| 대기열 소요시간 | `QUEUE_PASSED.ts_ms - QUEUE_ENTERED.ts_ms` |

### A.6 — 부수 지표

| 항목 | 계산 |
|------|------|
| 이선좌 빈도 | `SEAT_HOLD_CONFLICT_409 / SECTION_SELECTED` |
| HOLD API 실패율 | `HOLD_FAILED / SECTION_SELECTED` |
| SECTION 차단 빈도 | `SECTION_BLOCKED / 전체 구역 진입 시도` |

### A.7 — 직접 좌석 선택 모드 타깃 적중률

직접 좌석 선택 모드 스웜에서만 계산. 스웜 구성 YAML의 `zone`·`party_size`·`seat_order`와 실제 Hold 결과를 대조.

| 지표 | 계산 | 의미 |
|------|------|------|
| 의도 구역 적중률 | Hold한 좌석의 구역이 YAML zone과 일치하는 에이전트 비율 | 목표 구역 확보율 |
| 연석 적중률 (좌석 기준) | `party_size 연속 좌석 수 / 점유 좌석 수` | 연속 좌석 확보율 |
| 연석 적중률 (에이전트 기준) | N연석 확보에 성공한 에이전트 비율 | 에이전트 단위 적중률 |
| 상대 앞/뒷열 준수율 | `seat_order` 방향 준수 비율 (상대 중앙값 기준) | 앞열·뒷열 지향 반영률 |
| 상대 좌/우 준수율 | 좌/우 방향 준수 비율 (상대 중앙값 기준) | 좌·우 지향 반영률 |
| **MAP 타깃 적중률 (복합)** | 위 4조건 AND 통과 비율 | 종합 적중 |

### A.8 — LLM 코디네이터 정책 수행률

LLM 활성화된 스웜에서만 계산. 자세한 내용은 [07-llm-coordinator](07-llm-coordinator.md) 참조.

| 지표 | 계산 |
|------|------|
| 전체 정책 수행률 | `(유지 + 검증된 변경 반영) / 총 결정` |
| 변경 지시 반영률 | `반영된 변경 지시 / 검증 가능한 변경 지시` |
| 정책 반영 지연 | 결정 시각 ↔ 다음 단계 전이 이벤트 시각 차이의 중앙값 |
| 에러율 | `COORDINATOR_ERROR / (COORDINATOR_DECISION + COORDINATOR_ERROR)` |
| 트리거별 분포 | `trigger` 값별 집계 |

## B 블록 — 외부 데이터 필요 지표 (미구현)

본 자동 집계에는 포함되지 않습니다. 외부 데이터 수신 후 별도 스크립트로 산출.

### B.1 — 직접 좌석 선택 모드 절대 기준

좌석맵 메타데이터(블럭별 최대 열·좌석 번호) 필요.

| 지표 | 계산 |
|------|------|
| 절대 앞열 선호 준수율 | `front_*_first` 에이전트의 점유 row ≤ 3 비율 |
| 절대 뒷열 선호 준수율 | `back_*_first` 에이전트의 점유 row ≥ max_row - 2 비율 |
| 절대 좌/우 방향 준수율 | seat_no 기반 좌우 반영률 |

### B.2 — 공격 vs 정상 유저 비교

서버팀에서 경기 종료 후 Hold 레코드 CSV 필요.

| 지표 | 계산 |
|------|------|
| 선점 우위 | `median(공격 hold_ts_ms) - median(정상 hold_ts_ms)` |
| 앞열 독식률 | 공격 row ≤ 3 비율 vs 정상 비율 |
| 정상 유저 완주율 | 정상 Hold 성공 비율 |
| False Positive Rate | 정상 중 `BLOCKED` 판정 비율 |
| 공격 차단율 (서버 기준) | 공격 중 `BLOCKED` 판정 비율 |

## 출력 예시 (요약 텍스트)

```
=== 평가 요약 — S9 (MAP, 에이전트 5) ===

[A.1 Hold 도달률]
  2/5 (40.0%)  총 6석 확보

[A.2 단계별 퍼널]
  대기열    2/5 (40.0%)
  VQA       5/5 (100.0%)
  구역 선택 2/2 (100.0%)
  Hold      2/2 (100.0%)

[A.3 VQA 상세]
  팝업 총 5회 (통과 5, 실패 0)
  팝업당 평균 실패: 0.00회
  첫시도 성공률: 5/5 (100.0%)
  서브라운드 실패: 0/5

[A.4 TERMINAL 사유]
  ABORT=3, DONE=2

[A.5 시간 지표]
  E2E 소요시간(RUN_START → Hold): median=229.3s / p90=231.0s  (n=2)
  VQA 풀이시간(시작버튼 → PASSED): median=5.6s / p90=5.9s  (n=5)
  대기열 소요시간(QUEUE_OPENED → PASSED): median=0.0s / p90=0.1s  (n=2)

[A.6 부수 지표]
  이선좌: 0회
  HOLD_FAILED: 0회
  SECTION_BLOCKED: 0회

[A.7 MAP 의도 적중]
  평가 대상 에이전트: 2
  의도 구역 적중률: 100.0%
  연석 적중률(좌석 기준): 6/6 (100.0%)  · 에이전트 기준: 100.0%
  상대 앞/뒷열 준수율: 100.0%
  상대 좌/우 준수율: 50.0%
  ── MAP 타겟 적중률(복합): 50.0%

[A.8 LLM 코디네이터 정책]
  결정 9회 (유지 8, 변경 1) / 에러 0회 (에러율 0.0%)
  전체 수행률: 9/9 (100.0%)
  트리거 분포: PAYMENT_PAGE_REACHED×2, TERMINAL_DONE×2, TIMER×5
```

## 합산 집계

여러 스웜 결과를 합산해 전체 KPI를 계산하려면 `scripts/summarize_logs.py`를 사용합니다.

| 용도 | 방식 |
|------|------|
| 단일 스웜 재집계 | `swarm_<ID>_agent*.jsonl` 경로를 인자로 |
| 다중 스웜 합산 | `swarm_*_agent*.jsonl` glob 패턴으로 |
| 구성 YAML 포함 시 | A.7 지표 자동 계산 |
| 코디네이터 로그 포함 시 | A.8 지표 자동 계산 |

## 참조

- [08-audit-evidence](08-audit-evidence.md) — 이벤트 로그 포맷
- [07-llm-coordinator](07-llm-coordinator.md) — 코디네이터 결정 이벤트
- [11-events-reference](11-events-reference.md) — 집계에 사용되는 이벤트 카탈로그
- `spec/attack_kpi.md` — 원본 KPI 스펙 문서
