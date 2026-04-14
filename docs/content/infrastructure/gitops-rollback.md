# 배포 복구 검증

## 1. 테스트 개요

- 테스트명: `staging api-gateway order-core URL 오기입 복구 테스트`
- 수행 일자: `2026-04-14`
- 대상 환경: `staging`
- 대상 서비스: `api-gateway`
- 테스트 목적:
  - 잘못된 upstream URL 반영 시 실제 요청 실패가 발생하는지 확인하였습니다.
  - 모니터링 알람 명세서 기준 `HTTP 5xx` 경고 알람이 발송되는지 확인하였습니다.
  - 정상 설정 재반영을 통한 GitOps 롤백이 동작하는지 확인하였습니다.

## 2. 테스트 시나리오

- 변경 파일: `ca-staging/values/apps/values-api-gateway.yaml`
- 변경 항목: `ORDER_CORE_URL`

정상 설정:

```yaml
ORDER_CORE_URL: http://order-core.staging-webs.svc.cluster.local:8083
```

장애 유발 설정:

```yaml
ORDER_CORE_URL: http://order-core.staging-webs.svc.cluster.local:18083
```

복구 설정:

```yaml
ORDER_CORE_URL: http://order-core.staging-webs.svc.cluster.local:8083
```

시나리오 선택 이유:

- `api-gateway`는 사용자 요청이 실제로 진입하는 서비스라 장애 영향 설명이 명확합니다.
- `ORDER_CORE_URL` 오기입은 데이터 변경 없이 `HTTP 500`을 재현할 수 있어 리스크가 낮습니다.
- 알람 명세서의 `HTTP 5xx` 경고 조건과 직접 연결되어 알람 발송 여부를 확인하기 적합합니다.
- 정상 값 재반영만으로 복구가 가능해 GitOps 롤백 흐름을 검증하기 쉽습니다.

## 3. 커밋 및 시각 기록

- 대상 리포지토리: `303-goormgb-k8s-helm`
- 배포 브랜치: `argocd-sync/ca-staging`

| 구분 | 커밋 해시 | 시각(KST) | 비고 |
|---|---|---|---|
| 정상 기준 커밋 | `e077de14` | 2026-04-14 19:19:23 | 테스트 시작 전 정상 기준점 |
| 장애 유발 커밋 | `0dd0097a` | 2026-04-14 20:11:19 | `test(ca-staging): api-gateway order-core URL 오기입 반영` |
| 최초 요청 실패 확인 | - | 2026-04-14 20:13:12 | `/order/clubs` 호출 시 `HTTP 500` 확인 |
| 복구 커밋 | `63f66245` | 2026-04-14 20:14:14 | `fix(ca-staging): api-gateway order-core URL 원복` |
| 경고 알람 발생 | - | 2026-04-14 20:14:43 | `StagingHttp5xxWarning` Discord 발송 |
| 서비스 복구 확인 | - | 2026-04-14 20:16:00 | `/order/clubs` 호출 시 `HTTP 200` 확인 |
| 경고 알람 복구 | - | 2026-04-14 20:20:43 | `StagingHttp5xxWarning` Discord 복구 발송 |

## 4. 수행 절차 요약

1. `staging` 환경의 `api-gateway`, `order-core`, ArgoCD 상태를 정상 기준으로 확인하였습니다.
2. `ORDER_CORE_URL`을 `8083 -> 18083`으로 변경하였습니다.
3. 장애 유발 커밋을 생성하고 staging 배포 브랜치(`argocd-sync/ca-staging`)에 push하였습니다.
4. `/order/clubs` 요청이 `HTTP 500`으로 실패하는 것을 확인하였습니다.
5. Discord 채널에서 `StagingHttp5xxWarning` 경고 발송을 확인하였습니다.
6. `ORDER_CORE_URL`을 다시 `8083`으로 원복하였습니다.
7. 복구 커밋을 생성하고 staging 배포 브랜치(`argocd-sync/ca-staging`)에 push하였습니다.
8. `/order/clubs` 요청이 다시 `HTTP 200`으로 복구된 것을 확인하였습니다.
9. Discord 채널에서 `StagingHttp5xxWarning` 복구 메시지를 확인하였습니다.

