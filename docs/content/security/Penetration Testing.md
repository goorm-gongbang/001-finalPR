# 침투 테스트 종합 보고서
## goormgb.space / playball.one (4팀)
### KT Cloud TechUp 72시간 모의해킹 침투 테스트

---

| 항목 | 내용 |
|------|------|
| 테스트 기간 | 2026-04-02 ~ 2026-04-04 (72시간) |
| 보고서 작성일 | 2026-04-06 |
| 대상 도메인 | goormgb.space, staging.playball.one |
| 총 발견 취약점 | 35건 (CRITICAL 11, HIGH 12, MEDIUM 12) |
| 자동 스캔 도구 | S2N Scanner v0.2.1 (7팀 이택우 자체 개발) |
| 주요 성과 | JWT RSA 키 위조, AWS S3 Defacement, 결제 0원 조작, Kiali prod 장악 |

---

## 1. 요약 (Executive Summary)

본 보고서는 goormgb.space(구름공방 야구 티켓 예매 플랫폼) 및 staging.playball.one에 대해 72시간 동안 수행된 침투 테스트 결과를 종합 정리한 문서이다. 5팀(레드팀 자동화/수동), 1팀(Burp Suite 웹 취약점), 4팀(Kiali·kafka-ui 인프라), 7팀(S2N 자동 스캐너) 4개 관점에서 총 35건의 취약점이 발견되었다.

### 핵심 공격 성과

- 팀 Notion에서 JWT RSA Private Key 전체 유출 → ROLE_ADMIN 토큰 위조 성공
- AWS IAM 크리덴셜 유출 → S3 버킷 Defacement (HACKED.html 업로드)
- Gmail 앱 비밀번호 유출 → 기업 이메일 24개 전체 열람
- 결제 금액 클라이언트 조작 → 118,000원 티켓을 0원에 구매
- 좌석 선점 IDOR → 임의 seatId 선점 후 0원 결제 체인 완성
- Kiali prod 무인증 쓰기 권한 → VirtualService PATCH 성공, 전체 트래픽 조작 가능
- kafka-ui 무인증 → 실제 결제 데이터 2,212건 이상 열람
- S2N 자동 스캐너: 로그인 Rate Limiting 미탐지, OS Command Injection 의심 4건 발견

### 취약점 종합

| 심각도 | 건수 | 대표 항목 |
|--------|------|-----------|
| CRITICAL | 11건 | JWT 키 유출/위조, AWS 키 유출, Gmail 탈취, Kiali 쓰기, kafka-ui 노출 |
| HIGH | 12건 | K8s API 외부 노출, Actuator 비인증, OS Command Injection 의심, Thread Pool 무제한 |
| MEDIUM | 12건 | Staging Cloudflare 미적용, CSP 헤더 누락, Rate Limiting 미설정, Origin 미검증 |
| **합계** | **35건** | 자동 스캔 포함 시 고유 취약점 유형 40+건 |

---

## 2. 대상 시스템 개요

| 항목 | 내용 |
|------|------|
| 프로덕션 도메인 | goormgb.space (구름공방) |
| 스테이징 도메인 | staging.playball.one (Vercel), api.staging.playball.one (ALB 직접 노출) |
| 인프라 | AWS EKS + Cloudflare CDN/WAF + Istio Service Mesh |
| 백엔드 | Spring Boot (API Gateway + Auth-Guard + Queue + Seat + Order-Core) |
| 메시징 | Apache Kafka (kafka-ui 포함) |
| DB | PostgreSQL + Redis |
| 인증 | 카카오 OAuth + JWT (RS256) — Access/Refresh/Admission 3종 |

### 2.1 서브도메인 현황 및 Cloudflare 적용 현황

> **검증 근거:** (1) Nmap 스캔에서 goormgb.space → Cloudflare IP 화이트리스트로 차단 확인, (2) S2N Scanner가 staging.playball.one 직접 접근 성공(85.7% 성공률) — Cloudflare WAF 없음 확인, (3) 5팀이 prod Cloudflare 우회 시도 후 Day 2까지 차단 지속 확인.

