# KPI 평가 — 방어 시스템

> **기준**: Runtime / Post-Review 방어 KPI는 `trace_id` 기준으로 산정 (`session_id`는 재사용 가능성 존재).  
> 공격 성과 관련 지표(방어 저지율, 개입 단계 분포, 좌석 확보 차단/저지 비율)는 공격 KPI 문서(`ai/reference/attack/09-kpi-evaluation.md`)의 수치를 그대로 재사용했다.

---

## 핵심 지표

| 지표 | 값 | 의미 |
|------|-----|------|
| **방어 저지율** | **33.3%** (10/30) | 공격 세션이 Hold 도달하지 못한 비율 (= 1 − 공격 성공률 66.7%) |
| **좌석 확보 차단/저지 비율** | **33.3%** | 좌석 확보 성공을 막아낸 비율 |
| **Post-Review Suspicious 비율** | **31.6%** (6/19) | Candidate 중 LLM이 이상으로 분류한 비율 |

> 방어 저지율·좌석 확보 차단/저지 비율은 공격 KPI 문서 수치 재사용 (출처: `06_KPI_트러블슈팅.md` §6.2 A.1, §6.4 구조적 관찰)

---

## B.1 — Runtime Tier 분포 (latest_tier 기준)

**수식**: `Tier Ratio_x = #(latest_tier = x) / #(unique trace_id) × 100`  (x ∈ {T0, T1, T2, T3})

| Tier | trace 수 | 비율 |
|------|---------:|-----:|
| T0 | 11 | 36.7% |
| T1 | 17 | 56.7% |
| T2 | 2 | 6.7% |
| T3 | 0 | 0.0% |
| **합계** | **30** | **100%** |

**해석**
- **T0 (36.7%)**: 실질 개입 없는 정상/저위험 구간 — 최종적으로 Hold에 성공한 세션 포함
- **T1 (56.7%)**: 경미한 위험 또는 초기 개입 구간 — 탐지의 주 분포. 방어 시스템이 가장 많은 세션을 T1로 분류하여 THROTTLE 적용
- **T2 (6.7%)**: 명확한 이상행동으로 인식된 중간 이상 구간 — 2개 세션만 T2까지 상승
- **T3 (0.0%)**: 최상위 위험 구간 — 이번 실행에서 T3 도달 세션 없음

---

## B.2 — Runtime Action 분포 (latest_action 기준)

**수식**: `Action Ratio_a = #(latest_action = a) / #(unique trace_id) × 100`  (a ∈ {NONE, THROTTLE, BLOCK})

| Action | trace 수 | 비율 |
|--------|---------:|-----:|
| NONE | 11 | 36.7% |
| THROTTLE | 19 | 63.3% |
| BLOCK | 0 | 0.0% |
| **합계** | **30** | **100%** |

**해석**
- **NONE (36.7%)**: 실시간 개입 없음 — 저위험 세션(T0)과 일치
- **THROTTLE (63.3%)**: 지연/마찰 유도 중심 — 이번 방어의 주된 실시간 대응 방식. 즉시 차단보다 마찰 유도를 우선했음
- **BLOCK (0.0%)**: 직접 차단 없음 — Runtime 단계에서의 즉시 차단은 발생하지 않음

---

## B.3 — Post-Review Candidate · Suspicious 수

동일 시간 구간에서 Post-Review가 생성한 window 기준 `candidate_count`와 `suspicious_count` 합산.

**수식**
- `Total Candidate Count = Σ candidate_count`
- `Total Suspicious Count = Σ suspicious_count`
- `Suspicious Rate = Total Suspicious Count / Total Candidate Count × 100`

| 지표 | 값 |
|------|---:|
| Candidate 총합 (window 집계) | 19 |
| Suspicious 총합 (window 집계) | 6 |
| **Suspicious 비율** | **31.6%** |

**해석**
- **candidate_count**: Post-Review 검토 대상으로 올라온 세션 수 (window 집계 기준 19)
- **suspicious_count**: 그중 사후판단이 이상 세션으로 분류한 수 (6건)
- Runtime에서 THROTTLE을 받은 세션 중 일부를 후속 LLM 검토 대상으로 재평가했음을 보여줌

---

## B.4 — Reviewed Session 수

Post-Review가 실제로 review를 수행해 저장한 세션 수.

**수식**
- `Reviewed Session Count = #(post_review_session_results)`
- `Suspicious Session Count = #(review_result = 'SUSPICIOUS')`

