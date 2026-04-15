# 로그/백업 정책

Prod 기준은 운영 로그, 감사 로그, 장기보관 증적 데이터, 운영 DB 복구 백업을 서로 다른 목적으로 분리해 관리합니다.

---

## 분류 기준

| 구분 | 포함 대상 | 운영 목적 |
|---|---|---|
| **운영 로그** | 인프라 로그, 서비스 로그, Trace, 메트릭 장기 블록 | 장애 분석, 운영 추적, 포스트모템 |
| **감사 로그** | CloudTrail, 감사 보고서, 파기 요약, 접속기록 | 변경 이력 추적, 감사 대응, 포렌식 |
| **장기보관 증적 데이터** | 회원 장기보관 증적, 거래/정산 법정증적 | 정책/법정 보존 |
| **운영 DB 복구 백업** | RDS Automated Backup + PITR, 수동 스냅샷, `pg_dump -> S3` | 운영 데이터 복구 |

---

## Prod 보관 기준

| 데이터 유형 | 저장 위치 | Hot | Warm | Cold | 비고 |
|---|---|---|---|---|---|
| **인프라 로그** | Loki(S3 backend) | 3일 | S3 backend 내 보관 | 미적용 | 1차 RCA, 포스트모템 |
| **서비스 로그** | Loki(S3 backend) | 14일 | S3 backend 내 보관 | 미적용 | 배포 후 오류, 문의 대응 |
| **Trace 데이터** | Tempo(S3 backend) | 7일 | S3 backend 내 보관 | 미적용 | 분산 추적 확인 |
| **메트릭 장기 블록** | Prometheus + Thanos(S3) | Prometheus 로컬 TSDB | Thanos S3 180일 | Glacier 90일 전환 | 장기 메트릭 조회 |
| **결제/예매 증적 로그** | Loki + S3 Archive | 30일 | 90일 | 미적용 | 운영 검색, 단기 재조사 |
| **일반 감사로그** | `{prefix}-audit-logs/cloudtrail/`, `audit-reports/` | 해당 없음 | S3 30일 | Glacier Flexible Retrieval 전환 후 총 400일 | CloudTrail, 감사 보고서, 파기 요약 |
| **개인정보처리시스템 접속기록** | `{prefix}-audit-logs/pis-access/` | 해당 없음 | S3 30일 | Glacier Flexible Retrieval 전환 후 총 2년 | 관리자/운영자 접근 이력 |
| **회원 장기보관 증적 데이터** | `{prefix}-archive/member-retention/` | 해당 없음 | S3 30일 | Glacier Deep Archive 전환 후 총 3년 | 회원 상태변경, 동의, 탈퇴, 제재, 민원 최소 증적 |
| **거래/정산 법정증적 데이터** | `{prefix}-archive/commerce-retention/` | 해당 없음 | S3 30일 | Glacier Deep Archive 전환 후 총 5년 | 주문, 예매, 결제, 취소, 환불, 정산, 세무 증빙 |
| **PostgreSQL 보조 백업** | `{prefix}-backup/prod/postgres/` | 해당 없음 | 14일 | 미적용 | 장기보관, 이관, 수동 복구 보조 |

---

## 저장소 구조

| 저장소 | 주요 경로 | 용도 |
|---|---|---|
| **운영 백업 버킷** | `{prefix}-backup/prod/postgres/` | PostgreSQL dump 백업 |
| **감사 전용 버킷** | `{prefix}-audit-logs/cloudtrail/`, `cloudtrail-digest/`, `pis-access/`, `audit-reports/`, `lifecycle-expiration-summary/` | 감사 로그, 접속기록, 파기 이력 |
| **장기보관 아카이브 버킷** | `{prefix}-archive/member-retention/`, `commerce-retention/`, `legal-hold/` | 정책/법정 보존 데이터 |
| **관측 로그 버킷** | `{prefix}-prod-loki/prod/`, `{prefix}-prod-tempo/prod/`, `{prefix}-prod-thanos/prod/` | Loki, Tempo, Thanos 객체 저장소 |

---

## 운영 기준

- 운영 로그는 장애 분석과 단기 재조사를 위한 구간으로 관리합니다.
- 감사 로그와 접속기록은 운영 로그와 분리해 장기 보관합니다.
- 회원 증적과 거래/정산 증적은 운영 DB가 아니라 아카이브 저장소를 기준으로 보관합니다.
- RDS 기본 복구 수단은 Automated Backup + PITR입니다.
- 수동 스냅샷은 대규모 변경 전 보호 기준으로 사용합니다.
- `pg_dump -> S3`는 장기보관, 이관, 수동 복구를 위한 보조 백업입니다.

---

## 점검 항목

| 항목 | 확인 내용 |
|---|---|
| **Loki/Tempo/Thanos** | S3 backend 또는 block 업로드가 정상인지 |
| **RDS 복구 준비도** | PITR 가능 상태, 자동백업 정상 여부, 예정된 수동 스냅샷 생성 여부 |
| **Dump 백업** | 최근 `pg_dump -> S3` 성공 시각과 오브젝트 생성 여부 |
| **감사 저장소** | CloudTrail 수집, Digest 무결성, 파기 요약 적재 여부 |
| **장기보관 증적** | member-retention, commerce-retention 적재 누락 여부 |