| 서브도메인 | Cloudflare | 상태 | 비고 |
|-----------|-----------|------|------|
| goormgb.space | O (확인됨) | 보호 | WAF + IP 화이트리스트. Nmap 차단 확인 |
| api.goormgb.space | O (확인됨) | 보호 | WAF + IP 화이트리스트. Swagger 포함 |
| kiali.goormgb.space | O (확인됨) | **우회됨** | CF 적용되나 무인증 접근 가능 — CRITICAL |
| kafka-ui.goormgb.space | O (확인됨) | **우회됨** | CF 적용되나 무인증 접근 가능 — CRITICAL |
| cloudbeaver.goormgb.space | O (추정) | 보호 | IP 화이트리스트로 차단됨 |
| argocd.goormgb.space | O (추정) | 부분 | Google OAuth 있으나 도메인 제한 없음 |
| grafana.goormgb.space | O (추정) | 조건부 | 302 로그인 페이지 |
| staging.playball.one | **X (확인됨)** | **무보호** | Vercel 직접 노출. S2N 스캔 성공으로 확인 |
| api.staging.playball.one | **X (확인됨)** | **무보호** | ALB 직접 노출. 주요 공격 대상 — CRITICAL |

### 2.2 공격 인프라

| 역할 | IP | 도구 |
|------|----|------|
| C2 서버 | 10.10.2.83 | Sliver v1.7.4, Metasploit |
| 리다이렉터 | 3.35.14.225 | Nginx, socat |
| 오퍼레이터 | 43.202.50.89 | Nmap, Masscan, Nuclei, SQLMap, AWS CLI, pyjwt |

---

## 3. 자동화 스캔 결과 (7팀 이택우 — S2N Scanner)

7팀 이택우는 자체 개발한 S2N Scanner v0.2.1로 staging.playball.one을 대상으로 자동화 블랙박스 스캔을 수행하였다. 102개 URL에 2,010건 요청을 전송하였으며 고유 취약점 6종을 발견하였다.

### 3.1 스캔 개요

| 항목 | 내용 |
|------|------|
| 스캐너 | S2N Scanner v0.2.1 (7팀 자체 개발) |
| 대상 URL | https://staging.playball.one/ |
| 스캔 시간 | 2026-04-02 16:16:43 ~ 16:19:07 (약 143초) |
| 총 요청 수 | 2,010건 (성공률 85.7% — Cloudflare 없어 직접 접근 성공) |
| 플러그인 | CSRF, SQL Injection, File Upload, OS Command, XSS, Brute Force, Soft Brute Force |
| 총 발견 건수 | 105건 (HIGH 4, MEDIUM 51, LOW 25, INFO 25) — 중복 URL 포함 |
| 고유 취약점 유형 | 6종 |

### 3.2 플러그인별 결과

| 플러그인 | 상태 | 발견 건수 | 비고 |
|---------|------|-----------|------|
| csrf | PARTIAL | 100건 (MEDIUM) | CSP 헤더 누락, Origin 미검증 등 — 중복 URL 포함 |
| sqlinjection | SUCCESS | 0건 | SQL Injection 미탐지 (앱 레벨 필터 작동) |
| file_upload | SUCCESS | 0건 | 파일 업로드 취약점 없음 |
| oscommand | SUCCESS | **4건 (HIGH)** | 정적 JS 파일 파라미터 OS Command Injection 의심 |
| xss | SUCCESS | 0건 | XSS 미탐지 |
| BruteForcePlugin | SUCCESS | 0건 | 계정 잠금 정상 동작 |
| soft_brute_force | SUCCESS | 1건 (MEDIUM) | 로그인 Rate Limiting 미탐지 (10회 연속 요청 성공) |

