# 12. Storage · Migration · Deployment

AI Defense의 저장소는 **목적별로 분리**되어 있고, 배포는 **순서 보장**이 핵심입니다.

## 저장소 분리

| 저장소 | 목적 | 소유 | 데이터 |
|-------|------|------|--------|
| **PostgreSQL** | 정책 권위, 사후 분석 저장 | 운영팀·AI팀 | policy_versions, policy_rollout_state, post_review_runs, optimization_runs |
| **Redis** | 런타임 세션·정책 캐시 | AI Defense | session state, policy projection, challenge tokens, dedup TTLs |
| **S3** | 감사 아카이브, ETL source | 클라우드 팀 | decision_audit.jsonl, trajectory_raw.jsonl (append-only) |
| **ClickHouse** | 분석 read model | 데이터 팀 | defense_audit_events raw, rollup view들 |

## PostgreSQL DDL

### 주요 테이블

| 테이블 | 역할 |
|-------|------|
| `post_review_runs` | 사후 검토 배치 실행 이력 |
| `post_review_session_results` | 세션별 사후 검토 결과 |
| `policy_versions` | 정책 스냅샷 전체 버전 |
| `policy_rollout_state` | 현재 base/candidate, rollout stage, ratio |
| `policy_rollout_events` | 정책 변경 audit trail |
| `policy_optimization_runs` | Optimizer 제안 이력 |

### DDL 적용 원칙

| 원칙 | 내용 |
|------|------|
| **Idempotent** | 재실행해도 안전 |
| **기존 row 보존** | 마이그레이션 중 데이터 손상 없음 |
| **Dry-run 지원** | 실제 적용 전 SQL·plan 확인 |

## ClickHouse DDL

### Raw Fact

| 테이블 | 역할 |
|-------|------|
| `defense_audit_events` | 모든 runtime 감사 이벤트 raw |

### Read Model Views

| 뷰 | 역할 |
|---|------|
| `defense_session_rollups` | Session별 5분 window 집계 |
| `defense_match_rollups` | 경기별 5분 window 집계 |
| `defense_post_review_candidates_v1` | 사후 검토 후보 |

## CLI 도구들

### tm-ai-storage-migrate

| 항목 | 내용 |
|------|------|
| **역할** | PostgreSQL DDL 적용 |
| **Dry-run** | SQL 파일 존재·적용 plan 확인 |
| **Idempotent** | 이미 있으면 skip |

### tm-ai-policy-bootstrap

| 항목 | 내용 |
|------|------|
| **역할** | baseline PolicySnapshot을 `policy_versions`에 저장 |
| **속성** | ACTIVE, source_type=BASELINE_BOOTSTRAP |
| **Rollout row** | FULL, ratio=0, current_status=ACTIVE |
| **기존 처리** | 이미 있으면 overwrite 안 함, skip |

### tm-ai-policy-projection-resync

| 항목 | 내용 |
|------|------|
| **역할** | PostgreSQL rows → Redis runtime projection |
| **옵션** | `--current` / rollout_id 지정 / policy_version 지정 |
| **쓰기 순서** | policy document → rollout state → version index |
| **타임스탬프** | `projection_refreshed_at_ms` 기록 |

## 배포 PreSync 순서

배포의 안정 조건은 **3단계 순서 보장**입니다.

```
PreSync Job (실패하면 Deployment 진행 안 함)
    ↓
[1] tm-ai-storage-migrate
    └─ PostgreSQL DDL 적용
    ↓
[2] tm-ai-policy-bootstrap
    └─ baseline policy seed 생성
    ↓
[3] tm-ai-policy-projection-resync --current
    └─ Redis projection 준비
    ↓
Deployment + CronJob 진행
    └─ runtime 시작
```

### 왜 이 순서인가

| 의존 관계 | 이유 |
|---------|------|
| migration → bootstrap | 테이블이 없으면 insert 실패 |
| bootstrap → resync | policy row가 없으면 projection 불가 |
| resync → runtime | runtime이 projection 읽음 |

