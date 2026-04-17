# ArgoCD·Grafana 접속 복구

> **분류**: 접근 경로·복구 · **환경**: 운영 EKS · **상태**: ✅ 해결

## 증상

- 재배포 이후 `argocd.playball.one`, `grafana.playball.one` 외부 접속 불가
- Route53 도메인 레코드 부재
- 인터넷용 ALB(Application Load Balancer, 외부 HTTP/HTTPS 트래픽을 받는 AWS 로드밸런서) 부재
- EKS 클러스터는 `ACTIVE` 상태였지만 `argocd`, `external-dns`, `monitoring`, `istio-system` 등 bootstrap 이후 필요한 계층이 비어 있었음

## 원인

- bootstrap 제거 과정에서 `root-prod` ArgoCD 애플리케이션이 삭제되며 GitOps 관리 리소스가 함께 prune(선언에서 사라진 리소스를 실제 클러스터에서도 삭제하는 동작)됨
- `external-dns`가 `sync` 모드로 동작하면서 대상 Ingress/Service가 사라진 뒤 Route53 레코드도 함께 삭제됨
- `aws-load-balancer-controller`가 관련 Ingress 삭제 이후 인터넷용 ALB를 함께 제거함
- Terraform으로는 EKS 자체만 복구됐고, ArgoCD·external-dns·monitoring 계층은 자동으로 다시 올라오지 않음
- `alb-ingress` 값 파일에 오래된 ACM(AWS Certificate Manager, HTTPS 인증서 관리 서비스) 인증서 ARN이 남아 있어 ALB가 `CertificateNotFound`로 생성되지 못함
- Grafana가 사용하는 `ExternalSecret` 설정이 활성 values 블록에 없어서 관리자 계정·Google OAuth 시크릿이 생성되지 않음

## 해결

- 운영 접근 가능한 SSO 역할로 kubeconfig를 다시 구성하고 bootstrap 재설치에 필요한 Terraform output을 확보함
- `install-all.sh`로 bootstrap 계층을 다시 설치해 `argocd`, `external-dns`, `monitoring`, `istio-system`을 복구함
- `303-goormgb-k8s-helm`에서 ALB 인증서 ARN을 현재 값으로 수정함
- Grafana `ExternalSecret` 설정을 활성 values 블록으로 이동해 시크릿 생성 경로를 복구함
- `alb-ingress`, `prometheus-extras`를 강제 refresh/sync하고 `ExternalSecret`, `Secret`, Grafana 파드 상태를 확인함

## 관측 결과

- CloudTrail 기준 `2026-04-07 02:17:22 KST`에 `goormgb-prod-external-dns` 역할이 DNS 레코드를 삭제했고, `2026-04-07 02:54:48 KST`에 `goormgb-prod-aws-lb-controller` 역할이 인터넷용 ALB를 삭제함
- ArgoCD 앱 상태는 `alb-ingress`, `external-dns`, `prometheus-extras`, `grafana` 모두 `Synced / Healthy`로 복구됨
- Route53 레코드와 인터넷용 ALB가 다시 생성되어 `argocd.playball.one`, `grafana.playball.one`, `prometheus.playball.one` 접근이 정상화됨
- Grafana는 `302 /login` 응답을 반환하며 로그인 경로까지 정상 복구됨

## 향후 모니터링

- bootstrap 제거 또는 클러스터 재구성 직후 `root` 앱, `external-dns`, `alb-ingress`, `prometheus-extras` 동기화 상태를 우선 확인
- Route53 레코드, 인터넷용 ALB, ACM 인증서 연결 상태를 함께 점검
- Grafana `ExternalSecret`과 관리자 시크릿이 정상 생성되는지 배포 직후 확인

## 참조

- `301-goormgb-terraform` output
- `302-goormgb-k8s-bootstrap` 설치 스크립트
- `303-goormgb-k8s-helm` 커밋
  - `bb95880` `fix(prod): update alb ACM certificate ARN`
  - `7a339e1` `fix(prod): move grafana eso config into active values block`

---

[← 트러블슈팅 인덱스로](../operational-troubleshooting)
