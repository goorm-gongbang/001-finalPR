# 07. VQA — 2중 게이트 보안 챌린지

Challenge 계층은 위험을 즉시 block하기 전에 **사람임을 검증**하는 완충 장치입니다. S3 단계의 고정 보안 관문이며, 정답뿐 아니라 **푸는 과정의 행동 궤적**까지 2중으로 검증합니다.

## 발상의 전환

> **"정답을 맞춘다 ≠ 사람이다"**

- 자동화 봇이 VQA의 시드를 읽어 정답 좌표·타이밍을 계산하는 건 충분히 가능
- 정답 제출만으로는 사람 여부 판별 불가
- **푸는 과정의 마우스 움직임**까지 검증해야 함

## 2중 게이트 구조

| 게이트 | 검증 내용 | 대상 |
|-------|---------|------|
| **1층: 공간·시간 검증** | 글러브를 목표 위치로 가져갔는가, 목표 시각에 잡았는가, 실제 트리거됐는가 | 정답 자체 |
| **2층: 행동 궤적 판정** | 푸는 과정의 마우스 움직임이 자연스러운가 | 정답을 푸는 **과정** |

## 챌린지 발급 (Issue)

### Redis 저장 정보

| 필드 | 의미 |
|------|------|
| `challenge_id` | 챌린지 고유 식별자 |
| `seed` | 시드값 |
| `target_x`, `target_y` | 목표 좌표 (정규화 0.15~0.85) |
| `target_ts_ms` | 목표 시각 (700~2600ms offset 기반) |
| `expires_at_ms` | 만료 시각 (TTL 적용) |

### Public 파라미터

클라이언트에 공개되는 정보:

| 필드 | 의미 |
|------|------|
| `ready_go_total_seconds` | 준비 단계 총 시간 |
| `play_duration_seconds` | 게임 지속 시간 |
| `catch_radius_px` | 공간 판정 반지름 |
| `timing_window_ms` | 시간 판정 윈도우 |

### Seed Commitment

시드의 SHA256을 사전 커밋으로 노출 → 사후 조작 불가.

## 1층 게이트 — 공간·시간 검증

### 검증 단계

1. **챌린지 존재 여부** — `challenge_id` 유효성
2. **세션 매칭** — 발급된 세션과 요청 세션 일치
3. **재사용 여부** — `used` 플래그 확인
4. **만료 여부** — `expires_at_ms` 이전인지

### 공간 판정 (Spatial Verdict)

| 항목 | 계산 |
|------|------|
| 글러브 위치 | 클라이언트 전송 `glove_pos_norm` (정규화) |
| 목표 위치 | 발급 시 저장된 `target` |
| 거리 | 정규화 공간에서 유클리드 거리 |
| 반지름 | viewport 기반 `radius_norm` |
| 판정 | `dist ≤ radius_norm` |

### 시간 판정 (Temporal Verdict)

| 항목 | 계산 |
|------|------|
| 실제 잡은 시각 | 클라이언트 전송 `catch_ts_ms` |
| 목표 시각 | 발급 시 저장된 `target_ts_ms` |
| 시간 차이 | 절대값 |
| 허용 윈도우 | `timing_window_ms` |
| 판정 | `|catch_ts - target_ts| ≤ timing_window_ms` |

### 트리거 확인

| 항목 | 내용 |
|------|------|
| `catch_triggered` | 클라이언트가 실제로 잡기 동작을 했는가 |
| false인 경우 | 공간·시간 판정 모두 실패 처리 |

## 2층 게이트 — 행동 궤적 판정

클라이언트가 함께 전송한 VQA telemetry(마우스 궤적)를 Guard의 점수 계산과 유사하게 재계산합니다.

### VQA Attempt Score 계산

```
botRisk = Guard와 동일 내부 점수 계산

boosted_risk = 0.40 · linearity
             + 0.25 · (1 − normalize(pathRatio, 1, 1.20))
             + 0.15 · (1 − normalize(tremor, 0, 1.5))
             + 0.10 · normalize(velocity, 600, 2400)
             + 0.10 · (1 − normalize(dwell, 50, 500))

attempt_score = max(botRisk, boosted_risk)
```

> **boosted_risk는 챌린지 전용** — 극단적으로 직선적인 성공 패턴을 더 강하게 봄.

## VQA Terminal Abnormal 판정

정답을 맞췄더라도 `attempt_score`가 극단 기준을 만족하면 **abnormal terminal**로 처리해 BLOCKED 반환.

### Terminal Abnormal 조건

```
point_count ≥ 6 AND (
    (attempt_score ≥ 0.92)
    OR
    (attempt_score ≥ 0.84 AND has_strong_reasons AND linearity_extreme)
)
```

### 강한 Reason Code (`strong_reasons`)

| 지표 | 극단 기준 |
|------|---------|
| `linearity_extreme` | ≥ 0.985 (거의 완벽한 직선) |
| `path_ratio_extreme` | ≤ 1.03 |
| `tremor_low` | ≤ 0.20 |
| `velocity_high` | ≥ 2200 |
| `dwell_low` | ≤ 80 |

