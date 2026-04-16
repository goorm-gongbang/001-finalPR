# 08. 감사 · 증거 수집

공격 에이전트의 모든 결정은 **사후에 완전히 재구성될 수 있어야** 합니다. 실패 원인을 정량 분석하고 방어 개선 방향을 도출하려면 세 가지 감사 산출물이 필요합니다.

## 3중 감사 산출물

| 산출물 | 형식 | 용도 |
|--------|------|------|
| **구조화 이벤트 로그** | JSON Lines (한 줄씩 덧붙여 쓰는 포맷) | 경량 분석, 실시간 스트리밍 모니터링, 지표 산출 |
| **상태 스냅샷** | PNG 스크린샷, HAR 네트워크 트레이스, 브라우저 콘솔 로그 | "그 시점 UI가 어떻게 보였나" 맥락 보완 |
| **자동 집계 지표** | 스웜 종료 시 요약 파일 | 좌석 확보율, 퍼널, 챌린지 상세, 시간 지표 등 |

### 왜 3중인가

| 단일 산출물 | 한계 |
|-----------|------|
| 이벤트 로그만 | 그 시점 화면이 어땠는지 모름 |
| 스냅샷만 | 전체 흐름 빠른 훑기 어려움 |
| 지표만 | 개별 실패의 구체적 원인 파악 어려움 |

## 구조화 이벤트 로그

### 파일 위치

| 경로 | 내용 |
|------|------|
| `logs/attack/<env>/<run_id>/swarm_<ID>_agent<N>_<ts>.jsonl` | 에이전트별 이벤트 로그 |
| `logs/attack/<env>/<run_id>/swarm_<ID>_coordinator_<ts>.jsonl` | LLM 코디네이터 결정 로그 |

### `<run_id>` 포맷

```
{스웜 식별자}_{예정 시각}_ran{실행 시각}

예: s9_0416_1100_ran105647
```

- **스웜 식별자**: `s1`, `s2`, ..., `s15` (소문자)
- **예정 시각**: 오픈 시각 기반 `MMDD_HHMM`
- **실행 시각**: 실제 실행 시작 시각 `HHMMSS`

> **매 실행마다 유니크** — 같은 오픈 시각으로 여러 번 돌려도 파일이 겹치지 않습니다.

### 레코드 포맷

모든 이벤트는 다음 공통 필드를 가집니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `ts_ms` | integer | 이벤트 발생 시각 (Unix ms) |
| `event` | string | 이벤트 종류 (카탈로그 §11 참조) |
| `flow_state` | string | 당시 FlowState (S0~SX) |
| `session_id` | string | 세션 식별자 |
| `agent_id` | integer | 에이전트 순번 |
| (기타) | object | 이벤트별 추가 필드 |

### 예시 레코드

```
{"ts_ms": 1744819200123, "event": "RUN_START", "flow_state": "S0", "agent_id": 0, "mode": "MAP"}
{"ts_ms": 1744819201005, "event": "BOOKING_BTN_CLICK", "flow_state": "S1", "agent_id": 0}
{"ts_ms": 1744819205250, "event": "QUEUE_PASSED", "flow_state": "S2", "agent_id": 0, "queueRank": 42}
{"ts_ms": 1744819210400, "event": "CHALLENGE_UI_SOLVER_START", "flow_state": "S3", "agent_id": 0}
{"ts_ms": 1744819215900, "event": "CHALLENGE_PASSED", "flow_state": "S3", "agent_id": 0, "challenge_attempts_used": 1}
{"ts_ms": 1744819220100, "event": "SECTION_SELECTED", "flow_state": "S4", "agent_id": 0, "intended_zone": "테라존", "clicked_zone": "테라존"}
{"ts_ms": 1744819225300, "event": "PAYMENT_PAGE_REACHED", "flow_state": "S5", "agent_id": 0, "labels": ["205블럭 3열 14번", "205블럭 3열 15번"], "booked_party_size": 2, "url": "..."}
{"ts_ms": 1744819225400, "event": "TERMINAL", "flow_state": "SX", "agent_id": 0, "terminal_reason": "DONE"}
{"ts_ms": 1744819225500, "event": "RUN_END", "flow_state": "SX", "agent_id": 0}
```

