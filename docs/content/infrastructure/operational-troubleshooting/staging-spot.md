# Staging Spot 다양화 — Karpenter NodePool 인스턴스 타입 분산

> **분류**: 비용·가용성 · **환경**: Staging EKS · **상태**: ✅ 적용 (관측 중)

## 증상

**2026-04-14 저녁 KST** staging 환경에서 spot 인스턴스가 대량 회수:

- **apps NG**: spot interruption **9회+**
- **monitoring NG**: 2회 중단

**Discord 알람을 통해 staging 환경의 불안정이 이 정도 규모였다는 것을 처음 파악**했습니다. 알람 파이프라인(EventBridge → Lambda → Discord webhook)이 없었다면 중단이 쌓이고 있다는 사실 자체를 놓칠 뻔한 상황이었습니다.

## 원인

- Spot 인스턴스가 **단일 인스턴스 타입(`m6g.xlarge`) + 단일 AZ(`ap-northeast-2a`)**에 몰려 있었음
- AWS Spot 전략상 **같은 풀이 한꺼번에 회수**되면 연쇄 중단 발생
- 다양화가 없으면 1개 풀 회수 = 전체 워크로드 중단 위험

## 왜 "다양화"가 안정성을 올리는가 — Spot 풀 이론

AWS Spot은 **`(인스턴스 타입) × (AZ)`** 조합 하나를 **"Spot 풀"** 이라는 독립 단위로 운영합니다. 회수 이벤트는 **풀 단위로 발생**하고 다른 풀에 전이되지 않습니다.

### 회수 확률 계산 (개념)

- 단일 풀(1 타입 × 1 AZ): 회수 확률 = `p`
- **타입 N개 × AZ M개**로 분산: 각 풀에 1/(N×M) 인스턴스
  - 한 풀이 회수돼도 전체에 미치는 영향은 **1/(N×M)**
  - 모든 풀이 동시에 회수될 확률은 **p^(N×M)** — 실질적으로 0에 수렴

### 실제 Playball 적용

| 구분 | Before | After |
|------|--------|-------|
| 인스턴스 타입 | 1종 (`m6g.xlarge`) | **apps 7종 / monitoring 5종** |
| AZ 분산 | 1개 (a) | **3개 (a/b/c)** |
| 풀 개수 | 1 | **21개 이상** (apps 기준 7×3) |
| 1풀 회수 시 영향 | 100% | 약 5% (1/21) |

**Karpenter의 역할**: 가용 풀 중 **가격이 낮고 용량이 있는 곳**을 자동으로 선택해 Pod를 배치. 다양화는 Karpenter에게 "선택지를 제공"하는 것 — 선택지가 많을수록 한 풀이 막혀도 다른 풀로 즉시 이전 가능.

**핵심 통찰**: "같은 시점에 AWS 전체의 *모든 타입 × 모든 AZ*가 동시에 부족해질 확률"은 극히 낮기 때문에, 다양화만으로 실무급 안정성 확보가 가능합니다.

## 해결

**apps NodePool** — 1종 → **7종** 다양화:

- `m6g.xlarge`, `m7g.xlarge`, `m6gd.xlarge`, `r6g.xlarge`, `r7g.xlarge`
- `m6g.2xlarge`, `m7g.2xlarge`

**monitoring NodePool** — 1종 → **5종** 다양화:

- `m6g.xlarge`, `m7g.xlarge`, `r6g.xlarge`, `r7g.xlarge`, `m6g.2xlarge`

**공통 원칙**:

- **SPOT 유지** (On-Demand 전환 보류)
- **Graviton(arm64) 통일** — 이미지 호환 유지
- **메모리 ≥ 16GB** 보장
- **AZ 다양화** 동시 적용

## 관측 결과 (조치 후 ~15h)

| NodePool | 조치 전 (24h) | 조치 후 (~15h) |
|----------|--------------|---------------|
| apps | **9회+** | **1회** |
| monitoring | 2회 | **0회** |

→ 조치 전 24h 대비 **급격히 감소**. 다만 관측 샘플이 짧아 장기 효과는 지속 관측 필요.

## 왜 On-Demand 전환 대신 다양화를 선택했나

`monitoring NG를 On-Demand로 전환`하는 옵션도 있었지만:

- **비용 효율 원칙** 유지 (Spot 중심 운영)
- 다양화만으로 충분한 안정성이 나올 수 있음 → 먼저 검증
- Spot이 계속 안정적이면 On-Demand 전환 **불필요**

## 향후 모니터링 기준

**재확인 지표**:

- CloudTrail `BidEvictedEvent` **7일 조회**
- `goormgb-staging-*` ASG scaling activity 확인
- **Spot Rebalance Recommendation 빈도** 체크

**전환 트리거**:

- **monitoring**: 24h에 **2회 이상 중단 재발** 시 → `capacity_type: SPOT → ON_DEMAND` 전환 권고
- **apps**: **일 5회 이상** 중단 시 → Mixed Instance 또는 On-Demand 부분 도입 검토

---

[← 트러블슈팅 인덱스로](../operational-troubleshooting)
