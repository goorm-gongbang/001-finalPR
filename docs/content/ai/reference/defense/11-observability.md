# 11. Observability · 감사 · ETL · ClickHouse

AI Defense는 런타임 판단의 **재현성과 사후 분석**을 위해 감사를 중심으로 관측 데이터를 남깁니다. 3중 저장 구조로 서로 다른 용도를 지원합니다.

## 3중 저장 구조

```
Runtime audit JSONL (실시간 기록, 한 줄씩 추가만 됨)
    ↓
S3 Archive (주기 rotate·upload, 영구 아카이브)
    ↓
ETL Worker (변환·적재)
    ↓
ClickHouse (raw fact + rollup view, 분석 대상)
```

### 왜 3중인가

| 저장소 | 용도 | 특성 |
|-------|------|------|
| **구조화 로그 파일** | 실시간 기록 + tail 모니터링 + 규제 준수 | append-only |
| **장기 저장소 (S3)** | 영구 아카이브 + 재처리 원천 | 불변 (immutable) |
| **분석 저장소 (ClickHouse)** | 질의·집계 + 대시보드 소스 | SQL query |

각 저장소가 **서로 다른 용도**를 가지며, 하나로 모두 커버 못합니다.

## 1. Runtime Audit Log

### AuditEntry 구조

모든 Runtime 판단은 canonical JSONL row로 기록됩니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `ts_ms` | integer | 이벤트 발생 시각 |
| `session_id` | string | 세션 식별자 |
| `event_type` | string | 이벤트 종류 |
| `raw_payload` | object | 이벤트별 추가 정보 |
| `trace_id` | string | 분산 추적 ID |
| `request_id` | string | 요청 ID |
| `correlation_id` | string | 상관 ID |
| `challenge_id` | string? | 챌린지 ID (해당 시) |
| `flow_state` | string | 현재 FlowState |
| `risk_tier` | string | 현재 Tier |
| `action` | string | 결정된 Action |
| `reason_code` | string | 사유 코드 |
| `policy_version` | string | 적용된 정책 버전 |

### Mandatory Event Types

| 이벤트 | 의미 |
|-------|------|
| `DEF_GUARD_SCORED` | Guard가 riskScore 계산 완료 |
| `DEF_ANALYZER_EVIDENCE_UPDATED` | Analyzer가 counter/signal 갱신 |
| `DEF_PLAN_COMPUTED` | Planner가 action 선택 |
| `DEF_ORCH_EXECUTED` | Orchestrator가 state transition·HTTP 응답 확정 |
| `DEF_THROTTLE_APPLIED` | THROTTLE 실제 적용 |
| `DEF_BLOCK_ENFORCED` | BLOCK 실제 enforced |
| `S3_CHALLENGE_RESULT` | VQA 결과 (PASS/FAIL) |
| `TURNSTILE_VERIFIED` | 외부 human score 수신 |

### 기록 특성

| 특성 | 내용 |
|------|------|
| **append-only** | 한 번 쓴 내용은 수정 없이 계속 쌓임 |
| **즉시 flush** | 실행 도중 tail 모니터링 가능 |
| **스키마 검증** | event catalog 기반 검증 |
| **PII 금지 키 스캔** | 개인정보 포함 방지 |

### Local Warehouse Collector

JSONL을 tailing 또는 inline ingest하는 로컬 수집기. Compatibility·debug 용도로 유지되며 **운영 raw fact 원천은 아님**.

## 2. S3 Archive

### 동작

```
runtime audit JSONL (local file)
    ↓
주기적으로 atomic rename → rotation
    ↓
S3에 upload
    ├─ 성공 시 local rotated file 삭제
    └─ 실패 시 pending rotated file 유지 → 다음 주기 재시도
```

### 특성

| 특성 | 내용 |
|------|------|
| **영구 아카이브** | 삭제 안 함 |
| **Replay 원천** | 문제 분석·재처리 시 원천 데이터 |
| **낮은 비용** | S3 표준 스토리지 (콜드 스토리지도 고려) |

## 3. ETL Worker

### 동작

