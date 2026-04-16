# 09. 오프라인 정책 자동 최적화기

온라인에 LLM을 두지 않기로 한 대가로, 정책을 유연하게 진화시키는 역할은 오프라인 최적화기가 담당합니다. **LLM을 자동 적용기가 아닌 "제안 도구"로 사용**하는 것이 차별점입니다.

## 역할

| 항목 | 내용 |
|------|------|
| **입력** | ClickHouse의 관측 지표 + trace 샘플 |
| **출력** | 정책 patch proposal, optimization run record, rollout state, rollout event |
| **성격** | 제안 도구 (자동 적용 아님 — 검증기·단계적 배포 경유) |

## 작동 흐름

```
[1] 분석 저장소에서 지표 스냅샷 읽기
    └─ 차단율, 챌린지 실패율, 평균 지연, 특성 누락률 등
    ↓
[2] 실행 조건 확인 (Trigger Guard)
    └─ 이벤트 수·세션 수·쿨다운 충족 여부
    ↓ (조건 미충족 시 종료)
[3] 규칙 기반 제안 우선 시도
    └─ 결정론 규칙으로 단순한 patch
    ↓ (규칙 매치 안 되면)
[4] LLM 호출 (안전장치 적용)
    └─ model allowlist + QPS limit + JSON schema validator
    ↓
[5] Proposal Validator 통과 확인
    └─ 허용 path + numeric bound + 정책 일관성 검증
    ↓
[6] 단계적 배포 (Canary)
    └─ 5% → 20% → 50% → 100%
    ├─ 각 단계에서 guardrail 지표 감시
    └─ 악화 시 자동 롤백
```

## 입력 — Metrics Snapshot

ClickHouse의 특정 window 기반 지표:

| 지표 | 의미 |
|------|------|
| `window_start_ms`, `window_end_ms` | 분석 구간 |
| `events_total` | 총 이벤트 수 |
| `unique_sessions`, `unique_traces` | 세션·트레이스 수 |
| `event_counts_by_type` | 이벤트 타입별 건수 |
| `tier_distribution` | Tier 분포 |
| `action_distribution` | Action 분포 |
| `block_rate` | 차단율 |
| `require_s3_rate` | 챌린지 요구 비율 |
| `throttle_applied_rate` | throttle 적용 비율 |
| `avg_throttle_delay_ms` | 평균 지연 |
| `s3_pass_rate`, `s3_fail_rate`, `s3_temp_lock_rate` | 챌린지 통과·실패·임시 잠금 비율 |
| `dedup_duplicate_rate` | 중복 제거 비율 |
| `missing_feature_rate` | Feature 누락률 |
| `internal_error_rate` | 내부 에러율 |
| `latest_policy_version` | 최근 정책 버전 |

> **계산 기준** — `block_rate` 등은 trace 기준. `missing_feature_rate`는 Guard 로그의 `missingFlags` 비율.

## Trigger Guard

실행 조건을 충족하지 않으면 제안 시도조차 하지 않습니다.

### 기본 조건

| 조건 | 기본 임계 |
|------|---------|
| 총 이벤트 수 | ≥ 2000 |
| 고유 세션 수 | ≥ 200 |
| throttle 이벤트 수 | ≥ 100 |
| S3 이벤트 수 | ≥ 100 |
| 쿨다운 | 마지막 실행 후 일정 시간 경과 |
| max calls per run | 미초과 |
| 서킷 브레이커 | closed 상태 |

> **의도** — 샘플이 부족한 상태에서 정책을 건드리는 걸 방지.

## 규칙 기반 제안 (Rule-based Proposal)

### 기본 규칙 예시

| 조건 | 제안 |
|------|------|
| `avg_throttle_delay_ms` > 260 | T2 throttle delay −20ms |
| `block_rate` > 1.5% AND `s3_fail_rate` > 8% | `risk.alpha` −0.02 |

단순하고 결정론적인 규칙을 우선 적용. LLM은 최후의 수단.

## LLM Fallback

규칙이 매치되지 않을 때만 LLM 호출.

### 안전장치

| 안전장치 | 목적 |
|---------|------|
| Model allowlist | 승인된 모델만 사용 |
| QPS limit | API 호출 속도 제한 |
| Concurrency limit | 동시 호출 제한 |
| Timeout / retry | 지연·일시 실패 대응 |
| Circuit breaker | 연속 실패 시 차단 |
| JSON schema | 응답 형식 강제 |
| Validator | 응답 내용 검증 |

## Proposal Validator

### 허용 Path (Allowlist)

최적화기가 **변경 가능한** 파라미터:

| 파라미터 | 의미 |
|---------|------|
| `risk.alpha` | EWMA 누적 계수 |
| `tier.thresholds.T0_max` | T0 상한 |
| `tier.thresholds.T1_max` | T1 상한 |
| `tier.thresholds.T2_max` | T2 상한 |
| `tier.hysteresis.margin` | 히스테리시스 여유 |
| `risk.probation_seconds` | 보호 대기 시간 |
| `planner.throttle_delay_ms.T1` | T1 지연 |
| `planner.throttle_delay_ms.T2` | T2 지연 |