### 3.3 주요 발견 취약점 (고유 6종)

#### [S-01] OS Command Injection 의심 — 정적 JS 파일 파라미터
> **[HIGH]** CWE: 미분류 | 플러그인: oscommand

정적 JavaScript 파일(`/_next/static/chunks/7eee5e97d07d5243.js`)에 `t`, `this`, `function`, `e` 파라미터로 OS Command Injection 페이로드 전송 시 비정상 응답 패턴 감지. 추가 수동 검증 필요.

```
GET /_next/static/chunks/7eee5e97d07d5243.js?t=test%3Bid  → 비정상 응답
GET /_next/static/chunks/7eee5e97d07d5243.js?this=test%3Bid → 비정상 응답
```

**대응 방안:** 정적 파일 쿼리 파라미터 처리 로직 제거. 수동 검증으로 실제 Command Injection 여부 확인.

---

#### [S-02] Content-Security-Policy (CSP) 헤더 누락
> **[MEDIUM]** CWE: CWE-352 | 플러그인: csrf

staging.playball.one 전체 페이지(102개 URL)에 CSP 헤더 미설정. XSS 및 데이터 삽입 공격에 취약.

**대응 방안:** `default-src 'self'`부터 시작하여 점진적 CSP 정책 강화.

---

#### [S-03] Origin 헤더 미검증
> **[MEDIUM]** CWE: CWE-346 | 플러그인: csrf

위조된 Origin 헤더 요청에 정상 응답 반환. 상태 변경 엔드포인트의 CSRF 방어 미흡.

**대응 방안:** 상태 변경 API에서 Origin/Referer 헤더 검증 및 신뢰되지 않는 출처 거부.

---

#### [S-04] 로그인 Rate Limiting 미적용
> **[MEDIUM]** CWE: 미분류 | 플러그인: soft_brute_force

로그인 엔드포인트에 10회 연속 요청 시 차단/지연 없음. 브루트포스 공격에 취약.

**대응 방안:** Spring Security Rate Limiting 또는 Cloudflare Rate Limiting 적용. IP별 로그인 시도 제한.

---

#### [S-05] X-Requested-With 헤더 미검증
> **[LOW]** CWE: CWE-352 | 플러그인: csrf

X-Requested-With 헤더 없이 전송된 요청과 동일 응답 반환. 커스텀 헤더 기반 CSRF 방어 미구현.

**대응 방안:** API 엔드포인트에서 X-Requested-With 헤더 검증 로직 추가.

---

#### [S-06] 미인증 접근 페이지 서버 측 제한 미설정
> **[MEDIUM]** 수동 확인 | 7팀 이택우

미인증 상태에서 예약 페이지 접근 시 클라이언트 측 리다이렉트만 구현. JavaScript 비활성화 시 인증 없이 페이지 접근 가능.

**대응 방안:** Next.js `getServerSideProps` 또는 `middleware`에서 서버 측 인증 확인 후 강제 리다이렉트.

---

## 4. 취약점 상세

### 4.1 CRITICAL (11건)

---

#### [C-01] JWT RSA Private Key 소스코드 노출 → ADMIN 토큰 위조

| 항목 | 내용 |
|------|------|
| 심각도 | **CRITICAL** |
| 출처 | 5팀 황준하 (Day 1) |
| 위치 | `.env`, `application-local.yaml`  |
| 대응 방안 | RSA 키 즉시 로테이션, AWS KMS/Vault 전환 |

**침투 경로:**

4팀 Notion 에서 `.env` 파일내용과 `application-local.yaml`에 JWT RSA 2048bit Private Key 전문이 발견되었다. 해당 키를 추출하여 `pyjwt` 라이브러리로 ROLE_ADMIN 페이로드의 JWT를 직접 서명하였다.

