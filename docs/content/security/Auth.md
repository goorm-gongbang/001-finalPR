# 서비스 인증 및 인가 프로토콜 정의서

1.개요

본 문서는 **Spring Boot 메인 서버**와 **FastAPI AI 추론 서버** 간의 통합 인증 및 인가를 위한 프로토콜을 정의한다. 사용자의 보안 세션을 유지하고, AI 모델(vLLM) 및 VQA 스트리밍 자원에 대한 비정상 접근을 차단하는 것을 목적으로 한다.

# 1.1 프로젝트 개요

목적: 시스템의 자원 보호 및 사용자 식별을 위한 인증/인가 메커니즘 정의

대상: Next.js 프론트엔드, Spring Boot 메인 서버, FastAPI AI 추론 서버

사용기술: Java 21, Spring Security, JWT, Redis, Python 3.12 (FastAPI)

## 1.2 목표

**인증 목표:** 사용자 식별 및 통합 세션 관리.

**인가 목표:** 역할 기반 권한 제어(RBAC) 및 AI 자원 보호.

2. 인증 매커니즘

# 2.1 기술 스택

**Method:** 카카오 OAuth 2.0 기반 자체 JWT 발급

**Algorithm:** HS256 (Spring Boot와 FastAPI 간 Secret Key 공유), RS256 (Istio Gateway 검증 연동)

**Storage:** Redis (Key: refresh_token:{jti}) Refresh Token 저장 및 블랙리스트 관리

**[설정값 동기화]**

- **Token TTL**: Access 15m / Refresh 7d (환경변수 설정 기준)
- **Verification**: iss와 aud 클레임을 필수로 검증하며, 개발 환경은 HS256을 사용하되 운영 환경은 인프라 보안 정책에 따라 RS256으로 전환을 검토함.

## 2.2 토큰 구조(payload)

JWT의 페이로드(Claims)는 다음과 같이 구성하는 것을 권장

"iss": "goormgb-auth-service" 토큰 발급자

"sub": "user_uuid_12345"      사용자 고유 식별자

“aud”: “goormgb-api”

“jti”   : “unique-id-v4”               토큰 고유 식별자

"auth": "ROLE_USER"           사용자 권한 (Spring Security Role)

"tokenType": "ACCESS"         토큰 타입 (ACCESS / REFRESH)

"iat": 1737510000                   발급 시간

"exp": 1737513600                 만료 시간 (Access: 15m, Refresh: 7d)

3. 프로토콜 상세 및 데이터 흐름

# 3.1 로그인 및 토큰 발급

1. **Client (Next.js)** 가 ID/PW로 로그인 요청.
2. **Main Server (Spring Boot)** 가 DB(MySQL) 확인 후 인증 성공 시 JWT 쌍(Access/Refresh) 생성.
3. **Refresh Token**은 Redis에 저장(RTR 방식 적용)
4. Client에 토큰 전달.

토큰 재발급(Refresh) 시 **RTR(Refresh Token Rotation)** 방식을 채택하여, 사용된 기존 Refresh Token은 즉시 폐기하고 새로운 쌍을 발급한다.

## 3.2 블랙리스트 관리 (로그아웃 관련)

- 로그아웃 시 Access Token의 jti를 Redis **블랙리스트**에 등록하여 만료 전까지의 모든 재사용 시도를 차단한다.

<참조> 토큰 관리 및 기술 사양

| **구분** | **내용** | **비고** |
| --- | --- | --- |
| **Back-end** | Java 21 / Spring Boot 3.4.2 | Spring Security, JWT 활용 |
| **AI Engine** | Python 3.12 / FastAPI | vLLM 기반 실시간 VQA 응답 |
| **Database** | **Postgres**, MongoDB (RDB) / Redis (Cache) | 세션 캐싱 및 Threat Score 관리 |
| **Token Type** | Access Token (15m) / Refresh Token (7d) | Redis를 통한 토큰 Rotation 적용 |

4. API 명세 상세

# 4.1 인증 헤더 규격

모든 보호된 자원에 대한 요청은 아래 헤더를 포함해야 한다.

- **Key:** Authorization
- **Value:** Bearer {Access_Token}

## 4.2 주요 엔드포인트

| **기능** | **경로** | **Method** | **설명** |
| --- | --- | --- | --- |
| 로그인 | POST /auth/kakao/callback | POST | Access/Refresh 토큰 발급 |
| 토큰 갱신 | POST /auth/token/refresh | POST | 토큰 재발급 - 쿠키 사용 |
| VQA 스트리밍 | GET /users/me | GET | AI 서버의 SSE 응답 (JWT 검증 필수) |

### **4.3 인프라 보안 및 전송 계층 (Istio 연동)**

### 인프라 설계서에 정의된 서비스 메쉬(Service Mesh)를 통해 API 전송 구간의 보안을 물리적으로 강화한다.

- **상호 TLS(mTLS) 강제**: 클러스터 내부의 모든 서비스 간 통신(Main ↔ AI ↔ Redis)은 Istio의 PeerAuthentication을 통해 상호 인증 및 암호화되어 패킷 스니핑을 원천 차단한다.
- **Gateway JWT 필터링**: 외부 요청이 들어오는 인그레스 게이트웨이(Ingress Gateway) 레벨에서 JWT의 유효성을 1차 검증하여, 비정상적인 요청이 백엔드 비즈니스 로직까지 도달하지 않도록 방어한다.
- **인가 정책(AuthorizationPolicy) 제어**: L7 레벨에서 서비스 간 호출 권한을 관리하여, 허가되지 않은 내부 경로로의 접근(Lateral Movement)을 차단한다.

