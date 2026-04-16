# 로그/백업/보관 정책

Playball은 운영 로그, 감사 로그, 장기보관 증적 데이터, 운영 DB 복구 백업을 서로 다른 목적으로 분리해 관리합니다.

---

## 보관 구조

![보관 구조](/images/infrastructure/log-backup-policy/01_log-backup-policy.svg?w=67%)

---

## 로그 수집 원칙

| 항목 | 기준 |
|---|---|
| **로그 레벨** | `ERROR`, `WARN` 전량 수집, `INFO`는 핵심 운영 이벤트만 수집 |
| **비활성 레벨** | Staging / Prod `DEBUG`, `TRACE` 비활성화 |
| **INFO 수집 범위** | 대기열 진입, READY 승격, Hold 성공/실패/만료, 주문 생성, 결제 성공/실패/취소/환불, 무통장 입금 발급 및 기한 만료, 추천 degrade / fallback |
| **제외 범위** | 시드 데이터 초기화 로그, 단순 조회 로그, SQL 출력 로그, 상세 프레임워크 디버그 로그 |
| **민감정보 처리** | 비밀번호, 카드번호, 계좌번호, 주민번호, 토큰/JWT는 저장하지 않고, 식별자는 마스킹 또는 가명처리 |

---

## 분류 기준

| 구분 | 포함 대상 | 운영 목적 |
|---|---|---|
| **운영 로그** | 인프라 로그, 서비스 로그, Trace, 메트릭 장기 블록 | 장애 분석, 운영 추적, 포스트모템 |
| **감사 로그** | CloudTrail, 감사 보고서, 파기 요약, 접속기록 | 변경 이력 추적, 감사 대응, 포렌식 |
| **장기보관 증적 데이터** | 회원 장기보관 증적, 거래/정산 법정증적 | 정책/법정 보존 |
| **운영 DB 복구 백업** | RDS Automated Backup + PITR, 수동 스냅샷, PostgreSQL 데이터베이스 보조 백업 | 운영 데이터 복구 |

---

## 운영 보관 기준

| 데이터 유형 | 저장 위치 | Hot | Warm | Cold | 비고 |
|---|---|---|---|---|---|
| **인프라 로그** | Loki + S3 관측 저장소 | 3일 | S3 보관 | 미적용 | 1차 RCA, 포스트모템 |
| **서비스 로그** | Loki + S3 관측 저장소 | 14일 | S3 보관 | 미적용 | 배포 후 오류, 문의 대응 |
| **Trace 데이터** | Tempo + S3 관측 저장소 | 7일 | S3 보관 | 미적용 | 분산 추적 확인 |
| **메트릭 장기 데이터** | Prometheus + Thanos + S3 관측 저장소 | Prometheus 로컬 TSDB | S3 180일 | S3 Glacier 90일 전환 | 장기 메트릭 조회 |
| **결제/예매 증적 로그** | Loki + S3 운영 백업 저장소 | 30일 | S3 90일 | 미적용 | 운영 검색, 단기 재조사 |
| **일반 감사로그** | S3 감사 저장소 + S3 Glacier Flexible Retrieval | 해당 없음 | S3 30일 | Glacier Flexible Retrieval 전환 후 총 400일 | CloudTrail, 감사 보고서, 파기 요약 |
| **개인정보처리시스템 접속기록** | S3 감사 저장소 + S3 Glacier Flexible Retrieval | 해당 없음 | S3 30일 | Glacier Flexible Retrieval 전환 후 총 2년 | 관리자/운영자 접근 이력 |
| **회원 장기보관 증적 데이터** | S3 아카이브 저장소 + S3 Glacier Deep Archive | 해당 없음 | S3 30일 | Glacier Deep Archive 전환 후 총 3년 | 회원 상태변경, 동의, 탈퇴, 제재, 민원 최소 증적 |
| **거래/정산 법정증적 데이터** | S3 아카이브 저장소 + S3 Glacier Deep Archive | 해당 없음 | S3 30일 | Glacier Deep Archive 전환 후 총 5년 | 주문, 예매, 결제, 취소, 환불, 정산, 세무 증빙 |
| **PostgreSQL 보조 백업** | S3 운영 백업 저장소 | 해당 없음 | 14일 | 미적용 | 장기보관, 이관, 수동 복구 보조 |

---

## 저장소 구조

| 저장소 | 저장 대상 | 용도 | 실제 버킷 |
|---|---|---|---|
| **S3 운영 백업 저장소** | PostgreSQL 데이터베이스 보조 백업, 운영 로그 백업 | 운영 복구와 단기 재조사 | `playball-web-backup` |
| **S3 감사 저장소** | 감사 로그, 접속기록, 파기 이력 | 감사 추적 및 포렌식 | `playball-audit-logs`, `playball-prod-ai-audit`, `playball-staging-ai-audit` |
| **S3 Glacier 장기보관 저장소** | 회원/거래 장기보관 데이터 | 정책/법정 보존 데이터 | `playball-retention-archive` |
| **S3 관측 저장소** | Loki 로그, Tempo Trace, Thanos 메트릭 장기 데이터 | 관측 데이터 장기 저장 | `playball-{prod,staging}-{loki,tempo,thanos,clickhouse}` |

**예시) 실제 운영 중인 S3 버킷 구성**

> AWS 콘솔에서 조회한 Playball의 S3 General Purpose Bucket 목록입니다. 4가지 저장 목적(운영 백업 / 감사 / 장기보관 / 관측)에 따라 네이밍과 환경(`prod` / `staging`) 접두사로 버킷을 분리해 Lifecycle·권한·접근 통제를 독립적으로 관리합니다.

