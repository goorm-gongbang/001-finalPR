# 02. Ext-Authz 연동과 트래픽 제어

AI Defense 판단을 실제 트래픽 제어로 연결하는 계층입니다. Istio Gateway의 Envoy가 중요 API에 대해서만 외부 인증(ext-authz)을 활성화하고, 어댑터가 요청을 AI Defense의 판단 요청으로 번역합니다.

## 계층 구조

```
[사용자 브라우저]
    ↓ HTTP 요청
[Istio Gateway]
    ├─ Lua Filter: critical API 판별
    ├─ ext-authz 필터 (gRPC)
    └─ 라우팅
        ↓
[인증·방어 어댑터 (gRPC)]
    ↓ POST /evaluate (HTTP)
[AI Defense Runtime]
    ↓ 응답 (allow/deny + 헤더)
[Envoy]
    ├─ allow → 백엔드 전달
    ├─ HTTP 403 → 차단 응답
    └─ HTTP 428 → 챌린지 요구
```

## Istio Lua Filter — 중요 API 선별

모든 API를 검사하면 지연이 누적되므로 **중요 API만** 선별해 ext-authz를 활성화합니다.

### 제외 경로

| 경로 | 이유 |
|------|------|
| `/ai/*` | AI Defense 자체 경로 (무한 루프 방지) |
| health, metrics | 헬스체크·모니터링 |
| load-test | 부하 테스트 |

### 적용 대상 (Critical API)

| API 종류 | 예시 |
|---------|------|
| 큐 입장 | `/api/queue/enter` 등 |
| 좌석 조회 | `/api/recommend/blocks`, `/api/sections` |
| 좌석 확보 | `/api/seat/holds`, `/api/assign-hold` |
| 결제 시작 | `/api/payment/*` |

### 매칭 로직

| 단계 | 동작 |
|------|------|
| 1 | path·method가 제외 경로 매치? → 통과 |
| 2 | critical API 패턴 매치? → ext-authz 활성화 |
| 3 | dynamic metadata에 `ext_authz_enabled=true` 설정 |
| 4 | `x-ext-authz-event-type` 헤더 추가 |
| 5 | ext_authz 필터가 gRPC로 어댑터 호출 |

> **왜 중요 API만** — 전체 API 검사 시 지연 수십 ms 증가 + 오탐 영향 확대. 결제·선점 관련만 선별하면 false positive 범위 최소화.

## 어댑터 — Check ↔ Evaluate 변환

### 요청 변환

Envoy의 ext-authz check 요청(gRPC)을 AI Defense의 `/evaluate` 요청(HTTP)으로 변환합니다.

| 요청 본문 필드 | 출처 |
|------------|------|
| `session_id` | 요청 헤더·쿠키 |
| `trace_id` | 분산 추적 헤더 |
| `path`, `method` | 요청 메서드·경로 |
| `timestamp` | 서버 수신 시각 |
| `headers` | 요청 헤더 전체 (telemetry 헤더 포함) |
| `flow_state` | 세션 상태에서 조회 |
| `defense_tier` | 세션 상태에서 조회 |
| `challenge_fail_count` | 세션 상태에서 조회 |
| `repetitive_pattern_count` | 세션 상태에서 조회 |
| `token_mismatch` | 세션 상태에서 조회 |

### 응답 변환

AI Defense의 결정을 HTTP 응답으로 번역합니다.

| AI Defense 결정 | HTTP 응답 | 헤더 |
|---------------|---------|------|
| `NONE` (통과) | `allow=true` | `x-defense-check-skipped=true` 또는 헤더 없음 |
| `THROTTLE` | `allow=true` | `x-defense-throttle-ms=<value>` |
| `REQUIRE_S3` (챌린지) | `allow=false, http=428` | `x-defense-reason=CHALLENGE_REQUIRED` |
| `BLOCK` | `allow=false, http=403` | `x-defense-reason=BLOCKED` |

### 왜 어댑터를 둘까

| 관점 | 내용 |
|------|------|
| **관심사 분리** | AI Defense는 의사결정 개념으로 응답, 어댑터가 HTTP로 번역 |
| **변경 독립성** | AI Defense 판단 구조 변경 ≠ Envoy 설정 변경 |
| **역호환성** | Envoy 정책 변경 시 AI Defense 로직 영향 없음 |

## THROTTLE 구현 — Delay 주입

### 동작

```
[Runtime] action=THROTTLE 결정 + delay 계산
    ↓
[Runtime] response 헤더에 x-defense-throttle-ms 추가
    ↓
[Adapter] 이 헤더 값 확인 → 응답 전송 직전에 sleep(delay)
    ↓
[Envoy] 지연 후 client에 응답 전달
```

### 기본 지연값

| Tier | Delay |
|------|-------|
| T1 | 80 ms |
| T2 | 250 ms |
| 최대 | 2000 ms |

### 헤더 기반 전달의 이점

- Runtime에서 delay 계산 완료 후 헤더로 전달
- 어댑터·Envoy는 단순히 헤더 읽고 sleep만
- delay 값을 조정할 때 어댑터·Envoy 코드 수정 불필요 (정책에서만 수정)

## 장애 시 통과 정책 (fail-open)

### 동작

```python
try:
    response = call_ai_defense(request)
except (timeout, error):
    # AI 서버 장애해도 정상 요청은 백엔드로 통과
    return allow()
```

### 왜 통과시키는가

| 이유 | 설명 |
|------|------|
| **가용성 우선** | AI Defense 장애로 티켓팅 서비스 전체 중단은 불가 |
| **DDoS 별도 대응** | 일반적 DDoS는 WAF에서 처리 |
| **오토스케일 기대** | 애플리케이션 수준 봇은 AI가 못 막아도 백엔드 오토스케일로 일부 대응 가능 |

### trade-off

| 단점 | 보완 |
|------|------|
| AI 장애 시간 동안 방어력 저하 | 모니터링에서 fail-open rate 별도 추적 |
| 짧은 타임아웃이 필요 | 기본 0.8초 타임아웃 설정 |
| 서버 다운 시 완전 취약 | KEDA 오토스케일링으로 복원력 확보 |

## 중요 API 매칭 범위의 운영 트레이드오프

| 범위 | 문제 |
|------|------|
| 너무 넓게 | latency 증가, 오탐 영향 증가 |
| 너무 좁게 | 중요한 공격면 놓침 |
| 현재 | critical API 중심 — 결제·선점 중심 |

## 관련 운영 지표

| 지표 | 의미 |
|------|------|
| ext-authz deny율 | 차단된 요청 비율 |
| fail-open 발생률 | 장애로 인한 통과 비율 |
| 어댑터 타임아웃 | gRPC 타임아웃 발생 빈도 |
| AI Defense latency | 평가 API 응답 시간 |

## 참조

- [03-runtime-pipeline](03-runtime-pipeline.md) — Runtime 내부 동작
- [05-tier-action](05-tier-action.md) — Tier별 action 결정
- [13-failure-recovery](13-failure-recovery.md) — 실패 모델
