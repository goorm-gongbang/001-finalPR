# 11. 이벤트 카탈로그

에이전트가 기록하는 모든 주요 이벤트의 카탈로그입니다. 각 이벤트의 발생 시점과 주요 페이로드 필드를 정리합니다.

## 이벤트 분류

| 카테고리 | 섹션 |
|---------|------|
| 실행 라이프사이클 | [§1](#1-실행-라이프사이클) |
| 단계 전이 | [§2](#2-단계-전이) |
| 보안 챌린지 | [§3](#3-보안-챌린지) |
| 좌석 선택·확보 | [§4](#4-좌석-선택확보) |
| 코디네이터 | [§5](#5-코디네이터-이벤트) |
| 보조 | [§6](#6-보조-이벤트) |

---

## 1. 실행 라이프사이클

| 이벤트 | 발생 시점 | 주요 페이로드 |
|-------|---------|------------|
| `RUN_START` | 에이전트 실행 시작 | `agent_id`, `mode`, `run_id`, `mouse_profile`, `manual_login` |
| `BOOTSTRAP_COMPLETE` | 브라우저·세션 초기화 완료 | — |
| `RUN_END` | 에이전트 실행 종료 | `terminal_reason`, `run_id` |
| `TERMINAL` | 상태머신 종료 판정 | `terminal_reason` (DONE/BLOCKED/ABORT) |

### TerminalReason

| 값 | 의미 |
|---|------|
| `DONE` | 좌석 확보 성공 (결제 페이지 도달) |
| `BLOCKED` | 방어 차단 |
| `ABORT` | 내부 실패 |
| `COOLDOWN` | 예약 (미구현) |
| `SESSION_EXPIRED` | 예약 (미구현) |
| `RESET` | 예약 (미구현) |

---

## 2. 단계 전이

### 예매 진입 (S1)

| 이벤트 | 발생 시점 |
|-------|---------|
| `PRE_ENTRY_ATTEMPT` | 예매 버튼 클릭 시도 |
| `PRE_ENTRY_QUEUE_OPENED` | 예매 버튼 클릭 (큐 진입 시도) |
| `PRE_ENTRY_QUEUE_NOT_OPEN_YET` | 큐 미개방 응답 (409) |
| `PRE_ENTRY_QUEUE_RETRY_TIMEOUT` | 큐 재시도 타임아웃 |
| `ENTRY_CLICKED` | 대기열 진입 클릭 성공 |
| `BOOKING_BTN_CLICK` | 예매 버튼 클릭 이벤트 (`manual_login` 없을 때) |
| `OPEN_AT_WAITING` | 오픈 시각 대기 중 |
| `OPEN_AT_CLICK_SLOT_START` | 오픈 정각 도달, 클릭 슬롯 시작 |
| `OPEN_AT_CLICK_SLOT_END` | 클릭 슬롯 종료 |
| `PRE_ENTRY_ROUTE_TO_SECURITY` | 챌린지 감지 → S3 전환 |

### 대기열 통과 (S2)

| 이벤트 | 발생 시점 |
|-------|---------|
| `QUEUE_URL_CHECK` | 큐 URL 도달 확인 |
| `QUEUE_RANK_POLL` | 대기 순위 폴링 |
| `QUEUE_SECURITY_DETECTED` | 대기 중 챌린지 감지 |
| `QUEUE_PASSED` | 대기열 통과 |
| `QUEUE_TIMEOUT` | 대기 타임아웃 |

### 구역 선택 (S4 / S4R)

| 이벤트 | 발생 시점 |
|-------|---------|
| `ZONE_SEATS_RESPONSE` | `/zones/.../seats` 응답 수신 |
| `ZONE_CONFLICT` | 구역 선점 충돌 (409) |
| `SECTION_BOT_DETECTED` | 구역 차단 감지 (`text=인증 실패`) |
| `SECTION_BLOCKED` | 구역 차단 확정 |
| `SECTION_FAILED` | 구역 선택 실패 |
| `SECTION_SELECTED` | 구역 선택 완료 (MAP) |
| `RECOMMEND_PARTY_SIZE_ATTEMPT` | 추천 모드 인원수 설정 시도 |
| `RECOMMEND_PARTY_SIZE_SKIP` | 이미 설정됨, 스킵 |
| `RECOMMEND_CARD_SELECTED` | 추천 카드 선택 |
| `RECOMMEND_BOOK_CLICK` | 추천 모드 예매 버튼 클릭 |
| `RECOMMEND_AUTO_CLICK` | 자동 선택 버튼 클릭 |
| `RECOMMEND_FAILED` | 추천 모드 실패 |
| `NO_RECOMMENDATIONS_SWITCH_TO_MAP` | 추천 결과 없어 MAP으로 폴백 |
| `RECOMMEND_MAP_FALLBACK_FAILED` | MAP 폴백 실패 |
| `ACCEPT_FAILED` | 추천 수락 실패 |
| `RECOMMENDATIONS_LOADED` | 추천 카드 로드 완료 |
| `RECOMMENDATIONS_RESPONSE` | 추천 API 응답 수신 |

### SECTION_SELECTED 페이로드

| 필드 | 의미 |
|------|------|
| `intended_zone` | 에이전트가 목표한 구역 (YAML 또는 전략 저장소 기반) |
| `clicked_zone` | 실제 클릭한 구역 텍스트 |

---

## 3. 보안 챌린지

| 이벤트 | 발생 시점 |
|-------|---------|
| `CHALLENGE_DETECTED` | 챌린지 팝업 감지 |
| `CHALLENGE_UI_SOLVER_START` | 챌린지 풀이 시작 |
| `CHALLENGE_GATE_ACQUIRED` | 동시성 게이트 획득 |
| `CHALLENGE_COLD_START_WARMUP` | 콜드 스타트 워밍업 |
| `CHALLENGE_START_CLICKED` | 시작 버튼 클릭 |
| `CHALLENGE_SUB_ROUND_RESULT` | 서브 라운드 결과 (매 시도마다) |
| `CHALLENGE_PASSED` | 챌린지 전체 통과 |
| `CHALLENGE_FAILED` | 챌린지 실패 (재시도 불가) |
| `CHALLENGE_BOT_DETECTED` | 봇 탐지 감지 |
| `UI_SOLVER_DRAG_AND_HOLD` | 드래그 실행 상세 |
| `UI_SOLVER_DROP_DECISION` | 놓기 결정 순간 |

### CHALLENGE_SUB_ROUND_RESULT.result 값

| 값 | 의미 |
|---|------|
| `success` | 공간·시간 판정 모두 통과 |
| `transitioning` | 다음 라운드 전환 중 |
| `fail` | 드롭했지만 판정 빗나감 |
| `terminal_fail` | 재시도 불가 실패 |
| `drop_timeout` | 인디케이터 조건 미충족 |
| `glove_timeout` | 글러브 가시화 실패 |
| `positions_not_found` | 좌표 획득 실패 |
| `drag_verify_failed` | 드래그 후 위치 재확인 실패 |

---

## 4. 좌석 선택·확보

| 이벤트 | 발생 시점 |
|-------|---------|
| `SEAT_BLOCK_SELECTED` | 담당 블록 결정 |
| `SEAT_ADJACENT_FOUND` | N연석 발견 |
| `SEAT_ADJACENT_NOT_FOUND` | N연석 미발견 |
| `HOLDS_RESPONSE` | `/holds` 응답 수신 |
| `SEAT_HOLD_CONFLICT_409` | 좌석 충돌 (이선좌) |
| `HOLD_FAILED` | 좌석 확보 실패 |
| `MAP_BOOK_BUTTON_DISABLED` | 예매 버튼 활성화 실패 |
| `PAYMENT_PAGE_REACHED` | 결제 페이지 도달 (좌석 확보 성공) |
| `SEAT_FAILED` | 좌석 선택 단계 실패 |

### PAYMENT_PAGE_REACHED 페이로드

| 필드 | 의미 |
|------|------|
| `url` | 결제 페이지 URL |
| `booked_party_size` | 실제 확보 좌석 수 |
| `labels` | 확보 좌석 라벨 목록 (예: `["205블럭 3열 14번", "205블럭 3열 15번"]`) |

> **용도** — 다른 에이전트의 `excluded_seats`에 즉시 반영되어 이선좌 방지.

---

## 5. 코디네이터 이벤트

코디네이터 로그 파일(`swarm_<ID>_coordinator_<ts>.jsonl`)에 기록됩니다.

| 이벤트 | 발생 시점 |
|-------|---------|
| `COORDINATOR_DECISION` | LLM 결정 완료 |
| `COORDINATOR_ERROR` | LLM 호출 실패 |

### COORDINATOR_DECISION 페이로드

| 필드 | 의미 |
|------|------|
| `trigger` | 트리거 유형 (`TIMER`, `PAYMENT_PAGE_REACHED` 등) |
| `trigger_agent_id` | 트리거 유발한 에이전트 |
| `reason` | LLM 판단 이유 |
| `updates` | 변경 지시 배열 (`[{agent_id, zone?, party_size?, ...}]`) |

### 트리거 종류

| 트리거 | 의미 |
|-------|------|
| `TIMER` | 배치 타임아웃 (주기 점검) |
| `BATCH` | 이벤트 버퍼 임계 도달 |
| `PAYMENT_PAGE_REACHED` | 좌석 확보 성공 이벤트 |
| `SECTION_BLOCKED` | 구역 차단 이벤트 |
| `CHALLENGE_FAILED` | 챌린지 연속 실패 (같은 에이전트 3회) |
| `TERMINAL_DONE` | 에이전트 정상 종료 |
| `TERMINAL_BLOCKED` | 에이전트 차단 종료 |

---

## 6. 보조 이벤트

| 이벤트 | 발생 시점 |
|-------|---------|
| `TRAJ_SYNTH` | 마우스 궤적 합성 완료 (목표 vs 실측 지표) |
| `MAP_MODE_TOGGLE_CLICKED` | MAP 토글 클릭 (RECOMMEND 모드에서) |
| `MAP_MODE_TOGGLE_SKIP` | MAP 토글 생략 |
| `PRE_ENTRY_PARTY_SIZE_SET` | S1에서 인원수 드롭다운 사전 설정 |
| `PARTY_SIZE_TRIGGER_INFO` | 인원수 드롭다운 트리거 요소 정보 |
| `PARTY_SIZE_TRIGGER_NOT_FOUND` | 트리거 요소 미발견 |
| `PARTY_SIZE_POPUP_TIMEOUT` | 드롭다운 팝업 타임아웃 |
| `PARTY_SIZE_CLICK_RESULT` | 드롭다운 항목 클릭 결과 |
| `PARTY_SIZE_LOCATOR_FALLBACK_SUCCESS` | 로케이터 폴백 성공 |
| `PARTY_SIZE_LOCATOR_FALLBACK_FAILED` | 로케이터 폴백 실패 |
| `AGENT_EXCEPTION` | 에이전트 예외 발생 |

---

## 공통 필드 (모든 이벤트)

| 필드 | 타입 | 설명 |
|------|------|------|
| `ts_ms` | integer | 이벤트 발생 시각 (Unix ms) |
| `event` | string | 이벤트 종류 |
| `flow_state` | string | 당시 FlowState (S0~SX) |

에이전트 로그의 경우 `session_id`, `agent_id`가 공통 포함. 코디네이터 로그는 `ts_ms`, `event`, `agent_id`, 페이로드로 구성.

## 참조

- [08-audit-evidence](08-audit-evidence.md) — 감사 로그 저장 구조
- [09-kpi-evaluation](09-kpi-evaluation.md) — 이벤트 기반 KPI 계산
