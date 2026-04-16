# 04. 위험 점수 계산 (Guard)

Guard 단계는 두 가지 입력을 받아 위험 점수를 계산·누적하고 Tier를 갱신합니다.

## 입력

| 입력 | 출처 | 특성 |
|------|------|------|
| **마우스 행동 feature 5가지** | 클라이언트 telemetry | 필수 — 항상 수집 |
| **외부 인간 검증 점수** | Turnstile 같은 제3자 서비스 | 선택 — 없으면 fail-open score 사용 |

## 5가지 행동 Feature

### Feature 정의와 정규화

| Feature | 의미 | 정규화 범위 | 낮을수록 위험한 이유 |
|---------|------|-----------|------------------|
| `tremorStdDev` | 손떨림 표준편차 | 0 ~ 6 | 자동화 봇은 떨림이 없어 기준선에 정확히 맞음 |
| `linearityRatio` | 직선거리/총거리 | 0 ~ 1 | 1에 가까울수록 시작점↔끝점 직선 = 기계적 |
| `avgVelocity` | 평균 속도 (px/s) | 0 ~ 4000 | 인간 50~1500 범위, 초고속은 비정상 |
| `dwellTime` | 클릭 전 머뭇거림 (ms) | 0 ~ 2000 | 사람은 hesitation 있음, 봇은 거의 0 |
| `pathRatio` | 총거리/직선거리 | 1 ~ 3 | ≤ 1.10 + linearity ≥ 0.92면 `linear_path` 플래그 |

### Raw Telemetry → Feature 계산

클라이언트가 전송한 이동·클릭 이벤트를 처리합니다.

| 단계 | 계산 |
|------|------|
| 좌표 정규화 | xNorm/yNorm 0~1 범위 → 1000px virtual canvas |
| 포인트 정렬 | `tsMs` 기준 오름차순 |
| `totalDist` | 인접 포인트 간 유클리드 거리 합 |
| `linearDist` | 첫 포인트와 마지막 포인트 직선 거리 |
| `duration` | 마지막 ts - 첫 ts |
| `linearityRatio` | `linearDist / totalDist` |
| `avgVelocity` | `totalDist / durationSec` |
| `pathRatio` | `totalDist / linearDist` |
| `dwellTime` | 인접 세그먼트 이동거리 ≤ 3px 또는 속도 ≤ 30px/s 구간 `dtMs` 누적 |
| `tremorStdDev` | 첫-끝점 선분에 대한 중간 포인트들의 수직거리 표준편차 |

> **제약** — `linearDist ≤ 20px`이면 tremor 샘플 생성 안 함. 포인트 수 < 2면 대부분 feature 0.

## 내부 점수 계산

### 수식

```
s_내부 = 0.35 · tremor_bot
       + 0.25 · linearity_bot
       + 0.15 · velocity_bot
       + 0.15 · dwell_bot
       + 0.10 · linear_path
```

### 각 "bot 값" 계산

| 변수 | 수식 |
|------|------|
| `tremor_bot` | `1 − normalize(tremor, 0, 6)` |
| `linearity_bot` | `normalize(linearity, 0, 1)` (선형성 자체) |
| `velocity_bot` | `normalize(velocity, 50, 1500)` (50 이하 0, 1500 이상 1) |
| `dwell_bot` | `1 − normalize(dwell, 0, 2000)` |
| `linear_path` | `linearity > 0.92 AND pathRatio < 1.10` → 1, else 0 |

> **핵심 대칭** — 떨림과 머뭇거림은 "낮을수록 봇", 직선성과 속도는 "높을수록 봇".

### 가중치 설계 의도

| 지표 | 가중치 | 의미 |
|------|-------|------|
| 손떨림 | **0.35 (최대)** | 사람의 자연스러운 떨림이 가장 흉내내기 어려움 |
| 직선성 | 0.25 | 두 번째로 중요 |
| 속도 | 0.15 | 중간 비중 |
| 머뭇거림 | 0.15 | 속도와 동등 비중 |
| 완벽한 직선 플래그 | 0.10 | 극단적 직선+고속 조합 잡는 보조 신호 |

## 외부 점수 결합

### 수식

```
s_외부봇도 = 1 − 외부점수
s_현재    = 0.30 · s_외부봇도 + 0.70 · s_내부
```

