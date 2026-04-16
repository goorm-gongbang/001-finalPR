# 05. Tier · Action · 히스테리시스 · 보호 대기

위험 점수를 실제 트래픽 제어로 변환하는 계층입니다.

## Tier 정의

| Tier | 점수 범위 | 기본 Action | 의미 |
|------|---------|---------|------|
| **T0** | < 0.20 | NONE | 정상 |
| **T1** | < 0.50 | THROTTLE (80ms) | 경미 |
| **T2** | < 0.80 | THROTTLE (250ms) | 의심 |
| **T3** | ≥ 0.80 | BLOCK | 위험 |

## Action 정의

| Action | HTTP 응답 | 헤더 | 효과 |
|--------|---------|------|------|
| **NONE** | 200 allow | — | 그대로 통과 |
| **THROTTLE** | 200 allow | `x-defense-throttle-ms` | 일정 시간 지연 후 응답 |
| **REQUIRE_S3** | 428 CHALLENGE_REQUIRED | `x-defense-reason=CHALLENGE_REQUIRED` | 챌린지 요구 |
| **BLOCK** | 403 BLOCKED | `x-defense-reason=BLOCKED` | 차단 |

## 히스테리시스 (Hysteresis)

단순 임계값만 쓰면 점수가 경계값 근처에서 진동할 때 Tier가 왔다갔다합니다. 이를 방지하기 위해 **다운그레이드에만 여유 임계치**를 적용합니다.

### 핵심 원칙

| 방향 | 규칙 |
|------|------|
| **업그레이드** (점수 상승) | 임계값 넘으면 즉시 |
| **다운그레이드** (점수 하강) | 여유(`margin`) 이상 더 떨어져야 반영 |

### 계산

```
if raw_tier < previous_tier:
    if in_probation:
        tier = previous_tier                     # 다운그레이드 금지
    else:
        downgrade_cutoff = threshold[previous_tier-1] - margin
        if r_현재 >= downgrade_cutoff:
            tier = previous_tier                 # 아직 안 내려옴
        else:
            tier = raw_tier                      # 내려감
else:
    tier = raw_tier
```

### 기본 margin

| 항목 | 값 |
|------|---|
| `margin` | 0.02 |

### 예시

- 세션이 T2 (0.50~0.80)에 있음
- r_현재가 0.40으로 떨어짐 → raw_tier는 T1
- 다운그레이드 cutoff: `T0_max − margin = 0.20 − 0.02 = 0.18`
- r_현재 0.40 > 0.18 → **여전히 T2 유지**
- r_현재가 0.15로 더 떨어져야 T1로 내려감

> **효과** — "정말로 회복했는지" 확인하는 과정. 한두 번의 좋은 이벤트만으로 Tier가 급락하지 않음.

## 보호 대기 (Probation)

챌린지 통과 직후의 특수 상황을 다룹니다.

### 개념

| 조건 | 효과 |
|------|------|
| S3 챌린지 `PASS` 후 | 점수 50% 감쇠 |
| 추가로 | `probationUntilMs`까지 **Tier 다운그레이드 금지** |

### 왜 필요한가

- 점수만 반감시키면 바로 T0로 떨어져 다시 봇이 자유롭게 행동 가능
- "봇이 챌린지만 억지로 통과한 뒤 다시 빠르게 행동"하는 시나리오를 잡기 위함
- 일정 시간 경계 상태 유지 필요

### 설정값

| 파라미터 | 기본값 |
|---------|-------|
| `probation_seconds_after_s3_pass` | 정책에서 정의 |

## 정책 우선순위 규칙

Action 결정 시 **다음 순서대로** 규칙이 적용됩니다.

```
① 이미 차단 중 (Redis block key 존재) → BLOCK (Tier 무관)
② 종료 상태 (flowState == SX) → NONE (무개입)
③ 구역/좌석 단계(S4/S5)에서 s3_passed == false → REQUIRE_S3 + HTTP 428
④ 결제 단계 (S6) → Tier matrix 적용 (챌린지 강제 안 함)
⑤ 그 외 → 기본 Tier-Action matrix 적용
```

### 왜 이 순서