![AWS S3 Console – 저장소 구성](/images/infrastructure/log-backup-policy/aws-console-backup-env.png)

---

## 운영 기준

- 운영 로그는 장애 분석과 단기 재조사를 위한 구간으로 관리합니다.
- 감사 로그와 접속기록은 운영 로그와 분리해 장기 보관합니다.
- 회원 증적과 거래/정산 증적은 운영 DB가 아니라 아카이브 저장소를 기준으로 보관합니다.
- RDS 기본 복구 수단은 Automated Backup + PITR입니다.
- 수동 스냅샷은 대규모 변경 전 보호 기준으로 사용합니다.
- PostgreSQL 데이터베이스 보조 백업은 장기보관, 이관, 수동 복구를 위한 보조 백업입니다.

---

## 백업 및 아카이브 스케줄

| 구분 | KST | 대상 |
|---|---|---|
| **운영 DB 보조 백업** | 02:00~02:30 | PostgreSQL 데이터베이스 보조 백업 |
| **인프라 로그 백업** | 03:10 | 인프라 로그 |
| **서비스 로그 백업** | 03:20 | 서비스 로그 |
| **결제/예매 증적 로그 백업** | 03:30 | 운영 검색 및 단기 재조사 로그 |
| **회원 장기보관 적재** | 03:40 | 회원 장기보관 증적 데이터 |
| **거래/정산 법정증적 적재** | 03:50 | 주문, 예매, 결제, 취소, 환불, 정산, 세무 증빙 |
| **매니페스트 생성** | 04:00 | 장기보관 적재 검증 |

---

## 파기 기준

**예시) `playball-retention-archive` 버킷 Lifecycle 정책**

> 회원 상태·민원·탈퇴 증적과 주문·결제·정산 법정 증빙은 `playball-retention-archive` 버킷에 **prefix 단위로 분리 저장**합니다. 각 prefix는 아래 Lifecycle 정책으로 S3 Standard에서 30일 뒤 **Glacier Deep Archive**로 자동 전환되고, 법정 보존기간이 도달하면 **Expiration 규칙으로 자동 삭제(파기)**됩니다. 즉 "최소 비용 저장 + 법정 보존 만료 = 자동 파기"가 한 벌의 Lifecycle로 집행됩니다.

| Prefix | 저장 대상 | 전환 | 만료(자동 파기) | 법적 근거 |
|---|---|---|---|---|
| `member-retention/` | 회원 상태변경·동의·탈퇴·제재·민원 증적 | 30일 → Deep Archive | **3년 (1,095일)** | 회원 분쟁/민원 대응 최소 보존 |
| `member-retention-manifest/` | 회원 증적 적재 매니페스트 (무결성 검증용) | 30일 → Deep Archive | 3년 | 원본과 동기 파기 |
| `commerce-retention/` | 주문·예매·결제·취소·환불·정산·세무 증빙 | 30일 → Deep Archive | **5년 (1,825일)** | 전자상거래법·국세기본법 증빙 보존 |
| `commerce-retention-manifest/` | 거래 증적 적재 매니페스트 | 30일 → Deep Archive | 5년 | 원본과 동기 파기 |

![playball-retention-archive Lifecycle Rules](/images/infrastructure/log-backup-policy/aws-console-retention-archive-lifecycle.png)

| 항목 | 기준 | 이유 |
|---|---|---|
| **운영 로그** | Loki 보관기간 종료 후 자동 만료, S3 백업은 Lifecycle 기준으로 자동 삭제 | 장애 분석과 단기 재조사 구간만 확보하면 되기 때문 |
| **일반 감사로그** | 총 400일 보관 후 자동 삭제 | 연간 감사 대응에 운영 여유 구간을 더한 기준 |
| **개인정보처리시스템 접속기록** | 총 2년 보관 후 자동 삭제 | 법정 최소 기준과 운영 리스크를 함께 반영한 기준 |
| **회원 장기보관 증적 데이터** | 총 3년 보관 후 자동 삭제 | 회원 상태 변경과 민원 대응에 필요한 사후 증적 구간 확보 |
| **거래/정산 법정증적 데이터** | 총 5년 보관 후 자동 삭제 | 전자상거래 및 회계 증빙 보존 기준 반영 |
| **예외 보관** | 법적 분쟁, 감사 대응, 보안 조사, 민원 처리 등 사유가 있으면 별도 예외 보관 기준으로 삭제 유예 | 일반 수명주기와 분리해 조사와 분쟁 대응을 유지하기 위함 |
| **파기 이력** | S3 Lifecycle 전환/만료 이벤트를 CloudTrail Data Events와 EventBridge로 수집하고, Lambda 일일 요약을 감사 버킷에 저장 | 삭제 자체도 감사 추적 대상이기 때문 |

---

## 점검 항목

| 항목 | 확인 내용 |
|---|---|
| **Loki/Tempo/Thanos** | S3 저장과 장기 데이터 업로드가 정상인지 |
| **RDS 복구 준비도** | PITR 가능 상태, 자동백업 정상 여부, 예정된 수동 스냅샷 생성 여부 |
| **데이터베이스 보조 백업** | 최근 PostgreSQL 데이터베이스 보조 백업 성공 시각과 오브젝트 생성 여부 |
| **감사 저장소** | CloudTrail 수집, Digest 무결성, 파기 요약 적재 여부 |
| **장기보관 증적** | 회원/거래 장기보관 데이터 적재 누락 여부 |
