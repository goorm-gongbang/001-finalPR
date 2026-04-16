# 장애 대응

Playball은 성능 저하, 서비스 가용성 문제, 복구 가능성 저하를 분리해 판단합니다. 장애 대응은 인지, 1차 분류, 영향 차단, 복구, 종료 확인 순서로 진행합니다.

---

## 복구 구조

![복구 구조](/images/infrastructure/incident-response/01_incident-response.svg?w=67%)

---

## 장애 판단 기준

| 분류 | 주요 징후 | 우선 확인 항목 |
|---|---|---|
| **애플리케이션** | 5xx, P99 상승, CrashLoop | 최근 배포, 애플리케이션 로그, 환경변수, 외부 API |
| **인프라** | Node NotReady, Pod 재스케줄링, CPU/메모리 포화 | 노드 상태, 오토스케일링, 네트워크 |
| **데이터** | DB 연결 포화, 데이터 손상, 잘못된 배치 | 쿼리, 락, PITR 필요 여부 |
| **캐시/세션** | Redis down, 메모리 포화 | Redis 상태, eviction, 의존 기능 영향 |
| **보안/감사** | 권한 변경, 루트 로그인, WAF 급증, 감사 저장소 이상 | CloudTrail, EventBridge, WAF 이벤트 |
| **복구 가능성** | RDS 백업 실패, PITR 비활성, 수동 스냅샷 미생성, 최근 PostgreSQL 데이터베이스 보조 백업 부재 | 자동백업, 수동 스냅샷, PostgreSQL 데이터베이스 보조 백업 성공 시각 |
| **장기보관 적재** | `member-retention/`, `commerce-retention/`, `pis-access/` 적재 실패 | 배치, Lambda, CronJob, 매니페스트 검증 |

---

## 장애 등급

| 등급 | 기준 | 초기 대응 목표 |
|---|---|---|
| **Critical** | 서비스 중단, 핵심 기능 장애, 보안 중대 이벤트, 복구 가능성 상실 | 5분 이내 상황 전파 및 복구 착수 |
| **Warning** | 성능 저하, 장애 전조, 일부 기능 이상 | 30분 이내 원인 파악 및 조치 |
| **Info** | 추세 공유, 참고성 이벤트 | 상황 공유 및 기록 |

---

## 알림 단계

| 단계 | 의미 | 채널 | 멘션 | 대응 시간 |
|---|---|---|---|---|
| **Critical** | 서비스 장애/중단 위험 | `#alerts-critical` | 운영 멘션 | 5분 이내 |
| **Warning** | 성능 저하, 장애 전조 | `#alerts-warning` | 없음 | 30분 이내 |
| **Info** | 참고성 이벤트, 추세 공유 | `#alerts-info` | 없음 | 확인만 |

보안/감사 이벤트는 `#alerts-security-critical`, `#alerts-security-warning`, `#alerts-security-info` 채널로 분리 운영합니다. `Info`는 기본적으로 실시간 전송 대상에서 제외하고, `Warning`도 사용자 영향 가능성이 높은 항목만 선택적으로 실시간 전송합니다.

---

## 알림 전파 구조

| 영역 | 파이프라인 | 최종 채널 |
|---|---|---|
| **EKS 내부 메트릭/로그** | Prometheus/Loki 룰 → Alertmanager → Discord | 운영 채널 또는 보안/감사 채널 |
| **AWS 리소스 운영 메트릭** | CloudWatch Alarm → SNS/Lambda → Discord | 운영 채널 |
| **AWS 감사/보안 이벤트** | CloudTrail → EventBridge → Lambda → Discord | 보안/감사 채널 |
| **정책 위반** | Policy Reporter → Discord direct | `#alerts-security-info` |
| **노드 상태 / Spot interruption** | 전용 인프라 경로 | `#staging-eks-spot`, `#prod-eks-spot` |

---

## 운영 알림 기준

