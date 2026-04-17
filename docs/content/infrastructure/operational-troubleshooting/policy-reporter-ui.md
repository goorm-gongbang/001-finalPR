# Policy Reporter UI 복구

> **분류**: 보안 관측·접근 · **환경**: Staging EKS · **상태**: ✅ 해결

## 증상

- Policy Reporter UI 접속 시 `Connection Refused`, `503`, TLS 오류가 반복됨
- OAuth 프록시를 경유한 접근 경로가 불안정해 정책 위반 화면을 정상적으로 확인할 수 없었음
- 일부 시점에는 `policy-reporter-oauth-proxy` 파드가 스케줄링되지 않아 로그인 이후 화면 진입이 막혔음

## 원인

- Policy Reporter UI 컨테이너 이미지와 실행 인자가 현재 UI 버전 기준과 맞지 않았음
- UI v3 포트가 `8082`인데, 서비스와 헬스 체크 기준이 다른 값으로 남아 있었음
- `policy-reporter` 서비스가 OAuth 프록시 포트(`4180`)를 명시적으로 바라보지 않았음
- 프록시 서비스 셀렉터 라벨이 맞지 않아 `503`이 발생했음
- Istio mTLS 적용 상태에서 `policy-reporter-ui`와 OAuth 서비스 간 통신에 대한 예외 규칙이 없어 TLS 오류가 발생했음
- `policy-reporter-oauth-proxy`의 노드 선택기와 테인트 허용 설정이 부족해 스케줄링 오류가 발생했음

## 해결

- Policy Reporter UI 이미지를 `ghcr.io/kyverno/policy-reporter:3.7.3`으로 올리고 `run-ui` 인자를 추가함
- UI v3 기준 포트 `8082`와 헬스 체크 경로를 맞춤
- `policy-reporter` 서비스에 OAuth 프록시 포트 `4180`을 명시적으로 연결함
- 프록시 서비스 셀렉터 라벨을 수정해 `503` 경로를 정리함
- `policy-reporter-route`에 `DestinationRule`을 추가해 필요한 구간에서 mTLS를 비활성화함
- `policy-reporter-oauth-proxy` 배포에 노드 선택기와 테인트 허용을 보완해 파드 스케줄링을 정상화함

## 관측 결과

- Policy Reporter UI가 정상 응답하며 정책 위반 화면과 로그인 경로가 안정적으로 열림
- OAuth 프록시 경유 접속이 정상화되어 보안 관측 화면 접근이 가능해짐
- UI 포트, 서비스 연결, mTLS 예외, 파드 스케줄링까지 함께 정리되면서 동일 증상이 반복되지 않는 상태로 복구됨

## 향후 모니터링

- `policy-reporter-ui`, `policy-reporter-oauth-proxy` 파드의 Ready 상태와 재시작 여부 확인
- 로그인 경로 4xx/5xx, 서비스 응답 오류, TLS 오류 로그를 우선 확인
- Kyverno 정책 위반 발생 시 Policy Reporter UI와 Discord 알림이 함께 정상 동작하는지 확인

## 참조

- `70365d4c` `fix: policy-reporter TLS_error 해결을 위한 DestinationRule 추가`
- `3f93eaee` `fix: policy-reporter-ui-proxy 서비스 셀렉터 라벨 수정 (503 에러 해결)`
- `dbbe590f` `fix: policy-reporter 서비스가 oauth2-proxy 포트(4180)를 바라보도록 targetPort 명시`
- `006f1e56` `fix: policy-reporter UI 이미지 주소를 ghcr.io/kyverno/policy-reporter:3.7.3으로 수정 및 run-ui 인자 추가`
- `ab2a14b6` `fix: policy-reporter UI v3 포트(8082) 반영 및 헬스 체크 정상화`
- `c31d04ba` `fix: policy-reporter-oauth-proxy 스케줄링 에러 해결 (노드 선택기 및 테인트 허용 수정)`
- `846e767b` `fix: policy-reporter-oauth-svc에 대한 DestinationRule(mTLS DISABLE) 추가로 TLS 에러 해결`

---

[← 트러블슈팅 인덱스로](../operational-troubleshooting)
