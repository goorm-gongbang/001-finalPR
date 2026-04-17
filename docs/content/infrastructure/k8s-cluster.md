# K8s 클러스터 구성

> **역할**: Namespace 단위 리소스 배치 · NodePool 매핑 · 클러스터 내부 구조

Playball EKS 클러스터는 **목적별 Namespace 분리**와 **NodePool 전용 배치**로 워크로드 간 영향을 격리합니다.

![K8s 클러스터 구성](/images/infrastructure/architecture/01_cluster.svg)

---

## Namespace 구성

| Namespace | 주요 Pod · 역할 | 배포 경로 |
|-----------|---------------|---------|
| **istio-system** | Ingress Gateway, istiod, Rate Limit Service, EnvoyFilter 적용 지점 | 303 helm (`istio`, `istio-security`) |
| **monitoring** | Prometheus · Alertmanager · Grafana · Loki · Tempo · OTel Collector | 303 helm (`monitoring`) |
| **security** | Kyverno · Policy Reporter · 런타임 감시 | 303 helm (`kyverno-policies`, 런타임 감시 차트) |
| **data** | ClickHouse · CloudBeaver · RedisInsight · Kafka-UI (Staging 관리 도구) | 303 helm (`clickhouse`, `redisinsight`, …) |
| **ai** | AI Defense API · 202 authz-adapter (ext_authz 대상) | 303 helm + 201 AI repo |
| **apps** | Auth-Guard · Queue · Seat · Order-Core · API-Gateway · Frontend | 303 helm (`apps/java-service`) |
| **argocd** | ArgoCD Server · Repo Server · Application Controller · Root App | 302 bootstrap으로 초기 설치 |
| **kube-system** | CNI · CoreDNS · Karpenter · AWS Load Balancer Controller | bootstrap + k8s managed |

---

## NodePool 분리 (Karpenter)

| NodePool | 용도 | 정책 |
|----------|-----|------|
| **apps** | 애플리케이션 서비스 워크로드 | Spot 다양화 (Staging) / On-Demand (Prod) |
| **monitoring** | Prometheus·Loki·Tempo 등 관측성 | 전용 NodePool — 부하가 다른 워크로드에 전이되지 않게 격리 |
| **loadtest** | k6 부하테스트 전용 | 별도 NodePool + Rate Limit 예외 (부하테스트 격리 환경) |

NodePool 분리 목적:
- **관측성이 서비스 부하에 영향받지 않게**
- **부하테스트가 실제 서비스 리소스를 뺏지 않게**
- **Spot 중단 영향을 워크로드 특성에 맞게** (monitoring은 On-Demand 선호)

---

## 네트워크 격리

- **CNI** — L3/L4 라우팅, 네트워크 플로우 관측
- **NetworkPolicy default-deny** — 모든 Namespace에 기본 차단, `allow-policies.yaml`로 필요한 통신만 허용
- **Istio mTLS STRICT** — Namespace 내/외 모든 Pod 간 통신 자동 암호화

상세 정책은 [보안 → 인프라 보안](../security/infrastructure-security) 참조.
