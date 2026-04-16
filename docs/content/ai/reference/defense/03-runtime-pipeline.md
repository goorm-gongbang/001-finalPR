# 03. Runtime 판단 파이프라인

Runtime은 요청 하나가 들어올 때마다 **4단 파이프라인**을 순서대로 거칩니다. 각 단계는 명확히 분리된 책임을 가집니다.

## 4단 구조

```
1. 점수 계산 (Guard)
    ↓  위험 점수·등급 갱신
2. 증거 축적 (Analyzer)
    ↓  규칙 기반 파생 신호·세션 카운터 갱신
3. 정책 적용 (Planner)
    ↓  우선순위 규칙에 따라 Action 결정
4. 실행·상태 (Orchestrator)
    ↓  HTTP 응답 구성 + 상태 전이 확정
```

## 각 단계의 역할

| 단계 | 입력 | 출력 | 책임 |
|------|------|------|------|
| **1. Guard** | 행동 지표 + 외부 인간 검증 점수 | 위험 점수, Tier | 숫자 계산만 |
| **2. Analyzer** | 이벤트 스트림 | 파생 신호, 세션 카운터 | 규칙 기반 패턴 감지 |
| **3. Planner** | 점수 + 증거 | Action 결정 | 우선순위 규칙 적용 |
| **4. Orchestrator** | Action 결정 | HTTP 응답 + 상태 저장 | 흐름 검증, 챌린지 강제, 차단 기록 |

## 왜 네 단으로 나누었나

| 이유 | 설명 |
|------|------|
| **책임 분리** | 한 단으로 합치면 버그 원인 추적 어렵고 단위 테스트 난해 |
| **단계별 감사** | 로그가 단계별로 찍혀 "어느 단계가 잘못 판단했나" 즉시 확인 |
| **상태 쓰기 분리** | 각 단계가 쓸 수 있는 상태 필드가 엄격히 분리 → 오염 위험 최소화 |

## 상태 쓰기 권한 분리

각 단계가 접근 가능한 세션 상태 필드가 엄격히 분리됩니다.

| 단계 | 쓸 수 있는 필드 |
|------|--------------|
| **Guard** | `riskScore`, `defenseTier`, `lastStepRisk`, `lastGuardTsMs` |
| **Analyzer** | `challengeFailCount`, `seatTakenStreak`, `holdFailStreak`, `probationUntilMs`, `challengeHaltUntilMs` |
| **Orchestrator** | `flowState`, `s3Passed`, `s3PassedAtMs`, `lastDecisionAction` |
| **Planner** | (없음 — 읽기만) |

> **효과** — 한 컴포넌트의 버그가 다른 컴포넌트의 상태를 오염시킬 위험 최소화.

---

## 1. Guard — 점수 계산

자세한 내용은 [04-risk-scoring](04-risk-scoring.md) 참조.

### 주요 입력

| 입력 | 출처 |
|------|------|
| 마우스 행동 feature 5가지 | 클라이언트 telemetry |
| 외부 인간 검증 점수 | Turnstile 등 제3자 서비스 |
| 이전 점수 | 세션 상태 (Redis) |

### 주요 처리

1. 5 feature를 0~1 범위로 정규화
2. 가중 합으로 내부 점수 계산
3. 외부 점수와 결합
4. EWMA로 누적
5. 비활성 감쇠·챌린지 통과 감쇠 적용
6. Tier 결정

### 중복 제거 (Dedup)

같은 `traceId`·`eventType`·`ts bucket`의 중복 처리로 인한 점수 중복 상승을 방지합니다.

| 항목 | 기본값 |
|------|-------|
| 중복 제거 TTL | 600초 |
| 키 | `traceId + eventType + ts_bucket` |

---

## 2. Analyzer — 증거 축적

자세한 내용은 [06-analyzer-signals](06-analyzer-signals.md) 참조.

### 주요 입력

| 입력 | 출처 |
|------|------|
| 최신 위험 점수·Tier | Guard 결과 |
| 이벤트 타입 | 현재 요청 정보 |
| 세션 카운터 | Redis 버킷 카운터 |

### 주요 처리

| 이벤트 타입 | 처리 |
|-----------|------|
| 고가치 클릭 | `rapid_high_value_click` 카운터 증가 |
| 조회성 API | `excessive_read_scanning` 카운터 증가 |
| 챌린지 실패 | `s3_fail_burst` 카운터 증가 + `challengeFailCount` 증가 |
| 챌린지 통과 | `challengeFailCount` 0 리셋 + `probationUntilMs` 설정 |
| 좌석 hold 성공 | `seatTakenStreak` 증가, `holdFailStreak` 리셋 |
| 좌석 hold 실패 | `holdFailStreak` 증가, `seatTakenStreak` 리셋 |

### 파생 신호 3종

