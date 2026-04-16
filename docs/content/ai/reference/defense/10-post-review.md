# 10. Backoffice Copilot — 사후 검토 워크플로우

Runtime에서 즉시 차단되지 않은 **의심 세션**을 사후 검토하는 workflow입니다. Human-in-the-Loop 레이어로 동작합니다.

## 배경

Online은 **완충적으로 설계**되어 있습니다.

- 중간 등급(T1/T2) 세션은 즉시 차단하지 않고 지연·챌린지로 처리
- 이 **회색지대 세션**이 실제 봇인지는 사후에 별도 레이어에서 판단

> **목적** — 온라인 방어가 완충적으로 처리한 T1/T2·throttle·VQA failure 등의 흔적을 사후 운영 데이터로 전환.

## 특징

| 항목 | 내용 |
|------|------|
| **VQA 재검증** | ❌ 하지 않음 (이미 발생한 audit와 read model 기반) |
| **PostgreSQL 저장** | 검토 결과 기록 |
| **Backend 전달** | 의심(SUSPICIOUS) 세션만 제재 API로 전달 |
| **LLM 활용** | 있으면 LLM 판단, 없으면 규칙 기반 폴백 |

## 6단계 워크플로우

```
[Node 1] Input Collection
    └─ ClickHouse read model 또는 fixture JSONL에서 AnalysisInput 생성
    ↓
[Node 2] Candidate Selection
    └─ Hard filter 적용 → 후보 세션 선정
    ↓
[Node 3] Session Analysis
    └─ 각 candidate별 timeline_summary + suspicious_signals 생성
    ↓
[Node 4] Review
    ├─ LLM 있으면 → LLM review output 파싱
    └─ LLM 없으면 → deterministic fallback
    ↓
[Node 5] Summary
    └─ Run-level 3줄 요약 생성
    ↓
[Node 6] Persist & Delivery
    ├─ PostgreSQL 저장 (run + session result)
    ├─ Suspicious-only backend 전달
    └─ export + validation status resolution
```

## Node 1 — Input Collection

| 입력 소스 | 선택 조건 |
|---------|---------|
| ClickHouse read model | 실제 운영 환경 (primary) |
| Fixture JSONL | 테스트·개발 환경 |

**AnalysisInput 생성**

세션 목록을 분석 단위로 변환.

## Node 2 — Candidate Selection

Hard filter로 후보 세션을 좁힙니다.

### 필터 조건

| 조건 | 의미 |
|------|------|
| T1 또는 T2를 봤음 | 회색지대 세션 |
| Block 이벤트 없음 | 즉시 차단되지 않은 세션 |
| Latest action ≠ BLOCK | 현재 차단 상태 아님 |
| Latest tier ≠ T3 | 현재 최고 위험 아님 |
| Terminal outcome = NOT_BLOCKED | 정상 종료된 세션 |

> **효과** — 즉시 차단된 세션은 이미 방어됐으므로 제외. 완충 처리된 회색지대만 남김.

## Node 3 — Session Analysis

### Suspicious Signals 생성

| 신호 | 조건 |
|------|------|
| `seen_t2` | T2 도달 기록 |
| `vqa_fail_count` | 챌린지 실패 횟수 |
| `throttle_event_count` | throttle 적용 횟수 |
| `latest_action_THROTTLE` | 최근 action이 throttle |
| `terminal_reason` | 종료 사유 |

### Timeline Summary 생성

시간순 이벤트를 문장으로 요약:

- T1/T2 도달 시점
- Throttle 횟수
- S3 challenge failure 횟수
- Terminal reason / outcome

### Raw Fallback

요약에 `UNKNOWN` 필드가 있거나 suspicious signal이 없으면 **제한된 `decision_audit` row를 추가로 읽어 보강**합니다.

## Node 4 — Review

### LLM Review (가능할 때)

| 입력 | 내용 |
|------|------|
| System prompt | "You are a traffic abuse analyst. Review the session timeline..." |
| User message | 세션 요약 + 신호 목록 |
| Output | SUSPICIOUS / NORMAL / UNCERTAIN |

### Deterministic Fallback

LLM 없거나 timeout/error/schema invalid인 경우:

```
if seen_t2 OR vqa_fail_count > 0 OR throttle_event_count > 0
       OR latest_action == THROTTLE:
    result = SUSPICIOUS
else:
    result = NORMAL
```