5. 보안 가드레일 작동 및 예외 처리

# 5.1 실시간 위협 대응

**Redis 연동:** Redis에 저장된 유저별 Threat Score를 매 요청마다 확인.

위협 점수 임계치 초과 시, Redis에 저장된 해당 유저의 **jti 세션 정보를 삭제**하여 즉시 강제 로그아웃을 수행한다.

**Anomaly 탐지:** PyOD 모델이 마우스 궤적 및 클릭 간격에서 이상 징후 포착 시, 해당 유저의 토큰을 즉시 블랙리스트 처리.

## 5.2 AI 보안

모든 AI 요청 페이로드는 FastAPI의 Prompt Guard 레이어를 통과해야 함.

프롬프트 인젝션 의심 시 403 Forbidden 반환.

### 5.3 에러 코드 정의

401 Unauthorized: 토큰 만료 또는 서명 불일치 (Next.js에서 /login 리다이렉트).

403 Forbidden: 권한 부족 또는 보안 위협 점수 초과로 인한 접근 차단.

429 Too Many Requests: KEDA 오토스케일링 임계치 도달 시 전송.

<참조> 보안 가드레일 작동 원리

| **보안 계층** | **적용 기술** | **상세 목적** |
| --- | --- | --- |
| **AI 방어** | Prompt Guard | 프롬프트 인젝션 및 민감 정보(PII) 마스킹 |
| **행동 분석** | PyOD / Scikit-learn | 마우스 궤적 및 클릭 기반 비정상 패턴 탐지 |
| **성능 최적화** | KEDA (Kubernetes) | 대기열 기반 GPU 오토스케일링(HPA) 구현 |
| **추적/평가** | LangSmith / RAGAS | LLM 호출 추적(Tracing) 및 방어 성공률 벤치마킹 |

6. 운영 지침 및 주의사항

# 6.1 운영지침

**배포 및 관제:** Vercel(Front)과 Docker(Back) 기반 MSA 구조로 배포하며, LangSmith를 통해 지속적으로 품질을 모니터링합니다.

**예외 처리 가이드:**

Threat Score 임계값 초과 시 즉시 Redis 세션 만료 및 403 반환.

토큰 탈취 의심 시 전역 로그아웃(Logout All Devices) 기능 수행.

## 6.2. 주의사항

1. **Spring Boot (3.4.2):** OncePerRequestFilter를 상속받아 JWT 검증 로직 구현. SecurityConfig에서 비동기 요청(SSE)에 대한 보안 컨텍스트 유지 설정 필요.
2. **FastAPI:** HTTPBearer를 사용하여 의존성 주입(Depends) 형태로 토큰 검증기 구현.
3. **Next.js (15):** Zustand에 저장된 Access Token이 만료될 경우 axios interceptor에서 /refresh API를 호출하는 로직 구현.
4. **CORS:** AllowCredentials: true 설정이 필요함.

Refresh Token을 쿠키로 주고받기 위해서는 이 설정이 필수.

프론트엔드 도메인에 대해 메인 서버와 AI 서버 모두 명확한 Allow 정책 수립.

부록1. 참고자료

본 프로토콜은 아래의 표준 및 기술 스택 명세에 기반하여 설계되었습니다.

- **RFC 7519 (JSON Web Token):** JWT의 구조 및 보안 클레임 정의 표준.
- **OAuth 2.0 Authorization Framework:** 위임 인가 프레임워크의 업계 표준 패턴 반영.
- **FastAPI / vLLM Documentation:** 비동기 추론 서버 구현 및 GPU 오토스케일링 연동 가이드.
- **Spring Security 6.x Specification:** Java 21 및 Spring Boot 4.0.2 환경에서의 필터 체인 및 인증 객체 관리.
- **Prompt Guard Guidelines:** 프롬프트 인젝션 방어 및 PII(민감 정보) 마스킹 보안 가드레일 수칙.

부록2. 용어 정의

| **Access Token** | 클라이언트가 보호된 자원에 접근하기 위해 사용하는 단기 유효 토큰. | 유효기간: 15분. |
| --- | --- | --- |
| **Refresh Token** | Access Token 만료 시, 재로그인 없이 토큰을 갱신하기 위한 장기 유효 토큰. | Redis에서 관리 및 보안 로테이션 적용.
유효기간: 7일 |
| **VQA (Visual QA)** | 이미지를 분석하여 질문에 답하는 AI 기술로, 본 시스템의 핵심 기능임. | FastAPI 및 vLLM 엔진에서 처리. |
| **Prompt Guard** | LLM 요청 시 악의적인 프롬프트 입력을 필터링하는 보안 가드레일 레이어. | 프롬프트 인젝션 방지. |
| **Threat Score** | 유저의 행동 패턴(마우스 궤적, 클릭 등)을 분석하여 산출한 실시간 위협 점수. | Redis에 캐싱하여 세션 차단 여부 결정. |
| **KEDA** | Kubernetes 기반의 이벤트 기반 오토스케일러로, 대기열 길이에 따라 GPU 서버 조절. | 인프라 효율성 및 가용성 확보. |
| **SSE (Server-Sent Events)** | 서버에서 클라이언트로 실시간 데이터를 스트리밍하는 단방향 통신 방식. | AI 추론 결과의 실시간 응답에 사용. |