```python
# JWT 위조 PoC
import jwt
with open("private_key.pem") as f:
    key = f.read()

payload = {
    "iss": "goormgb-auth-service",
    "sub": "1",
    "aud": "goormgb-api",
    "auth": "ROLE_ADMIN"
}
token = jwt.encode(payload, key, algorithm="RS256")
```

위조된 토큰으로 `/auth/me` 호출 결과:
```json
{"id": 1, "email": "grgbdev@gmail.com", "nickname": "구름공방 개발팀"}
```

관리자 계정(id:1) 완전 장악 확인.

---

#### [C-02] AWS IAM 크리덴셜 유출 → S3 Defacement

| 항목 | 내용 |
|------|------|
| 심각도 | **CRITICAL** |
| 출처 | 5팀 황준하 (Day 1) |
| 위치 | `.env` (4팀 Notion) |
| Access Key | `AKIAXHOB7NGJJWLQU5HF` / Account: `497012402578` |
| 대응 방안 | IAM 키 즉시 비활성화, 최소 권한 원칙 적용, S3 퍼블릭 접근 차단 |

**침투 경로:**

동일 `.env` 파일에서 AWS IAM Access Key와 Secret Key를 추출하였다. AWS CLI로 `aws sts get-caller-identity` 실행 성공 후 IAM 유저(`arn:aws:iam::497012402578:user/service/qna-presigned-url-user-dev`)의 S3 접근 권한을 확인하였다. `goormgb-qna` 버킷의 `dev/` 경로에 Defacement 파일 3개를 업로드하였다.

```bash
aws s3 cp hacked.html s3://goormgb-qna/dev/hacked.html
aws s3 cp index.html s3://goormgb-qna/dev/HACKED/index.html
aws s3 cp proof.txt s3://goormgb-qna/dev/HACKED/proof.txt
```


---

#### [C-04 ~ C-11] 기타 CRITICAL 취약점 요약

| ID | 취약점 | 핵심 내용 | 침투 경로 요약 | 대응 방안 |
|----|--------|-----------|----------------|-----------|
| C-04 | 카카오 OAuth Secret 유출 | Client Secret: `78HoZOGD...` — OAuth 토큰 직접 교환으로 계정 탈취 가능 | 동일 `.env` 파일에서 카카오 Client ID/Secret 추출. 카카오 OAuth 토큰 교환 API로 임의 토큰 발급 가능 | 카카오 시크릿 즉시 재발급, Vault 관리 |
| C-05 | DB 크리덴셜 유출 | PostgreSQL `goormgb/1234`, CloudBeaver 계정 3개. Cloudflare가 유일한 방어선 | `application-local.yaml`에서 DB 접속 정보 평문 발견. IP 화이트리스트로 직접 접속은 차단되나 SSRF 발견 시 즉시 악용 가능 | DB 비밀번호 변경, CloudBeaver VPN 이동 |
| C-06 | Admission Key 유출 | 대기열 토큰 RSA Key 노출 → 무제한 위조 → 대기열 우회, 매크로 방지 무력화 | `.env`에서 Admission 서비스용 별도 RSA Key 발견. 위조 토큰으로 대기열 순서 우회 후 좌석 선점 자동화 가능 | Admission 키 로테이션, 서버 측 Queue 통과 검증 |
| C-07 | loadtest 무인가 계정 생성 | `POST /auth/loadtest/signup` → 인증 없이 201. 51개 계정 생성. Day 3 패치됨 | Swagger UI에서 loadtest 전용 엔드포인트 발견. 인증 헤더 없이 직접 호출하여 hacker001 포함 다수 계정 생성 | loadtest API 완전 비활성화 |
| C-08 | 결제 금액 클라이언트 조작 | `totalPrice:0` 변조 → 201 → PAID/COMPLETED. 118,000원 티켓 0원 구매 | Burp Suite로 결제 요청 가로채기. `totalPrice` 파라미터를 0으로 변조하여 재전송 시 서버가 검증 없이 주문 생성 및 결제 완료 처리 | 서버에서 좌석 가격 산정, 클라이언트 값 신뢰 금지 |
| C-09 | 좌석 IDOR | 임의 seatId hold 성공 → 주문 → 결제 체인 완성. 타인 좌석 탈취 가능 | 좌석 선점 API의 `seatIds` 파라미터를 타인의 seatId로 변조하여 hold 성공. 이후 주문 생성 → 결제까지 전체 체인 정상 동작 확인 | 서버 측 seatId 소유권 교차 검증 |
| C-10 | Kiali prod 무인증 쓰기 | `kiali.goormgb.space` — VirtualService PATCH 200. 17개 네임스페이스 조작 가능 | Kiali `auth.strategy: anonymous` 설정으로 인증 없이 접근. `/kiali/api/namespaces` 17개 조회 후 VirtualService PATCH 요청으로 resourceVersion 변경 확인 (748526 → 3991319) | OIDC 인증 적용, 쓰기 권한 제한 |
| C-11 | kafka-ui 무인증 노출 | `kafka-ui.goormgb.space` — `readOnly:false`, 결제 데이터 2,212건 열람 | AUTH_TYPE 미설정으로 인증 없이 접근. 클러스터 조회에서 `readOnly:false` 확인 후 `bank-transfer-expired` 토픽 메시지 2,212건 열람. 실제 결제 금액(154,000원 등) 포함 | 인증 적용, readOnly:true, VPN 이동 |