### 왜 폴백을 두는가

| 이유 | 설명 |
|------|------|
| 운영 연속성 | LLM API 키 없거나 장애여도 사후 검토가 돌아가야 함 |
| 필수 요소 아님 | LLM은 정확도를 높이는 도구일 뿐 |
| 단순 규칙의 충분성 | T2·챌린지 실패·throttle은 명백한 의심 신호 |

## Node 5 — Summary

Run-level 3줄 요약 생성:

```
예시:
"2026-04-16 batch reviewed 500 candidates: 50 suspicious, 450 normal.
 Main patterns: T2 + throttle (30), VQA failure (15), rapid scanning (5).
 Recommended actions: block 10 sessions, monitor 40 sessions."
```

## Node 6 — Persist & Delivery

### PostgreSQL 저장

#### `post_review_runs`

| 필드 | 의미 |
|------|------|
| `match_id` | 경기 식별자 |
| `window` | 분석 구간 |
| `candidate_count` | 후보 세션 수 |
| `suspicious_count` | 의심 판정 수 |
| `summary_text_json` | 3줄 요약 |
| `status` | 실행 상태 |

#### `post_review_session_results`

| 필드 | 의미 |
|------|------|
| `match_id` | 경기 식별자 |
| `session_id` | 세션 식별자 |
| `review_result` | SUSPICIOUS / NORMAL |
| `evidence_summary` | 근거 요약 |
| `session_analysis_json` | 전체 분석 데이터 |
| `backend_delivery_status` | 백엔드 전달 상태 |

### Backend Delivery

| 대상 | 방식 |
|------|------|
| **Suspicious 세션만** | 백엔드 제재 API 호출 |
| **Normal 세션** | 저장만 하고 전달 안 함 |

#### 전달 페이로드

```
POST /api/v1/internal/sanctions
{
  "idempotency_key": "<unique>",
  "target": "<session_id or user_id>",
  "action": "SUSPEND",
  "reason_code": "BACKOFFICE_COPILOT_SUSPICIOUS",
  ...
}
```

| 항목 | 의미 |
|------|------|
| `idempotency_key` | 중복 제재 방지 |
| `action` | SUSPEND 등 |
| `reason_code` | 제재 사유 |

### 왜 Suspicious-only인가

| 이유 | 설명 |
|------|------|
| 불필요 처리 방지 | Normal까지 전달하면 백엔드가 분석·저장 반복 |
| 잘못된 제재 위험 감소 | 명확히 의심되는 것만 전달 |
| 중복 제재 방지 | idempotency key로 이미 제재된 세션 필터링 |

### 실패 처리

| 상황 | 처리 |
|------|------|
| Backend adapter 없음 | delivery_status = NOT_CONFIGURED |
| Backend 호출 실패 | delivery_status = FAILED (run persistence는 이미 완료) |
| 중복 전달 | idempotency_key로 스킵 |

## 운영 설정

### CLI 매개변수

| 매개변수 | 기본값 | 의미 |
|---------|-------|------|
| `window` | 600초 | 분석 구간 |
| `limit` | 1000 | 최대 후보 수 |
| `dry_run` | false | 실제 PostgreSQL 대신 in-memory 저장 |
| `require_llm` | false | LLM 필수 여부 |

### 환경별 동작

| 환경 | LLM | Fallback |
|------|-----|---------|
| Production | 활성 | LLM 실패 시 규칙 기반 |
| Staging | 활성 | LLM 실패 시 규칙 기반 |
| Dev | LLM 키 없으면 규칙 기반만 | — |

### 실행 주기

CronJob으로 주기 실행 (예: 10분마다 최근 10분 window 처리).

## 감사 이벤트

| 이벤트 | 내용 |
|-------|------|
| `post_review_run_started` | 실행 시작 |
| `post_review_run_completed` | 정상 종료 |
| `post_review_run_failed` | 실행 실패 |
| `post_review_llm_fallback` | 규칙 기반 폴백 사용 |
| `post_review_backend_delivered` | 백엔드 전달 성공 |
| `post_review_backend_failed` | 백엔드 전달 실패 |

## 참조

- [05-tier-action](05-tier-action.md) — T1/T2 회색지대 정의
- [08-policy-authority](08-policy-authority.md) — PostgreSQL 스키마
- [11-observability](11-observability.md) — ClickHouse read model (입력 소스)