| 알람 | 조건 | 심각도 | 참고 경로 |
|---|---|---|---|
| **5xx 에러율 증가** | > 1% (5분) / > 3% (5분) | Warning / Critical | Grafana `애플리케이션 모니터링 (Spring Boot)` |
| **응답 지연(P99)** | > 3초 / > 5초 | Warning / Critical | Grafana `애플리케이션 모니터링 (Spring Boot)` |
| **Pod CrashLoop** | 재시작 > 3회 (10분) | Critical | Grafana `K8s 운영 현황판 (Pods)` |
| **Node NotReady** | Ready 아닌 노드 1개 이상 (5분) | Critical | Grafana `K8s 운영 현황판 (k9s 스타일)` |
| **클러스터 CPU 사용률** | > 65% / > 80% | Warning / Critical | Grafana `K8s 운영 현황판 (k9s 스타일)` |
| **클러스터 메모리 사용률** | > 70% / > 90% | Warning / Critical | Grafana `K8s 운영 현황판 (k9s 스타일)` |
| **PostgreSQL 연결 포화** | > 70% / > 90% | Warning / Critical | Grafana `Database - RDS PostgreSQL` |
| **RDS 백업/복구 상태 이상** | Backup 실패, PITR 비활성, 수동 스냅샷 미생성, 최근 PostgreSQL 데이터베이스 보조 백업 부재 | Warning / Critical | Grafana `운영 알람 현황`, CloudWatch |
| **Redis 가용성** | `redis_up = 0` | Critical | Grafana `Cache & Queue - ElastiCache Redis` |
| **Redis 메모리 사용률** | > 80% / > 90% | Warning / Critical | Grafana `Cache & Queue - ElastiCache Redis` |
| **ALB 자체 5xx 응답** | 5분간 5건 이상 | Critical | CloudWatch `ALB` |

---

## 보안/감사 알림 기준

| 알람 | 조건 | 심각도 | 참고 경로 |
|---|---|---|---|
| **매크로/봇 탐지 수** | > 50건 (5분) / > 200건 (5분) | Warning / Critical | Grafana `Lua WAF 보안 정책` |
| **차단 IP 수** | > 100건 (5분) / > 500건 (5분) | Warning / Critical | Grafana `Rate Limit 모니터링` |
| **인증 실패율** | > 30% (5분) / > 50% (5분) | Warning / Critical | Grafana `Loki Kubernetes Logs`, `애플리케이션 모니터링 (Spring Boot)` |
| **WAF 차단 이벤트(403/429)** | > 200건 (15분) / > 1000건 (15분) | Warning / Critical | Grafana `Istio WAF 모니터링`, `Rate Limit 모니터링` |
| **Kyverno 정책 위반** | privileged, latest 태그, 리소스 제한, 필수 라벨, ArgoCD 관리 라벨, probe 위반 감지 | Info | `Policy Reporter UI` |
| **권한/보안 설정 변경** | 루트 계정 로그인, AccessKey 생성/변경, 정책 변경, CloudTrail 비활성 시도, 위험한 보안그룹 변경 | Critical | CloudTrail, CloudWatch, `#alerts-security-critical` |
| **감사 저장소 삭제 이벤트** | 감사 저장소 삭제 또는 고위험 삭제 이벤트 감지 | Warning / Critical | CloudTrail, 감사 보고서, 파기 요약 |

---

## 복구 가능성 알림 기준

| 항목 | 기준 | 단계 | 참고 경로 |
|---|---|---|---|
| **RDS 백업 실패 / PITR 비활성 / 예정된 수동 스냅샷 미생성 / 최근 PostgreSQL 데이터베이스 보조 백업 부재** | 1회 이상 감지 | Warning | Grafana `운영 알람 현황`, CloudWatch |
| **복구 가능성 상실** | PITR 불가, 자동백업 실패 지속, PostgreSQL 데이터베이스 보조 백업 부재 지속 | Critical | Grafana `운영 알람 현황`, CloudWatch |
| **Loki / Tempo S3 저장 이상** | 객체 저장소 접근 실패, 적재 실패 | Warning | Grafana, S3 버킷 |
| **Thanos 장기 메트릭 업로드 이상** | 장기 메트릭 업로드 실패, object storage secret 이상 | Warning | Grafana, S3 버킷 |

