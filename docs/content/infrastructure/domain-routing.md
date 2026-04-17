# 도메인 · 라우팅

> **이 페이지의 관점**: "사용자가 입력한 **도메인**이 어떤 경로로 **최종 Pod까지 매핑**되는가" — DNS · TLS · 라우팅 규칙에 초점. 트래픽에 적용되는 **보안 필터**는 [외부 진입 구조](./external-entry) 참조.

Playball은 **Route53 공인 도메인 → ACM TLS 인증서 → CloudFront 배포 → ALB → Istio Gateway → VirtualService → K8s Service → Pod** 순서로 도메인을 매핑합니다. 각 단계는 **주소 해석과 경로 매칭**만 수행합니다.

![도메인 라우팅](/images/infrastructure/domain-routing/01_domain-routing.svg)

---

## 단계별 역할

| 단계 | 구성 요소 | 하는 일 |
|------|-----------|---------|
| **DNS** | Route53 Public Hosted Zone | `api.{env}.playball.one` → CloudFront Alias 매핑 |
| **TLS 인증서** | ACM (CloudFront용 us-east-1, ALB용 ap-northeast-2) | 인증서 발급 · 자동 갱신 · DNS validation |
| **CDN** | CloudFront Distribution | 엣지 캐싱 · TLS termination · 원본(ALB) 전달 |
| **로드밸런서** | ALB + Target Group | 호스트/경로 기반 타겟 라우팅 |
| **메쉬 진입** | Istio Gateway CR | 클러스터 진입점 · 프로토콜/포트/호스트 선언 |
| **라우팅 규칙** | VirtualService CR | HTTP 경로 · 헤더 · 가중치 기반 서비스 매칭 |
| **서비스** | K8s Service → Pod | 서비스 추상화 · Pod 로드 밸런싱 |

---

## 환경별 도메인

| 환경 | 도메인 | 인증서 |
|------|--------|--------|
| **Dev** | `*.dev.playball.one` (Cloudflare Proxy 경유) | cert-manager + Let's Encrypt |
| **Staging** | `*.staging.playball.one` | ACM (us-east-1 · ap-northeast-2) |
| **Prod** | `*.playball.one` | ACM (us-east-1 · ap-northeast-2) |

> Dev는 Cloudflare Proxy 경유 — [Dev 아우터 아키텍처](./outer-architecture-dev) · [Chrome QUIC 트러블슈팅](./operational-troubleshooting/chrome-quic) 참조.

---

## Gateway / VirtualService 분리 설계

Istio Gateway CR과 VirtualService CR을 **역할 분리**해서 사용:

| CR | 담당 |
|----|------|
| **Gateway** | 진입점(호스트·포트·프로토콜·TLS) 선언 — 1개 Gateway가 여러 VirtualService와 결합 |
| **VirtualService** | 경로·헤더·가중치 기반 라우팅 규칙만 담당 — 서비스별로 독립 관리 |

이렇게 나누면:
- **진입점 설정(호스트·인증서)은 중앙 관리** (Gateway 1개)
- **라우팅 규칙은 서비스 팀별 독립** (VirtualService N개)

---

## 설계 포인트

- **외부 진입은 CloudFront로 단일화** — ALB 직접 노출 없음 (Prod SG는 CloudFront prefix list만 허용)
- **Gateway → VirtualService 2단 분리** — 진입점과 라우팅을 분리 관리
- **ACM 자동 갱신** — TLS 만료 수동 개입 없음
- **환경별 도메인 prefix 분리** — `dev.` · `staging.` · (prod는 prefix 없음)으로 시각적 구분

---

[← 인프라 아키텍처 개요](./architecture) · [외부 진입 구조 (보안 체인) →](./external-entry)
