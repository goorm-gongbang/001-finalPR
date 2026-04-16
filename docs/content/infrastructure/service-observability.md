# 서비스 관측

서비스 관측 화면은 Playball의 애플리케이션 상태, 데이터베이스 상태, 메시지 처리 흐름, 로그와 Trace를 함께 확인하는 기준입니다. 오류율과 지연시간, 로그, Trace를 한 경로에서 이어서 보는 것이 목적입니다.

---

## 주요 대시보드

| 대시보드 | 주요 지표 | 목적 |
|---|---|---|
| **애플리케이션 모니터링** | 요청 수, 응답 시간, 5xx 오류, 엔드포인트 지연 분포 | 서비스 상태 확인 |
| **Database - RDS PostgreSQL** | CPU, 연결 수, IOPS, 지연시간, 사용 가능 메모리 | 데이터베이스 상태 확인 |
| **Kafka Overview** | 브로커 수, 토픽 수, 파티션 수, Consumer Lag | 메시지 적체 여부 확인 |
| **Loki Kubernetes Logs** | 서비스별 로그 건수, 로그 본문, 예외 메시지 | 장애 시각 전후 로그 확인 |

---

## 애플리케이션 모니터링

Spring Boot 애플리케이션의 요청 수, 응답 시간, 5xx 오류, 엔드포인트별 지연 분포를 기준으로 서비스 상태를 확인합니다.

![애플리케이션 모니터링(Spring Boot)](/images/infrastructure/grafana-dashboards/application-monitoring-spring-boot.png)

---

## Database - RDS PostgreSQL

RDS PostgreSQL의 CPU, 연결 수, IOPS, 지연시간, 사용 가능 메모리를 기준으로 데이터베이스 상태를 확인합니다.

![Database - RDS PostgreSQL](/images/infrastructure/grafana-dashboards/database-rds-postgresql.png)

---

## Kafka Overview

브로커 수, 토픽 수, 파티션 수, Consumer Lag를 기준으로 메시지 처리 흐름과 적체 여부를 확인합니다.

![Kafka Overview](/images/infrastructure/grafana-dashboards/kafka-overview.png)

---

## Loki Kubernetes Logs

Loki 기반 로그 화면에서 서비스별 로그 건수와 실제 로그 본문을 함께 확인합니다. 장애 시각 전후의 예외와 처리 흐름을 빠르게 대조할 때 사용합니다.

![로그 확인(Loki Kubernetes Logs)](/images/infrastructure/grafana-dashboards/loki-kubernetes-logs.png)

---

## 운영 기준

| 구분 | 확인 지표 | 목적 |
|---|---|---|
| **애플리케이션 상태** | 요청 수, 응답 시간, 오류율, 엔드포인트별 지연 | 서비스 이상 징후 확인 |
| **데이터베이스 상태** | CPU, 연결 수, IOPS, 지연시간 | 쿼리 병목과 연결 포화 확인 |
| **메시지 처리 상태** | Topic별 메시지 수, Consumer Lag | 비동기 처리 적체 확인 |
| **로그 확인** | 예외 로그, 로그 건수, 서비스별 로그 본문 | 원인 분석과 장애 시각 전후 대조 |
