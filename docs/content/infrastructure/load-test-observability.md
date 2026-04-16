# 부하테스트 전용

부하 테스트 관측 화면은 Staging에서 진행한 부하 테스트 시나리오와 인프라 상태를 함께 확인하는 기준입니다. k6 결과와 Pod, Node, Istio 라우팅, 로그를 같이 보며 병목 구간과 확장 동작을 확인합니다.

---

## k6 Controller

k6 Controller는 **부하 테스트의 실행·모니터링·결과 취합을 한 UI로 통합한 자체 구축 컨트롤러**입니다. Go 기반 서버로 구현했고, **Docker 이미지로 패키징되어 누구나 동일한 환경에서 손쉽게 띄울 수 있습니다**. 팀원은 브라우저에서 VU 범위·Duration·테스트 대상 API를 선택하고 즉시 부하를 쏠 수 있습니다.

![k6 Controller UI](/images/infrastructure/infra-loadtest/k6-controller.png)

### Flow 단위 서비스별 상세 지표

단일 flow(예: 매치 진입 → 큐잉 → READY → 좌석 진입 통합 프리셋) 실행 직후, Controller 화면에서 **해당 flow 안의 엔드포인트별 · 서비스별 상세 응답시간 분포**를 바로 확인할 수 있습니다. k6 클라이언트가 HTTP 요청에 대해 실제로 측정한 수치(서버 응답 수신까지의 왕복 시간)를 엔드포인트 태그(`testid`, `endpoint`) 단위로 집계한 결과입니다.

![k6 Controller – Flow Services](/images/infrastructure/infra-loadtest/k6-controller-flow-services.png)

> **해석 시 주의**: 이 화면은 **요청 단위(RTT)** 기준이라, 큐 READY 폴링처럼 "클라이언트가 의도적으로 기다리는 시간"은 서버 처리 지연이 아니라 **시나리오 설계상의 대기**입니다. 따라서 `queue-status` 같은 폴링 엔드포인트는 응답시간이 길게 찍혀도 병목이 아닐 수 있으니, 서버 측 처리 지연은 아래 "수신 대시보드"와 "서비스별 병목 진단"에서 교차 확인해야 합니다.

---

## 그라파나 k6용 대시보드

### k6 부하테스트 - 수신

**서비스가 "실제로 받은" 요청** 기준으로 부하 결과를 해석하는 화면입니다. k6 클라이언트가 쏜 수치가 아니라, Istio ingress + 각 서비스의 Micrometer 메트릭으로 관측된 **수신 측 트래픽**을 기준으로 집계합니다. 클라이언트가 쏜 수와 서버가 실제로 처리한 수의 차이를 비교해 게이트웨이/네트워크 중간 유실 지점을 빠르게 분리합니다.

주요 메트릭:

| 구분 | 기반 메트릭 | 확인 포인트 |
|---|---|---|
| **서비스 수신 RPS** | `http_server_request_duration_seconds_count` | 애플리케이션이 실제 수신한 초당 요청 수 |
| **성공 TPS (비즈니스)** | `business_ok_transactions` | HTTP 2xx + 응답 body code=OK 조건까지 통과한 **실 성공** |
| **응답시간 분포 (P50/P95/P99)** | `http_server_request_duration_seconds_bucket` | 꼬리 지연(P99) 기준 병목 감지 |
| **5xx 에러율** | `http_server_request_duration_seconds_count{status=~"5.."}` | 서비스 레벨 실패율 |
| **Istio 수신 메트릭** | `istio_requests_total`, `istio_request_duration_milliseconds` | sidecar 기준 워크로드별 RPS/지연, 앱 메트릭과 교차 검증 |
| **상태코드 분포** | `http_response_status_code` | 200 / 429 / 503 비율로 rate limit / 포화 구분 |

![K6 부하테스트 - 수신](/images/infrastructure/infra-loadtest/k6-susin.png)

---

### k6 부하테스트 - 서비스별 병목 진단

수신 화면이 "얼마나 잘 받았는가"를 본다면, 이 화면은 **"어디가 먼저 막혔는가"**를 봅니다. 각 서비스의 **병목 지점별 특화 지표**를 한 화면에 모아, 부하 구간에 튀는 서비스와 원인 계층(Tomcat 스레드 / HikariCP / Redis / GC / Kafka / CPU throttle)을 즉시 짚을 수 있게 구성했습니다.

![k6 서비스별 병목 진단](/images/infrastructure/infra-loadtest/k6-byeongmok0.png)

**서비스 특성 → 중점 관측 지표 매핑:**