> **의미** — 정상 사람이 이 값을 **모두 통과하기 거의 불가능**. "정답은 맞췄지만 푸는 과정이 부자연스러운 봇"을 걸러내는 최종 방어선.

## 통과 처리

### 성공 시

```
[1] challengeFailCount = 0 (Analyzer)
[2] probationUntilMs 설정 (Analyzer)
[3] s3Passed = true (Orchestrator)
[4] s3PassedAtMs = now (Orchestrator)
[5] r_new = r_new × 0.5 (Guard — 검증 통과 감쇠)
[6] match state와 sid-level alias에 vqa_passed=true upsert
[7] D0 decision engine에 S3 PASS 싱크
```

### 실패 시

```
[1] challengeFailCount += 1 (Analyzer)
[2] vqa_attempt_count += 1 (VQA 전용 카운터)
[3] attempt window counter 증가
[4] cooldown 적용 (첫 실패 / 두 번째 이후 다른 cooldown)
[5] max attempts 초과 시 challengeHaltUntilMs 설정 → HTTP 429
```

### Abnormal Terminal 시

```
[1] vqa_last_result = BLOCKED
[2] remainingAttempts = 0
[3] reason = "abnormal_pattern"
[4] 즉시 차단
```

## 재시도·쿨다운·잠금 메커니즘

| 단계 | 동작 |
|------|------|
| 실패 감지 | `attempt_window_counter` 증가 |
| 첫 실패 | 짧은 쿨다운 |
| 연속 실패 | 긴 쿨다운 |
| max attempts 초과 | `challengeHaltUntilMs` 설정 |
| 잠금 상태 요청 | HTTP 429 CHALLENGE_TEMPORARILY_LOCKED |

## Turnstile 외부 검증 (External Score Channel)

### 역할

| 항목 | 내용 |
|------|------|
| **위치** | Optional external score channel |
| **기본 fail-open score** | 0.50 |
| **캐싱** | Redis cache에 결과 저장 |

### 처리

| 상황 | 처리 |
|------|------|
| 토큰 없음 | fail-open score 사용 |
| 토큰 invalid/timeout/error | fail-open score 사용 |
| 성공 + score 반환 | 해당 값 사용 |
| 성공 but score 없음 | 1.0으로 간주 |

### Guard 결합

Guard에서 `external_score`가 낮을수록 `s_ext_botlikeness`가 높아짐 → 위험 점수 증가.

## Verify 중 오류 처리

Redis 오류·read 오류 등 내부 문제가 발생했을 때:

| 설정 | 동작 |
|------|------|
| `fail_open` 모드 (기본) | `CHALLENGE_VERIFY_UNAVAILABLE` 반환, 사용자 허용 |
| `fail_close` 모드 | `CHALLENGE_VERIFY_UNAVAILABLE` 반환, 사용자 거부 |

환경변수로 제어 가능.

## Telemetry 누락 처리

| 조건 | 처리 |
|------|------|
| telemetry point < 2 | `missing_vqa_telemetry` — 챌린지 성공 조건 자체 불충족 |
| D0 risk sync에서 feature summary 없음 + 결과 `PASS` 아님 | `external_score = 0.0` (위험 상승) |

> **주의** — 프론트엔드 telemetry 수집 실패는 **사용자 경험상 챌린지 실패 또는 위험 상승**으로 이어짐. 클라이언트 SDK 안정성이 중요.

## 왜 공격자가 뚫기 어려운가

| 관점 | 설명 |
|------|------|
| 1층 | 시드 계산 + 정확한 타이밍 제출 필요 |
| **2층** | **마우스 움직임 자체를 자연스럽게 합성** ← 훨씬 까다로움 |

공격 에이전트가 6단 궤적 합성 파이프라인을 들이는 이유가 바로 여기입니다.

## 정책 허용 범위

| 파라미터 | 자동 최적화 대상? |
|---------|--------------|
| retry window | ❌ (제외) |
| cooldown seconds | ❌ (제외) |
| halt seconds | ❌ (제외) |
| max attempts | ❌ (제외) |

> **이유** — 사용자 경험 직결 파라미터. 운영·제품 소유 결정으로 남김.

## 감사 이벤트

| 이벤트 | 내용 |
|-------|------|
| `S3_CHALLENGE_RESULT` | 챌린지 결과 (PASS/FAIL/BLOCKED) |
| `S3_CHALLENGE_HALTED` | 임시 잠금 발생 |
| `TURNSTILE_VERIFIED` | 외부 검증 완료 |
| `VQA_TELEMETRY_SCORE` | 궤적 기반 점수 계산 결과 |

## 참조

- [03-runtime-pipeline](03-runtime-pipeline.md) — Orchestrator의 S3 fixed gate
- [04-risk-scoring](04-risk-scoring.md) — 내부 점수 계산 (재사용)
- [06-analyzer-signals](06-analyzer-signals.md) — challengeFailCount 관리
