# Organization & IAM Identity Center

Playball은 AWS Organizations로 다계정 환경을 분리하고, IAM Identity Center(구 AWS SSO)로 단일 로그인 후 계정·환경별로 최소 권한만 선택해 assume하도록 설계했습니다.

![AWS IAM Identity Center – 계정/그룹 할당 현황](/images/sc/sso/iam-identity-center.png)

---

## 1. 설계 원칙

- **다계정 분리**: 운영(Prod)·스테이징(Staging)·관리(Management)를 AWS 계정 단위로 분리해 장애/사고의 블라스트 레이디어스를 축소합니다.
- **SSO 단일화**: 모든 인원은 Google 계정(OIDC) 기반 IAM Identity Center로만 로그인하며, IAM User/Access Key는 사용하지 않습니다.
- **그룹 = 직무**: 사용자는 팀 그룹(CN/SC/AI/DEV)에만 속하며, 권한은 그룹에 부여된 **Permission Set**으로 주입됩니다.
- **환경 × 직무 매트릭스**: 같은 팀이라도 Staging과 Prod는 별도의 Permission Set을 사용해 Prod 권한을 상대적으로 축소합니다.
- **8시간 세션**: 모든 Permission Set의 Session Duration은 `PT8H`로 고정되어 근무시간 이후 자동 만료됩니다.

---

## 2. 계정 구조

| 계정 이름      | 계정 ID        | 역할                                                                       |
| -------------- | -------------- | -------------------------------------------------------------------------- |
| `techupgrgbcn` | `4970124025XX` | **Management 계정** — AWS Organizations 관리, CN 공용 개발/스테이징 인프라 |
| `admin-kj`     | `4062235491XX` | **Playball staging 계정** — Staging EKS, RDS, S3, Secrets 등 Staging 환경  |
| `ca-prod`      | `9905216464XX` | **Playball 운영 계정** — Prod EKS, RDS, S3, Secrets 등 서비스 실 운영      |

---

## 3. 그룹 구조

| 그룹    | 역할                  | 주요 권한 테마                                                  |
| ------- | --------------------- | --------------------------------------------------------------- |
| **CN**  | Cloud Native · DevOps | EKS/S3/Secrets/ECR 풀 권한, 인프라 전체 관리 (SSM은 Session 액션만)       |
| **SC**  | 보안팀                | Secrets 관리, CloudTrail 감사 로그 접근, SSM Session                     |
| **AI**  | AI팀                  | AI Defense/ClickHouse S3 읽기, 환경별 Secrets 읽기, SSM Session          |
| **DEV** | 개발팀                | EKS 읽기(AccessKubernetesApi), 환경별 Secrets 읽기, SSM Session          |

---

## 4. 그룹 × 계정 Assignment 매트릭스

같은 그룹이라도 접속하는 계정에 따라 적용되는 Permission Set이 달라집니다. Staging vs Prod는 리소스 접근 범위와 쓰기/읽기 수준이 분리됩니다.

| 그룹    | `techupgrgbcn` (Management) | `admin-kj` (Staging) | `ca-prod` (Prod) |
| ------- | --------------------------- | -------------------- | ---------------- |
| **CN**  | `Dev-CN`                | `Staging-CN`         | `Prod-CN`        |
| **SC**  | —                           | `Staging-SC`         | `Prod-SC`        |
| **AI**  | —                           | `Staging-AI`         | `Prod-AI`        |
| **DEV** | —                           | `Staging-Dev`        | `Prod-Dev`       |

> **읽는 법**: "CN 그룹원이 admin-kj(Staging) 계정에 접속하여 `Staging-CN` Permission Set을 선택해 assume할 수 있다."

---

## 5. Permission Set 상세 권한

### 5.1 Cloud Native (CN)

