# 10. 설정 및 실행

## 실행 모드

두 가지 실행 모드를 지원합니다.

| 모드 | 내용 |
|------|------|
| **단일 에이전트** | 에이전트 1개만 실행 (디버깅·개발 용) |
| **스웜 모드** | 구성 파일 기반 다중 에이전트 동시 실행 |

## 공통 매개변수

### 필수

| 매개변수 | 타입 | 설명 |
|--------|------|------|
| `target-env` | string | `staging` / `dev` / `prod` — 환경별 기본 URL·세션 경로·로그 경로 설정 |
| `game-id` | string | 대상 경기 식별자 |

### 오픈 시각 관련

| 매개변수 | 타입 | 기본값 | 설명 |
|--------|------|-------|------|
| `open-at` | ISO8601 | (즉시 실행) | 오픈 시각 (타임존 포함 권장) |
| `open-at-click-spacing-ms` | integer | 3000 | 에이전트 간 클릭 선형 지연 |
| `open-at-queue-retry-ms` | integer | 180000 | 큐 미개방 시 최대 재시도 총 시간 |

### 출력

| 매개변수 | 기본값 | 설명 |
|--------|-------|------|
| `log-dir` | 자동 | 로그 저장 디렉터리 (환경별 기본값) |
| `frontend-url` | 자동 | 대상 URL (환경별 기본값, 직접 덮어쓰기 가능) |

## 단일 에이전트 매개변수

| 매개변수 | 타입 | 설명 |
|--------|------|------|
| `mode` | string | `MAP` (직접 좌석 선택) / `RECOMMEND` (좌석 추천) |
| `session-file` | path | 세션 파일 경로 |
| `party-size` | integer | 예매 인원수 |
| `zone` | string | 목표 구역 이름 (MAP 모드) |
| `challenge-strategy` | string | 챌린지 풀이 전략 |
| `vqa-require-arm` | flag | 타이밍 엄격화 장치 활성 |
| `vqa-drag-verify` | flag | 드래그 후 재확인 장치 활성 |
| `headless` | flag | 헤드리스 모드 (UI 없이 실행) |
| `slow-mo-ms` | integer | Playwright 슬로우모션 (디버깅용) |
| `manual-login` | flag | 자동 로그인 대신 사용자 수동 로그인 대기 |

### 챌린지 전략

| 전략 | 의미 | 마우스 프로파일 |
|------|------|-------------|
| `ui_solver` | 결정론 풀이 (기본) | human |
| `ui_solver_stealth` | 스텔스 모드 추가 | human |
| `ui_solver_pass` | 스텔스 + 통과 경향 | human |
| `botlike_fail` | 의도적 실패 (탐지 반응 확인용) | bot |

## 스웜 매개변수

| 매개변수 | 타입 | 설명 |
|--------|------|------|
| `swarm-config` | path | 스웜 구성 파일 경로 |
| `agent-count` | integer | 실행할 에이전트 수 (기본: 구성의 전체) |
| `no-monitor` | flag | TUI 대시보드 비활성 |
| `no-coordinator` | flag | LLM 코디네이터 비활성 |
| `vqa-concurrency` | integer | 스웜 내 동시 챌린지 풀이 제한 (기본 1) |
| `vqa-start-jitter-ms` | integer | 에이전트별 챌린지 시작 시각 jitter |
| `repeat` | integer | 반복 실행 횟수 |
| `repeat-delay-ms` | integer | 반복 간 간격 |

## 환경변수

| 환경변수 | 설명 |
|--------|------|
| `TM_FRONTEND_URL` | 대상 URL |
| `TM_GAME_ID` | 대상 경기 |
| `TM_ATTACK_MODE` | 모드 기본값 |
| `TM_HEADLESS` | 헤드리스 모드 |
| `TM_SLOW_MO_MS` | 슬로우모션 |
| `TM_MOUSE_PROFILE` | 마우스 프로파일 (human / bot) |
| `TM_ATTACK_CHALLENGE_MODE` | 챌린지 모드 |
| `TM_ATTACK_CHALLENGE_STRATEGY` | 챌린지 전략 |
| `TM_VQA_REQUIRE_ARM` | 타이밍 엄격화 기본값 |
| `TM_VQA_DRAG_VERIFY` | 드래그 재확인 기본값 |
| `TM_OPEN_AT_QUEUE_RETRY_MS` | 큐 재시도 기본값 |
| `TM_SESSION_FILE` | 세션 파일 기본 경로 |
| `TM_MANUAL_LOGIN` | 수동 로그인 기본값 |
| `TM_MANUAL_LOGIN_TIMEOUT_MS` | 수동 로그인 타임아웃 |
| `TM_ATTACK_AGENT_LLM_MODEL` | LLM 모델 (기본 `gpt-4.1-nano`) |
| `TM_ATTACK_AGENT_LLM_BASE_URL` | LLM API 베이스 URL |
| `TM_ATTACK_AGENT_LLM_API_KEY` | LLM API 키 |
| `COORDINATOR_BATCH_SIZE` | 코디네이터 배치 크기 (기본 5) |
| `COORDINATOR_BATCH_INTERVAL_SEC` | 코디네이터 배치 간격 (기본 10초) |