### 수정 불가 Path

| 파라미터 | 이유 |
|---------|------|
| Challenge retry/cooldown/halt | 사용자 경험 직결 |
| Block TTL | 사용자 경험 직결 |
| S3 gate state | 보안 설계 critical |

### 검증 항목

| 검증 | 내용 |
|------|------|
| Path 허용 여부 | Allowlist 체크 |
| Numeric bound | 각 값의 허용 범위 |
| Patch op | set/inc/dec만 허용 |
| Patch 수 | 1~12개 |
| Threshold 단조성 | T0 < T1 < T2 < 1.0 |
| Throttle 단조성 | T2 delay ≥ T1 delay |

## 왜 엄격한 허용 목록인가

- LLM이 "챌린지 재시도 5회로 늘려보자" 같은 창의적 제안을 해도 사용자 경험 직결 파라미터는 건드리면 안 됨
- 처음부터 수정 대상에서 제외 = **어떤 답이 나와도 위험하지 않음**
- LLM의 창의성 ≠ 올바름, 잘못된 방향으로도 창의적일 수 있음

## 단계적 배포 (Canary Rollout)

### 단계

```
5% → 20% → 50% → 100%
```

각 단계에서:

| 단계 | 동작 |
|------|------|
| 배포 | 해당 비율의 트래픽에 candidate 적용 |
| 관찰 | guardrail 지표 감시 |
| 판정 | 정상이면 다음 단계, 악화 시 자동 롤백 |
| FULL 도달 | candidate를 base로 승격, candidate_policy_version = None |

### Guardrail 지표

| 지표 | 의미 |
|------|------|
| `s3_temp_lock_rate` | 임시 잠금 비율 |
| `block_rate` | 차단율 |
| `avg_throttle_delay` | 평균 지연 |
| `s3_fail_rate` | 챌린지 실패율 |
| `dedup_duplicate_rate` | 중복 비율 |
| `internal_error_rate` | 내부 에러율 |

### Guardrail Delta 계산

```
base_metrics = read_metrics(base_policy_version)
candidate_metrics = read_metrics(candidate_policy_version)

for 각 지표:
    delta = candidate - base
    if delta > threshold:
        rollback(reason=해당 지표 악화)
```

## 왜 단계적인가

| 측면 | 이유 |
|------|------|
| **영향 분산** | 한 번에 100% 적용 시 모든 사용자에 즉시 퍼짐 |
| **조기 감지** | 5%에서 먼저 재서 문제 감지 |
| **점진적 확대** | 괜찮으면 확대 → 위험을 통제 가능한 수준으로 묶음 |

## Rollback

### 트리거

| 조건 | 동작 |
|------|------|
| Guardrail 지표 악화 | 자동 롤백 (`stage = ROLLED_BACK`) |
| 운영자 수동 | 명령어로 롤백 |

### 롤백 결과

| 필드 | 값 |
|------|---|
| `stage` | `ROLLED_BACK` |
| `ratio` | 0 |
| `candidate_policy_version` | None |

## 운영 모드

### Dry Run

| 모드 | 동작 |
|------|------|
| `dry_run=true` (기본) | 제안만 생성, 실제 적용 안 함 |
| `dry_run=false` + `apply_enabled=true` | 실제 적용 |
| `dry_run=false` + `apply_enabled=false` | 실패 (`apply_blocked`) |

### Apply Enable 전환

| 단계 | 절차 |
|------|------|
| 초기 | `dry_run=true`로 충분한 기간 운영 |
| 검증 | 제안 품질·롤아웃 guardrail 확인 |
| 승인 | AI팀 승인 후 `apply_enabled=true` 설정 |
| 모니터링 | rollout/rollback 지표 추적 |

## Post-check

Apply 후 확인 항목:

| 항목 | 확인 대상 |
|------|---------|
| PostgreSQL rollout state | stage, base/candidate version, ratio, updated_at_ms |
| Redis projection | version index, projection_refreshed_at_ms |
| Runtime 지표 | 새 정책 적용 후 guardrail 정상 여부 |

## 자동 mutation 제한

Optimizer는 다음 동작만 자동으로 수행:

| 동작 | 허용 |
|------|------|
| Canary start (5% 시작) | ✅ |
| Rollout expand (20→50→100%) | ✅ |
| Rollback (guardrail 악화 시) | ✅ |
| 그 외 정책 변경 | ❌ (운영자 수동) |

## 참조

- [08-policy-authority](08-policy-authority.md) — 정책 권위 저장소 구조
- [11-observability](11-observability.md) — 지표 수집 (ClickHouse)
- [13-failure-recovery](13-failure-recovery.md) — 정책 관련 실패 처리
