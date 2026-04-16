# 보안 개요

> **역할**: Playball 보안 체계의 전체 지도 · 모의해킹 기반 재설계

## 7축 보안 아키텍처

Playball 보안은 **외부 요청 방어 체인 (5) + 플랫폼 보안 (1) + 내부자 접근 (1)** 의 7축으로 설계했습니다.

```mermaid
flowchart LR
    User["사용자 브라우저"] --> Client["클라이언트 보안<br/>방어 시작 · 토큰 발행"]
    Client --> GW["Gateway / mTLS<br/>외부 진입 · 메쉬"]
    GW --> Bot["봇 대응 체계<br/>경로 판별"]
    Bot --> App["백엔드 방어 체계<br/>앱 계층 최종"]
    App --> Data["데이터 보안<br/>저장소"]

    subgraph Platform["인프라 보안 — 모든 계층을 감싸는 플랫폼 레이어"]
        Client
        GW
        Bot
        App
        Data
    end

    Ops["접근 제어<br/>운영자 SSO"] -. 관리 .-> Platform
```

**읽는 법**:
- **가로축 (5단)** = 요청이 들어오는 방향. 브라우저에서 시작해 저장소까지 각 계층이 차례로 검증
- **감싸는 레이어** = 모든 계층의 기반이 되는 인프라 보안(VPC·NetworkPolicy·런타임 감시·Kyverno·감사)
- **점선** = 운영자가 이 모든 구조를 SSO 기반 최소권한으로 관리

> **📌 설계 기반**: 본 보안 구조는 **2026-04 외부 모의해킹에서 도출된 취약점 지적을 바탕으로 재구성**되었습니다. 단순 체크리스트 방어가 아니라 실제 공격자 관점에서 뚫린 지점을 식별하고, 그 결과를 **7축 보안 체계**로 재설계한 것이 현재 구성입니다. 실제 지적 사항과 조치 이력은 [부록: 취약점 관리](./vulnerability-management)에서 확인할 수 있습니다.

---

## 전체 요청 흐름

```mermaid
flowchart LR
    USER["사용자"] --> EDGE["Edge<br/>CloudFront + AWS Shield"]
    EDGE --> LB["LB<br/>ALB + Security Group"]
    LB --> MESH["Mesh<br/>Istio Gateway<br/>EnvoyFilter + Lua<br/>Rate Limit + ext_authz"]
    MESH --> INTERNAL["Internal<br/>mTLS"]
    INTERNAL --> APP["Application<br/>JWT + Security Header + Obfuscation"]
    APP --> DATA["RDS / Redis / Kafka"]
    APP --> OBS["Grafana / CloudWatch / CloudTrail"]
```

---

## 7축 상세

| 축 | 주요 구성 | 처리 기준 |
|---|---|---|
| **클라이언트** | CSP, X-Bot-Token(Canvas FP+HMAC), 보안 헤더, 소스맵 비활성화, 난독화 | 브라우저 노출 최소화, 프론트에서 방어 토큰 발행 |
| **Gateway / mTLS** | CloudFront, ALB+SG, Istio Gateway, EnvoyFilter+Lua, Rate Limit, ext_authz | 외부 진입 통합 · 요청 패턴 차단 · 서비스 간 통신 암호화 |
| **봇 대응** | Fingerprint 추적, bot_fingerprint_headless/multi_ip 메트릭, AI Defense 행동 분석 | 헤드리스·분산 매크로·AI 에이전트 탐지 |
| **백엔드** | JWT 검증, Admission Token 재검증, 보안 헤더 | 앱 계층 최종 방어 · 대기열 우회 차단 |
| **데이터** | RDS PITR·저장 암호화·TLS required, Secrets Manager 환경별 격리 | DB/Redis 접속 안전성 · 시크릿 노출 최소화 |
| **인프라** | NetworkPolicy(default-deny), 런타임 감시, Kyverno + Policy Reporter | 네트워크 격리 · 컨테이너 런타임 감시 · 배포 리소스 정책 |
| **접근 제어** | IAM Identity Center SSO, 최소 권한 Permission Set, CloudTrail 감사 | 운영자 접근 · 변경 이력 추적 |

---

## 차단과 검증 기준

| 구분 | 적용 위치 | 목적 |
|---|---|---|
| **WAF 패턴 검사** | Mesh | SQL Injection, XSS, Path Traversal, SSRF, Log4Shell, Bot Scanner 등 차단 |
| **Rate Limit** | Mesh | 과도한 요청을 Gateway에서 429로 종료 |
| **추가 인가 판단** | Mesh | ext_authz + authz-adapter로 민감 경로 추가 검증 |
| **JWT 검증** | Application | 사용자 인증 상태와 토큰 유효성 확인 |
| **Admission Token 검증** | Application | 대기열 우회와 비정상 선점 요청 방지 |
| **보안 헤더 / 난독화** | Application | 브라우저 노출 범위 최소화 |
| **mTLS** | Internal | 내부 통신 암호화와 서비스 상호 인증 |
| **감사 추적** | CloudTrail, EventBridge | 운영 변경, 보안 이벤트, 예외 보관 판단 근거 확보 |

---

## 추적 경로

| 구분 | 확인 경로 |
|---|---|
| **차단 / 제한 이벤트** | Grafana, Loki, Istio 관련 대시보드 |
| **정책 위반 이벤트** | Policy Reporter, Discord |
| **운영 변경 이력** | CloudTrail, EventBridge, Discord |
| **복구 후 상태 확인** | Grafana, CloudWatch, Discord |

---

## 점검 항목

| 구분 | 확인 기준 |
|---|---|
| **외부 진입** | CloudFront, ALB, Gateway 경로가 정상인지 |
| **차단 / 제한** | 403, 429, 인증 실패율, WAF 차단 이벤트가 증가하는지 |
| **인가 흐름** | ext_authz, JWT, Admission Token 검증이 정상인지 |
| **내부 통신** | mTLS 정책과 예외 구성이 운영 기준과 일치하는지 |
| **클라이언트 보호** | 보안 헤더와 난독화 기준이 배포 상태와 일치하는지 |
| **감사 추적** | CloudTrail, EventBridge, Discord 흐름이 정상인지 |