| 서비스 | 특성 | 병목 나기 쉬운 지점 | 우선 관측 지표 |
|---|---|---|---|
| **seat** | DB 쿼리 집약 — 좌석 조회, Hold 생성, 분산락. PG·Redis 동시 호출 | **HikariCP pool 포화** / DB row lock 경합 / Redis 좌석 점유 락 대기 | `hikaricp_connections_pending`, `hikaricp_connections_acquire_seconds` P99, PG `pg_stat_activity` waiting, Redis `commandstats` 좌석 락 키 wait, JVM GC pause P99 |
| **queue** | Redis 위주, DB는 match 조회만. WebSocket으로 READY 푸시 | **Redis command latency** / 대기열 적체 / WS 연결 수 폭증 | `redis_commands_duration_seconds_bucket`, 대기열 Sorted Set 길이, WebSocket 활성 연결 수, pod 메모리 워킹셋 (in-memory 상태) |
| **order-core** | 결제/주문 트랜잭션, Kafka produce/consume | **Kafka producer/consumer lag** / 외부 결제 API 응답 / DB 트랜잭션 경합 | `kafka_producer_request_latency_avg`, `kafka_consumergroup_lag`, 결제 외부 호출 P99, DB deadlock count |
| **auth-guard** | 경량 JWT/토큰 검증, 대부분 Redis 캐시 히트 | **토큰 캐시 미스 증가** / CPU 스로틀 | 캐시 hit ratio, CPU throttle %, P99 latency 증가 폭 |
| **api-gateway** | Istio ingress + JWT + Rate Limit | **Envoy worker 포화** / ext_authz 지연 / 429 spike | `envoy_cluster_upstream_rq_pending`, ext_authz P99, 429 비율 |

**교차 관측 포인트 (전 서비스 공통):**

- **CPU throttling**: `container_cpu_cfs_throttled_seconds_total` — limit에 닿아 스로틀되면 P99 튐 근본 원인
- **Memory working set vs limit**: OOMKilled 직전 구간에서 GC가 격화되며 응답 시간 왜곡
- **JVM GC pause**: Full GC > 500ms는 seat/order-core에서 좌석 락 타임아웃 유발
- **Istio outlier detection ejections**: 특정 pod 퇴출되는 구간을 시각화 → replica 편향 확인
- **Pod restart / CrashLoop**: 부하 중 restart가 찍히면 위 지표들과 시간축 맞춰 원인 역추적

**실제 부하테스트 활용 예시:**

1000vu에서 seat P99만 4.3s로 튀고 나머지 서비스는 정상 구간일 때, 본 대시보드에서 같은 시점의 **HikariCP acquire wait P99**를 확인해 pool 포화가 실 원인임을 판별했습니다. (이후 pool size 25 → 40 조정으로 해소 검증)

---

## 병목 발견 파이프라인

Playball 부하테스트는 **"① k6 Controller + 대시보드로 튀는 구간 포착 → ② Tempo Trace로 근본 원인 확정"** 2단계로 병목을 추적합니다.

### ① k6 Controller + Grafana 대시보드로 튀는 지점 탐지

k6 Controller 결과와 Grafana `k6 부하테스트` 대시보드를 병행 관찰해 **부하 구간에 튀는 서비스와 엔드포인트**를 1차로 좁힙니다. 수신 RPS, P99 응답시간, 5xx, HikariCP pending, GC pause, Kafka lag 같은 **집계 지표로 이상 구간의 존재**를 드러냅니다.

![k6 병목 탐지 1](/images/infrastructure/infra-loadtest/k6-byeongmok1.png)

![k6 병목 탐지 2](/images/infrastructure/infra-loadtest/k6-byeongmok2.png)

### ② Tempo Trace로 요청 단위 근본 원인 확정

집계 지표만으로는 "seat P99가 4.3s 튄다"까지만 알 수 있고, **어떤 호출 체인의 어떤 구간에서 시간을 먹었는지**는 볼 수 없습니다. 이때 Tempo의 분산 트레이스를 조회해 요청 단위로 드릴다운합니다.

![Tempo Trace – 병목 상세 분석](/images/infrastructure/infra-loadtest/byeongmok-detail.png)

**이 화면이 기반으로 하는 Trace 메트릭:**

- **계측 수단**: `common-charts/apps/java-service` 배포 템플릿이 컨테이너 시작 시 **OpenTelemetry Java Agent** 를 init container로 내려받아 `-javaagent:/otel/opentelemetry-javaagent.jar` 로 주입합니다. 자바 코드를 전혀 건드리지 않고 **HTTP 서버/클라이언트, JDBC, Redis, Kafka, Spring WebFlux** 등 주요 라이브러리가 자동 instrumentation 됩니다.
- **Trace 전송 경로**: OTel Agent → **OTel Collector (클러스터 내)** → **Tempo** (gRPC / OTLP). 수집된 span은 100% 샘플링되어 Tempo에 적재됩니다.
- **조회 대상 필드**: Trace 한 건에서 각 span의 **duration, HTTP status, DB 쿼리문(JDBC span), Redis command, Kafka topic, exception stack** 까지 확인해 "어느 서비스의 어느 호출이 얼마나 걸렸는지"를 ms 단위로 짚어냅니다.

**활용 흐름 예시:**

1. Grafana에서 seat P99가 4.3s로 튄 시간대 포착
2. 해당 시간대에 발생한 slow trace를 Tempo에서 조회
3. 한 건 열어보니 `Hikari.getConnection` span이 3.8s 차지 → HikariCP 대기가 원인
4. 풀 사이즈 조정 후 재부하 → 동일 trace 경로에서 `getConnection` 구간이 < 50ms로 수렴되는지 재확인

---

