# 인프라 보안

> **역할**: AWS · Kubernetes 경계 · 코드로 관리되는 플랫폼 보안

외부 요청 방어 체인(클라이언트 → Gateway → 봇 → 백엔드 → 데이터)과 별개로, **AWS 계정·네트워크·클러스터 수준에서 "구성 자체가 안전한가"** 를 보장하는 구조입니다. 모든 구성은 `301-playball-terraform`과 `303-goormgb-k8s-helm` 레포에서 **선언적으로 관리**되어 재현·감사 가능합니다.

---

## 1. 네트워크 경계 (AWS Layer)

### VPC 구조

- `301-playball-terraform/modules/vpc` 로 환경별 VPC 선언
- **Private Subnet**에 EKS 워커·RDS·ElastiCache 배치 → 외부 직접 접근 불가
- **Public Subnet**에는 ALB·NAT Gateway만
- NAT Gateway를 통해 **아웃바운드만 허용**, 인바운드는 없음

### Security Group

- `modules/bastion`, `modules/cdn`, `environments/*/main.tf` 에서 세밀 제어
- **Bastion SG**: SSM 아웃바운드만 (22 포트 오픈 없음)
- **ALB SG**: 443 인바운드, 출처는 **CloudFront prefix list로 제한**
- **RDS SG**: 5432 인바운드 from EKS pod SG
- **Redis SG**: 6379 인바운드 from EKS pod SG

### CloudFront — 유일한 외부 진입점

- `stacks/dns-acm-cdn` 에서 관리
- 모든 외부 HTTPS 요청의 단일 경로
- Prod에는 **AWS WAF + Shield 추가 적용 예정** (운영 환경 적용)

---

## 2. 클러스터 네트워크 보안 (Kubernetes Layer)

### CNI 기반 네트워킹

- 고성능 네트워킹 CNI로 L3/L4 라우팅과 서비스 디스커버리 처리
- kube-proxy 대체로 지연 감소
- 네트워크 플로우 실시간 관측 가능 — 어떤 Pod 간 통신이 있었는지 흐름 추적

### NetworkPolicy (Default-Deny)

- `common-charts/infra/network-policies/templates/default-deny.yaml`
- **모든 네임스페이스에 기본 차단(default-deny-all) 적용**
- `allow-policies.yaml` 에서 필요한 트래픽만 명시적으로 허용
- 즉 **"열려있는 게 기본"이 아니라 "닫혀있는 게 기본"** 의 제로트러스트 네트워킹

### Istio mTLS

- 서비스 간 모든 내부 통신은 **자동 mTLS 암호화**
- 상세: [Gateway / mTLS](./gateway-mtls)

---

## 3. 클러스터 정책 · 런타임 보안

### Kyverno + Policy Reporter

- `common-charts/infra/kyverno-policies`
- **배포 리소스 정책 검증** — requireLabels, disallowPrivileged, disallowLatestTag, requireResourceLimits, protectCriticalNamespaces, requireArgocdManagement 등
- 환경별 강도 차등 (Prod만 `requireProbes` 강제, 안정화 후 Deny 모드 전환 예정)
- 상세 운영은 [클러스터 정책](../infrastructure/cluster-policy) 문서 참조

### 런타임 위협 탐지

- **커널 수준에서 프로세스·시스템콜을 감시**하는 런타임 탐지기 도입
- 정책 기반으로 특정 행위(쉘 실행, 네트워크 연결, 파일 접근 등) 실시간 탐지
- **컨테이너 탈출·권한 상승 시도·암호화폐 마이닝** 같은 고급 공격을 앱 계층 이전에 조기 발견

### Kubernetes RBAC

- `common-charts/infra/rbac`
- ServiceAccount별 **최소 권한** 부여
- **IRSA와 연동**되어 Pod → AWS API 호출을 IAM 수준에서 추가 제한
- Pod이 Secrets/S3/RDS 등에 접근할 때 AWS 정책이 2차 게이트 역할

---

## 4. 감사 이벤트 파이프라인

`301-playball-terraform/stacks/audit-security` 에서 통합 관리:

| 이벤트 | 경로 |
|-------|-----|
| **모든 AWS API 호출** | CloudTrail → `audit-logs` S3 버킷 (암호화·버저닝·lifecycle) |
| **Security Events** (IAM 변경 등) | EventBridge → Lambda → **Discord 알림** |
| **Audit Events** (S3 Object Delete) | S3 delete 감지 → Lambda → **Discord 알림** |
| **Secret Change** (Secrets Manager 변경) | EventBridge → Lambda → Discord |
| **Spot Interruption** (Spot 회수) | EventBridge → Lambda → Discord |

**핵심 특성**:
- `audit-logs` S3는 **버저닝 + Object Lock 체계**로 무단 삭제 시에도 복원 가능
- S3 delete 시도 자체가 Discord 알림으로 즉시 감지됨 → **감사 로그 은폐 시도도 드러남**

---

## 5. 운영 환경 적용 예정 (Phase 2)

다음 AWS 계정 보안 서비스는 **운영 환경 안정화 단계에서 활성화 예정**입니다:

- **GuardDuty** — 머신러닝 기반 AWS 계정 위협 탐지 (비정상 API 호출, 크립토 마이닝, S3 데이터 유출 등)
- **Security Hub** — GuardDuty·Config·Inspector 등 결과를 통합 대시보드로 보기
- **Config** — 리소스 구성 변경 추적 + 규정 준수 체크 (예: 암호화되지 않은 EBS 볼륨 감지)

현재는 **CloudTrail + audit-security 이벤트 파이프라인**으로 기본 감사 체계를 먼저 완성했고, 위 세 서비스는 Prod 트래픽 안정화 + 비용 예산 확정 후 순차 적용.

---

## 설계 기준 요약

| 계층 | 담당 | 관리 레포 |
|------|-----|---------|
| **VPC·SG·NACL** | 네트워크 경계 | 301 terraform (`modules/vpc`, `modules/bastion`) |
| **NetworkPolicy** | Pod 간 트래픽 격리 | 303 helm (`network-policies`) |
| **Kyverno** | 배포 리소스 정책 | 303 helm (`kyverno-policies`) |
| **런타임 감시** | 커널 수준 프로세스·시스템콜 탐지 | 303 helm |
| **RBAC + IRSA** | K8s ↔ AWS 권한 경계 | 303 helm (`rbac`) + 301 terraform (`modules/eks`) |
| **CloudTrail / 감사** | API 호출·변경 이력 | 301 terraform (`stacks/audit-security`) |

---

## 차별점

1. **코드로 관리 (IaC)**: 모든 보안 설정이 terraform/helm 레포에 선언적으로 있어 **재현·감사·롤백 가능**
2. **네트워크·런타임 2중 감시**: NetworkPolicy(트래픽 격리) + 런타임 감시(프로세스·시스템콜) 로 다층 가시성 확보
3. **Default-Deny 네트워크**: "열어두고 막기"가 아니라 "닫아두고 필요한 것만 열기" 원칙
4. **감사 로그 은폐 방지**: S3 delete 시도 자체를 Discord 알림화하여 내부자 공격까지 탐지
