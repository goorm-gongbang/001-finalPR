# 13. 실패 모델과 복구 전략

AI Defense의 실패 모델은 **어떤 source를 믿고 무엇을 재실행해야 하는지**에 따라 나뉩니다. 각 실패 유형별로 복구 경로가 다릅니다.

## 복구 우선순위 원칙

| 목적 | 권위 원천 |
|------|---------|
| 정책의 현재 상태 | **PostgreSQL** (control plane) |
| Runtime 서빙 payload | **Redis projection** |
| 관측 재처리 | **S3 archive + ClickHouse** |
| Block 상태 검증 | **Redis + AI Defense audit** |

> **핵심 원칙** — Runtime 장애를 빨리 고치려고 PostgreSQL을 request path에 붙이는 건 **설계 위반**입니다.

## 실패 유형별 복구

### 1. Runtime Policy Read 실패

| 원인 | 처리 |
|------|------|
| **Missing** — 캐시에 없음 | `RuntimePolicyAuthorityError` |
| **Invalid** — 디코딩 오류 | `RuntimePolicyAuthorityError` |
| **Stale** — 신선도 만료 | `RuntimeProjectionStaleError` |

**복구 경로**

```
Redis projection을 PostgreSQL에서 재동기화
    ↓
tm-ai-policy-projection-resync --current
```

| Repair Hint | 내용 |
|-----------|------|
| Redis projection 복구 필요 | 명시 |
| 관련 env 확인 | PG·Redis env 완비 |
| Reconciler 확인 | 자동 동기화 동작 중인지 |

### 2. Control-plane Write 실패

| 에러 | 내용 |
|------|------|
| `PostgresControlPlaneWriteError` | PostgreSQL 쓰기 실패 |

**중요** — 이 경우 projection sync를 **진행하지 않습니다**. 일관성 손상 방지.

**복구 경로**

```
PostgreSQL 상태 복원 (backup·PITR)
    ↓
쓰기 재시도
    ↓
성공 후에만 Redis projection sync
```

### 3. Redis Projection Apply 실패

| 에러 | 내용 |
|------|------|
| `RedisProjectionApplyError` | Redis 쓰기 실패 |
| Resync hint 포함 | 재시도 안전 |

**주의** — PostgreSQL 쓰기는 이미 성공했을 수 있음. 같은 resync 재시도가 정상 복구 경로.

### 4. ClickHouse Ingest 실패

| 에러 | 원인 |
|------|------|
| `ETLIngestError` | Object-level 실패 |
| `CanonicalAuditMappingError` | Schema drift 가능성 |
| `ClickHouseBatchWriteError` | Network·auth·table·timeout |

**복구 경로**

```
S3 archive가 원천이므로 재처리로 복구
    ↓
tm-ai-etl-worker --force-replay --from-date <date>
```

| 확인 항목 | 내용 |
|---------|------|
| Schema drift | CanonicalAuditMappingError 발생 시 |
| Network·auth·table | ClickHouseBatchWriteError 발생 시 |
| Timeout 설정 | 배치 크기·시간 조정 |

### 5. Post-Review Backend Delivery 실패

| 상황 | 처리 |
|------|------|
| Backend adapter 없음 | delivery_status = NOT_CONFIGURED |
| 네트워크 오류 | delivery_status = FAILED |
| Run persistence | 이미 완료 (DB-first) |

**복구** — 실패한 session row만 재전달. Idempotency key로 중복 방지.

### 6. Auth-Guard Block Sync 실패

| 상황 | 처리 |
|------|------|
| Best-effort 동기화 | 실패해도 AI Defense block 상태·audit 먼저 확인 |

## 실패 모드 요약

| 영역 | 기본 모드 | 비상 모드 |
|------|---------|---------|
| **Ext-authz** | fail-open (장애 시 통과) | — |
| **Strict authority** | fail-fast (오류 명시) | — |
| **S3 verify** | 설정 가능 | 환경변수로 변경 |

### Ext-authz Fail-open

| 이유 | 설명 |
|------|------|
| **가용성 우선** | AI 장애로 서비스 전체 중단 방지 |
| **대체 방어** | 일반 DDoS는 WAF에서, 애플리케이션 봇은 backend autoscale |
| **trade-off** | 장애 시간 동안 방어력 저하 감수 |

### Strict Authority Fail-fast

| 이유 | 설명 |
|------|------|
| **일관성 우선** | invalid state로 계속 동작하는 것이 더 위험 |
| **trade-off** | 장애 시 request 실패 증가 (가용성 저하) |

### S3 Verify 설정

| 설정 | 동작 |
|------|------|
| 기본 | fail-close (HTTP 503) |
| 비상 | `TM_S3_VERIFY_UNAVAILABLE_MODE=fail_open` (policy downgrade) |

## 모니터링 지표

### Fail-open 발생률

| 지표 | 의미 |
|------|------|
| `ext_authz_fail_open_rate` | 장애로 통과된 비율 |
| 경보 기준 | 일정 임계 초과 시 |

### Projection Freshness

| 지표 | 의미 |
|------|------|
| `projection_staleness_ms` | 현재 시각 - `projection_refreshed_at_ms` |
| 경보 기준 | `max_staleness_ms` 근접 |

### Block 상태 일관성

| 지표 | 의미 |
|------|------|
| Redis block count vs Auth-Guard block count | 동기화 상태 |

## 복구 Runbook 예시

### Case 1: Runtime이 Policy read 실패 다수 발생

```
1. Projection staleness 지표 확인
    ↓ stale이면 PostgreSQL 정상 여부 확인
2. PostgreSQL 장애 여부 확인
    ↓ 정상이면 Redis 장애 여부
3. Redis 장애가 아니면 reconciler 동작 확인
    ↓ reconciler 중단이면 수동 resync
4. tm-ai-policy-projection-resync --current
5. Runtime 재평가
```

### Case 2: ClickHouse에 데이터가 없음

```
1. ETL worker 로그 확인
    ↓ ETLIngestError 확인
2. S3에 원천 파일 존재 확인
    ↓ 있으면 재처리 가능
3. tm-ai-etl-worker --force-replay --from-date <date>
4. ClickHouse에 데이터 확인
```

### Case 3: Ext-authz Fail-open 지속

```
1. AI Defense 서비스 로그 확인
    ↓ 500·timeout 확인
2. 리소스 부족 여부
    ↓ CPU·메모리 확인 (KEDA autoscale 동작?)
3. 다운스트림 의존성 (Redis, PG) 상태
4. 복구 후 fail-open 정상화 확인
```

## 제약 (현재 구조의 알려진 한계)

| 제약 | 설명 |
|------|------|
| **VQA telemetry 의존성** | 클라이언트에서 궤적 데이터 전송해야 함. 수집 실패 시 챌린지 자체 실패 가능 |
| **Match ID 추출 한계** | path·session_id shape 의존 → ambiguous case 존재 |
| **Ext-authz Fail-open** | AI 장애 시 방어 공백 |
| **Turnstile Optional** | 외부 score 없으면 fail-open score (0.5) 사용 → 정보량 감소 |
| **Policy projection freshness** | 너무 완화하면 stale, 너무 엄격하면 가용성 저하 |

## 참조

- [02-ext-authz](02-ext-authz.md) — Fail-open 상세
- [08-policy-authority](08-policy-authority.md) — Strict authority·신선도
- [11-observability](11-observability.md) — ETL·ClickHouse 재처리
- [12-storage-deployment](12-storage-deployment.md) — CLI 도구들
