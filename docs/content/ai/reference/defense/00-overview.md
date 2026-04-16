# AI Defense 개발 문서

> 버전: 1.0 · 최종 수정: 2026-04-16

AI Defense 시스템의 전체 구조와 동작 원리를 토픽별로 상세히 설명합니다. 티켓팅 예매 흐름에서 자동화 봇과 비정상 행동을 실시간으로 탐지해 완충·차단하는 방어 시스템입니다.

## 시스템 요약

| 항목 | 내용 |
|------|------|
| **유형** | 행동 기반 실시간 방어 시스템 |
| **판단 축** | 마우스 행동 + 세션 상태 + 외부 검증 점수 |
| **구조** | Online Plane (실시간 판단) + Offline Plane (정책 최적화) |
| **런타임 LLM** | **미사용** — 결정론 규칙만 |
| **오프라인 LLM** | 정책 제안·사후 검토에 활용 (안전장치 적용) |
| **감시 대상** | 큐 입장, 좌석 hold, 결제 등 중요 API |

## 설계 철학

| 요구 | 대응 |
|------|------|
| **실시간성** | 결정 로직 단순·결정론 → 응답 지연 예측 가능 |
| **진화 대응력** | 오프라인 평면에서 LLM·인간 개입으로 정책 업데이트 |
| **감사 추적** | 모든 판단이 로그로 재현 가능 |
| **가용성** | 방어 장애 시 fail-open으로 서비스 전체 중단 방지 |

## 문서 구성

### 아키텍처

| 문서 | 내용 |
|------|------|
| [01-architecture](01-architecture.md) | 두 Plane 분리 · 요청 흐름 · 주요 컴포넌트 |
| [02-ext-authz](02-ext-authz.md) | Envoy/Istio ext-authz 연동 |

### Runtime 판단 파이프라인

| 문서 | 내용 |
|------|------|
| [03-runtime-pipeline](03-runtime-pipeline.md) | Guard → Analyzer → Planner → Orchestrator 4단 |
| [04-risk-scoring](04-risk-scoring.md) | 위험 점수 계산 (5 feature + EWMA) |
| [05-tier-action](05-tier-action.md) | Tier · Action · 히스테리시스 · 보호 대기 |
| [06-analyzer-signals](06-analyzer-signals.md) | 규칙 기반 증거 축적 |
| [07-vqa-gate](07-vqa-gate.md) | VQA 보안 챌린지 · 2중 게이트 |

### Policy 계층

| 문서 | 내용 |
|------|------|
| [08-policy-authority](08-policy-authority.md) | PostgreSQL 권위 · Redis 캐시 분리 |
| [09-offline-optimizer](09-offline-optimizer.md) | 오프라인 자동 최적화기 |
| [10-post-review](10-post-review.md) | Backoffice Copilot · 사후 검토 |

### 관측 · 운영

| 문서 | 내용 |
|------|------|
| [11-observability](11-observability.md) | 감사 로그 · S3 · ClickHouse |
| [12-storage-deployment](12-storage-deployment.md) | 스토리지 · 마이그레이션 · 배포 |
| [13-failure-recovery](13-failure-recovery.md) | 실패 모델 · 복구 전략 |

## 핵심 차별화 기능

1. **행동 기반 Risk Scoring** — 단순 WAF·rate-limit이 아닌 마우스 궤적 5 feature + EWMA 누적
2. **Online Deterministic × Offline LLM 경계** — 실시간은 예측 가능, 정책 업데이트는 LLM 활용
3. **PostgreSQL 권위 + Redis 캐시 분리** — 감사 추적과 런타임 지연 동시 달성
4. **VQA 2중 게이트** — 정답뿐 아니라 푸는 과정의 행동 궤적까지 검증
5. **허용 목록 기반 자동 최적화** — LLM 제안도 엄격한 범위 제한으로 안전 운영
6. **Human-in-the-Loop 사후 검토** — 완충 처리된 회색지대 세션을 사후 재판단

## 참고 자료

| 문서 | 용도 |
|------|------|
| `AI_DEFENSE_DETAILED_TECHNICAL_DOCUMENT.md` | 원본 기술 보고서 (설계 근거 포함) |
| `PRESENTATION_04_05_DEFENSE.md` | 발표자료용 요약 |
| 201 레포 `spec/aligned_docs_2026-03-10/01_defense_runtime_online.md` | Runtime 설계 원본 |
| 201 레포 `spec/aligned_docs_2026-03-10/03_attack_defense_alignment_matrix.md` | 공격↔방어 매핑 |

## 용어집

| 용어 | 의미 |
|------|------|
| **Online Plane** | 실시간 요청 판단 계층 |
| **Offline Plane** | 정책 분석·개선 계층 |
| **Guard** | 위험 점수 계산 단계 |
| **Analyzer** | 규칙 기반 증거 축적 단계 |
| **Planner** | 정책 적용 단계 |
| **Orchestrator** | 실행·상태 전이 단계 |
| **EWMA** | 지수가중이동평균 (점수 누적 방식) |
| **Hysteresis** | 등급 다운그레이드 여유 임계치 |
| **Probation** | 챌린지 통과 후 다운그레이드 금지 기간 |
| **VQA 2중 게이트** | 정답 + 행동 궤적 동시 검증 |
| **Canary Rollout** | 단계적 배포 (5% → 20% → 50% → 100%) |
| **허용 목록 (Allowlist)** | 자동 최적화기가 수정 가능한 파라미터 제한 목록 |
