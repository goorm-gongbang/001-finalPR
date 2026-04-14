# 클러스터 정책

Kyverno는 클러스터에 배포되는 리소스를 검증하는 정책 엔진으로 운영합니다. `staging`, `prod` 환경 모두 `kyverno` 네임스페이스에 배포하고, 정책은 ArgoCD를 통해 별도 애플리케이션으로 적용합니다.

---

## 배포 구성

| 항목 | staging | prod |
|---|---|---|
| **엔진 버전** | Kyverno `3.7.1` | Kyverno `3.7.1` |
| **배포 위치** | `kyverno` namespace | `kyverno` namespace |
| **배포 방식** | ArgoCD `kyverno` + `kyverno-policies` | ArgoCD `kyverno` + `kyverno-policies` |
| **Webhook 동작** | `failurePolicy: Ignore` | `failurePolicy: Ignore` |
| **정책 동작** | `validationAction: Audit` | `validationAction: Audit` |
| **모니터링 연동** | `ServiceMonitor` 활성화 | `ServiceMonitor` 활성화 |

---

## 적용 정책

| 정책 | 내용 | staging | prod |
|---|---|---|---|
| **필수 라벨** | `app`, `version` 라벨 확인 | 적용 | 적용 |
| **Privileged 금지** | `privileged: true` 컨테이너 금지 | 적용 | 적용 |
| **latest 태그 금지** | `:latest` 또는 태그 미지정 이미지 금지 | 적용 | 적용 |
| **리소스 제한 확인** | CPU/메모리 limits 확인 | 적용 | 적용 |
| **Probe 확인** | readiness/liveness probe 확인 | 미적용 | 적용 |
| **중요 네임스페이스 보호** | ArgoCD 이외 주체의 수정/삭제 제한 | 적용 | 적용 |
| **ArgoCD 관리 강제** | `app.kubernetes.io/instance` 라벨 확인 | 적용 | 적용 |

---

## 예외 범위

정책 검증 제외 네임스페이스는 다음과 같습니다.

- `kube-system`
- `kube-public`
- `kube-node-lease`
- `kyverno`
- `argocd`
- `istio-system`
- `monitoring`
- `external-secrets`
- `external-dns`
- `karpenter`
- `cert-manager`
- `messaging`

---

## 운영 기준

| 항목 | 현재 적용 내용 |
|---|---|
| **정책 적용 시점** | 리소스 생성 또는 변경 시 검증 |
| **운영 모드** | 위반 시 차단하지 않고 Audit 기록 생성 |
| **중요 네임스페이스 보호** | ArgoCD 이외 주체의 UPDATE/DELETE 제한 |
| **배포 기준** | ArgoCD 관리 라벨이 없는 리소스 생성 검증 |
| **이미지 기준** | 명시적 버전 태그 사용 검증 |
| **리소스 기준** | limits, 라벨, probe 구성 여부 검증 |

---

## 점검 항목

| 항목 | 확인 내용 |
|---|---|
| **정책 리포트** | 위반 리소스와 위반 정책명이 기록되는지 |
| **배포 검증** | ArgoCD 관리 라벨과 필수 라벨이 포함되는지 |
| **운영 리소스** | privileged, `latest` 태그, limits 누락이 없는지 |
| **예외 네임스페이스** | 시스템/인프라 네임스페이스가 제외 범위와 일치하는지 |