| 순위 | 이유 |
|-----|------|
| block 우선 | terminal 상태이므로 한 번 차단되면 state 유지 |
| terminal 우선 | 이미 끝난 세션은 판단 불필요 |
| S3 gate 강제 | S4/S5에서 챌린지 미통과는 Tier 무관하게 게이트 적용 |
| S6 완화 | 결제 단계에서 새 friction은 구매 전환 방해 → 새 챌린지는 안 걸지만 Tier 기반 지연은 적용 |

### Evidence Suffix (이유 코드 맥락)

Planner는 Action 자체를 바꾸지 않고 **reason suffix에 맥락**만 추가합니다.

| Suffix | 조건 |
|--------|------|
| `scan_high` | 조회 스캐닝 압력 높음 |
| `hv_high` | 고가치 클릭 압력 높음 |
| `s3_fail_burst` | 챌린지 연속 실패 |
| `probation` | 보호 대기 중 |

예: `T2 THROTTLE (reason=scan_high, probation)`

## Orchestrator의 Terminal-First 실행

Orchestrator는 **Terminal-First Executor** 패턴으로 동작합니다.

```
[1] Redis block key 또는 plan=BLOCK 체크
    → 해당 시 BLOCK 유지·생성 + HTTP 403 응답
    (전이 검증 skip — 이미 차단된 세션은 모든 요청 거절)

[2] current flowState == SX 체크
    → 해당 시 terminal_no_replan → ALLOW

[3] 요청된 flowState != 현재 flowState
    → 허용 전이 테이블 확인
    → 없으면 HTTP 409 INVALID_TRANSITION

[4] S4/S5 요청 + s3_passed == false
    → Plan 무관하게 S3 fixed gate 강제
    → HTTP 428 + S3 grace key 설정

[5] 정상 allow path
    → NONE/THROTTLE 적용
    → Throttle delay 헤더 추가 (THROTTLE일 때)
    → 세션 TTL refresh
```

## FlowState 허용 전이

| 전이 | 허용 여부 |
|------|--------|
| S0→S1, S1→S2, S2→S3, S3→S4, S3→S5 | ✅ |
| S4→S5, S4→S6, S5→S6 | ✅ |
| S6→S5 (결제 중도 취소) | ✅ |
| S6→SX (결제 완료) | ✅ |
| S0~S5 → SX (abort/timeout) | ✅ |
| 그 외 | ❌ HTTP 409 |

## 외부 F-state 호환

백엔드·프론트엔드 호환을 위해 F-state를 내부 D0 state로 매핑합니다.

| F-state | D0 state | 의미 |
|---------|---------|------|
| F0 | S0 | 초기 |
| F1 | S2 | 큐 입장 |
| F2 | S3 | 좌석 진입 (보안 검증 단계) |
| F3R | S4 | 추천 블록 조회 (좌석 추천 모드) |
| F3M | S4 | 수동 섹션 조회 (직접 좌석 선택 모드) |
| F4R | S5 | 추천 hold |
| F4M | S5 | 수동 hold |
| FX | SX | 종료 |

> **R/M suffix** — 좌석 모드(추천/수동) 정보 보존용. 내부 판단에서는 같은 S4/S5로 합쳐짐.

## 운영 지표

| 지표 | 의미 |
|------|------|
| Tier 분포 | T0/T1/T2/T3 비율 |
| Action 분포 | NONE/THROTTLE/BLOCK 비율 |
| Downgrade 빈도 | 다운그레이드 발생 횟수 |
| INVALID_TRANSITION 빈도 | flow state 동기화 문제 |

### 판독 가이드

| 관찰 | 해석 |
|------|------|
| T2 증가 + THROTTLE만 증가, BLOCK 안정 | 완충적으로 동작 중 |
| T3 + BLOCK 동반 증가 | 높은 위험 또는 정책 과민 가능성 |
| INVALID_TRANSITION 증가 | 프론트·백엔드 flow 동기화 확인 필요 |

## 참조

- [03-runtime-pipeline](03-runtime-pipeline.md) — 4단 파이프라인 상세
- [04-risk-scoring](04-risk-scoring.md) — Tier 결정 입력
- [06-analyzer-signals](06-analyzer-signals.md) — Evidence suffix 소스