---

## 초기 대응 원칙

| 항목 | 기준 |
|---|---|
| **영향 차단 우선** | 원인 분석보다 서비스 영향 최소화와 복구 착수를 먼저 수행 |
| **증거 우선 확보** | 복구 전 장애 시각, 알람 메시지, 로그, 최근 변경점 확보 |
| **신규 복원 후 전환** | 데이터 복구는 기존 인스턴스를 덮어쓰기보다 신규 복원 후 검증·전환을 우선 |
| **선언형 복구** | Pod는 백업 대상이 아니라 GitOps, Helm values, 컨테이너 이미지 기준으로 복구 |
| **예외 보관 유지** | 법정 보존 또는 감사 대상 데이터는 삭제하지 않고 필요 시 예외 보관 적용 |

---

## 장애 대응 절차

![장애 대응 절차](/images/infrastructure/incident-response/02_incident-response.svg?w=60%)

---

## 계층별 복구 기준

| 계층 | 기본 복구 기준 | 확인 항목 |
|---|---|---|
| **애플리케이션** | Kubernetes self-healing, 재스케줄링, GitOps 재적용, 재배포 | Pod 상태, 최근 배포, Helm values, 이미지 태그 |
| **데이터베이스** | RDS Automated Backup + PITR, 수동 스냅샷, 필요 시 신규 복원 후 전환 | PITR 가능 여부, 자동백업 정상 여부, 스냅샷 보유 여부 |
| **보조 백업** | PostgreSQL 데이터베이스 보조 백업 | 최근 성공 시각, Job 실패 여부, 오브젝트 생성 여부 |
| **캐시** | Replica 기반 복구 또는 재구성 | 가용성, 메모리 사용률, eviction, 의존 기능 영향 |
| **관측 저장소** | Loki/Tempo S3 저장, Prometheus 로컬 TSDB + Thanos 장기 메트릭 저장 | 객체 저장소 접근, 장기 데이터 업로드, 적재 상태 |

---

## 초기 점검 항목

| 항목 | 확인 내용 |
|---|---|
| **최초 장애 시각** | 사건번호 기준 시각 확보 |
| **관련 알람 메시지** | Discord 알림, Alertmanager 또는 AWS 네이티브 경로 확인 |
| **최근 배포 변경점** | ArgoCD Sync 이력, GitHub 반영 내역 확인 |
| **애플리케이션 로그** | 오류 패턴, 공통 예외, 배포 직후 변화 확인 |
| **인프라 이벤트** | 노드, 오토스케일링, 네트워크, Redis 상태 확인 |
| **데이터 상태** | PostgreSQL 연결률, 슬로우 쿼리, PITR 가능 여부 확인 |
| **보안/감사 이벤트** | CloudTrail, EventBridge, WAF 이벤트 확인 |

---

## 장애 종료 기준

| 항목 | 기준 |
|---|---|
| **서비스 정상화** | 핵심 기능이 정상 응답하고 사용자 영향이 해소됨 |
| **지표 회복** | 5xx, P99, DB 연결률, Redis 상태 등 핵심 지표가 기준선으로 복귀 |
| **복구 가능성 확보** | PITR, 자동백업, 수동 스냅샷, PostgreSQL 데이터베이스 보조 백업 상태가 정상으로 확인됨 |
| **증적 확보** | 장애 시각, 로그, 알림, 변경 이력, 영향 범위가 정리됨 |
| **후속 작업 등록** | 원인 분석과 재발 방지 항목이 티켓 또는 GitHub 작업으로 남겨짐 |
