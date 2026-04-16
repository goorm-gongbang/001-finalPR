# 인프라 개요

Playball의 클라우드 인프라는 서비스가 안정적으로 동작하도록 자원 구성, 배포 자동화, 고가용성, 관측, 복구 기준을 갖추고 있습니다. 서비스는 `CloudFront`, `EKS`, `Istio Mesh`, `RDS`, `ElastiCache`, `ArgoCD`, `Karpenter/KEDA`를 기반으로 운영합니다. 상태 확인과 장애 분석은 `Grafana`, `Policy Reporter`, `CloudTrail`, `CloudWatch`를 기준으로 수행합니다.

---

## 서비스 특성

| 항목 | 내용 | 대응 인프라 |
|---|---|---|
| **트래픽 집중** | 티켓 오픈 시점에 대량 요청이 짧은 시간에 집중 | Karpenter(노드 확장), KEDA(Kafka lag·Cron Pre-Warming), HPA, Istio Rate Limit, CloudFront |
| **실시간 경쟁** | 대기열, 좌석 선점, 결제 단계에서 동시성 제어가 중요 | ElastiCache Redis(분산 락·대기열), Kafka(이벤트 순서), Istio ext_authz(Admission Token), HikariCP 튜닝 |
| **가용성 요구** | 배포 오류, 노드 장애, DB 문제에도 서비스 흐름이 빠르게 복구되어야 함 | Multi-AZ EKS, RDS Multi-AZ + Standby, Redis 복제본 + 자동 장애조치, ArgoCD GitOps 재배포, PDB, Terraform IaC |
| **운영 추적성** | 장애 분석, 감사 추적, 복구 판단을 위한 로그·메트릭·이력 관리가 필요 | Prometheus + Thanos, Loki, Tempo(+OTel), Grafana, CloudTrail, Policy Reporter, Discord 알림 |

---

## 인프라 구성 목적

| 항목 | 내용 |
|---|---|
| **서비스 연속성** | 배포 이후에도 서비스가 지속적으로 동작하도록 인프라 구조와 운영 기준을 함께 설계 |
| **환경 분리** | Dev, Staging, Prod를 목적에 따라 분리해 변경 영향과 검증 범위를 분리 |
| **자동화 운영** | Terraform, Helm, ArgoCD, CI/CD 기준으로 인프라와 배포 과정을 자동화 |
| **고가용성** | 장애가 발생해도 서비스가 이어지도록 Multi-AZ, 오토스케일링, 선언형 복구 기준을 구성 |
| **확장과 보호** | 티켓 오픈 시점의 급격한 요청 증가를 전제로 확장, 보호, 복구 기준을 설계 |
| **관측과 복구** | 모니터링 알람, 로그·백업 보관, 장애 대응 절차를 운영 기준으로 관리 |

---

## 구성 범위

| 구분 | 내용 |
|---|---|
| **환경 운영** | Dev, Staging, Prod 분리 운영 |
| **프로비저닝** | Terraform 기반 AWS 인프라 생성과 환경별 구성 관리 |
| **클러스터 운영** | ESO, ArgoCD, Karpenter, DB 초기화, 공통 인프라 구성 |
| **배포 자동화** | Helm + ArgoCD 기반 GitOps |
| **고가용성 / 확장** | Multi-AZ, KEDA, HPA, Karpenter |
| **장애 대응** | 배포 복구 검증, GitOps 재적용, RDS PITR, PostgreSQL 데이터베이스 보조 백업 |
| **운영 정책** | 모니터링 알람, 로그 및 데이터베이스 보관/백업, 장애 대응 절차 |

---

## 운영 흐름

```mermaid
flowchart LR
    CLIENT(["사용자 요청"]) --> CF["CloudFront"] --> EKS["EKS<br/>(Istio + App)"] --> DATA["RDS<br/>ElastiCache"]
    ARGO["ArgoCD<br/>(Helm GitOps)"] -.배포.-> EKS
    EKS -.관측.-> OBS["Grafana · Policy Reporter<br/>CloudTrail · CloudWatch"]

    classDef edgeBox fill:#fff8e1,stroke:#d6b656,color:#5a4a1a
    classDef runBox fill:#e6f4ea,stroke:#82b366,color:#2d5a34
    classDef dataBox fill:#ece3f1,stroke:#9673a6,color:#4a2e5f
    classDef opsBox fill:#e7f0fb,stroke:#6c8ebf,color:#223b63
    classDef obsBox fill:#fbeaea,stroke:#b85450,color:#6b2a26
    class CF edgeBox
    class EKS runBox
    class DATA dataBox
    class ARGO opsBox
    class OBS obsBox
```

서비스 요청은 `CloudFront`와 `EKS`를 거쳐 애플리케이션으로 전달되고, 운영 데이터는 `RDS`와 `ElastiCache`에서 처리합니다. 배포는 `ArgoCD` 기준으로 반영하며, 상태 확인과 장애 분석은 `Grafana`, `Policy Reporter`, `CloudTrail`, `CloudWatch`를 기준으로 수행합니다.

---

## 사용 기술

> 버전은 실제 Staging/Prod에 적용된 차트·서비스 기준입니다. (괄호 안은 Helm 차트 버전)

| 영역 | 기술 · 버전 |
|---|---|
| **클라우드** | AWS EKS `1.35`, RDS PostgreSQL `16`, ElastiCache Redis `7`, CloudFront, ALB, Route53, ACM |
| **서비스 메쉬** | Istio `1.29.1` (base / istiod / gateway) |
| **프로비저닝** | Terraform |
| **배포** | Helm, **ArgoCD** (argo-helm), TeamCity, **ECR** — ECR은 환경별 이미지 저장소(`staging/playball/web/*`, `prod/...`)로, Dev도 On-Prem에서 동일 ECR을 Pull |
| **오토스케일링** | Karpenter `1.11.1`, KEDA `2.19.0`, HPA (k8s 내장), Metrics Server `3.13.0` |
| **시크릿/권한** | External Secrets Operator `2.3.0`, IRSA, AWS IAM Identity Center SSO |
| **관측성** | kube-prometheus-stack `83.4.0` (Prometheus · Alertmanager · Grafana 분리 `10.5.15`), Loki `6.55.0`, Tempo `1.24.4`, Thanos (kube-prom-stack 포함), OpenTelemetry Collector `0.150.0` |
| **정책/보안** | Kyverno `3.7.1`, Policy Reporter `3.7.3` |
| **운영 확인** | CloudTrail, CloudWatch, Discord (알림 전파) |