## 5. 관측 결과

> 비용 제약으로 spot 기반 환경에서 테스트하여 증적 캡처 시점과 테스트 시각이 완벽하게 일치하지 않을 수 있습니다.

### 5.1 서비스 동작 결과

- 정상 상태에서 `/order/clubs` 호출 결과는 `HTTP 200`이었습니다.
- 장애 유발 후 `/order/clubs` 호출 결과는 `HTTP 500`이었습니다.
- 복구 후 `/order/clubs` 호출 결과는 다시 `HTTP 200`이었습니다.

### 5.2 Grafana 관측 결과

- Grafana 화면에서는 `5xx` 흔적과 `order-core` 관련 에러 경로를 확인하였습니다.

![Grafana 5xx 발생 흔적](/images/infrastructure/recovery-test/01_grafana_5xx발생.png)

![Grafana 5xx 흔적](/images/infrastructure/recovery-test/02_grafana_5xx흔적.png)

### 5.3 알람 관측 결과

- 경고 알람명: `StagingHttp5xxWarning`
- 서비스: `staging-api-gateway`
- 상태코드: `500`
- Discord 경고 발생 시각: `2026-04-14 20:14:43 KST`
- Discord 경고 복구 시각: `2026-04-14 20:20:43 KST`

> 알람 룰은 `increase(...[5m]) > 0` 조건을 사용하고 있습니다. 단발성 오류에 과도하게 반응하지 않도록 최근 5분 집계를 기준으로 경고 신뢰성을 유지하기 위해 의도된 설정입니다.

![Discord 5xx 알람](/images/infrastructure/recovery-test/07_discord_5xx알람.png)

### 5.4 Kubernetes / ArgoCD 관측 결과

- 이번 케이스는 배포 실패가 아니라 잘못된 설정 반영으로 인한 요청 실패였습니다.
- ArgoCD 화면에서는 장애 상태보다는 반영된 revision과 원복 커밋 이력을 확인하였습니다.
- `History and rollback` 화면과 sync 상태 화면을 기준으로 장애 유발 커밋과 복구 커밋 흐름을 확인하였습니다.

![ArgoCD 커밋 이력](/images/infrastructure/recovery-test/04_argocd_히스토리.png)

![ArgoCD sync 상태 - 장애 유발 커밋 반영 후](/images/infrastructure/recovery-test/05_argocd_장애커밋반영.png)

![ArgoCD sync 상태 - 복구 커밋 반영 후](/images/infrastructure/recovery-test/06_argocd_복구커밋반영.png)

## 6. 성공 기준 충족 여부

| 항목 | 결과 | 판단 |
|---|---|---|
| 잘못된 설정 반영 확인 | `ORDER_CORE_URL`이 `18083`으로 반영됨 | 충족 |
| 실제 요청 실패 확인 | `/order/clubs` 호출 시 `HTTP 500` 확인 | 충족 |
| 경고 알람 발송 확인 | `StagingHttp5xxWarning` Discord 발생 확인 | 충족 |
| 정상 값 재반영 후 복구 | 복구 커밋 반영 후 `ORDER_CORE_URL` 정상화 | 충족 |
| 최종 정상 상태 회복 | `/order/clubs` 응답 `HTTP 200` 및 Discord 복구 메시지 확인 | 충족 |

## 7. 결론

이번 테스트에서는 `staging` 환경에서 `api-gateway`의 `ORDER_CORE_URL`을 잘못 반영한 뒤, 실제 요청 실패와 `HTTP 5xx` 경고 알람 발생 여부를 확인하였습니다.

테스트 결과 `/order/clubs` 요청은 `HTTP 500`으로 실패하였고, Discord 경고 채널에서 `StagingHttp5xxWarning` 알람이 발송되었습니다. 이후 정상 `ORDER_CORE_URL`을 다시 반영하는 GitOps 롤백을 수행한 뒤 `/order/clubs` 응답은 `HTTP 200`으로 복구되었으며 Discord 복구 메시지도 확인하였습니다.

따라서 Playball 서비스는 `api-gateway`의 upstream 설정 오류에 대해 `HTTP 5xx` 기준으로 장애를 감지하고 GitOps 롤백으로 복구할 수 있음을 확인하였습니다.