---

### 4.2 HIGH (12건)

| ID | 취약점 | 출처/내용 | 침투 경로 요약 | 대응 |
|----|--------|-----------|----------------|------|
| H-01 | Gmail 기업 이메일 탈취 | 5팀 — 앱 비밀번호로 SMTP/IMAP 접근 | C-03과 동일 경로 | 앱 비밀번호 폐기, 2FA |
| H-02 | K8s API 서버 외부 노출 | 5팀 — 52.78.83.41:443 (401, 인증 시 장악) | actuator/metrics에서 K8s 내부 URI 추출 후 직접 접근 시도. 401 반환으로 익명 접근 차단 확인. 인증 정보 획득 시 클러스터 전체 접근 가능 | 프라이빗 엔드포인트 전환 |
| H-03 | K8s 내부 서비스 DNS 노출 | 5팀 — actuator/metrics에서 4개 서비스 DNS 추출 | `/actuator/metrics/http.client.requests`에서 `auth-guard.staging-webs.svc.cluster.local:8080` 등 내부 서비스 DNS 4개 추출 | actuator 인증, DNS 마스킹 |
| H-04 | API Gateway 쓰기 인증 우회 | 5팀 — POST/PUT/PATCH/DELETE → 500 (401 아님) | 인증 헤더 없이 쓰기 메서드 전송 시 401이 아닌 500 반환. Gateway 레벨 인증 필터 미적용으로 실제 서비스까지 요청이 도달함을 의미 | 라우트별 인증 필터 적용 |
| H-05 | Spring Boot Actuator 전체 노출 | 5팀 — /actuator 7개 엔드포인트 비인증 | `/actuator/health`, `/actuator/metrics`, `/actuator/env` 등 7개 엔드포인트 인증 없이 접근. 서버 내부 상태, 환경변수, 디스크/메모리 정보 노출 | 노출 최소화, 인증 적용 |
| H-06 | 내부 라우트 + K8s URI 노출 | 5팀 — http.client.requests 메트릭에서 5개 라우트 | actuator metrics의 `http.client.requests` 항목에서 내부 서비스 간 호출 라우트 5개와 K8s 서비스 URI 노출 | 민감 메트릭 제거 |
| H-07 | 무인증 KBO 구단 데이터 탈취 | 5팀 — GET /order/clubs → 200 (인증 없음) | API Gateway에서 GET 메서드에 대한 인증 필터 미적용. 인증 없이 전체 KBO 구단 데이터 조회 성공 | API 인증 적용 |
| H-08 | 서버 리소스 정보 노출 | 5팀 — 디스크 15GB, JVM 215MB, CPU 등 | actuator/metrics에서 서버 디스크 사용량, JVM 힙 메모리, CPU 사용률, GC 통계 등 인프라 정보 전체 노출 | actuator 인증 필수 |
| H-09 | Thread Pool 무제한 DoS | 5팀 — executor.pool.max = 2,147,483,647 | actuator/metrics에서 `executor.pool.max` 값이 Integer.MAX_VALUE(약 21억)로 설정된 것을 확인. 대량 요청 시 Thread Exhaustion으로 서비스 전체 마비 가능 | pool.max 200~500 제한 |
| H-10 | IP 블랙리스트 우회 (staging) | 5팀 — staging Cloudflare 없어 WAF 우회 불필요 | staging.playball.one은 Cloudflare 미적용으로 ALB에 직접 접근. 봇 탐지, IP 블랙리스트 등 보안 장치 전혀 없음 | Staging WAF/CDN 적용 |
| H-11 | SQLi 앱 레벨 필터 우회 가능성 | 5팀 — 인코딩 변형으로 우회 가능성 | 앱 레벨에서 일부 SQLi 패턴을 차단하나 URL 인코딩, 대소문자 변형 등으로 우회 가능성 존재. WAF 없어 자동화 공격에 취약 | WAF 추가, Prepared Statement |
| H-12 | OS Command Injection 의심 | 7팀 S2N — JS 파일 파라미터 비정상 응답 4건 | S2N Scanner가 정적 JS 파일에 `;id`, `&&id` 등 OS Command 페이로드 삽입 시 비정상 응답 패턴 4건 감지. 수동 검증 필요 | 수동 검증 후 파라미터 처리 제거 |

