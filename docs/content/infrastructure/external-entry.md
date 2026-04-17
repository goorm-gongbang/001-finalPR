# 외부 진입 구조

> **이 페이지의 관점**: "외부 트래픽이 백엔드에 닿기 전 **어떤 보안 필터를 차례로 통과**하는가" — Shield · WAF · Rate Limit · 인증/인가 필터 체인에 초점. DNS/인증서/라우팅 규칙 자체는 [도메인 · 라우팅](./domain-routing) 참조.

외부 사용자와 부하 테스트 트래픽은 **CloudFront(+ AWS Shield) → ALB(+ Security Group) → Istio IngressGateway → EnvoyFilter(Rate Limit · ext_authz) → Backend Services → RDS · ElastiCache** 체인을 통과하며, 각 단계에서 **검증·제한·차단**이 순차 적용됩니다.

![외부 진입 구조](/images/infrastructure/architecture/01_infra-arc.svg?w=50%)

---

## 단계별 적용 필터

| 단계 | 적용 필터 | 차단/제한 대상 |
|------|-----------|----------------|
| **CloudFront + AWS Shield** | 엣지 캐싱, DDoS 기본 방어 | L3/L4 볼륨 공격 · 정적 자원 남용 |
| **AWS WAF** | AWSManagedRulesCommonRuleSet · Rate-based rule(2000/5min) · 지역 차단 | OWASP Top10 패턴 · 의심 IP 고빈도 요청 |
| **ALB Security Group** | CloudFront Managed Prefix List만 허용 | ALB 직접 접근 시도 (origin bypass) |
| **Istio IngressGateway** | mTLS 강제 · Host 헤더 검증 | 잘못된 호스트 요청 · 평문 통신 |
| **EnvoyFilter · Rate Limit** | IP · 토큰 · 경로 단위 요청 제한 | 티켓팅 오픈 시 비정상 과다 요청 |
| **ext_authz** | AI 방어 Guard 호출 · 위험 점수 평가 | 봇 의심 요청 · 티어별 Action 적용 |
| **Backend + Spring Security** | 인증·인가·CSRF·입력 검증 | 앱 레벨 공격 |

---

## 부하 테스트와의 관계

부하 테스트 트래픽도 **동일 체인**을 통과합니다 (허용 IP/토큰은 Rate Limit · WAF 예외 규칙으로 관리). 실제 공격 패턴을 재현해 **각 필터의 동작을 검증**하는 게 목적입니다.

| 테스트 시나리오 | 검증 필터 |
|------------------|-----------|
| 티켓팅 오픈 동시 5000 VU | Rate Limit · WAF Rate-based |
| AI 공격 에이전트 세션 | ext_authz Guard · VQA 게이트 |
| 악성 페이로드 주입 | WAF OWASP 룰셋 |

---

## 설계 원칙

- **단일 진입 경로**: 모든 외부 트래픽은 CloudFront → ALB 경로로 수렴 → 필터 체인을 **우회할 수 없음**
- **경계 분리**: 볼륨 방어(Shield/WAF)는 AWS 엣지, 요청 단위 검증(Rate Limit/ext_authz)은 클러스터 내부
- **검증 레이어 다중화**: 한 계층이 뚫려도 다음 계층이 잡음 (defense-in-depth)

상세 방어 논리는 [보안 / 개요](../security/overview) · [AI 방어 시스템](../ai/reference/defense/00-overview) 참조.

---

[← 도메인 · 라우팅](./domain-routing) · [계정 경계 →](./account-boundary)
