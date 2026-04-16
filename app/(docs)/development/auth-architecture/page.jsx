import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="인증 아키텍처">
            <h1>인증 아키텍처</h1>
            <p>
                RSA 비대칭키 방식을 사용합니다. <strong>Auth-Guard가 개인키로 서명</strong>하고,
                <strong>API Gateway가 공개키로 검증</strong>합니다. Gateway만 JWT를 파싱하고,
                하위 서비스는 <code>X-User-Id</code> 헤더만 읽습니다.
            </p>

            <hr />

            <h2>토큰 설계</h2>
            <table>
                <thead><tr><th>토큰</th><th>TTL</th><th>저장 위치</th><th>용도</th></tr></thead>
                <tbody>
                    <tr><td><strong>Access Token</strong></td><td>15분</td><td>클라이언트 메모리</td><td>API 인증</td></tr>
                    <tr><td><strong>Refresh Token</strong></td><td>4시간 (부하테스트용) / 설정 가능</td><td>HttpOnly Cookie + Redis</td><td>토큰 재발급 (RTR)</td></tr>
                    <tr><td><strong>Admission Token</strong></td><td>15분</td><td>HttpOnly Cookie</td><td>대기열 통과 → Seat 진입권</td></tr>
                    <tr><td><strong>Seat Hold</strong></td><td>5분</td><td>PostgreSQL (<code>seat_holds</code>)</td><td>좌석 점유 → 주문 생성 권한</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>JWT 토큰 구조</h2>
            <pre><code>{`Access Token Claims:
├─ sub: userId (subject)
├─ aud: JWT_ACCESS_TOKEN_AUDIENCE
├─ iss: JWT_ISSUER
├─ iat: 발급 시각
├─ exp: 만료 시각 (기본 15분)
├─ jti: 고유 토큰 ID (블랙리스트 키)
├─ tokenType: "ACCESS"
├─ auth: 권한 (ROLE_USER 등)
└─ sid: 세션 ID (RTR 시 유지)

Admission Token Claims (Queue → Seat 진입권):
├─ sub: userId
├─ matchId: 대상 경기 ID
├─ type: "ADMISSION"
├─ iss: "queue-service"
├─ exp: 15분 TTL
└─ jti: 고유 ID`}</code></pre>

            <hr />

            <h2>핵심 설계 포인트</h2>

            <h3>RTR (Refresh Token Rotation)</h3>
            <p>
                토큰을 재발급할 때 기존 Refresh Token을 즉시 폐기하고 새 토큰을 발급합니다.
                토큰이 탈취되더라도 재사용이 불가능하며, <code>sid</code>(세션 ID)는 유지되어 세션 추적이 가능합니다.
            </p>
            <pre><code>{`1. Client → POST /auth/token/refresh (쿠키에 Refresh Token)
2. Auth-Guard: Redis에서 기존 RT 검증 (jti 일치 확인)
3. 기존 RT 삭제 (Redis DEL)
4. 새 Access Token + 새 Refresh Token 발급 (sid 유지)
5. 새 RT를 Redis에 저장 (IP, UA 포함)
6. 만약 삭제된 RT로 재요청 → 401 (탈취 의심)`}</code></pre>

            <h3>블랙리스트 기반 로그아웃</h3>
            <p>
                로그아웃 시 Access Token의 JTI를 Redis 블랙리스트(<code>token_blacklist:{"{jti}"}</code>)에 등록하고,
                남은 TTL 동안 API Gateway에서 해당 토큰을 차단합니다 (Reactive Redis로 sub-ms 응답).
            </p>

            <h3>서비스 간 2단계 신뢰</h3>
            <p>
                서비스 간 신뢰는 <strong>Admission Token</strong>(대기열 → 좌석)과
                <strong>Seat Hold</strong>(좌석 → 주문) 2단계로 분리하여,
                대기열 우회와 중복 주문을 원천 차단합니다.
            </p>

            <h3>Internal API Key (타이밍-세이프 비교)</h3>
            <p>
                <code>/internal/**</code>, <code>/loadtest/**</code> 엔드포인트는 <code>X-Internal-Api-Key</code> 헤더로 보호됩니다.
                <code>MessageDigest.isEqual()</code>을 사용하여 타이밍 공격을 방어합니다.
            </p>

            <h3>유저 차단 Kafka 연쇄 처리</h3>
            <pre><code>{`AI 방어 서버
│  POST /internal/users/{userId}/block
│  Header: X-Internal-Api-Key: {secret}
▼
Auth-Guard
├─ 1. User.status = BLOCKED (PostgreSQL)
├─ 2. 차단 유저 로그인 시도 → 403 USER_ALREADY_BLOCKED
├─ 3. TransactionSynchronization.afterCommit()
└─ 4. Kafka publish → topic: user-blocked
       ▼
Order-Core (KafkaListener)
└─ 해당 userId의 활성 주문 → status = UNDER_REVIEW`}</code></pre>

            <hr />

            <h2>쿠키 보안 설정</h2>
            <p>
                Refresh Token과 Admission Token 모두 <code>HttpOnly + Secure + SameSite=None</code>로 설정되어
                XSS 토큰 탈취와 CSRF 공격을 방어합니다.
            </p>
        </DocPageLayout>
    );
}