| Permission Set           | 주요 권한                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dev-CN`             | AdministratorAccess + ECR Full Access, SSM Session, S3 `goormgb-dev-*` (Dev 환경은 kubeadm 기반이라 EKS는 사용하지 않음 — 이 권한은 ECR/공유 인프라 관리 용도) |
| `Staging-CN` / `Prod-CN` | `eks:*`, `s3:*` on `playball-*`, `secretsmanager:GetSecretValue/Describe/List`, EC2/ECR/CloudWatch/Logs/RDS/ElastiCache `Describe`, Cost Explorer, **SSM은 Session 액션만** (`StartSession/TerminateSession/ResumeSession/Describe*`) — `SendCommand·Put/DeleteParameter·AutomationExecution` 등 우회 공격 경로는 제외 |

### 5.2 보안팀 (SC)

| Permission Set           | 주요 권한                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `Staging-SC` / `Prod-SC` | SSM Session, `secretsmanager:*` on `{env}/*`, S3 읽기 `playball-*`, CloudTrail Lookup |

### 5.3 AI팀

| Permission Set           | 주요 권한                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `Staging-AI` / `Prod-AI` | SSM Session, Secrets 읽기 `{env}/*`, S3 읽기 (`playball-{env}-ai-audit`, `playball-{env}-clickhouse` 등) |

### 5.4 개발팀 (DEV)

| Permission Set             | 주요 권한                                    |
| -------------------------- | -------------------------------------------- |
| `Staging-Dev` / `Prod-Dev` | SSM Session, Secrets 읽기 `{env}/*`, S3 읽기 |

---

## 6. 최소권한 설계 포인트

- **계정 경계로 1차 격리**: Staging은 `admin-kj`, Prod는 `ca-prod` 별도 계정에 두어 권한·리소스·과금 경계를 계정 단위로 끊습니다.
- **환경 태그 기반 조건부 허용**: `DevOps-*` Permission Set은 `aws:ResourceTag/Environment` 조건으로 환경 간 교차 접근을 막습니다.
- **Secrets 네임스페이스 분리**: 모든 Secrets 정책은 `arn:aws:secretsmanager:*:*:secret:{env}/*` 처럼 환경 prefix로 제한되어 Prod 시크릿이 Staging 권한으로 노출되지 않습니다.
- **S3 버킷 prefix 스코프**: `playball-*`(서비스 데이터) vs `goormgb-{env}-*`(환경 전용) 로 계층이 나뉘고, Permission Set이 허용 prefix만 지정합니다.
- **IAM은 "접속"까지만 제어**: IAM Permission Set은 DB에 **로그인 가능한지(yes/no)** 와 **SSM 세션을 열 수 있는지**만 결정합니다. 실제 DB 안에서 `SELECT` vs `UPDATE` vs `DELETE` 같은 세밀한 SQL 명령 제어는 **PostgreSQL Role/GRANT**(DB 레벨) 에서 별도 관리합니다. 즉 **IAM = 게이트웨이, DB Role = 내부 권한** 2중 구조.

> **📝 향후 확장 — IAM DB Authentication 연동 가능**
>
> 현재는 DB 접속 자체를 **Bastion SSM + DB 유저/비밀번호** 조합으로 운영합니다. 필요해지면 다음 구조로 **IAM ↔ DB 유저를 1:1 매핑**해 SSO 로그인 한 번으로 DB까지 연결되는 체계로 확장 가능합니다.
>
> **구현 단계**:
> 1. PostgreSQL 각 유저(`db_admin`, `db_readonly` 등)에 `GRANT rds_iam` 부여
> 2. IAM Permission Set에 `rds-db:connect` 액션 추가, **Resource를 유저별로 분리** 기재 (예: CN은 `...:dbuser:db-XXX/db_admin`, DEV는 `.../db_readonly`)
> 3. RDS 인스턴스 파라미터 `iam_database_authentication_enabled = true`
>
> **효과**:
> - DB 비밀번호 관리 폐지 — IAM 토큰(15분 단기)으로 로그인
> - IAM 그룹(CN/DEV/AI/SC) → DB 유저 → DB Role/GRANT 로 **3단 권한 체인**이 완성됨
> - CloudTrail에 "누가 어느 DB 유저로 로그인했는지" 자동 감사 기록
>
> 현 단계에서는 **설계 구조만 준비**해두고, 운영 규모가 커지는 시점에 전환합니다.
- **SSM은 Session 액션만 허용 (전 팀 공통)**: 모든 Permission Set의 SSM은 `StartSession/TerminateSession/ResumeSession/Describe*` 로 제한합니다. Bastion 경유 DB·EKS 터널링은 가능하지만 `SendCommand`(임의 EC2 원격 명령), `PutParameter`(설정 오염), `AutomationExecution`(대량 재시작·삭제) 같은 **우회 공격 경로는 차단**됩니다.
