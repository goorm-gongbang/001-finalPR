# 아우터 아키텍처 - EKS (Staging · Prod)

> **역할**: AWS EKS 환경의 VPC 토폴로지 · 외부 진입 · Multi-AZ 배치 구조 (CIDR/리소스 세부 포함)

Staging/Prod는 **AWS VPC 위에 Multi-AZ로 배치된 EKS 클러스터**입니다. Public/Private 서브넷을 분리해 **외부 진입(ALB)** 과 **내부 워크로드(EKS/RDS/Redis)** 의 네트워크 경계를 명확히 나눕니다.

---

## VPC 토폴로지 (상세)

![VPC 토폴로지](/images/infrastructure/architecture/02_outer.svg)

---

## VPC 주소 체계

| 구분 | CIDR | 주소 범위 | 용도 |
|------|------|-----------|------|
| **VPC** | `10.0.0.0/16` | 10.0.0.0 – 10.0.255.255 (65,536개) | 전체 네트워크 범위 |
| Public Subnet (a) | `10.0.1.0/24` | 10.0.1.0 – 10.0.1.255 | NAT-a, ALB ENI |
| Public Subnet (c) | `10.0.2.0/24` | 10.0.2.0 – 10.0.2.255 | NAT-c, ALB ENI |
| Private App Subnet (a) | `10.0.11.0/24` | 10.0.11.0 – 10.0.11.255 | EKS Worker, Bastion, VPC Endpoint ENI |
| Private App Subnet (c) | `10.0.12.0/24` | 10.0.12.0 – 10.0.12.255 | EKS Worker, VPC Endpoint ENI |
| Private Data Subnet (a) | `10.0.21.0/24` | 10.0.21.0 – 10.0.21.255 | RDS Primary, ElastiCache Primary |
| Private Data Subnet (c) | `10.0.22.0/24` | 10.0.22.0 – 10.0.22.255 | RDS Standby, ElastiCache Replica |

> 각 서브넷은 AWS 예약 IP 5개(`.0` 네트워크 · `.1` VPC 라우터 · `.2` DNS · `.3` 예약 · `.255` 브로드캐스트)를 제외하고 사용합니다. `/24` 서브넷당 사용 가능 251개.

---

## 외부 진입 경로 (Edge → Pod)

```
사용자
  ↓  HTTPS (TCP 443)
Route 53 (playball.example.com A/AAAA → CloudFront Alias)
  ↓
CloudFront Distribution (PoP · ACM 인증서 종단)
  ↓  HTTPS (Origin: ALB DNS)
AWS WAF (WebACL 평가)
  ↓
ALB (internet-facing, Multi-AZ ENI 10.0.1.10 · 10.0.2.10)
  ↓  HTTP (VPC 내부)
Istio IngressGateway Service (NodePort / Target Group IP)
  ↓  mTLS
Backend Pod (Pod CIDR)
```

| 단계 | 리소스 | 식별자 |
|------|--------|--------|
| DNS | Route 53 Hosted Zone | `Z0XXXXXXXXXXX` (playball.example.com) |
| Edge | CloudFront Distribution | `E2XXXXXXXXXX` |
| TLS | ACM Certificate | `arn:aws:acm:us-east-1:<acct>:certificate/<uuid>` (CloudFront용 us-east-1) |
| WAF | WebACL | `playball-waf` (AWSManagedRulesCommonRuleSet + Rate-based 2000/5min) |
| L7 LB | ALB | `playball-alb.elb.ap-northeast-2.amazonaws.com` |
| Target Group | IP mode | ALB → Istio IngressGateway Pod IP 직접 |
| Ingress | Istio IngressGateway | Pod in `istio-system`, Service LoadBalancer |

---

## Private 서브넷 내부 리소스 (상세)

### EKS 클러스터

