# Organization & SSO

Playball은 AWS Organizations로 다계정 환경을 분리하고, IAM Identity Center(구 AWS SSO)로 단일 로그인 후 계정·환경별로 최소 권한만 선택해 assume하도록 설계했습니다.

---

## 1. 설계 원칙

- **다계정 분리**: 운영(Prod)·스테이징(Staging)·관리(Management)를 AWS 계정 단위로 분리해 장애/사고의 블라스트 레이디어스를 축소합니다.
- **SSO 단일화**: 모든 인원은 Google 계정(OIDC) 기반 IAM Identity Center로만 로그인하며, IAM User/Access Key는 사용하지 않습니다.
- **그룹 = 직무**: 사용자는 **팀 그룹(CN/SC/AI/DEV/FE/PM)**에만 속하며, 권한은 그룹에 부여된 **Permission Set**으로 주입됩니다.
- **환경 × 직무 매트릭스**: 같은 팀이라도 Staging과 Prod는 별도의 Permission Set을 사용해 Prod 권한을 상대적으로 축소합니다.
- **8시간 세션**: 모든 Permission Set의 Session Duration은 `PT8H`로 고정되어 근무시간 이후 자동 만료됩니다.

---

## 2. 계정 구조

| 계정 이름 | 계정 ID | 역할 |
|---|---|---|
| `techupgrgbcn` | `497012402578` | **Management 계정** — AWS Organizations 관리, CN 공용 개발/스테이징 인프라 |
| `admin-kj` | `406223549139` | **Playball 운영 계정** — Staging / Prod EKS, RDS, S3, Secrets 등 서비스 실 운영 |
| `ca-prod` | `990521646433` | **격리 예비 계정** — 별도 운영 도메인 예약 (현재 권한 할당 없음) |

---

## 3. 그룹 구조

| 그룹 | 역할 | 주요 권한 테마 |
|---|---|---|
| **CN** | Cloud Native · DevOps | EKS/S3/Secrets/ECR/SSM 풀 권한, 인프라 전체 관리 |
| **SC** | 보안팀 | Secrets 관리, CloudTrail/GuardDuty/SecurityHub, 감사 로그 접근 |
| **AI** | AI팀 | AI Defense/ClickHouse S3 읽기, 환경별 Secrets 읽기, SSM Session |
| **DEV** | 개발팀 | EKS 읽기(AccessKubernetesApi), 환경별 Secrets 읽기, SSM Session |
| **FE** | 프론트엔드팀 | CloudWatch 읽기, 자산 S3(`goormgb-assets`) 읽기 |
| **PM** | 기획팀 | Billing/Cost Explorer/CloudWatch 읽기 |
| **PEN** | 모의해킹 | 현재 권한 할당 없음 (프로젝트 투입 시 부여) |

---

## 4. 그룹 × 계정 Assignment 매트릭스

같은 그룹이라도 접속하는 계정에 따라 적용되는 Permission Set이 달라집니다. Staging vs Prod는 리소스 접근 범위와 쓰기/읽기 수준이 분리됩니다.

| 그룹 | `techupgrgbcn` (Management) | `admin-kj` (Staging) | `admin-kj` (Prod) |
|---|---|---|---|
| **CN** | `DevOps-Dev`, `DevOps-Staging` | `Staging-CN`, `DevOps-Staging`, `Admin-Full` | `Prod-CN`, `DevOps-Prod` |
| **SC** | — | `Staging-SC` | `Prod-SC`, `Security-Prod` |
| **AI** | — | `Staging-AI` | `Prod-AI` |
| **DEV** | `Developer-Staging` | `Staging-Dev` | `Developer-Prod`, `Prod-Dev` |
| **FE** | `FE-Access` | — | — |
| **PM** | `PM-Access` | — | — |

> **읽는 법**: "CN 그룹원이 admin-kj 계정의 Staging 환경에 접속하면 `Staging-CN` 또는 `DevOps-Staging` Permission Set을 선택해 assume할 수 있다."

