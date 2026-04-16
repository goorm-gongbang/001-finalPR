# 01. 아키텍처

AI Defense는 **Online Plane**(실시간 판단)과 **Offline Plane**(정책 분석·개선)으로 명확히 분리된 두 평면 구조입니다.

## 왜 두 평면으로 나누었나

방어 시스템의 요구는 서로 충돌하는 방향을 가집니다.

| 요구 | 의미 | 대응 |
|------|------|------|
| **실시간성** | 판단이 빠르고 예측 가능해야 함 | 결정 로직 단순·결정론 |
| **진화 대응력** | 공격 패턴 변화에 정책이 따라가야 함 | 유연성, LLM·인간 개입 |

한 시스템이 둘 다 하려면 양쪽이 어정쩡해집니다. 그래서 **두 평면으로 분리**했습니다.

| 평면 | 역할 | LLM 사용 | 설계 원칙 |
|------|------|---------|----------|
| **Online Plane** | 실시간 요청 판단 | ❌ **절대 호출 안 함** | 예측 가능성·재현성 |
| **Offline Plane** | 데이터 분석·정책 개선 | ✅ (안전장치와 함께) | 진화 대응력·자동화 |

> **이 분리가 AI팀 설계 철학의 출발점**입니다. 거의 모든 후속 결정이 이 원칙에서 파생됩니다.

## 요청 흐름

```
[사용자 브라우저]  마우스 행동 데이터 포함
      ↓
[서비스 메시 게이트웨이 (Envoy + Istio)]  중요 API만 선별
      ↓
[인증·방어 어댑터]  판단 요청 변환
      ↓
[AI Defense 런타임 (4단 파이프라인)]
      ↓ ↕
[인메모리 저장소 (Redis)]  세션 상태
      ↓
[백엔드 API]  비즈니스 로직

         ─── Offline Plane ───

[런타임 감사 로그] → [S3 아카이브] → [ETL] → [ClickHouse 분석 저장소]
                                                ├→ [정책 자동 최적화기]
                                                │      → [PostgreSQL 정책 권위]
                                                │      → 런타임 캐시 재동기화
                                                └→ [사후 검토 도우미]
                                                       → 의심 세션만 백엔드 제재
```

## 주요 컴포넌트

### Online Plane 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| **Envoy + Istio** | 서비스 메시 게이트웨이. Lua filter로 중요 API 선별 |
| **인증·방어 어댑터** | ext-authz 요청 ↔ AI Defense 평가 요청 변환 |
| **AI Defense 런타임** | 4단 파이프라인 (Guard→Analyzer→Planner→Orchestrator) |
| **Redis** | 세션 상태, 차단 상태, 중복 제거, 챌린지 토큰, 정책 캐시 |

### Offline Plane 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| **S3 아카이브** | 런타임 감사 로그의 영구 아카이브 |
| **ETL 처리기** | S3 로그 → ClickHouse 적재 |
| **ClickHouse** | 분석 저장소 (raw fact + rollup view) |
| **정책 자동 최적화기** | 지표 기반 정책 변경 제안 |
| **PostgreSQL** | 정책 권위 저장소 |
| **사후 검토 도우미 (Copilot)** | 의심 세션 사후 판단 |

## 설계 선택과 이유

### 중요 API만 검증

| 선택 | 이유 |
|------|------|
| 큐 입장·좌석 hold·결제만 ext-authz 활성화 | 모든 요청 검사 시 지연 누적·오탐 영향 확대 |
| 조회성 API는 통과 | 공격 가치 낮음, 부담만 큼 |

### 어댑터를 중간에 두는 이유

- AI Defense는 "차단 / 지연 / 챌린지 / 통과" 같은 의사결정 개념으로 응답
- 어댑터가 이걸 HTTP 응답 코드(403/428/allow)와 헤더(throttle-ms 등)로 번역
- AI Defense 판단 구조를 바꿔도 게이트웨이 설정 손댈 필요 없음
- 반대로 게이트웨이 정책이 바뀌어도 AI Defense 로직 영향 없음

### 장애 시 통과 정책 (fail-open)

| 선택 | 이유 |
|------|------|
| AI Defense 장애 시 요청 통과 | 서비스 전체 중단 방지 (가용성이 보안보다 우선) |
| 그 시간 방어력 저하 감수 | 모니터링으로 별도 감시 |

> **trade-off** — 장애 시간 동안 방어력은 낮아지지만, 서비스 중단은 더 큰 손실. KEDA 오토스케일링·타임아웃·fail-open 발생률 모니터링으로 보완.

## 데이터 흐름

### 런타임 판단 흐름

```
사용자 요청
    ↓
Envoy Lua filter: critical API인가?
    ├─ NO → 통과
    └─ YES → ext-authz 활성화
              ↓
          Adapter → AI Defense /evaluate
                     ↓
          Runtime 4단 파이프라인
                     ↓
          결정 (NONE/THROTTLE/REQUIRE_S3/BLOCK)
                     ↓
          Adapter → Envoy 응답 변환
                     ├─ allow + throttle 헤더
                     ├─ HTTP 403 (BLOCK)
                     └─ HTTP 428 (챌린지 필요)
                     ↓
          사용자·백엔드에 반영
```

### 오프라인 분석 흐름

```
Runtime audit JSONL
    ↓
주기적으로 S3 archive로 rotate·upload
    ↓
ETL Worker가 S3 → ClickHouse 변환·적재
    ↓
┌─────────────────────────────────────┐
│ ClickHouse 분석 저장소              │
│   ├─ defense_audit_events (raw)    │
│   ├─ session rollup view           │
│   ├─ match rollup view             │
│   └─ post-review 후보 view         │
└─────────────────────────────────────┘
    ↓                           ↓
[정책 자동 최적화기]        [사후 검토 도우미]
    ↓                           ↓
지표 기반 제안              의심 세션 판별
    ↓                           ↓
PostgreSQL 정책 기록        백엔드 제재 전달
    ↓
Redis 캐시 재동기화
    ↓
Runtime 반영
```

## 참조

- [02-ext-authz](02-ext-authz.md) — 게이트웨이·어댑터 연동 세부
- [03-runtime-pipeline](03-runtime-pipeline.md) — 4단 파이프라인 상세
- [08-policy-authority](08-policy-authority.md) — 정책 권위·캐시 분리