| 지표 | 값 |
|------|---:|
| Reviewed session 수 (row 기준) | 6 |
| Suspicious session 수 (row 기준) | 6 |

**해석**
- `candidate_count`는 window 단위 집계(19), `reviewed session`은 실제 review row 기준(6)
- Reviewed 6건 전원이 SUSPICIOUS 판정 — Post-Review가 검토 수행한 세션은 모두 이상으로 분류

---

## B.5 — 방어 저지율

공격 세션 중 최종적으로 공격 성공(Hold 도달) 하지 못한 비율.

> **출처**: 공격 KPI 문서 재사용 (§6.2 A.1 Hold 도달률 기반 역산)

**수식**: `Defense Interception Rate = 1 − Attack Success Rate = (Total − Successful) / Total × 100`

| 지표 | 값 |
|------|---:|
| 총 공격 세션 수 | 30 |
| 공격 성공 세션 수 (DONE) | 20 |
| **방어 저지율** | **33.3%** (10/30) |

**해석**: Hold 도달 실패 10세션(BLOCKED 5 + ABORT 5) = 방어 저지율 33.3%

---

## B.6 — 방어 개입 단계 분포

공격 퍼널을 방어 관점으로 재해석 — 공격이 어느 단계에서 방어에 의해 꺾였는지.

> **출처**: 공격 KPI 문서 재사용 (§6.4 구조적 관찰, §6.2 A.2/A.4 기반)

| 개입 단계 | 세션 수 | 비율 |
|---------|-------:|-----:|
| 대기열 구간 개입 | 6 | 20.0% |
| Challenge 구간 개입 | 5 | 16.7% |
| 구역/좌석 선택 구간 개입 | 0 | 0.0% |
| 직접 차단 종료 (BLOCKED) | 5 | 16.7% |
| 내부 실패/중단 종료 (ABORT) | 5 | 16.7% |
| 최종 성공 종료 (DONE) | 20 | 66.7% |

> 상단 3행은 **단계 기준** (어느 구간에서 막혔는지), 하단 3행은 **결과 기준** (TERMINAL 사유). 중복 계산 포함.

**해석**: 방어 개입은 대기열·VQA 앞단에 집중. 구역/좌석 선택 이후 차단은 0 — 앞단 필터링 구조.

---

## B.7 — 좌석 확보 차단/저지 비율

좌석 확보 성공 관점에서, 최종적으로 좌석 확보를 막아낸 비율.

> **출처**: 공격 KPI 문서 재사용 (§6.2 A.1 기반 역산)

**수식**: `Seat Acquisition Prevention Rate = 1 − Seat Acquisition Success Rate`

| 지표 | 값 |
|------|---:|
| 총 공격 세션 수 | 30 |
| 좌석 확보 성공 세션 수 | 20 |
| **좌석 확보 차단/저지 비율** | **33.3%** (10/30) |

**해석**: 이번 실행에서 공격 에이전트가 Hold에 도달하는 것 자체가 좌석 확보와 1:1 대응되므로, 방어 저지율과 동일한 33.3%.

---

## 종합 해석

### 핵심 메시지

1. **Runtime 방어는 THROTTLE 중심 (63.3%)** — 즉시 차단(BLOCK 0%)보다 마찰 유도 중심으로 동작. 이는 False Positive 최소화를 위한 보수적 정책 반영.

2. **탐지는 T1에 집중, T2로 상승한 세션은 일부** — T1(56.7%)이 주 분포, T2(6.7%) 2건만 중간 이상 구간 진입. T3 없음.

3. **Post-Review는 Runtime 개입 세션 중 일부를 추가로 이상 분류** — Candidate 19건 중 6건(31.6%)을 Suspicious로 판정. Reviewed 6건 전원 SUSPICIOUS.

4. **공격 성과 역산 지표는 공격 KPI 재사용** — 방어 저지율·좌석 확보 차단 비율·개입 단계 분포는 공격 로그 기반으로 산정된 값을 그대로 가져옴.

---

## 참조

- [09-kpi-evaluation (공격)](../attack/09-kpi-evaluation.md) — 방어 저지율·개입 단계 분포 원본 수치
- [10-post-review](10-post-review.md) — Post-Review Copilot 구조
- [05-tier-action](05-tier-action.md) — Tier · Action 정의
- [트러블슈팅](troubleshooting.md) — 방어 설계 트레이드오프와 한계 정리
- [06_KPI_트러블슈팅.md](../../presentation/06_KPI_트러블슈팅.md) — 공격/방어 통합 KPI 상세 및 트러블슈팅