### 기록 특성

| 특성 | 내용 |
|------|------|
| **append-only** | 한 번 쓴 내용은 수정 없이 계속 쌓임 |
| **즉시 플러시** | write 후 즉시 디스크 반영 → 실행 도중 스트리밍 모니터링 가능 |
| **이벤트 버스 동시 발행** | 감사 로그 기록과 이벤트 버스 발행이 동시에 일어남 |

## 상태 스냅샷 (Evidence)

### 파일 구조

```
logs/evidence/<run_id>/
├── screenshots/
│   ├── S0_Init_<ts>.png
│   ├── S2_Queue_<ts>.png
│   ├── S4_Section_<ts>.png
│   └── ...
├── trace.zip              (HAR 네트워크 트레이스)
├── console.jsonl          (브라우저 콘솔 로그)
└── run_config.json        (실행 설정 스냅샷)
```

### 스크린샷

| 항목 | 내용 |
|------|------|
| **포맷** | PNG (전체 페이지) |
| **생성 시점** | FlowState 전환 시 자동 + 주요 실패 시점 |
| **파일명** | `{상태명}_{ts}.png` |
| **용도** | "그 시점에 UI가 어떻게 보였나" 시각적 확인 |

### HAR 네트워크 트레이스

| 항목 | 내용 |
|------|------|
| **포맷** | HAR (HTTP Archive) |
| **수집 범위** | 실행 전체 구간 |
| **포함 내용** | 모든 HTTP 요청·응답, 쿠키, 헤더, 타이밍 |
| **용도** | "어떤 응답을 받았나" 네트워크 상세 분석 |

### 콘솔 로그

| 항목 | 내용 |
|------|------|
| **포맷** | JSON Lines |
| **수집 범위** | 실행 전체 구간 |
| **포함 내용** | 브라우저 콘솔의 모든 메시지 |
| **용도** | 프론트엔드 에러·경고 확인 |

### 실행 설정 스냅샷

`run_config.json`에 실행 당시의 모든 매개변수가 저장됩니다.

| 필드 | 의미 |
|------|------|
| `run_id` | 실행 식별자 |
| `frontend_url` | 대상 URL |
| `game_id` | 경기 식별자 |
| `mode` | MAP / RECOMMEND |
| `mouse_profile` | 마우스 프로파일 |
| `challenge_strategy` | 챌린지 전략 |
| `headless` | 헤드리스 여부 |
| `trace_path` | HAR 파일 경로 |
| `console_log` | 콘솔 로그 경로 |

> **용도** — 나중에 같은 설정으로 재현할 때 참조. 실행 당시 조건을 정확히 복원 가능.

## 세션 파일 갱신

세션 파일은 실행 성공 후 자동으로 갱신됩니다.

| 시점 | 동작 |
|------|------|
| 에이전트 종료 시 | 브라우저 컨텍스트의 저장소 상태를 JSON으로 다시 저장 |
| 효과 | 토큰·쿠키가 갱신된 상태로 저장되어 다음 실행 시 만료 문제 회피 |

## 분석 워크플로우

실패 분석은 다음 순서로 진행하면 효율적입니다.

```
[1] 요약 파일(.txt) 확인
      ↓ 어느 스웜·에이전트에서 실패했는지 특정
[2] 에이전트 JSONL 로그 확인
      ↓ 어느 FlowState에서 어떤 이벤트로 멈췄는지 확인
[3] 해당 시점 스크린샷 확인
      ↓ "그 때 UI가 어떻게 보였는지" 시각 확인
[4] 네트워크 트레이스에서 해당 시점 응답 확인
      ↓ "어떤 HTTP 응답을 받았는지" 상세 분석
[5] 콘솔 로그 확인
      ↓ 프론트엔드 에러·경고 여부
```

## 자동 집계 지표

스웜 종료 시 자동으로 KPI를 집계합니다. 자세한 내용은 [09-kpi-evaluation](09-kpi-evaluation.md) 참조.

## 참조

- [09-kpi-evaluation](09-kpi-evaluation.md) — KPI 자동 집계 세부
- [11-events-reference](11-events-reference.md) — 이벤트 카탈로그 전체
