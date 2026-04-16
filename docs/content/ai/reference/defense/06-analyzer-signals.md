# 06. Analyzer — 규칙 기반 증거 축적

Guard가 연속적인 숫자 기반 점수 계산을 담당한다면, Analyzer는 **짧은 시간 내 특정 패턴의 반복**을 규칙 기반으로 감지합니다.

## 파생 신호 3가지

| 신호 | 감지 조건 | 기본 임계 | 의미 |
|------|---------|---------|------|
| **rapid_high_value_click** | 1.5초 윈도우 안에 좌석 클릭/확보 N회 이상 | 3회 | 대량 선점 시도 |
| **excessive_read_scanning** | 2초 윈도우 안에 조회 API N회 이상 | 8회 | 자동화 스캐닝 (정상 사용자는 초당 1~2회) |
| **s3_fail_burst** | 60초 안에 챌린지 N회 이상 실패 | 2회 | 챌린지 연속 실패 (정상은 대개 1회 내 통과) |

## Redis Bucket Counter 메커니즘

### 구조

```
key = tm:session:{sessionId}:counter:{signal_type}:{bucket_index}
bucket_index = ts_ms // window_ms
operation = INCR
TTL = window_seconds + 2초
```

### 동작

- 현재 시간의 bucket index로 키 생성
- `INCR` 하나로 카운트 증가
- 윈도우가 지나면 TTL로 자동 만료
- **슬라이딩 윈도우가 아닌 고정 bucket** — O(1) 연산

### 왜 고정 bucket인가

| 방식 | 특성 |
|------|------|
| 슬라이딩 윈도우 | 정확하지만 매 요청마다 타임스탬프 정렬 비용 |
| **고정 bucket** | 약간 부정확하지만 O(1), Runtime 경로 부담 없음 |

## 세션 상태 필드

Analyzer가 관리하는 상태 필드들입니다.

| 필드 | 의미 | 증가 조건 | 리셋 조건 |
|------|------|---------|---------|
| `challengeFailCount` | 챌린지 실패 누적 | S3 FAIL | S3 PASS (0으로) |
| `seatTakenStreak` | Hold 성공 연속 | `/api/hold` 2xx 또는 `HIGH_VALUE_CLICK.holdResult=SUCCESS` | Hold 실패 (0으로) |
| `holdFailStreak` | Hold 실패 연속 | `/api/hold` 4xx 또는 `holdResult=FAIL` | Hold 성공 (0으로) |
| `probationUntilMs` | 보호 대기 만료 시각 | S3 PASS 시 `now + probation_seconds` 설정 | — |
| `challengeHaltUntilMs` | 챌린지 임시 잠금 만료 | 재시도 max attempts 초과 | — |

### 책임 경계

Analyzer가 쓸 수 있는 필드는 위 5개로 **엄격히 제한**됩니다.

| 컴포넌트 | 쓸 수 있는 필드 |
|---------|--------------|
| Guard | `riskScore`, `defenseTier`, `lastStepRisk`, `lastGuardTsMs` |
| **Analyzer** | `challengeFailCount`, `seatTakenStreak`, `holdFailStreak`, `probationUntilMs`, `challengeHaltUntilMs` |
| Orchestrator | `flowState`, `s3Passed`, `s3PassedAtMs`, `lastDecisionAction` |

> **왜 엄격히 분리** — 한 컴포넌트의 버그가 다른 컴포넌트 상태를 오염시킬 위험 최소화. 운영 중 상태가 이상해도 원인 파악이 빠름.

## 이벤트 타입별 처리

### HIGH_VALUE_CLICK

| 페이로드 | 처리 |
|---------|------|
| `holdResult: SUCCESS` | `seatTakenStreak += 1`, `holdFailStreak = 0` |
| `holdResult: FAIL` | `holdFailStreak += 1`, `seatTakenStreak = 0` |
| 모든 경우 | `rapid_high_value_click` 버킷 카운터 증가 |

### API_CALL_OBS

| 조건 | 처리 |
|------|------|
| 메서드 READ 또는 GET | `excessive_read_scanning` 버킷 카운터 증가 |
| `/api/hold` 계열 + statusCode >= 400 | `holdFailStreak += 1` |
| `/api/hold` 계열 + statusCode < 300 | `seatTakenStreak += 1` |

### S3_RESULT

| 페이로드 | 처리 |
|---------|------|
| `PASS` | `challengeFailCount = 0`, `probationUntilMs` 설정 |
| `FAIL` | `challengeFailCount += 1`, `s3_fail_burst` 버킷 증가 |

## Evidence Summary (Planner 입력)

Analyzer가 갱신한 정보를 Planner에 전달하는 형태입니다.

### 압력 지표 (LOW/MED/HIGH)

| 지표 | 계산 |
|------|------|
| `scan_pressure` | `excessive_read_scanning` 카운터 ÷ 임계값 |
| `hv_click_pressure` | `rapid_high_value_click` 카운터 ÷ 임계값 |

| 구간 | 의미 |
|------|------|
| 임계값 미만 | LOW |
| 임계값 이상~2배 미만 | MED |
| 임계값 2배 이상 | HIGH |

### Rule Hits (파생 신호 활성 플래그)

| 플래그 | 조건 |
|-------|------|
| `RAPID_HIGH_VALUE_CLICK` | 신호 임계 초과 |
| `EXCESSIVE_READ_SCANNING` | 신호 임계 초과 |
| `S3_FAIL_BURST` | 신호 임계 초과 |

## 감사 이벤트

`DEF_ANALYZER_EVIDENCE_UPDATED` 이벤트로 기록:

| 필드 | 의미 |
|------|------|
| `countersSnapshot` | 현재 카운터 스냅샷 |
| `rapidHVClick` | 신호 활성 여부 |
| `excessiveReadScanning` | 신호 활성 여부 |
| `s3FailBurst` | 신호 활성 여부 |
| `scanPressure` | LOW/MED/HIGH |
| `hvClickPressure` | LOW/MED/HIGH |
| `challengeFailCount` | 현재값 |
| `seatTakenStreak` | 현재값 |
| `holdFailStreak` | 현재값 |

## 기본 임계값 (정책에서 변경 가능)

| 신호 | 윈도우 | 임계 |
|------|-------|------|
| rapid_high_value_click | 1500 ms | 3 |
| excessive_read_scanning | 2000 ms | 8 |
| s3_fail_burst | 60000 ms | 2 |

## Planner에서 어떻게 쓰이나

규칙 위반은 Action을 직접 바꾸지 않고 **reason suffix**로 반영됩니다.

| 시나리오 | Tier | Action | Reason |
|---------|------|--------|--------|
| 정상 | T0 | NONE | `tier=T0` |
| 스캐닝 집중 | T1 | THROTTLE | `tier=T1, scan_high` |
| 고가치 클릭 연속 + 스캐닝 | T2 | THROTTLE | `tier=T2, hv_high, scan_high` |
| 챌린지 연속 실패 + T3 | T3 | BLOCK | `tier=T3, s3_fail_burst` |

## 참조

- [03-runtime-pipeline](03-runtime-pipeline.md) — Analyzer의 파이프라인 위치
- [04-risk-scoring](04-risk-scoring.md) — Guard와의 역할 분담
- [05-tier-action](05-tier-action.md) — Planner의 Reason suffix 활용
