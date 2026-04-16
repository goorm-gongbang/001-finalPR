# 인프라 관측

Playball의 인프라 관측 화면은 클러스터 상태, 노드 자원, Pod 분포, 서비스 메쉬 동작을 한 화면에서 확인하는 기준입니다. 배포 직후 상태 확인과 장애 징후 탐지는 이 화면들을 기준으로 진행합니다.

---

## 주요 대시보드

| 대시보드 | 주요 지표 | 목적 |
|---|---|---|
| **EKS 클러스터 개요** | Ready 노드, 실행 중 Pod, 네임스페이스 수, 리소스 사용률 | 클러스터 전체 상태 확인 |
| **K8s 운영 현황판** | 대기 Pod, CrashLoop, 이미지 풀 실패, Node/Pod 목록 | 운영 징후와 즉시 조치 필요 항목 확인 |
| **Istio 워크로드 모니터링** | 요청량, 오류율, 지연시간, TCP 트래픽 | 메쉬 내부 트래픽 상태 확인 |
| **Kubernetes Pod 모니터링** | Pod 상태, 재시작, CPU·메모리, 네트워크 트래픽 | 워크로드 단위 이상 징후 확인 |

---

## EKS 클러스터 개요

클러스터 전반의 Pod 수, 네임스페이스 수, 리소스 사용률, 노드 상태를 한 화면에서 확인합니다.

![EKS 클러스터 개요](/images/infrastructure/grafana-dashboards/eks-cluster-overview.png)

---

## K8s 운영 현황판

Ready 상태, 대기 중 Pod, CrashLoop, 리소스 사용량, Pod/Node 목록을 기준으로 배포 직후 상태와 장애 징후를 확인합니다.

![K8s 운영 현황판 (k9s 스타일)](/images/infrastructure/grafana-dashboards/k8s-ops-k9s.png)

---

## Istio 워크로드 모니터링

요청량, 오류율, 지연시간, TCP 트래픽을 기준으로 서비스 메쉬 내부의 트래픽 흐름과 오류 징후를 확인합니다.

![Istio 워크로드 모니터링](/images/infrastructure/grafana-dashboards/istio-workload-monitoring.png)

---

## Kubernetes Pod 모니터링

Pod 상태, 재시작 횟수, CPU·메모리 사용량, 네트워크 트래픽을 기준으로 워크로드 단위 상태를 확인합니다.

![Kubernetes Pod 모니터링](/images/infrastructure/grafana-dashboards/kubernetes-pod-monitoring.png)

---

## 운영 기준

| 구분 | 확인 지표 | 목적 |
|---|---|---|
| **클러스터 상태** | Ready 노드, 실행 Pod, 대기 Pod, CrashLoop | 자원 부족 또는 배포 이상 확인 |
| **노드 상태** | CPU, 메모리, 스토리지, 역할별 노드 분포 | 스케일링 또는 노드 교체 판단 |
| **메쉬 상태** | 요청량, 오류율, 지연시간, TCP 연결 | Gateway 이후 트래픽 상태 확인 |
