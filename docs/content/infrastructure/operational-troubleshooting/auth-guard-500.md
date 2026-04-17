# Auth-Guard 500 복구

> **분류**: 인증·데이터베이스 · **환경**: Staging EKS · **상태**: ✅ 해결

## 증상

- Auth-Guard의 사용자 생성·저장 구간에서 `500` 에러가 발생함
- 인증 관련 API는 살아 있었지만, 데이터베이스 쓰기 구간에서 요청이 실패함

## 원인

- 데이터베이스 스키마 소유자(`goormgb_admin`)와 애플리케이션 계정(`playball_user`)이 분리되어 있었음
- 테이블 권한만으로는 `BIGSERIAL` 기반 시퀀스(sequence, 자동 증가 번호를 만드는 DB 객체)를 사용하는 `INSERT`를 정상 처리할 수 없었음
- `playball_user`에 시퀀스 `USAGE`, `SELECT` 권한이 빠져 있어 Auth-Guard 쓰기 경로가 `500`으로 실패함
- 새로 생성되는 테이블·시퀀스에 대한 기본 권한도 자동 적용되지 않는 상태였음

## 해결

- `playball_user`에 테이블 `SELECT`, `INSERT`, `UPDATE`, `DELETE` 권한을 명시적으로 부여함
- 모든 시퀀스에 `USAGE`, `SELECT` 권한을 추가함
- `ALTER DEFAULT PRIVILEGES`를 적용해 이후 생성되는 테이블·시퀀스에도 동일 권한이 자동 반영되도록 정리함
- `IF EXISTS` 조건을 넣어 로컬 환경처럼 `playball_user`가 없는 경우에도 스키마 초기화가 실패하지 않도록 수정함

## 관측 결과

- Auth-Guard의 데이터베이스 쓰기 경로가 정상화되어 `500` 오류가 재발하지 않음
- 애플리케이션 계정 권한과 스키마 초기화 기준이 함께 정리되어 배포 이후 동일 유형의 권한 누락 가능성이 줄어듦

## 향후 모니터링

- Auth-Guard 5xx 비율과 인증 API 오류 로그를 우선 확인
- 스키마 변경 또는 시드 데이터 수정 이후 시퀀스 권한이 정상 반영되는지 점검
- 신규 테이블·시퀀스 생성 후 `playball_user` 기본 권한 적용 여부를 배포 점검 항목에 포함

## 참조

- `c2a5a4e` `fix: playball_user 시퀀스 권한 누락으로 인한 auth-guard 500 에러 수정`
- `/Users/vita/Desktop/techup/grgb/302-goormgb-k8s-bootstrap/db/01-schema.sql`

---

[← 트러블슈팅 인덱스로](../operational-troubleshooting)