| 항목 | 값 |
|------|-----|
| 클러스터 이름 | `goormgb-staging` / `goormgb-prod` |
| 버전 | 1.30 |
| 엔드포인트 | Private + Public (팀 IP whitelist) |
| Pod CIDR (VPC CNI) | **VPC CIDR에서 직접 할당** (10.0.11.x / 10.0.12.x 노드 ENI에 Secondary IP) |
| Service CIDR | `172.20.0.0/16` (EKS 기본) |
| Node Group | **Karpenter 관리** (NodePool `apps`/`monitoring`) |

### RDS (PostgreSQL 15)

| 항목 | Staging | Prod |
|------|---------|------|
| 인스턴스 클래스 | `db.t4g.medium` | `db.r6g.large` (Multi-AZ) |
| 스토리지 | gp3 100GB | gp3 300GB |
| 서브넷 그룹 | `db-subnet-a`(10.0.21.0/24) + `db-subnet-c`(10.0.22.0/24) |
| 엔드포인트 | `goormgb-staging.cluster-xxx.ap-northeast-2.rds.amazonaws.com:5432` |
| Security Group | 인바운드 5432 ← EKS Node SG · Bastion SG |
| 백업 | 자동 스냅샷 7일 · PITR · 수동 스냅샷 별도 |

### ElastiCache (Redis 7)

| 항목 | 값 |
|------|-----|
| 노드 타입 | `cache.t4g.small` (Staging) / `cache.r6g.large` (Prod) |
| 클러스터 | Primary(AZ-a) + Replica(AZ-c) · Multi-AZ Auto Failover |
| 엔드포인트 | `goormgb-redis.xxx.ng.0001.apn2.cache.amazonaws.com:6379` |
| Security Group | 인바운드 6379 ← EKS Node SG |

### Bastion

| 항목 | 값 |
|------|-----|
| 인스턴스 | `t4g.nano` (Graviton ARM) |
| 배치 | Private Subnet (a) `10.0.11.5` |
| 접근 | **AWS Systems Manager Session Manager 전용** (SSH 포트 미개방) |
| IAM Role | `bastion-ssm-role` (AmazonSSMManagedInstanceCore + RDS/Redis CLI 접근 정책) |
| 용도 | RDS psql / redis-cli / kubectl (EKS private endpoint 경유) |

### VPC Endpoint (NAT 우회)

| 서비스 | Endpoint Type | 배치 | 용도 |
|--------|---------------|------|------|
| `com.amazonaws.ap-northeast-2.ecr.api` | Interface | Private-App (a/c) | ECR API |
| `com.amazonaws.ap-northeast-2.ecr.dkr` | Interface | Private-App (a/c) | Docker 레지스트리 Pull |
| `com.amazonaws.ap-northeast-2.s3` | Gateway | Route Table 연동 | S3 (Thanos/Loki/Tempo 백엔드) |
| `com.amazonaws.ap-northeast-2.secretsmanager` | Interface | Private-App (a/c) | ESO 동기화 |
| `com.amazonaws.ap-northeast-2.sts` | Interface | Private-App (a/c) | IRSA AssumeRoleWithWebIdentity |
| `com.amazonaws.ap-northeast-2.ssm` | Interface | Private-App (a) | Bastion SSM 세션 |

---

## 라우팅 테이블

| 라우팅 테이블 | 연결 서브넷 | 주요 라우트 |
|---------------|-------------|-------------|
| `rtb-public` | Public (a/c) | `0.0.0.0/0` → IGW · `10.0.0.0/16` → local |
| `rtb-private-app-a` | Private-App (a) | `0.0.0.0/0` → NAT-a · S3 → Gateway Endpoint · `10.0.0.0/16` → local |
| `rtb-private-app-c` | Private-App (c) | `0.0.0.0/0` → NAT-c · S3 → Gateway Endpoint · `10.0.0.0/16` → local |
| `rtb-private-data-a` | Private-Data (a) | S3 → Gateway Endpoint · `10.0.0.0/16` → local (인터넷 라우트 없음) |
| `rtb-private-data-c` | Private-Data (c) | S3 → Gateway Endpoint · `10.0.0.0/16` → local (인터넷 라우트 없음) |

