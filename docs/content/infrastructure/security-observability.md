# 보안 관측

보안 관측 화면은 AWS 감사 이벤트, AI Defense 동작, 보안 관련 텔레메트리와 저장소 상태를 함께 확인하는 기준입니다. 차단 결과와 감사 이벤트를 한 경로에서 이어서 보는 것이 목적입니다.

---

## 주요 대시보드

| 대시보드 | 주요 지표 | 목적 |
|---|---|---|
| **CloudTrail 감사 로그** | 이벤트 수, 거부 이벤트, 주요 API 호출, 최근 원시 로그 | 계정·리소스 변경 이력 확인 |
| **AI 텔레메트리 & 봇 탐지 현황** | Challenge 성공률, Fail-open 여부, 텔레메트리 태그 분포 | 봇 대응 동작 확인 |
| **ClickHouse Monitoring (AI Defense)** | Evaluate 처리량, Bot 분류 결과, MergeTree 상태 | AI Defense 저장소 상태 확인 |

---

## CloudTrail 감사 로그

CloudTrail 이벤트 수, 거부 이벤트, 주요 API 호출, 최근 원시 로그를 기준으로 AWS 계정과 리소스 변경 이력을 확인합니다.

![CloudTrail 감사 로그](/images/infrastructure/grafana-dashboards/cloudtrail-audit-log.png)

---

## AI 텔레메트리 & 봇 탐지 현황

AI Defense 서비스 상태, Challenge 성공률, Fail-open 여부, 텔레메트리 태그 분포를 기준으로 봇 대응 동작을 확인합니다.

![AI 텔레메트리 & 봇 탐지 현황](/images/infrastructure/grafana-dashboards/ai-telemetry-bot-detection.png)

---

## ClickHouse Monitoring (AI Defense)

ClickHouse 상태, Evaluate 처리량, Bot 분류 결과, MergeTree 상태를 기준으로 AI Defense 데이터 저장소 상태를 확인합니다.

![ClickHouse Monitoring (AI Defense)](/images/infrastructure/grafana-dashboards/clickhouse-monitoring-ai-defense.png)

---

## 운영 기준

| 구분 | 확인 지표 | 목적 |
|---|---|---|
| **감사 이벤트** | API 호출 수, 거부 이벤트, 최근 원시 로그 | AWS 계정과 리소스 변경 추적 |
| **봇 탐지 상태** | Challenge 성공률, Fail-open 여부, 텔레메트리 분포 | 방어 동작 정상 여부 확인 |
| **AI Defense 저장소 상태** | ClickHouse 상태, Evaluate 처리량, MergeTree 상태 | 텔레메트리 저장과 분석 파이프라인 확인 |
