# 향후 과제

운영 안정화 이후 순차 적용할 **개선 로드맵**입니다. 각 항목은 현재 구성의 **의식된 한계**이며, 도입 시점·비용·실효성을 검토해 단계적으로 반영합니다.

---

## 📋 로드맵 인덱스

| 항목 | 분류 | 도입 트리거 | 예상 효과 |
|-----|-----|----------|---------|
| [Argo Rollouts — 카나리 배포](#argo-rollouts---카나리-배포) | 배포 | Prod 트래픽 증가 시 | 배포 리스크 ↓ |
| [AWS WAF / Shield — 엣지 방어](#aws-waf--shield---엣지-방어) | 보안 | 공개 트래픽 수준↑ | T0·T1 매크로 엣지 차단 |
| [IAM DB Authentication](#iam-db-authentication) | 접근 제어 | DB 유저 수 증가 | 비밀번호 관리 폐지 + 감사 추적 |
| [Kyverno Deny 모드 전환](#kyverno-deny-모드-전환) | 정책 검증 | Prod 안정화 후 | 정책 위반 배포 원천 차단 |
| [GuardDuty · Security Hub · Config](#guardduty-security-hub-config) | 계정 보안 | Prod 운영 규모↑ | AWS 네이티브 위협 탐지 + 컴플라이언스 |
| [RDS 읽기 복제본 분리](#rds-읽기-복제본-분리) | 데이터 확장 | 쿼리 부하 증가 | 읽기/쓰기 격리, DEV/AI 팀 R/O 접근 |
| [ElastiCache 물리 분리](#elasticache-물리-분리) | 자원 격리 | Queue 트래픽 폭증 | 대기열↔인증 응답 전이 차단 |
| [VU 1~2만 급 재측정](#vu-1-2만-급-재측정) | 성능 | 대형 공연 유치 | 실질 처리 상한 재확인 |
| [break-glass Admin-Full (Prod)](#break-glass-admin-full-prod) | 접근 제어 | 긴급 대응 시나리오 확립 | 평소 최소권한 + 비상시 full 권한 분리 |

---

## Argo Rollouts — 카나리 배포

**현재**: ArgoCD GitOps 기반 배포, Prod는 전면 교체 방식.

**과제**: **Argo Rollouts 도입**해 카나리(점진 전환) · 블루/그린 지원. Prod 배포 시 5% → 25% → 100% 단계별 승격하며 메트릭 기반 자동 롤백.

**도입 근거**: 현재는 VU 수천 규모라 전면 교체로 리스크가 크지 않지만, 사용자가 늘어날수록 한 번의 배포 실패가 치명적.

---

## AWS WAF / Shield — 엣지 방어

**현재**: CloudFront 기본 보호만. WAF/Shield 미활성.

**과제**: Prod CloudFront에 **AWS WAF (Managed Rules)** + **Shield Advanced** 연계.
- Rate-based Rule + Amazon IP Reputation List (무료) — T0 HTTP flood 1차 차단
- Bot Control Targeted (유료, 월 $500~) — T2 헤드리스 탐지
- Shield Advanced — 대량 DDoS 흡수

**도입 근거**: 자체 구현(X-Bot-Token + Fingerprint + AI Defense)의 리버싱 위험과 이중 방어 체계 확보. 비용/가치 판단 후 순차 도입.

---

## IAM DB Authentication

**현재**: DB 접속은 Bastion SSM + DB 유저/비밀번호.

**과제**: PostgreSQL에 `GRANT rds_iam` + IAM Permission Set에 `rds-db:connect` 추가해 **IAM ↔ DB 유저 1:1 매핑**. SSO 로그인 한 번으로 DB까지 연결.

**도입 근거**:
- DB 비밀번호 관리 폐지 (IAM 토큰 15분 단기)
- CloudTrail에 "누가 어느 DB 유저로 로그인했는지" 자동 감사
- IAM 그룹(CN/DEV/AI/SC) → DB 유저 → DB Role 3단 권한 체인 완성

---

## Kyverno Deny 모드 전환

**현재**: 전 환경 **Audit 모드** (위반 로깅만, 차단 안 함).

**과제**: Prod 안정화 후 `validationAction: Deny`로 전환. 위반 리소스 배포 원천 차단.

**도입 근거**: 초기 도입 단계에선 Audit로 영향 범위 학습 → 안정화 후 Deny 전환이 실무 표준.

---

## GuardDuty · Security Hub · Config

**현재**: CloudTrail 기반 감사만.

**과제**: AWS 네이티브 보안 서비스 활성화 (Prod 우선).
- **GuardDuty** — ML 기반 위협 탐지 (크립토 마이닝·비정상 API 호출·S3 데이터 유출)
- **Security Hub** — 여러 보안 서비스 결과 통합 대시보드
- **Config** — 리소스 구성 변경 추적 + 규정 준수 체크

**도입 근거**: 현재는 자체 audit-security 파이프라인(EventBridge → Lambda → Discord)으로 기본 커버. 운영 규모·컴플라이언스 요구 커지면 순차 도입.

---

## RDS 읽기 복제본 분리

**현재**: Prod RDS Multi-AZ 단일 writer. DEV/AI 팀도 Primary에 read-only 접근.

**과제**: **Read Replica 프로비저닝** 후 DEV/AI 팀 접근을 복제본에만 허용.

**도입 근거**:
- Primary 쓰기 부하 보호
- DB 레벨 쓰기 권한 자체가 구조적으로 불가능 (물리 격리)
- 분석·디버깅 쿼리가 실시간 운영에 영향 주지 않음

---

## ElastiCache 물리 분리

**현재**: 단일 ElastiCache 인스턴스, **키 네임스페이스로 Queue ↔ Auth/Lock 논리 분리**.

**과제**: 트래픽 증가 시 **두 번째 ElastiCache 추가**. 대기열 전용 / 인증·락 전용으로 물리 분리.

**도입 근거**:
- 현재 키 분리가 이미 되어 있어 **코드 변경 없이 엔드포인트만 전환 가능**
- 대기열 트래픽이 폭증해도 인증·락 응답 지연에 전이 차단

---

## VU 1~2만 급 재측정

**현재**: 5000 VU까지 검증 완료.

**과제**: 대형 공연(1~2만 VU) 규모 재측정. 부하테스트 격리 환경(전용 NodePool + Rate Limit 예외)은 준비되어 있음.

**도입 근거**: 트래픽이 현재 검증 범위를 넘어설 시점의 **실질 처리 상한 재확인**.

---

## break-glass Admin-Full (Prod)

**현재**: Admin-Full은 admin-kj(Staging 계정)에만. ca-prod에는 별도 break-glass 없음.

**과제**: ca-prod에 **Admin-Full 별도 assignment** + **CloudTrail 알람 연동**. 긴급 대응 시만 의도적 assume.

**도입 근거**: Prod-CN의 `ssm:*` 과도 권한을 세션 액션만으로 축소한 후, **긴급 상황용 full 권한은 별도 break-glass PS로 분리**하는 것이 실무 패턴. 사용 시점만 감사 경로에 자동 알림.

---

## 원칙

- **예산 대비 효과** — 자체 구현이 "충분히 잘 돌고 있으면" 당장 도입 안 함
- **점진 도입** — Audit → Deny, 계획 → 일부 적용 → 전면 적용 단계별 이동
- **Trigger 명시** — "언제" 도입할지 트리거 조건을 사전에 정해두어 도입 시점 판단을 체계화
- **측정 우선** — 도입 전후 정량 지표(성능·비용·보안) 비교로 효과 검증
