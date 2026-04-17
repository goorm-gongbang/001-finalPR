# Kyverno & Policy-Reporter

**Kyverno**는 쿠버네티스 환경에 최적화된 **정책 검증 엔진**으로, 클러스터에 새로운 애플리케이션을 배포하려고 할 때, 정해둔 보안 및 운영 규칙을 잘 지켰는지 중간에서 자동으로 검사하는 문지기 역할을 합니다. 생성된 검사 결과는 **Policy Reporter**를 통해 시각화되고 외부 모니터링 시스템과 연동됩니다.

---

## 작동 방식 및 아키텍처

![Kyverno 작동 방식](/images/infrastructure/kyverno/01_kyverno.svg)

Kyverno와 Policy Reporter는 쿠버네티스 클러스터 내에서 유기적으로 연결되어 동작합니다.

1. **Kyverno 핵심 컨트롤러 (정책 검사 및 보고서 생성)**

- **Kyverno Admission Controller**: 사용자가 kubectl이나 CI/CD 파이프라인을 통해 리소스를 배포하면, Kubernetes API Server에서 해당 요청(Admission Review)을 가로채어 정책 위반 여부를 실시간으로 검사합니다.

- **Kyverno Background Controller**: 이미 클러스터에 배포되어 있는 기존 리소스(Pods, Deployments 등)를 백그라운드에서 주기적으로 스캔(Scan)하여 정책 준수 상태를 확인합니다.

- **Kyverno Reports Controller**: Admission 및 Background 검사 결과를 취합하여 쿠버네티스 커스텀 리소스인 PolicyReport 및 ClusterPolicyReport (CRD) 형태로 클러스터에 기록합니다.

2. **Policy Reporter (시각화 및 알림 연동)**
Kyverno가 기록한 원시 데이터(CRD)를 수집하여 관리자와 개발자가 쉽게 확인할 수 있도록 돕는 백엔드 및 UI 시스템입니다.

- **데이터 수집 및 UI 제공**: Policy Reporter 백엔드가 `PolicyReport` 리소스를 지속적으로 감시(Watch/Aggregate)합니다. 사용자는 **OAuth Proxy**를 통해 안전하게 인증을 거친 후, **Policy Reporter UI**에 접속하여 클러스터 전반의 정책 위반 상태를 대시보드 형태로 한눈에 파악(Fetch Data)할 수 있습니다.

- **실시간 알림 (Notify)**: 중대한 정책 위반이나 변경 사항이 발생하면, **Discord Webhook** 등을 통해 개발팀이나 인프라팀에 즉각적인 알림을 전송합니다.

- **메트릭 수집 (Scrape Metrics)**: 정책 검사 결과 데이터를 프로메테우스(Prometheus)가 수집할 수 있는 형식으로 노출하며, ServiceMonitor를 통해 기존 관제 시스템과 통합됩니다.

## 도입 이유

- **휴먼 에러 방지**: 개발자가 리소스 제한을 까먹거나, 잘못된 태그를 사용하는 상황을 방지합니다.
- **보안 표준 강제**: 취약점이 발생할 수 있는 설정이 클러스터에 올라오는 것을 방지합니다.
- **가시성 확보 (Policy Reporter)**: 정책 위반 내역을 CLI 환경이 아닌 직관적인 UI와 메신저 알림으로 즉각 파악하여 빠른 조치가 가능합니다.
---

## 환경별 적용

- **Dev**: 빠른 개발과 기능 테스트를 위해 사용하지 않습니다.
- **Staging**: Prod에 적용되기 전, 어떤 애플리케이션이 정책을 위반하고 있는지 확인하고 고칠 수 있도록 **Audit(감사)** 모드로 운영합니다.
- **Prod**: 모든 정책을 **Enforce(강제)** 모드로 운영하여, 정책을 위반하는 리소스가 클러스터에 배포되지 않도록 합니다.

---

## 정책 목록

### 보안 (Security)
- **최고 권한(Privileged) 탈취 방지**: 컨테이너가 호스트의 루트 권한을 가지지 못하도록 합니다.
- **중요 네임스페이스 보호**: 핵심 인프라 자원을 ArgoCD가 아닌 다른 주체(kubectl)가 함부로 수정 및 삭제해 서비스가 망가지는 걸 방지합니다.

### 안정성 (Reliavility)
- **자원 한도 설정**: 특정 애플리케이션이 CPU나 메모리를 독식하여 다른 애플리케이션이 죽는 일이 없도록 제한 설정을 의무화 하도록 합니다.
- **상태 검사**: 정상작동을 확인하는 readiness/liveness probe 설정을 강제하여, 배포 중 발생할 수 있는 서비스 다운타임을 예방합니다.

### 표준화 (Governance)
- **ArgoCD 배포 강제**: 수동 배포를 막아, 클러스터의 상태가 항상 코드와 일치하도록 하여 GitOps 파이프라인을 통제하며, 해커의 임의 서비스 수정 및 추가를 방지합니다.
- **`latest` 태그 방지**: `:latest`태그 이미지 사용을 차단하여 철저한 버전 관리를 강제합니다.
- **필수 라벨 확인**: 원활한 모니터링 및 리소스 추적을 위해 모든 애플리케이션에 필수 라벨을 부착하도록 합니다.