```
S3 object 선택 (신규 업로드된 .jsonl 파일)
    ↓
각 row를 canonical audit payload에서 ClickHouse insert row로 변환
    ↓
같은 object 내 dedup key 중복은 건너뜀
    ↓
batch size 도달 시 ClickHouse writer flush (retry policy 적용)
    ↓
성공한 object만 Redis processed-key ledger에 completed 기록
```

### 실패 처리

| 실패 | 처리 |
|------|------|
| 일부 row 변환 실패 | ledger에 completed 기록 안 됨 |
| Batch write 실패 | retry 후 실패 시 ledger 미기록 |
| 결과 | 다음 run 또는 force replay로 재처리 가능 |

### 환경별 권장 설정

| 환경 | Archive Interval | Batch Size |
|------|----------------|----------|
| Staging | 60초 | 128 |
| Production | 300초 | 256 |

## 4. ClickHouse

### Raw Fact Table — `defense_audit_events`

주요 컬럼:

| 컬럼 | 의미 |
|------|------|
| `ts_ms` | 이벤트 시각 |
| `session_id` | 세션 |
| `event_type` | 이벤트 종류 |
| `trace_id` | 트레이스 |
| `challenge_id` | 챌린지 |
| `flow_state` | 상태 |
| `risk_tier` | Tier |
| `action` | Action |
| `reason_code` | 사유 |
| `policy_version` | 정책 버전 |
| `raw_payload_json` | 전체 페이로드 |

### Read Model Views (5분 고정 window)

#### `defense_session_rollups`

Session별 집계.

| 컬럼 | 의미 |
|------|------|
| `session_id` | 세션 |
| `window_start_ms` | 윈도우 시작 |
| `event_count` | 이벤트 수 |
| `unique_traces` | 고유 트레이스 수 |
| `latest_flow_state` | 최신 flow state |
| `latest_action` | 최신 action |
| `latest_tier` | 최신 tier |
| `latest_reason` | 최신 사유 |
| `latest_policy_version` | 최신 정책 버전 |
| `throttle_count` | throttle 횟수 |
| `block_count` | block 횟수 |
| `challenge_count` | 챌린지 횟수 |

#### `defense_match_rollups`

경기별 집계 (match_id는 path 또는 session_id shape에서 보수적으로 추출).

#### `defense_post_review_candidates_v1`

사후 검토 후보 세션 목록. block·challenge·throttle·non-none action이 있는 세션을 후보로.

## 운영 지표

### ClickHouse Ingest 실패 복구

| 상황 | 복구 |
|------|------|
| ClickHouse ingest 실패 | S3 archive가 replay 원천이므로 복구 가능 |
| 원인 확인 필요 | key, flush_index, retry 설정, last_error 로그 |

### 에러 타입

| 에러 | 의미 | 복구 |
|------|------|------|
| `ETLIngestError` | Object-level 실패 | S3 object replay |
| `CanonicalAuditMappingError` | Schema drift 가능성 | 스키마 확인 |
| `ClickHouseBatchWriteError` | Batch write 실패 | network·auth·table·timeout 확인 |

## Processed-key Ledger

### 역할

| 항목 | 내용 |
|------|------|
| **목적** | 중복 처리 방지 |
| **저장소** | Redis |
| **TTL** | 영구 ledger 아니라 **운영 dedup cache** |

TTL이 지나면 이론상 재처리 가능하지만, 일반적으로 같은 object를 두 번 처리할 일은 없음.

## 재처리·Force Replay

### 언제 필요한가

| 상황 | 대응 |
|------|------|
| ClickHouse raw fact 손상 | S3 archive에서 재처리 |
| 특정 날짜 다시 처리 필요 | date 기반 force replay |

### 명령

```
tm-ai-etl-worker --force-replay --from-date 2026-04-16
```

## Read Model의 한계

### Match ID 추출 모호성

| 문제 | 설명 |
|------|------|
| 추출 방식 | path 또는 session_id shape 기반 보수적 추출 |
| 한계 | 일부 세션은 match_id가 ambiguous 또는 missing |
| 개선 방향 | 백엔드 계약 기반으로 안정화 |

## 참조

- [03-runtime-pipeline](03-runtime-pipeline.md) — 감사 이벤트 생성 시점
- [09-offline-optimizer](09-offline-optimizer.md) — ClickHouse 지표 입력
- [10-post-review](10-post-review.md) — Read model 활용