---

### 4.3 MEDIUM (12건)

| ID | 취약점 | 출처/내용 | 대응 |
|----|--------|-----------|------|
| M-01 | Staging Cloudflare 미보호 | 5팀 — ALB 직접 노출, Cloudflare 없음 | Staging Cloudflare 적용 |
| M-02 | Swagger UI 노출 | 5팀 — Day 3 패치됨 (404) | Non-prod 접근 제한 |
| M-03 | DB Encryption Key 노출 | 5팀 — `SD3L9QoO...=` 노출 | 키 로테이션, AWS KMS |
| M-04 | Internal API Key 노출 | 5팀 — Day 3 로테이션됨 | Vault/Secrets Manager 관리 |
| M-05 | Admin 엔드포인트 존재 확인 | 5팀 — 미문서화 7개 경로 (401) | 불필요 엔드포인트 제거 |
| M-06 | 단순 비밀번호 | 5팀 — dev/1234, Grgb1234! | 자동 생성 강력 비밀번호 |
| M-07 | Actuator RBAC 불일치 | 5팀 — health 403, metrics 200 불일치 | 일관된 인증 정책 |
| M-08 | Gateway 라우트 수 노출 | 5팀 — `gateway.routes.count = 4` | 민감 메트릭 제거 |
| M-09 | 주문 ID 열거 | 1팀 — 403/404 응답 차이로 주문 존재 확인 | 응답 통일, UUID 사용 |
| M-10 | Turnstile cfToken 하드코딩 | 1팀 — `ok-local-dev` 문자열로 봇방지 우회 | 바이패스 문자열 제거 |
| M-11 | CSP 헤더 누락 | 7팀 S2N — 전체 102개 URL CSP 미설정 | CSP 헤더 설정 |
| M-12 | Origin 미검증 + Rate Limiting 미설정 | 7팀 S2N — 위조 Origin 허용, 로그인 10회 연속 허용 | Origin 검증, Rate Limiting 적용 |

---

## 5. 공격 타임라인

### 5.1 Day 1 (2026-04-02)