| 신호 | 조건 | 기본 임계 |
|------|------|---------|
| `rapid_high_value_click` | 1.5초 윈도우 안에 3회 이상 고가치 클릭 | 3회 |
| `excessive_read_scanning` | 2초 윈도우 안에 조회 API 8회 이상 | 8회 |
| `s3_fail_burst` | 60초 안에 챌린지 2회 이상 실패 | 2회 |

---

## 3. Planner — 정책 적용

### 우선순위 규칙

```
① 이미 차단 중 (Redis block key 존재) → BLOCK
② 종료 상태 (flowState == SX) → NONE (무개입)
③ 구역/좌석 단계(S4/S5)에서 s3_passed == false → REQUIRE_S3 + HTTP 428
④ 결제 단계 (S6) → NONE (새 마찰 없음)
⑤ 그 외 → Tier-Action matrix 적용
```

### Tier → Action 기본 매트릭스

| Tier | Action |
|------|--------|
| T0 | NONE |
| T1 | THROTTLE |
| T2 | THROTTLE |
| T3 | BLOCK |

> **보조 신호** — Analyzer의 `scan_pressure`·`hv_click_pressure`·`rule_hits`는 Action을 직접 변경하지 않고 reason suffix(이유 코드)에 맥락 추가.

### 왜 이 순서인가

| 순위 | 이유 |
|-----|------|
| block 우선 | terminal 상태이므로 한 번 차단되면 state 유지 |
| terminal 우선 | 이미 끝난 세션은 판단 불필요 |
| S3 gate 강제 | S4/S5에서 챌린지 미통과는 tier와 무관하게 게이트 적용 |
| S6 완화 | 결제 단계에서 새 friction은 구매 전환 방해 |

---

## 4. Orchestrator — 실행·상태

### 주요 책임

| 책임 | 내용 |
|------|------|
| **Terminal-first block** | block 상태이거나 plan이 BLOCK이면 HTTP 403 즉시 반환 |
| **전이 검증** | 허용된 FlowState 전이인지 확인 (아니면 HTTP 409) |
| **S3 fixed gate** | Planner와 별개로 한 번 더 강제 (defense-in-depth) |
| **상태 커밋** | 세션 상태를 Redis에 저장 |
| **응답 구성** | HTTP 응답 + `x-defense-*` 헤더 |

### FlowState 허용 전이

canonical D0 FlowState: `S0 → S1 → S2 → S3 → S4 → S5 → S6 → SX`

| 전이 | 허용 여부 |
|------|--------|
| 순차 전이 | ✅ |
| S6 → S5 | ✅ (결제 중도 취소) |
| S0~S5 → SX | ✅ (abort/timeout) |
| 그 외 | ❌ HTTP 409 INVALID_TRANSITION |

> **SX 도달 후** — 새 replan 적용되지 않음. terminal no-replan.

### S3 fixed gate 강제

Planner가 REQUIRE_S3를 판단 안 했더라도, Orchestrator가 S4/S5 요청에 대해 s3_passed를 직접 확인합니다.

```
요청이 S4 또는 S5를 요구?
    ├─ YES + s3_passed = true → 통과
    ├─ YES + s3_passed = false → HTTP 428 CHALLENGE_REQUIRED (강제)
    └─ NO → Planner 결정대로
```

> **defense-in-depth** — 두 계층이 독립적으로 gate를 강제하므로 한쪽 버그도 방어력 유지.

### 응답 종류

| Action | HTTP 응답 | 헤더 |
|--------|---------|------|
| NONE / THROTTLE | 200 allow | `x-defense-throttle-ms` (THROTTLE만) |
| REQUIRE_S3 | 428 CHALLENGE_REQUIRED | `x-defense-reason=CHALLENGE_REQUIRED` |
| BLOCK | 403 BLOCKED | `x-defense-reason=BLOCKED` |

## 동시성 제어

| 락 | 범위 | 역할 |
|---|------|------|
| **프로세스 로컬 RLock** | 같은 세션 | 한 프로세스 내 동시 평가 직렬화 |
| **Redis 분산 락** | 같은 세션 | 여러 프로세스 간 직렬화 (best-effort) |

Redis 락 timeout 시 로컬 락만으로 진행하지만 경고 로그.

## 감사 이벤트

| 단계 | 이벤트 |
|------|-------|
| Guard | `DEF_GUARD_SCORED` |
| Analyzer | `DEF_ANALYZER_EVIDENCE_UPDATED` |
| Planner | `DEF_PLAN_COMPUTED` |
| Orchestrator | `DEF_ORCH_EXECUTED`, `DEF_BLOCK_DECIDED`, `DEF_BLOCK_ENFORCED`, `DEF_THROTTLE_APPLIED` |

자세한 내용은 [11-observability](11-observability.md) 참조.

## 참조

- [04-risk-scoring](04-risk-scoring.md) — Guard 점수 계산 세부
- [05-tier-action](05-tier-action.md) — Tier·Action 매핑
- [06-analyzer-signals](06-analyzer-signals.md) — Analyzer 규칙 세부
- [07-vqa-gate](07-vqa-gate.md) — S3 챌린지 게이트