## 스웜 구성 파일

YAML 형식. 예시:

```yaml
swarm_id: S9
mode: MAP
zone_strategy: TARGET_SPECIFIC
frontend_url: https://staging.playball.one
agents:
  - agent_id: 0
    session_file: sessions/s9_agent0.json
    zone: 오렌지석
    party_size: 6
    seat_order: front_left_first
    start_delay_ms: 0
  - agent_id: 1
    session_file: sessions/s9_agent1.json
    zone: 오렌지석
    party_size: 4
    seat_order: front_left_first
    start_delay_ms: 500
  # ... 반복
```

### 필드 설명

| 필드 | 설명 |
|------|------|
| `swarm_id` | 스웜 식별자 (`S1` ~ `S15`) |
| `mode` | `MAP` 또는 `RECOMMEND` |
| `zone_strategy` | 구역 배정 전략 (`TARGET_SPECIFIC` / `RANDOM` 등) |
| `frontend_url` | 대상 URL (CLI에서 덮어쓰기 가능, 선택) |
| `agents` | 에이전트별 상세 설정 리스트 |

### 에이전트별 필드

| 필드 | 설명 |
|------|------|
| `agent_id` | 에이전트 순번 (0부터) |
| `session_file` | 세션 파일 경로 |
| `zone` | 목표 구역 (MAP 모드) / `RANDOM` (RECOMMEND 자동 배정) |
| `party_size` | 예매 인원 |
| `seat_order` | 좌석 선택 순서 (`front_left_first`, `back_right_first` 등) |
| `start_delay_ms` | 시작 지연 |

## 스웜 정의 예시 (S1~S15)

| 스웜 | 모드 | 에이전트 수 | 특징 |
|------|------|---------|------|
| S1~S6 | RECOMMEND | 5 | 좌석 추천 모드 대량 점유 |
| S7 | MAP | 5 | 테라존 타깃 |
| S8 | MAP | 5 | 익사이팅존 타깃 |
| S9 | MAP | 5 | 오렌지석 타깃 |
| S10 | MAP | 5 | 테이블석 타깃 |
| S11~S12 | RECOMMEND | 10 | 대규모 RECOMMEND |
| S13~S15 | MAP | 10 | 2연석 대량 점유 |

## 실행 흐름

```
1. 환경 준비
   └─ Python 가상환경 + 의존성 설치
   └─ Playwright 브라우저 설치

2. 세션 파일 준비
   └─ 계정별 로그인 완료 상태 저장

3. 스웜 실행
   ├─ 스웜 구성 로드
   ├─ 에이전트 N개 병렬 시작
   ├─ 코디네이터·모니터 백그라운드 실행
   ├─ 각 에이전트 상태머신 순차 진행
   └─ 모든 에이전트 terminal 진입 시 종료

4. 결과 저장
   ├─ 이벤트 로그 JSON Lines
   ├─ 증거 스냅샷 폴더
   └─ 자동 집계 요약 파일

5. 수동 결제 (선택)
   └─ DONE 에이전트의 브라우저에서 결제 완료
```

## 로그 폴더 구조

```
logs/attack/<env>/<run_id>/
├── swarm_S9_agent0_<ts>.jsonl          # 에이전트별 이벤트
├── swarm_S9_agent1_<ts>.jsonl
├── ...
├── swarm_S9_coordinator_<ts>.jsonl     # LLM 결정 로그
├── summary_S9_<ts>.json                # 기계 판독용 KPI
└── summary_S9_<ts>.txt                 # 사람 판독용 요약
```

`<run_id>` 포맷: `{스웜ID}_{예정시각}_ran{실행시각}`

## 세션 파일 관리

### 일괄 생성

`scripts/create_sessions.py`를 사용해 여러 계정의 세션을 일괄 생성합니다.

| 매개변수 | 설명 |
|--------|------|
| `--swarm` | 스웜 식별자 |
| `--target-env` | 환경 |
| `--session-dir` | 저장 위치 |
| `--agents` | 특정 에이전트만 생성 (선택) |

### 단일 계정 수동 생성

`scripts/save_session.py`를 사용해 사용자가 직접 로그인한 상태를 저장합니다.

### 자동 갱신

에이전트 실행 종료 시 브라우저의 저장소 상태가 세션 파일로 다시 저장됩니다. 토큰 갱신이 자동으로 반영됩니다.

## 참조

- [02-workflow-states](02-workflow-states.md) — 각 모드별 워크플로우
- [06-swarm-infrastructure](06-swarm-infrastructure.md) — 스웜 인프라
- [12-troubleshooting](12-troubleshooting.md) — 실행 중 문제 대응
