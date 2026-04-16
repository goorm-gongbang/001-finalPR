# 클라이언트 보안

> **역할**: 방어 체인의 시작점 · X-Bot-Token 발행자 · 브라우저 노출 최소화

Playball은 브라우저에 노출되는 정보를 줄이고, 응답 헤더와 쿠키 속성을 보수적으로 유지하는 방식으로 클라이언트 보안을 구성합니다. 인증 판단과 주요 검증은 브라우저가 아니라 Gateway와 백엔드 계층에서 처리합니다.

---

## 프론트엔드 빌드와 노출 제어

| 항목 | 적용 방식 |
|---|---|
| **브라우저 소스맵** | 운영 빌드에서 비활성화 |
| **JavaScript 난독화** | 프로덕션 빌드 후 정적 청크 난독화 |
| **응답 헤더 최소화** | `poweredByHeader` 비활성화 |
| **정적 자산 분리** | 운영 빌드에서 CDN 경로 기준으로 정적 자산 제공 |

운영 빌드는 `build:prod` 스크립트에서 `next build` 이후 `javascript-obfuscator`를 적용합니다.

---

## 보안 헤더

Next.js 응답 헤더에 기본 보안 정책을 적용합니다.

| 헤더 | 목적 |
|---|---|
| **Content-Security-Policy-Report-Only (CSP)** | 허용된 출처만 연결되도록 위반 내역 수집 |
| **X-Content-Type-Options: nosniff** | MIME 타입 추측 방지 |
| **X-Frame-Options: DENY** | 클릭재킹 방지 |
| **Referrer-Policy** | 외부 전송 Referrer 최소화 |
| **Permissions-Policy** | 카메라, 마이크, 위치 권한 기본 차단 |

`connect-src`에는 API 도메인과 Faro 수집 경로가 포함되고, `img-src`에는 정적 자산과 S3 자산 경로가 포함됩니다.

---

## 토큰과 쿠키 처리

| 항목 | 운영 방식 |
|---|---|
| **Refresh Token** | `HttpOnly`, `Secure`, `SameSite=Lax` 쿠키로 저장 |
| **Admission Token** | `HttpOnly`, `Secure`, `SameSite=None` 쿠키 사용 |
| **JWT 검증** | 클라이언트가 아니라 API Gateway와 백엔드에서 검증 |
| **토큰 발급** | Auth-Guard가 RSA 기반 JWT 발급 담당 |

Refresh Token 쿠키 속성은 `JwtProperties`에서 관리하고, Admission Token은 Queue 서비스에서 별도 쿠키로 발급합니다.

---

## 클라이언트 관점의 운영 기준

| 구분 | 확인 내용 |
|---|---|
| **정적 자원 노출** | 운영 빌드에 소스맵이 노출되지 않는지 |
| **헤더 정책** | CSP, Frame, MIME 관련 헤더가 유지되는지 |
| **쿠키 속성** | `HttpOnly`, `Secure`, `SameSite` 설정이 의도대로 적용되는지 |
| **인증 흐름** | 로그인, 갱신, 대기열 토큰 흐름이 브라우저에서 정상 동작하는지 |
| **API 연결 범위** | 브라우저가 허용된 API 및 수집 경로로만 연결되는지 |