### 각 CLI가 idempotent한 이유

| 단계 | 이유 |
|------|------|
| Storage migrate | 이미 있는 스키마는 skip |
| Bootstrap | 기존 row 보존 |
| Projection resync | 같은 current state를 Redis에 overwrite 가능 |

→ 실패 후 같은 명령 재시도해도 안전.

## Deployment 구성

### AI Defense 서비스

| 항목 | 내용 |
|------|------|
| **프레임워크** | FastAPI |
| **Root path** | `/ai` |
| **필요 env** | Redis, PostgreSQL, ClickHouse, S3, Auth-Guard URL, OpenTelemetry |

### ai-etl CronJob

| 항목 | 내용 |
|------|------|
| **주기** | 매 시간 15분 |
| **이미지·SA** | ai-defense와 공유 |
| **역할** | S3 archive → ClickHouse 적재 |

### KEDA 오토스케일링

| 서비스 | 기준 | 범위 |
|-------|------|------|
| ai-defense | CPU | 1~3 replica |
| authz-adapter | CPU | 1~3 replica |

## 환경 구분

### Production 필수 환경변수

| 환경변수 | 값 |
|---------|---|
| `TM_ENV` | production |
| `TM_REDIS_URL` | Redis 연결 정보 |
| `TM_ROLLOUT_SALT` | 롤아웃 hash salt |
| `TM_POLICY_ALLOW_LOCAL_FALLBACK` | `false` |
| `TM_ALLOW_IN_MEMORY_REDIS` | `false` |

### Staging 기본값

| 설정 | 값 |
|------|---|
| Redis | DB 1을 runtime state/projection으로 |
| S3 archive bucket | staging 전용 |
| ClickHouse URL | staging 인스턴스 |
| ETL interval | 60초 |
| ETL batch | 128 |

### Production 기본값

| 설정 | 값 |
|------|---|
| Redis | 분리된 프로덕션 인스턴스 |
| ETL interval | 300초 |
| ETL batch | 256 |

## Optimizer 운영

### Dry-run 초기 운영

| 단계 | 설정 |
|------|------|
| 초기 배포 | `dry_run=true` 강제 |
| 검증 기간 | 제안 품질 관찰 |
| 승인 후 전환 | `TM_POLICY_OPTIMIZER_APPLY_ENABLED=true` |

### Apply 모드 실패

| 조건 | 결과 |
|------|------|
| `dry_run=false` + `apply_enabled=false` | `apply_blocked` 실패 |

### Post-check

Apply 후 다음 항목 확인:

| 항목 | 확인 대상 |
|------|---------|
| PostgreSQL rollout state | stage, base/candidate version, ratio, updated_at_ms |
| Redis projection | stage, base/candidate version, ratio, version index, projection_refreshed_at_ms |

## Post-Review CronJob

| 조건 | 상태 |
|------|------|
| ClickHouse read model 준비 | 필수 |
| PostgreSQL 준비 | 필수 |
| 주기 | 예: 10분 |
| Window | 예: 600초 |

## ArgoCD 통합

| 항목 | 내용 |
|------|------|
| **GitOps** | ArgoCD sync로 배포 |
| **PreSync** | 위 3단계 자동 실행 |
| **실패 시** | Deployment rollout 진행 안 함 |

## 배포 자동화 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **사람 개입 최소화** | PreSync로 storage·policy 자동 준비 |
| **순서 보장** | 마이그레이션→bootstrap→resync 순차 |
| **실패 안전** | 각 단계 idempotent, 재실행 가능 |
| **가드레일** | Optimizer는 dry-run 기본, 승인 후 apply |

## 참조

- [08-policy-authority](08-policy-authority.md) — PostgreSQL·Redis 분리
- [09-offline-optimizer](09-offline-optimizer.md) — Optimizer 동작
- [11-observability](11-observability.md) — ETL·ClickHouse
- [13-failure-recovery](13-failure-recovery.md) — 복구 경로