---

## 5. Permission Set 상세 권한

### 5.1 Admin / DevOps

| Permission Set | AWS Managed | 핵심 Inline |
|---|---|---|
| `Admin-Full` | **AdministratorAccess** | — (완전 권한, CN 그룹 장애 대응용) |
| `DevOps-Dev` | AdministratorAccess | EKS는 `Environment=dev` 태그로 제한, S3 `goormgb-dev-*` |
| `DevOps-Staging` | AdministratorAccess | EKS는 `Environment=staging` 태그 제한, S3 `goormgb-staging-*` |
| `DevOps-Prod` | AdministratorAccess | EKS는 `Environment=prod` 태그 제한, S3 `goormgb-prod-*` |

### 5.2 Cloud Native (서비스 운영)

| Permission Set | 주요 권한 |
|---|---|
| `Staging-CN` / `Prod-CN` | `eks:*`, `s3:*` on `playball-*`, `secretsmanager:GetSecretValue/Describe/List`, EC2/ECR/CloudWatch/Logs/SSM/RDS/ElastiCache `Describe`, Cost Explorer |

### 5.3 보안팀 (SC)

| Permission Set | 주요 권한 |
|---|---|
| `Staging-SC` / `Prod-SC` | SSM Session, `secretsmanager:*` on `{env}/*`, S3 읽기 `playball-*`, CloudTrail Lookup |
| `Security-Prod` | IAM Read, `cloudtrail:*`, `config:*`, `guardduty:*`, `securityhub:*`, CloudWatch/Logs — 침해/사고 조사 전용 |

### 5.4 AI팀

| Permission Set | 주요 권한 |
|---|---|
| `Staging-AI` / `Prod-AI` | SSM Session, Secrets 읽기 `{env}/*`, S3 읽기 (`playball-{env}-ai-audit`, `playball-{env}-clickhouse` 등) |

### 5.5 개발팀 (DEV)

| Permission Set | 주요 권한 |
|---|---|
| `Staging-Dev` / `Prod-Dev` | SSM Session, Secrets 읽기 `{env}/*`, S3 읽기 |
| `Developer-Staging` | EKS Cluster `goormgb-staging-eks`에 한정된 `eks:AccessKubernetesApi` + Describe |
| `Developer-Prod` | EKS Cluster `goormgb-prod-eks`에 한정된 `eks:AccessKubernetesApi` + Describe |

### 5.6 프론트엔드 / 기획

| Permission Set | 주요 권한 |
|---|---|
| `FE-Access` | CloudWatch/Logs 읽기, S3 읽기 `goormgb-assets` |
| `PM-Access` | CloudWatch/Logs 읽기, Billing View, Cost Explorer, Budgets Describe |

---

## 6. 최소권한 설계 포인트

- **환경 태그 기반 조건부 허용**: `DevOps-*` Permission Set은 `aws:ResourceTag/Environment` 조건으로 환경 간 교차 접근을 막습니다.
- **Secrets 네임스페이스 분리**: 모든 Secrets 정책은 `arn:aws:secretsmanager:*:*:secret:{env}/*` 처럼 환경 prefix로 제한되어 Prod 시크릿이 Staging 권한으로 노출되지 않습니다.
- **S3 버킷 prefix 스코프**: `playball-*`(서비스 데이터) vs `goormgb-{env}-*`(환경 전용) vs `goormgb-assets`(정적 자산) 3계층으로 분리됩니다.
- **개발자 EKS 제한**: `Developer-*`는 특정 클러스터 ARN만 허용해 타 환경 클러스터 `kubectl` 접근을 차단합니다.
- **Admin-Full은 break-glass**: CN 그룹 소속이지만 상시 사용이 아닌 장애 대응/복구 시나리오용이며 CloudTrail로 사용 이력이 전량 수집됩니다.
