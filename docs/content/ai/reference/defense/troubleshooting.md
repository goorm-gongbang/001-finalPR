# 방어 설계 트러블슈팅

## 목차

1. [기존 CAPTCHA의 한계와 VQA 재설계](#1-기존-captcha의-한계와-vqa-재설계)
2. [Telemetry ingest와 evaluate 경로 분리](#2-telemetry-ingest와-evaluate-경로-분리)
3. [ext_authz 기반 공통 enforcement 계층 도입](#3-ext_authz-기반-공통-enforcement-계층-도입)
4. [실행·보관·분석·권위 저장소 분리](#4-실행보관분석권위-저장소-분리)

---

## 1. 기존 CAPTCHA의 한계와 VQA 재설계

### 문제

초기에는 일반 CAPTCHA나 단순 challenge로도 봇을 어느 정도 걸러낼 수 있다고 볼 수 있었다. 그러나 이 시스템의 전제는 단순 스크립트가 아니라 브라우저를 직접 조작하고 시각 정보를 해석할 수 있는 고지능 자동화까지 방어하는 것이었다.

### 왜 단순 대안이 안 됐는가

| 기각 이유 | 구체적 문제 |
|------|------|
| OCR형·단일 클릭형 CAPTCHA | 멀티모달 모델·OCR 결합 자동화 환경에서 방어력이 빠르게 약해짐. "정답 제출"만 요구하는 challenge는 원칙적으로 풀 수 있다 |
| 추가 evidence 부재 | 이미 마우스 telemetry 기반 riskScore 계산 구조를 채택한 상황에서, 단순 정답 검증 장치는 판단에 쓸 수 있는 추가 행동 데이터를 거의 주지 못함 |

### 선택

challenge를 단순 정답 검증이 아닌, 시간 제한 + 복합 행동 + telemetry 수집이 동시에 이루어지는 VQA 인터랙션으로 재설계했다.

| 설계 기준 | 이유 |
|------|------|
| 시간 제한 | 레이턴시 자체를 공격 표면으로 활용. 고지능 모델도 시간 내 수행이 보장되지 않는다 |
| 복합 행동 (클릭·드래그·홀드·타이밍) | 자동화 난도를 단일 행동보다 구조적으로 높임 |
| challenge 중 telemetry 수집 | challenge 과정 자체가 AI Runtime 판단의 추가 evidence source가 됨 |
| 서비스 컨셉 연결 (야구 Catch Ball) | UX 자연스러움과 보안 요구 동시 충족 |

### 결과

VQA는 UI 요소가 아니라 실시간 방어 파이프라인 안에서 보안 검증 + 행동 telemetry 수집 + 마찰 비용 부과를 결합한 보안 장치로 설계됐다. 정상 사용자에게는 회복 경로를 제공하고, 자동화에는 추가 수행 비용을 부과하는 고가치 관문이 되었다.

### 남은 한계

구조 전체가 프론트 telemetry 품질에 의존한다. telemetry 누락, 브라우저 이벤트 수집 실패, 저사양·모바일 환경에서의 입력 왜곡은 오탐 또는 challenge 실패 가능성을 남긴다.

---

## 2. Telemetry ingest와 evaluate 경로 분리

### 문제

VQA와 행동 기반 방어를 설계하면서 프론트 telemetry(마우스 raw event/요약)를 AI Runtime에 전달해야 했다. 처음에는 보호 API 앞단에서 호출되는 `/ai/evaluate`에 telemetry를 함께 실어 보내는 방식을 떠올렸다.

### 왜 단순 대안이 안 됐는가

| 기각 이유 | 구체적 문제 |
|------|------|
| business API 계약 | backend critical API의 DTO·헤더를 AI 연동을 위해 변경하면 안 됨 |
| ext_authz 경로 책임 | `/ai/evaluate`는 "지금 이 요청을 허용할지"를 빠르게 판단하는 판정 경로. telemetry 수신은 ingest 성격으로 책임이 다름 |
| body coupling | Adapter가 원요청 body + raw telemetry를 동시에 처리하면 buffering·정규화 부담이 ext_authz 경로에 생기고 기존 인증/인가 구조와 충돌 |

### 선택

AI 연동을 목적 기준으로 3종류로 분리했다.

| 경로 | 호출 주체 | 특성 |
|------|------|------|
| `POST /ai/precheck/queue-enter` | 프론트 | 동기. queue enter 직전 선행 검사 |
| `POST /ai/telemetry/ingest` | 프론트 | 비동기. stage 전환 시점·보호 API 직전 preflight flush |
| `POST /ai/evaluate` | Adapter (ext_authz 내부) | 동기. body로 telemetry를 받지 않고 runtime state에서 최신 telemetry 조회 |

한 줄 요약: telemetry는 FE → AI direct ingest, evaluate는 Adapter → AI 내부 판정, business API는 그대로.

### 결과

- business API DTO 수정 없음
- ext_authz 경로를 판정 전용으로 단순화
- 프론트는 보호 API 직전 preflight flush만 수행
- evaluate 호출 시점엔 runtime state에 최신 telemetry가 이미 반영된 상태

### 남은 한계

ingest와 evaluate가 정확히 같은 타이밍에 일어나지 않는다. 직전 flush까지의 telemetry가 반영된다는 보장이 preflight flush 성공에 달려 있어, flush 누락 시 최신성이 깨질 수 있다. preflight flush가 선택 사항이 아닌 필수 설계 요소인 이유가 여기에 있다.

---

## 3. ext_authz 기반 공통 enforcement 계층 도입

### 문제

AI 판단을 critical API(queue enter, seat entry, block 조회, seat hold)에만 선택적으로 적용해야 했다. 방어 로직을 어디에 삽입할 것인가가 문제였다.

### 왜 단순 대안이 안 됐는가

| 대안 | 문제 |
|------|------|
| 각 backend API 내부에서 직접 AI 호출 | 비즈니스 서비스 전반에 AI 의존이 침투. API별 중복 코드, 정책 변경 시 전체 수정 필요, 응답 규격 통일 어려움 |
| FE가 보호 API 전에 `/ai/evaluate` 직접 호출 | 신뢰 경계 붕괴. 허용/차단 결정은 서버 인프라 레벨에서 강제되어야 한다. FE가 먼저 물어보고 따르는 구조는 우회 가능성을 열어둠 |

### 선택

Envoy ext_authz + Authz Adapter + AI Runtime 3계층 구조.

| 레이어 | 역할 |
|------|------|
| Envoy ext_authz | critical API 요청 공통 가로채기 |
| Adapter | 원요청 → AI가 이해할 수 있는 최소 DTO 정규화 |
| AI Runtime `/ai/evaluate` | session state · policy snapshot · telemetry summary 기반 action 결정 |
| Envoy/Adapter 응답 처리 | NONE → 200 allow / THROTTLE → header 기반 마찰 / REQUIRE_S3 → 428 challenge / BLOCK → 403 |

### 결과

- critical API에만 선택적으로 방어 적용
- business API body/header 계약 유지
- 방어 로직이 서비스 코드에 침투하지 않고 인프라 계층에서 강제
- 정책 변경 시 Adapter/AI contract만 조정하면 전체 흐름 유지
- allow / throttle / challenge / block 흐름을 단일 enforcement 계층에서 일관 처리

ext_authz + Adapter 구조는 연동 편의가 아니라, 방어를 서비스 코드에서 분리하고 인프라 enforcement layer에 올리기 위한 구조적 선택이었다.

### 남은 한계

Envoy-Adapter-AI Runtime 3계층 계약이 어긋나면 장애 원인 추적이 복잡해진다. `failure_mode_allow` 설정 시 AI 장애가 방어 공백으로 이어지므로, 연동 성공률·timeout·fail-open 비율을 별도로 관측해야 한다.

---

## 4. 실행·보관·분석·권위 저장소 분리

### 문제

AI Defense는 성격이 다른 네 가지 데이터 요구사항을 동시에 가진다.

| 요구사항 | 성격 |
|------|------|
| request path에서 빠르게 읽어야 하는 session/policy 상태 | 속도 우선 |
| 원본을 잃지 않는 audit 장기 보관 | 내구성 우선 |
| 운영 지표와 사후 분석 쿼리 | 집계·탐색 우선 |
| 정책·결과를 권위 있게 저장하는 control-plane | 일관성·권위 우선 |

### 왜 단일 저장소가 안 됐는가

| 단일 저장소 | 불가 이유 |
|------|------|
| Redis | request latency는 최저. 그러나 audit 장기 보관·정책 이력·분석 쿼리에 부적합 |
| PostgreSQL | authoritative storage로는 적합. 그러나 request path에서 session state를 빠르게 serving하기엔 부담 |
| S3 | 원본 보관엔 최적. 그러나 query/운영 분석에 불편하고 runtime authority 불가 |
| ClickHouse | 대규모 event 분석에 강함. 그러나 runtime authority·최종 권위 저장소로는 부적합 |

하나로 통합하면 단순해 보이지만, 실제로는 각 저장소의 책임 충돌이 발생한다.

### 선택

역할 기준으로 4개를 분리했다.

| 저장소 | 역할 | 근거 |
|------|------|------|
| Redis | 실행용. runtime state, policy projection, dedup, block 상태 | request path 최저 latency 보장 |
| S3 | 보관용. canonical JSONL audit log | ETL 실패·warehouse 재구축 시 replay/backfill source |
| ClickHouse | 분석용. defense_audit_events, session rollups, post_review_candidates | 운영 지표·drill-down·post-review 후보 선별 |
| PostgreSQL | 권위용. Backoffice 결과, 정책 버전, rollout state, optimization run | authoritative result store + policy control-plane DB |

### 결과

- runtime request path는 Redis만 읽고 즉시 판단
- 원본 증거는 S3에 분리 보관 (audit 재구축 가능)
- 분석·후보 선별은 ClickHouse에서 수행 (runtime 영향 없음)
- 최종 결과·정책 권위는 PostgreSQL에 일원화

하나의 DB에 모든 책임을 몰아넣지 않고, 실행·보관·분석·권위를 역할 기준으로 분리했다. 단순해 보이는 통합이 오히려 책임 충돌을 만들기 때문이다.

### 남은 한계

저장소가 분리되면 복구 경로도 분리된다. Redis projection 장애는 PostgreSQL resync, ClickHouse 적재 장애는 S3 replay 경로가 각각 필요하다. 운영자는 각 저장소의 source-of-truth 우선순위를 명확히 이해하고 있어야 한다.
