# 계정 경계 (Across-Account)

> **역할**: AWS Organization 기반 다계정 경계 · 공유 리소스 · SSO 연결 구조

Playball은 **AWS Organizations로 3개 계정을 분리**해 장애·권한·과금 경계를 계정 단위로 끊고, **IAM Identity Center로 단일 로그인 후 환경별 Permission Set을 선택**하는 구조로 운영합니다.

![계정 경계](/images/infrastructure/architecture/01_account-boundary.svg)

---

## 3 계정 구조

| 계정 | ID | 역할 | 주요 리소스 |
|------|----|----|-----------|
| **techupgrgbcn** (Management) | `497012402578` | AWS Organizations 관리 · CN 공용 인프라 | ECR 공용 레지스트리, IAM Identity Center, audit-security stack |
| **admin-kj** (Staging) | `406223549139` | Staging EKS · QA · 부하/보안 검증 | Staging VPC/EKS/RDS/ElastiCache |
| **ca-prod** (Prod) | `990521646433` | Prod 실서비스 운영 | Prod VPC/EKS/RDS/ElastiCache |

---

## 계정 간 공유 흐름

- **IAM Identity Center (SSO)** — Management 계정에서 중앙 관리, 3 계정으로 Permission Set 할당
  - CN 그룹 → `Dev-CN` / `Staging-CN` / `Prod-CN`
  - DEV 그룹 → `Staging-Dev` / `Prod-Dev`
  - AI 그룹 → `Staging-AI` / `Prod-AI`
  - SC 그룹 → `Staging-SC` / `Prod-SC`
- **ECR 공용 사용** — Management 계정의 ECR을 Dev(On-Prem)·Staging·Prod 모두 Pull
- **감사 로그 중앙 수집** — Management의 `audit-logs` S3에 CloudTrail · 보안 이벤트 집계

---

## 경계 설계 원칙

1. **장애 블래스트 레이디어스 축소**: 한 계정 사고가 다른 계정에 전이되지 않음
2. **과금 분리**: 환경별 AWS 비용을 계정 단위로 깔끔하게 추적
3. **권한 격리**: Prod 권한이 Staging에 없고, Staging 권한이 Prod에 없음
4. **IAM User 최소화**: 모든 인원 접근은 SSO. 예외는 `bot-kubeadm` IAM User 1개 (On-Prem Dev가 IRSA 못 쓰는 한계 대응)

상세 Permission Set 매핑은 [보안 → Organization & IAM Identity Center](../security/access-control/organization-sso) 참조.