> **Data 서브넷은 인터넷 경로 자체를 차단** — DB/Redis가 외부로 나갈 이유가 없음.

---

## Security Group 매트릭스 (요약)

| SG | 인바운드 | 아웃바운드 |
|----|----------|------------|
| `alb-sg` | 443 ← CloudFront Managed Prefix List | EKS Node SG로 앱 포트 |
| `eks-node-sg` | 앱 포트 ← alb-sg · 클러스터 내부 Full | Full (NAT/VPC Endpoint 경유) |
| `rds-sg` | 5432 ← eks-node-sg, bastion-sg | 없음 |
| `redis-sg` | 6379 ← eks-node-sg | 없음 |
| `bastion-sg` | HTTPS(443) ← SSM Endpoint | RDS 5432, Redis 6379, EKS API 443 |
| `vpce-sg` | 443 ← VPC CIDR (10.0.0.0/16) | 없음 |

---

## VPC 구성 원칙

| 구분 | 설계 | 이유 |
|------|------|------|
| **Multi-AZ** | 최소 2개 AZ (a/c) | 단일 AZ 장애 시에도 서비스 지속 · Spot 풀 다양화 전제 |
| **3-Tier 서브넷** | Public / Private-App / Private-Data | 외부 진입·앱·데이터 경계 분리로 공격 표면 최소화 |
| **NAT Gateway per AZ** | AZ별 1개씩 배치 | AZ 장애 대응 · Cross-AZ 트래픽 비용 절감 |
| **VPC Endpoint** | ECR/S3/SecretsManager/STS/SSM | NAT 우회 **데이터 전송 비용 절감** + 프라이빗 경로 |
| **Data Subnet 격리** | 0.0.0.0/0 라우트 없음 | DB/Redis는 외부로 나갈 이유 없음 → 완전 격리 |

---

## Staging vs Prod 차이

| 항목 | Staging | Prod |
|------|---------|------|
| 워커 노드 | **Spot 중심** ([다양화 정책](./operational-troubleshooting/staging-spot)) | **On-Demand 중심** |
| RDS 클래스 | `db.t4g.medium` 단일 | `db.r6g.large` Multi-AZ |
| Redis 클래스 | `cache.t4g.small` | `cache.r6g.large` |
| 관측성 저장소 | S3 (Thanos/Loki/Tempo) | S3 (Thanos/Loki/Tempo) |
| 관리 도구 | CloudBeaver/RedisInsight/Kafka-UI GUI 제공 | GUI 차단 · Bastion SSM 전용 |
| 접근 제어 | IP whitelist + Google OAuth | SSO 권한 + Bastion |

VPC/서브넷/NAT/ALB/VPC Endpoint 등 **네트워크 골격은 Staging과 Prod가 동일**하며, 차이는 **인스턴스 사이즈 · 노드 타입 · 관리 도구 노출 · 접근 제어 엄격도**에 있습니다.

---

## 왜 이 구조인가

- **Multi-AZ 필수**: Spot 다양화 · RDS 페일오버 · ALB 고가용성 — 모두 AZ 분산이 전제
- **3-Tier 분리**: Public Subnet은 NAT·ALB만 존재 → 워크로드/데이터 직접 노출 없음. Data 서브넷은 인터넷 경로 자체 차단
- **VPC Endpoint로 비용·보안 동시 해결**: ECR Pull, Secrets Sync, S3 업로드 모두 VPC 내부 경로로 처리 → NAT 트래픽·데이터 전송비 절감 + 공용 인터넷 미경유

---

[← 인프라 아키텍처 개요](./architecture) · [← Dev 아우터 아키텍처](./outer-architecture-dev)