| 시간 | 수행 내용 |
|------|-----------|
| 09:30 | 공격 인프라 3대 구축 (C2, 리다이렉터, 오퍼레이터) |
| 10:00~ | 4팀 Notion  — JWT RSA Key, AWS Key, Kakao Secret, DB 크리덴셜, Gmail 앱 비밀번호 전체 발견 |
| 11:00~ | RSA Private Key로 ADMIN JWT 위조 성공 (forged-admin-jwt.txt) |
| 12:00~ | AWS IAM Key로 S3 버킷(goormgb-qna) Defacement 업로드 성공 |
| 15:40 | staging.playball.one 발견 (Vercel) |
| 15:41 | api.staging.playball.one 발견 (ALB 직접 노출, Cloudflare 없음) |
| 15:42 | Swagger UI 전체 노출 확인 |
| 15:43 | `POST /auth/loadtest/signup` → hacker001 계정 무인가 생성 성공 (201) |
| 15:45 | 위조 ADMIN JWT → `/auth/me` → id:1 grgbdev@gmail.com 관리자 계정 장악 |
| 15:46 | actuator/metrics에서 K8s 내부 서비스 DNS 4개 발견 |
| 15:52 | K8s API 서버 발견: 52.78.83.41:443 (401 Unauthorized) |
| 15:55 | Gmail SMTP 로그인 성공 → IMAP으로 24개 이메일 전체 열람 |
| 16:16~ | 7팀 S2N Scanner 자동 스캔 (143초, 2,010 요청, 105건 발견) |

### 5.2 Day 3 (2026-04-04)

| 시간 | 수행 내용 |
|------|-----------|
| 14:47 | `GET /order/clubs` → 200 OK (무인증 구단 데이터 탈취) |
| 14:47 | POST/PUT/PATCH/DELETE → 500 (Gateway 쓰기 인증 우회 확인) |
| 14:48 | `actuator/metrics/http.client.requests` → 내부 라우트 5개 + K8s URI 추출 |
| 14:49 | Thread Pool 무제한 발견 (`executor.pool.max = 2,147,483,647`) |
| 14:50 | Admin 엔드포인트 7개 존재 확인 (401 반환) |
| 4팀 점검 | Kiali prod 무인증 → VirtualService PATCH 200 성공 |
| 4팀 점검 | kafka-ui 무인증 → 결제 데이터 2,212건 열람, readOnly:false 확인 |
| 1팀 점검 | 좌석 IDOR + 결제 0원 조작 공격 체인 완성. 주문 ID 열거, Turnstile 우회 확인 |

---

## 6. 방어팀 패치 현황

| 항목 | Day 1 상태 | Day 3 상태 | 패치 여부 |
|------|-----------|-----------|----------|
| loadtest/signup 인증 | 인증 없음 (201) | API Key 필요 | ✅ 완료 |
| Internal API Key | 유출 키 유효 | 로테이션 완료 | ✅ 완료 |
| Swagger UI | 200 (전체 노출) | 404 (제거됨) | ✅ 완료 |
| Prod IP 화이트리스트 | 차단 | 차단 유지 | ✅ 유지 (유일한 방어선) |
| Staging Cloudflare | 없음 | 없음 | ❌ 미패치 |
| Actuator 외부 노출 | 200 | 200 | ❌ 미패치 |
| Gateway 쓰기 인증 | 없음 | 500 (인증 없음) | ❌ 미패치 |
| 결제 금액 서버 검증 | 없음 | 없음 | ❌ 미패치 |
| 좌석 IDOR 검증 | 없음 | 없음 | ❌ 미패치 |
| Kiali 인증 | 없음 | 없음 | ❌ 미패치 |
| kafka-ui 인증 | 없음 | 없음 | ❌ 미패치 |
| CSP 헤더 | 없음 | 없음 | ❌ 미패치 (S2N 신규) |
| Rate Limiting (로그인) | 없음 | 없음 | ❌ 미패치 (S2N 신규) |

---

## 7. 권고사항

