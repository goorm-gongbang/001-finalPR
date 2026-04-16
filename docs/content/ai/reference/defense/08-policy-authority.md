# 08. 정책 권위와 런타임 캐시 분리

정책 관리에는 두 축이 있습니다: **권위(authority)**와 **서빙(serving)**. 이 둘을 분리한 것이 AI Defense의 중요한 설계 특징입니다.

## 두 계층

| 계층 | 저장소 | 역할 | 누가 읽는가 |
|------|-------|------|-----------|
| **권위** | PostgreSQL | 정책 원본·이력·롤아웃 상태 | 오프라인 도구들 |
| **서빙** | Redis | 직렬화된 정책 문서·롤아웃 캐시·버전 인덱스 | Runtime |

> **중요** — Runtime은 PostgreSQL을 **직접 읽지 않습니다**. Redis projection만 읽습니다.

## 왜 분리했나

### 3가지 관점

| 관점 | 이유 |
|------|------|
| **성능** | PostgreSQL 쿼리는 네트워크 RTT + 실행 시간이 수십 ms. Redis는 ms 이내. 요청 경로에서 매번 읽으면 누적 지연 커짐 |
| **안정성** | PostgreSQL이 잠시 느려져도 Runtime이 영향 안 받음. 백업·유지보수 중에도 운영 지속 |
| **감사 추적** | 정책 변경의 원천은 한 곳이어야 함. 파생 상태는 언제든 재동기화 가능 |

## PostgreSQL — 권위 저장소

### 주요 테이블

| 테이블 | 역할 |
|-------|------|
| `policy_versions` | 모든 정책 스냅샷 |
| `policy_rollout_state` | 현재 base/candidate, rollout stage, ratio |
| `policy_rollout_events` | 언제 누가 어떤 정책을 배포했는지 audit trail |
| `policy_optimization_runs` | Offline Optimizer 제안 이력 |
| `post_review_runs` | 사후 검토 배치 실행 이력 |
| `post_review_session_results` | 세션별 사후 검토 결과 |

### PolicySnapshot 구성

한 번의 평가 사이클에서 불변인 정책 파라미터 묶음:

| 분류 | 파라미터 예시 |
|------|-----------|
| Risk | `risk.alpha`, `risk.passive_decay_*`, `risk.probation_seconds_after_s3_pass` |
| Tier | `tier.thresholds.T0_max/T1_max/T2_max`, `tier.hysteresis.margin` |
| Turnstile | Turnstile 설정 |
| Action | Action matrix |
| S3 gate | gate 활성 여부 |
| Throttle | `throttle_delay_ms.T1/T2`, max delay |
| Challenge | retry/halt/TTL |
| Block | TTL |

### Validation

| 검증 항목 | 내용 |
|---------|------|
| Threshold 단조성 | `T0_max < T1_max < T2_max < 1.0` |
| Throttle 단조성 | `T2_delay >= T1_delay` |
| Cooldown 단조성 | 정책별 관계 |
| Turnstile limit | 허용 범위 |
| MVP invariant | MVP에서 고정되어야 할 값 (예: runtime_llm_enabled=false) |

## Redis — 런타임 서빙

### 저장 항목

| 항목 | 의미 |
|------|------|
| **Policy document** | 직렬화된 정책 문서 (JSON) |
| **Rollout state cache** | current base/candidate/ratio/stage |
| **Version index** | 사용 가능한 정책 버전 목록 |
| `projection_refreshed_at_ms` | 마지막 동기화 시각 |

### 런타임 동작

```
요청 들어옴
    ↓
PolicyLoader가 rollout state 읽음
    ├─ stage = NONE 또는 ROLLED_BACK → base 사용
    ├─ stage = FULL → base 사용
    └─ stage = 중간 (candidate + ratio) → 세션별 결정
                                         → sha256(session_id + salt) % 10000
                                         → ratio 범위 안이면 candidate, 아니면 base
    ↓
결정된 policy version의 document를 Redis에서 로드
    ↓
Runtime 판단에 사용
```

