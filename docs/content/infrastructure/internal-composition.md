# 내부 구성

> **역할**: 3-레포 분리와 클러스터 내부 App-of-Apps 구조를 한눈에 보여주는 다이어그램

**`301 Terraform` → `302 Bootstrap` → `303 Helm/Values GitOps`** 의 3-레포 분리 + **ArgoCD Root App → Infra Apps / Application Apps** 의 App-of-Apps 패턴으로 클러스터 내부 리소스를 관리합니다.

![내부 구성](/images/infrastructure/architecture/02_infra-arc.svg?w=85%)

---

## 흐름 요약

1. **301 Terraform** → AWS 리소스(VPC/EKS/RDS 등) 프로비저닝 + 클러스터 setup
2. **302 Bootstrap** → 클러스터 내부에 **ArgoCD Root App** 초기 설치 (1회성)
3. **303 Helm/Values Git 레포** →|sync|→ **ArgoCD가 지속 동기화**
4. **Root App** → Infra Apps · Application Apps로 App-of-Apps 확산
   - **Infra Apps**: Istio, ESO, Karpenter/KEDA, Kyverno + Policy Reporter, 관측성 스택
   - **Application Apps**: 백엔드 / 프론트엔드 서비스
5. **관측성** → Thanos(S3)로 메트릭 장기 저장

상세 레포 역할은 [인프라 아키텍처 → 저장소 역할 분리](./architecture#저장소-역할-분리) 참조.
