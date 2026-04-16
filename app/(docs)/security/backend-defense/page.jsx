import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="security" title="백엔드 방어 체계">
            <h1>백엔드 방어 체계 현황</h1>
            <p>
                v1.13.0-staging 기준 백엔드 보안 구현 현황입니다.
                구현 완료 <strong>28건</strong> · 침투테스트 대응 <strong>6건</strong> · 추후 과제 <strong>4건</strong>.
            </p>

            <hr />

            <h2>전체 방어 레이어</h2>
            <pre><code>{`외부 요청 (사용자 / 공격자)
        ▼
인프라 레이어 (클라우드팀)
  Istio Sidecar · mTLS · 네트워크 정책 · Cloudflare WAF
        ▼
게이트웨이 레이어 (API-Gateway :8085)
  JWT 인증 · 봇 UA 차단 · Rate Limiting · CORS
        ▼
서비스 레이어
  Auth-Guard: RSA JWT · RTR · 유저 차단
  Queue: Admission Token · Pre-Queue 검증
  Seat: Redisson 분산 락 · 좌석 수량 제한
  Order-Core: 주문 8매 제한 · Kafka 차단 소비
        ▼
데이터 레이어
  PostgreSQL: AES-256-GCM 암호화
  Redis: 블랙리스트 · 분산 락 · Rate Limit
  Kafka: user-blocked · payment-completed
        ▼ ◀◀ AI 방어 서버 연동 ▶▶
AI 방어 레이어 (AI팀)
  실시간 봇 탐지 · 행동 패턴 분석 · LLM 사후 분석`}</code></pre>

            <hr />

            <h2>2.1 API-Gateway (라우팅 / 1차 필터링)</h2>
            <table>
                <thead><tr><th>방어 기능</th><th>상태</th><th>구현 파일</th></tr></thead>
                <tbody>
                    <tr><td><strong>JWT 인증 필터</strong> — RSA256 공개키 검증 + 블랙리스트 체크 + X-User-Id 주입</td><td>구현 완료</td><td><code>JwtAuthenticationFilter.java</code></td></tr>
                    <tr><td><strong>봇 User-Agent 차단</strong> — curl, wget, python, selenium, puppeteer, playwright, headless + UA 20자 미만</td><td>구현 완료</td><td><code>BotUserAgentBlockFilter.java</code></td></tr>
                    <tr><td><strong>화이트리스트 HTTP 메서드 제한</strong> — GET_ONLY/POST_ONLY 구조화</td><td>침투테스트 대응</td><td><code>JwtAuthenticationFilter.java</code></td></tr>
                    <tr><td><strong>CORS Origin 검증</strong> — ALLOWED_ORIGINS 환경변수 기반 WebFilter</td><td>구현 완료</td><td><code>CorsGlobalFilter.java</code></td></tr>
                    <tr><td><strong>Rate Limiting (prod)</strong> — Redis Lua + Fail-open, 로그인 10회/분, 일반 100회/분</td><td>침투테스트 대응</td><td><code>RateLimitingFilter.java</code></td></tr>
                    <tr><td><strong>Rate Limit 모니터링</strong> — 429 응답 시 clientIP/path 로깅</td><td>구현 완료</td><td><code>RateLimitMonitoringFilter.java</code></td></tr>
                </tbody>
            </table>

            <hr />

            <h2>2.2 Auth-Guard (인증 / 토큰 / 유저 관리)</h2>
            <table>
                <thead><tr><th>방어 기능</th><th>상태</th></tr></thead>
                <tbody>
                    <tr><td><strong>RSA256 비대칭키 JWT</strong> — Auth-Guard만 개인키 보유</td><td>구현 완료</td></tr>
                    <tr><td><strong>Refresh Token Rotation (RTR)</strong> — 기존 토큰 삭제 + 새 발급, sid 유지</td><td>구현 완료</td></tr>
                    <tr><td><strong>Access Token 블랙리스트</strong> — 로그아웃 시 JTI 저장</td><td>구현 완료</td></tr>
                    <tr><td><strong>Internal API Key 필터</strong> — <code>MessageDigest.isEqual()</code> 타이밍-세이프 비교</td><td>구현 완료</td></tr>
                    <tr><td><strong>유저 차단/해제 API</strong> — AI 서버 연동</td><td>구현 완료</td></tr>
                    <tr><td><strong>Kafka user-blocked 이벤트</strong> — AFTER_COMMIT phase 발행</td><td>구현 완료</td></tr>
                    <tr><td><strong>OAuth Redirect URI 검증</strong> — scheme+host+port 화이트리스트</td><td>구현 완료</td></tr>
                    <tr><td><strong>차단 유저 로그인 거부</strong> — 403 USER_ALREADY_BLOCKED</td><td>구현 완료</td></tr>
                    <tr><td><strong>RefreshToken IP/UA 저장</strong> — 사후 분석용</td><td>구현 완료</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>2.3 Queue (대기열 / Admission Token)</h2>
            <table>
                <thead><tr><th>방어 기능</th><th>상태</th></tr></thead>
                <tbody>
                    <tr><td><strong>Redis Sorted Set 대기열</strong> — score 기반 순서 보장</td><td>구현 완료</td></tr>
                    <tr><td><strong>Admission Token (RSA JWT)</strong> — userId + matchId 바인딩, 15분 TTL, 일회용</td><td>구현 완료</td></tr>
                    <tr><td><strong>Pre-Queue 검증</strong> — 예매 옵션 설정 여부 확인</td><td>구현 완료</td></tr>
                    <tr><td><strong>HttpOnly + Secure + SameSite=None 쿠키</strong></td><td>구현 완료</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>2.4 Seat (좌석 선택 / 동시성 제어)</h2>
            <table>
                <thead><tr><th>방어 기능</th><th>상태</th></tr></thead>
                <tbody>
                    <tr><td><strong>Admission Token 검증</strong> — RSA 서명, matchId, userId, 만료 검증</td><td>구현 완료</td></tr>
                    <tr><td><strong>좌석 단위 Redisson 분산 락</strong> — 정렬 순 획득 + 역순 해제</td><td>구현 완료</td></tr>
                    <tr><td><strong>블럭 단위 Redisson 분산 락</strong> — Watch Dog 자동 TTL 갱신</td><td>구현 완료</td></tr>
                    <tr><td><strong>Booking Options Resilience4j @Retry</strong> — PreQueue 마커 비동기 재시도</td><td>구현 완료</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>2.5 Order-Core (주문 / 결제)</h2>
            <table>
                <thead><tr><th>방어 기능</th><th>상태</th></tr></thead>
                <tbody>
                    <tr><td><strong>user-blocked Kafka 소비</strong> — UNDER_REVIEW 처리</td><td>구현 완료</td></tr>
                    <tr><td><strong>주문당 최대 8매 제한</strong> — <code>MAX_TICKETS_PER_ORDER = 8</code></td><td>침투테스트 대응</td></tr>
                    <tr><td><strong>PII 필드 AES-256-GCM 암호화</strong> — 이름, 이메일, 전화번호, 생년월일</td><td>구현 완료</td></tr>
                    <tr><td><strong>주문 DTO 유효성 검증</strong> — @NotBlank, @Email, @Pattern, @Min, @Size</td><td>구현 완료</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>2.6 common-core (공통 보안 인프라)</h2>
            <table>
                <thead><tr><th>방어 기능</th><th>상태</th></tr></thead>
                <tbody>
                    <tr><td><strong>AES-256-GCM 필드 암호화</strong> — staging/prod 프로필, 12byte IV + 128bit 태그</td><td>구현 완료</td></tr>
                    <tr><td><strong>암호화 캐시 Dirty Checking 방지</strong> — ThreadLocal 기반</td><td>구현 완료</td></tr>
                    <tr><td><strong>SHA-256 해싱</strong> — 카카오 OAuth provider ID</td><td>구현 완료</td></tr>
                    <tr><td><strong>HSTS + X-Frame-Options: DENY</strong> — 모든 서비스 적용 (maxAge=31536000)</td><td>구현 완료</td></tr>
                    <tr><td><strong>Actuator 노출 최소화</strong> — health, prometheus만 허용</td><td>침투테스트 대응</td></tr>
                    <tr><td><strong>Thread Pool 제한</strong> — Tomcat 200~400, TaskExecutor max 50, HikariCP 20~30</td><td>침투테스트 대응</td></tr>
                    <tr><td><strong>Request Logging (MDC)</strong> — IP/UA/Referer/SessionId → Grafana Loki</td><td>구현 완료</td></tr>
                    <tr><td><strong>세션 STATELESS</strong> — Spring Security SessionCreationPolicy</td><td>구현 완료</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>3. 침투테스트 대응 결과</h2>
            <p>2026-04-02~04 72시간 모의해킹에서 발견된 취약점 <strong>6건 전부 패치 완료</strong>.</p>
            <table>
                <thead><tr><th>ID</th><th>취약점</th><th>심각도</th><th>대응</th><th>상태</th></tr></thead>
                <tbody>
                    <tr><td>C-09</td><td>좌석 IDOR — 수량 무제한</td><td>CRITICAL</td><td><code>MAX_TICKETS_PER_ORDER = 8</code></td><td>패치 완료</td></tr>
                    <tr><td>H-04</td><td>Gateway 쓰기 인증 우회</td><td>HIGH</td><td><code>WhitelistEntry</code> 메서드 구조화</td><td>패치 완료</td></tr>
                    <tr><td>H-05</td><td>Actuator 전체 노출</td><td>HIGH</td><td>health/prometheus만 허용</td><td>패치 완료</td></tr>
                    <tr><td>H-09</td><td>Thread Pool 무제한</td><td>HIGH</td><td>max 50 / HikariCP 20~30</td><td>패치 완료</td></tr>
                    <tr><td>M-09</td><td>주문 ID 순차 열거</td><td>MEDIUM</td><td>UUID orderNumber + 403/404 통일</td><td>패치 완료</td></tr>
                    <tr><td>M-12</td><td>Rate Limiting 미설정</td><td>MEDIUM</td><td>Redis Lua 기반 Rate Limiting</td><td>패치 완료</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>4. 추후 과제</h2>
            <ul>
                <li><strong>OAuth state 파라미터 검증</strong> — 카카오 OAuth callback CSRF 방어</li>
                <li><strong>IP 기반 큐 진입 제한</strong> — 동일 IP 무제한 진입 방지</li>
                <li><strong>좌석 Hold 반복 패턴 감지</strong> — hold/release 무한 반복 DoS (AI 협업)</li>
                <li><strong>RefreshToken 메타데이터 확장</strong> — Accept-Language, GeoIP</li>
            </ul>

            <hr />

            <h2>5. 보안 모니터링 메트릭</h2>
            <table>
                <thead><tr><th>서비스</th><th>메트릭</th><th>활용</th></tr></thead>
                <tbody>
                    <tr><td>Auth-Guard</td><td><code>ticketing_auth_attempts_total</code></td><td>브루트포스 탐지</td></tr>
                    <tr><td>Auth-Guard</td><td><code>ticketing_security_macro_detected_total</code></td><td>자동화 도구 추이</td></tr>
                    <tr><td>Auth-Guard</td><td><code>ticketing_auth_user_blocked_total</code></td><td>차단 현황</td></tr>
                    <tr><td>Queue</td><td><code>ticketing_queue_abandoned_total</code></td><td>봇 패턴 (즉시 이탈 반복)</td></tr>
                    <tr><td>Seat</td><td><code>ticketing_seat_hold_fail_total</code></td><td>lock 타임아웃 / 수량 초과</td></tr>
                    <tr><td>Seat</td><td><code>ticketing_seat_lock_wait_seconds</code></td><td>분산 락 대기시간 p50/p95/p99</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