## Freshness와 Staleness 감지

### Staleness 계산

```
if projection.projection_refreshed_at_ms exists:
    freshness_ts = projection.projection_refreshed_at_ms
else:
    freshness_ts = projection.updated_at_ms

staleness = now_ms - freshness_ts

if staleness > max_staleness_ms:
    raise RuntimeProjectionStaleError
```

### Strict Authority Mode

| 상황 | 기본 모드 | Strict 모드 |
|------|---------|-----------|
| projection missing | fallback 가능 | **RuntimePolicyAuthorityError** |
| decode error | fallback 가능 | **RuntimePolicyAuthorityError** |
| stale 감지 | fallback 가능 | **RuntimeProjectionStaleError** |

> **Strict mode 의의** — "정책이 stale한지 모르고 운영되는" 최악의 시나리오 차단.

### Strict mode의 trade-off

| 측면 | 영향 |
|------|------|
| **장점** | 정책 일관성 보장, 오래된 정책 방지 |
| **단점** | PostgreSQL 지연·장애 시 request 실패 증가 (가용성 저하) |
| **권장** | production은 strict, staging은 완화 |

## Projection Apply (PostgreSQL → Redis 동기화)

### 순서 보장

```
[1] policy document (JSON) 먼저 저장
    ↓
[2] rollout state 저장
    ↓
[3] version index 갱신 (기존 인덱스 + 새 input 합쳐서 정렬·dedup)
    ↓
[4] projection_refreshed_at_ms 타임스탬프 기록
```

### 실패 처리

| 상황 | 에러 |
|------|------|
| PostgreSQL write 성공 + Redis apply 실패 | `RedisProjectionApplyError` (resync hint 포함) |
| PostgreSQL write 실패 | `PostgresControlPlaneWriteError` (projection sync 진행 금지) |

## Projection Reconciler (자동 동기화)

### 조건

| 조건 | 의미 |
|------|------|
| Strict authority 활성 | projection이 중요한 환경 |
| PG·Redis env 완비 | 필요한 연결 정보 있음 |
| Redis backend 정상 | 분산 락 사용 가능 |

### 동작

```
백그라운드 loop
    ├─ Redis 분산 락 획득 시도 (중복 실행 방지)
    ├─ PostgreSQL에서 current rollout state 조회
    ├─ 해당 policy document 조회
    ├─ Redis에 document → rollout state → version index 순서로 apply
    ├─ projection_refreshed_at_ms 갱신
    └─ 주기 대기 후 반복
```

## 운영 관점

### Freshness 설정의 trade-off

| 값 | 영향 |
|---|------|
| 너무 길게 | stale projection 오래 허용 |
| 너무 짧게 | 일시적 PG/Redis 지연으로 runtime unavailable 증가 |

### Production 기본 정책

| 설정 | 권장 |
|------|------|
| `TM_POLICY_ALLOW_LOCAL_FALLBACK` | `false` |
| `TM_ALLOW_IN_MEMORY_REDIS` | `false` |
| Strict authority | 활성 |

> **복구 경로** — projection missing·stale → `tm-ai-policy-projection-resync` 재실행.

## 관련 에러

| 에러 | 원인 | 복구 |
|------|------|------|
| `RuntimePolicyAuthorityError` | projection missing/invalid/stale | Redis resync |
| `PostgresControlPlaneWriteError` | PostgreSQL write 실패 | 재시도, projection sync는 하지 않음 |
| `RedisProjectionApplyError` | Redis write 실패 | 같은 resync 재시도 안전 |

자세한 내용은 [13-failure-recovery](13-failure-recovery.md) 참조.

## 참조

- [09-offline-optimizer](09-offline-optimizer.md) — 정책 변경 제안 도구
- [12-storage-deployment](12-storage-deployment.md) — 배포 시 PreSync 절차
- [13-failure-recovery](13-failure-recovery.md) — 실패 모델
