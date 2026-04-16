import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="Redis 구성">
            <h1>Redis 구성</h1>
            <p>
                Redis는 두 개의 독립적인 인스턴스로 분리하여 운영합니다.
                티켓 오픈 시 대기열 트래픽이 폭발해도 인증과 좌석 분산 락 성능에 영향을 주지 않도록 설계했습니다.
            </p>

            <hr />

            <h2>인스턴스 분리 구성</h2>

            <h3>공용 Redis :6379 (Gateway / Auth-Guard / Seat / Order-Core)</h3>
            <table>
                <thead><tr><th>Key</th><th>Type</th><th>설명</th><th>TTL</th></tr></thead>
                <tbody>
                    <tr><td><code>refresh_token:{"{jti}"}</code></td><td>STRING</td><td>Refresh Token 저장 (IP/UA 포함)</td><td>설정 가능 (기본 4시간)</td></tr>
                    <tr><td><code>token_blacklist:{"{jti}"}</code></td><td>STRING</td><td>로그아웃 토큰 차단</td><td>남은 Access Token TTL</td></tr>
                    <tr><td><code>user-by-id:{"{userId}"}</code></td><td>STRING (JSON)</td><td>User DTO 분산 캐시</td><td>10분</td></tr>
                    <tr><td><code>auth-me:{"{userId}"}</code></td><td>STRING (JSON)</td><td>/auth/me 응답 캐시</td><td>30초</td></tr>
                    <tr><td><code>seat:booking-options:{"{m}:{u}"}</code></td><td>STRING (JSON)</td><td>예매 옵션 (추천/인원수/인접석)</td><td>900초 (15분)</td></tr>
                    <tr><td><code>seat:recommendation:match:{"{m}"}:block:{"{b}"}</code></td><td>Redisson RLock</td><td>블럭 단위 분산 락 (Watch Dog)</td><td>자동 갱신</td></tr>
                    <tr><td><code>seat:hold:match:{"{m}"}:seat:{"{s}"}</code></td><td>Redisson RLock</td><td>좌석 단위 분산 락</td><td>5초 lease</td></tr>
                    <tr><td><code>seat-groups-response:{"{m}"}</code></td><td>STRING (JSON)</td><td>좌석맵 API 응답 캐시</td><td>5초</td></tr>
                    <tr><td><code>matches-list-response:{"{date}"}</code></td><td>STRING (JSON)</td><td>경기 목록 API 응답 캐시</td><td>30초</td></tr>
                    <tr><td><code>rate_limit:{"{ip}:{ep}"}</code></td><td>STRING (INCR)</td><td>Rate Limiting 카운터 (prod)</td><td>60초</td></tr>
                </tbody>
            </table>

            <h3>Queue 전용 Redis :6380</h3>
            <table>
                <thead><tr><th>Key</th><th>Type</th><th>설명</th><th>TTL</th></tr></thead>
                <tbody>
                    <tr><td><code>queue:wait:{"{matchId}"}</code></td><td>ZSET</td><td>대기열 사용자 순서 (score = 진입 타임스탬프)</td><td>없음</td></tr>
                    <tr><td><code>queue:ready:{"{m}:{u}"}</code></td><td>STRING</td><td>Ready 상태 토큰 payload</td><td>60초 (설정 가능)</td></tr>
                    <tr><td><code>queue:ready:index:{"{m}"}</code></td><td>SET</td><td>Ready 유저 인덱스 (cleanup용)</td><td>없음</td></tr>
                    <tr><td><code>queue:expired:{"{m}:{u}"}</code></td><td>STRING</td><td>만료 마커</td><td>300초</td></tr>
                    <tr><td><code>queue:match</code></td><td>SET</td><td>활성 티켓팅 경기 목록</td><td>없음</td></tr>
                    <tr><td><code>queue:precheck:booking-option:{"{m}:{u}"}</code></td><td>STRING</td><td>PreQueue 검증용 예매 옵션 마커</td><td>900초</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>인스턴스 분리 이유</h2>
            <table>
                <thead><tr><th>문제</th><th>해결</th></tr></thead>
                <tbody>
                    <tr><td>대기열 폭발 시 Redis 부하 → 인증/락 지연</td><td>Queue 전용 인스턴스 분리로 영향 차단</td></tr>
                    <tr><td>블랙리스트 확인 지연 → JWT 검증 병목</td><td>공용 Redis(Auth/Lock)가 항상 안정적 응답 보장</td></tr>
                    <tr><td>좌석 분산 락 실패 → 동시성 이슈</td><td>대기열 트래픽과 분리되어 락 성공률 보장</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>Redis 활용 전략 정리</h2>

            <h3>1. 캐시 계층 (Caffeine vs Redis)</h3>
            <table>
                <thead><tr><th>항목</th><th>Caffeine (로컬)</th><th>Redis (원격)</th></tr></thead>
                <tbody>
                    <tr><td>저장 위치</td><td>JVM 힙 메모리</td><td>별도 서버</td></tr>
                    <tr><td>접근 시간</td><td>&lt; 1μs</td><td>0.5~2ms (+네트워크)</td></tr>
                    <tr><td>인스턴스 간 공유</td><td>각자 따로</td><td>공유됨 (단일 소스)</td></tr>
                    <tr><td>일관성</td><td>노드별 달라질 수 있음</td><td>단일 소스</td></tr>
                    <tr><td>적합 데이터</td><td>불변 (Match, Section, Block)</td><td>변동 가능 (User, 응답)</td></tr>
                </tbody>
            </table>

            <h3>2. 분산 락 (Redisson RLock)</h3>
            <p>
                SETNX 기반 단순 락에서 <strong>Redisson RLock</strong>으로 전환했습니다.
                Watch Dog으로 DB 트랜잭션 지연 시 TTL 자동 갱신, 스레드 ID 기반 소유자 검증,
                Pub/Sub 기반 효율적 대기 등을 제공합니다.
            </p>

            <h3>3. Lua 스크립트 원자 연산 (Phase 4 최적화)</h3>
            <p>
                대기열 재진입 시 ZREM + ZADD + ZRANK + ZCARD를 Lua 스크립트로 묶어
                <strong>3 RTT → 1 RTT</strong>로 단축했습니다.
            </p>
            <pre><code>{`-- queue:re-enter atomic script
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2])
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
local rank = redis.call('ZRANK', KEYS[1], ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
return {rank, count}`}</code></pre>

            <hr />

            <h2>PostgreSQL 테이블 소유권</h2>
            <table>
                <thead><tr><th>서비스</th><th>소유 테이블</th><th>비고</th></tr></thead>
                <tbody>
                    <tr><td><strong>Auth-Guard</strong></td><td>users, user_sns, dev_users, withdrawal_requests</td><td>회원 관리 (AES-GCM 암호화)</td></tr>
                    <tr><td><strong>Seat</strong></td><td>seats, blocks, sections, areas, match_seats, seat_holds, price_policies</td><td>좌석/가격 구조</td></tr>
                    <tr><td><strong>Order-Core</strong></td><td>orders, order_seats, payments, cash_receipts, cancellation_fee_policies, inquiries</td><td>주문/결제 (PII 암호화)</td></tr>
                    <tr><td><strong>공유 (common-core)</strong></td><td>matches, clubs, stadiums, onboarding_preferences, onboarding_preferred_blocks, onboarding_viewpoint_priority</td><td>공유 도메인</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