### 왜 내부 신호를 더 크게 보나 (0.70 vs 0.30)

| 이유 | 설명 |
|------|------|
| 외부 점수의 불안정성 | 선택적·타임아웃 가능성 있어서 주 신호로 쓰기 어려움 |
| 내부 신호의 항상성 | 마우스 feature는 항상 수집 가능 (telemetry만 오면) |
| 보조 검증 용도 | 외부 점수는 "또 하나의 증거"로 보정 역할 |

### 외부 점수 누락 시

| 상황 | 처리 |
|------|------|
| Turnstile 토큰 없음 | fail-open score (기본 0.50) 사용 |
| Turnstile 검증 실패·타임아웃 | fail-open score |
| 점수 반환 | 그 값을 `external_score`로 사용 |
| 점수 없이 성공 | 1.0으로 간주 |

## EWMA 누적

### 수식

```
r_새 = (1 − α) · r_이전 + α · s_현재     (α = 0.30)
```

- 최신 관찰값을 30%만 반영, 과거 70% 유지

### 왜 EWMA인가

| 방식 | 문제 |
|------|------|
| 단순 평균 | 단일 good event로 급락 → tier 진동 |
| 이동 평균 | 윈도우 밖 데이터 완전 잊음, 보수적 누적 어려움 |
| **EWMA** | 최신 반영 + 과거 유지의 균형, 상승·하강 모두 부드럽게 |

### 감쇠 메커니즘

EWMA 누적 전에 `r_이전`에 두 종류 감쇠가 적용됩니다.

#### 비활성 감쇠 (Passive Decay)

| 조건 | 값 |
|------|---|
| 임계 비활성 시간 | 30초 |
| 감쇠 주기 | 5초 |
| 감쇠 배율 | 0.98 |

**계산**

```
if (now - lastGuardTs) > passive_decay_after_inactive_s:
    elapsed_ticks = (now - lastGuardTs - threshold) / 5초
    r_이전 = r_이전 × (0.98 ^ elapsed_ticks)
```

**효과**

| 경과 시간 | 배율 |
|---------|------|
| 5초 | 0.98 |
| 1분 | 0.98^6 ≈ 0.886 |
| 5분 | 0.98^58 ≈ 0.308 |
| 1시간 | ≈ 0 |

> **의도** — 1시간 뒤 돌아온 사용자는 이전 위험 누적이 거의 초기화. 공정성 유지.

#### 챌린지 통과 감쇠 (Verification Decay)

| 조건 | 값 |
|------|---|
| S3 챌린지 `PASS` 직후 | `r_새 ← r_새 × 0.5` |

> **왜 0으로 리셋하지 않나** — 한 번의 챌린지 통과만으로 진짜 정상 사용자라고 단정 짓기 어려움. 봇이 챌린지만 뚫는 경우도 있음.

## Tier 결정

EWMA 결과 `r_새`를 등급으로 변환합니다. 자세한 내용은 [05-tier-action](05-tier-action.md) 참조.

| Tier | 점수 범위 |
|------|---------|
| T0 | < 0.20 |
| T1 | < 0.50 |
| T2 | < 0.80 |
| T3 | ≥ 0.80 |

## 감사 이벤트

`DEF_GUARD_SCORED` 이벤트로 기록되는 정보:

| 필드 | 의미 |
|------|------|
| `sInt` | 내부 점수 `s_내부` |
| `sExt` | 외부 봇도 `s_외부봇도` |
| `sT` | 최종 스텝 점수 `s_현재` |
| `rPrev` | 감쇠 적용 후 이전 점수 |
| `rNew` | 갱신된 누적 점수 |
| `missingFlags` | 누락된 feature 목록 |
| `tier` | 결정된 등급 |

## VQA Telemetry 판정 (추가 지표)

VQA 챌린지의 경우 기본 `botRisk` 외에 `boosted_risk`를 추가로 계산해 max를 취합니다. 자세한 내용은 [07-vqa-gate](07-vqa-gate.md) 참조.

## 참조

- [05-tier-action](05-tier-action.md) — Tier·Action 매핑 세부
- [06-analyzer-signals](06-analyzer-signals.md) — Analyzer 파생 신호
- [07-vqa-gate](07-vqa-gate.md) — VQA 2중 게이트