### 7.1 즉시 조치 (P0 — 24시간 이내)

1. **모든 시크릿 즉시 로테이션** — JWT RSA 키, AWS IAM 키, Kakao Secret, DB 비밀번호, Gmail 앱 비밀번호, DB 암호화 키
2. **결제 금액 서버 측 재계산** — 클라이언트 `totalPrice` 전송 금지, DB 기준 좌석 가격 산정
3. **좌석 hold 소유권 검증** — 해당 사용자에게 할당된 seatId인지 서버 측 교차 검증
4. **Kiali 인증 활성화** — OIDC 인증 즉시 적용, VPN 이동
5. **kafka-ui 인증 적용 및 readOnly:true 설정**
6. **K8s API 서버 프라이빗 엔드포인트 전환**

### 7.2 단기 조치 (1~2주)

8. Staging에 Cloudflare 적용 (ALB 직접 노출 차단)
9. Actuator 인증 적용 — `management.endpoints.web.exposure.include=health,info`만 노출
10. Gateway 쓰기 메서드 인증 필터 필수 적용
11. Thread Pool 제한 — `executor.pool.max`를 200~500으로 설정
12. loadtest API 완전 제거 — 모든 환경에서 비활성화
13. Turnstile cfToken 하드코딩 바이패스 문자열(`ok-local-dev`) 제거
14. ArgoCD Google OAuth 허용 도메인 제한 추가
15. 로그인 엔드포인트 Rate Limiting 적용 (IP당 5회/분)
16. Content-Security-Policy 헤더 설정 (S2N 발견)
17. Origin 헤더 검증 — 상태 변경 엔드포인트에서 허용 Origin 화이트리스트 적용

### 7.3 중기 조치 (1~3개월)

18. 시크릿 관리 체계 구축 — AWS Secrets Manager, HashiCorp Vault 도입
19. CI/CD 시크릿 스캔 자동화 — git-secrets, truffleHog
20. CloudBeaver, RedisInsight, Grafana를 VPN 뒤로 이동
21. 대기열 토큰 서명 강화 및 서버 측 Queue 통과 검증
22. 주문 ID를 UUID 등 비순차적 식별자로 변경
23. JWT 키 관리 체계 구축 (AWS KMS 활용)
24. 정기적 자동화 보안 스캔 파이프라인 구축 (S2N Scanner CI/CD 연동)

---

## 8. OWASP Top 10 매핑

| OWASP | 취약점 | 심각도 | 발견 |
|-------|--------|--------|------|
| A01: Broken Access Control | Gateway 쓰기 인증 우회, IDOR, loadtest 무인가, Actuator 노출 | CRITICAL/HIGH | 발견 |
| A02: Cryptographic Failures | RSA Private Key 노출, DB 암호화 키, Admission Key 노출 | CRITICAL | 발견 |
| A03: Injection | 앱 레벨 SQLi 필터 차단. OS Command Injection 의심 (S2N) | HIGH (의심) | 부분 |
| A04: Insecure Design | 결제 금액 클라이언트 수용, Thread Pool 무제한, 단순 비밀번호 | CRITICAL/HIGH | 발견 |
| A05: Security Misconfiguration | Staging Cloudflare 미적용, Actuator 노출, CSP 누락 | CRITICAL/HIGH | 발견 |
| A07: Auth Failures | Gmail 앱 비밀번호, Kakao Secret, Rate Limiting 미설정 | CRITICAL/MEDIUM | 발견 |
| A08: Software Integrity | JWT 위조(ADMIN), S3 Defacement, 결제 금액 조작 | CRITICAL | 발견 |
| A09: Logging Failures | K8s 내부 DNS/라우트 메트릭 노출, 서버 리소스 노출 | HIGH | 발견 |
| A10: SSRF (잠재적) | K8s 내부 DNS 확보 — SSRF 발견 시 직접 호출 가능 | 잠재적 | 잠재 |

---
