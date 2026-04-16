# 트래픽 대응

티켓팅 서비스는 경기 예매 오픈 시각에 요청이 짧은 시간 안에 집중됩니다. Playball은 경기 시작일 기준 7일 전 오전 `11:00`에 예매가 열리도록 설계되어 있어, 이 시각 전후의 트래픽 집중을 기준으로 대응 흐름을 구성했습니다. 트래픽이 발생한 뒤에만 Pod와 노드를 늘리면 준비 지연이 발생하므로 사전 확장과 실시간 확장을 함께 사용합니다.

---

## 대응 배경

![기존 확장](/images/infrastructure/traffic/01_traffic.svg?w=23%)

예매 오픈 시각인 `11:00` 이후에만 확장을 시작하면 Pod 준비까지 **수십 초 단위 지연**이 발생합니다. 이 구간 동안 사용자 요청이 처리되지 못해 타임아웃과 에러가 집중됩니다.

---

## 예매 오픈 기준

| 항목 | 내용 |
|---|---|
| **오픈 기준 시각** | 경기 시작일 기준 7일 전 오전 `11:00` (KST) |
| **적용 기준** | 경기별 판매 오픈 시각(`openAt`) 계산 후 대기열 진입과 판매 가능 여부를 동일 기준으로 판정 |
| **운영 의미** | 특정 경기의 예매가 열리는 순간에 요청이 몰리므로, `11:00` 전후를 기준으로 사전 확장과 실시간 확장을 함께 설계 |

예매 오픈 시각은 백엔드 공통 유틸에서 계산하며, 대기열 진입과 판매 가능 여부도 같은 기준을 사용합니다. 화면 표기와 실제 진입 허용 시점이 다르게 보이지 않도록 시간 기준을 공통으로 맞췄습니다.

---

## 대응 구조

![대응 구조](/images/infrastructure/traffic/02_traffic.svg?w=80%)


예매 오픈 전에는 `Cron pre-warming`으로 Pod를 먼저 늘리고, 오픈 이후에는 `CPU`, `Kafka lag`, `Queue 적체`를 기준으로 KEDA가 Pod 수를 조정합니다. 노드 자원이 부족해지면 Karpenter가 NodePool 기준으로 노드를 추가합니다.

---

## 트래픽 대응 기준

| 구분 | 기준 | 역할 |
|---|---|---|
| **사전 확장** | KEDA Cron | 티켓 오픈 전 목표 Replica를 미리 확보 |
| **실시간 Pod 확장** | KEDA CPU / Kafka lag | 요청 증가와 적체를 기준으로 Pod 수 조정 |
| **Node 확장** | Karpenter NodePool | Pod 배치를 위한 노드 자동 증설 |

---

## 서비스별 적용 범위

| 서비스 | 적용 기준 |
|---|---|
| **api-gateway** | CPU + Cron pre-warming |
| **auth-guard** | CPU + Cron pre-warming |
| **order-core** | CPU + Kafka lag + Cron pre-warming |
| **queue** | CPU + Kafka lag + Cron pre-warming |
| **seat** | CPU + Cron pre-warming |
| **ai-defense / authz-adapter** | CPU 기준 확장 |

오픈 직전에는 웹 계열 서비스의 기본 Replica를 먼저 확보하고, 오픈 이후에는 CPU와 Kafka lag 기준으로 확장을 이어갑니다. 앱 워크로드는 Karpenter NodePool에 배치해 피크 구간에서도 Pod 배치가 지연되지 않도록 구성했습니다.
