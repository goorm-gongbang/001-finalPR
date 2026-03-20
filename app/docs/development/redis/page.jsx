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

            <h3>Redis #1 — Queue 전용</h3>
            <table>
                <thead><tr><th>Key</th><th>Type</th><th>설명</th><th>TTL</th></tr></thead>
                <tbody>
                    <tr><td><code>queue:wait:{"{matchId}"}</code></td><td>ZSET</td><td>대기열 사용자 순서 관리</td><td>없음</td></tr>
                    <tr><td><code>queue:ready:{"{m}:{u}"}</code></td><td>STRING</td><td>대기열 입장 허용 토큰</td><td>30초</td></tr>
                    <tr><td><code>seat:preference:{"{m}:{u}"}</code></td><td>STRING</td><td>사용자 좌석 선호 캐시</td><td>900초</td></tr>
                    <tr><td><code>queue:match</code></td><td>SET</td><td>활성 티켓팅 경기 목록</td><td>없음</td></tr>
                </tbody>
            </table>

            <h3>Redis #2 — Auth / Lock 전용</h3>
            <table>
                <thead><tr><th>Key</th><th>Type</th><th>설명</th><th>TTL</th></tr></thead>
                <tbody>
                    <tr><td><code>refresh_token:{"{jti}"}</code></td><td>STRING</td><td>Refresh Token 저장</td><td>7일</td></tr>
                    <tr><td><code>token_blacklist:{"{jti}"}</code></td><td>STRING</td><td>로그아웃 토큰 차단</td><td>남은 AccessToken TTL</td></tr>
                    <tr><td><code>block_lock:{"{blockId}"}</code></td><td>STRING (SETNX)</td><td>블록 단위 좌석 락</td><td>5초</td></tr>
                    <tr><td><code>seat:session:{"{token}"}</code></td><td>HASH</td><td>좌석 선택 세션 관리</td><td>세션 TTL</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>분리 이유</h2>
            <table>
                <thead><tr><th>문제</th><th>해결</th></tr></thead>
                <tbody>
                    <tr><td>대기열 폭발 시 Redis 부하 → 인증/락 지연</td><td>Queue 전용 인스턴스 분리로 영향 차단</td></tr>
                    <tr><td>블랙리스트 확인 지연 → JWT 검증 병목</td><td>Auth/Lock 인스턴스가 항상 안정적 응답 보장</td></tr>
                    <tr><td>좌석 분산 락 실패 → 동시성 이슈</td><td>대기열 트래픽과 분리되어 락 성공률 보장</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>PostgreSQL 테이블 소유권</h2>
            <table>
                <thead><tr><th>서비스</th><th>소유 테이블</th><th>비고</th></tr></thead>
                <tbody>
                    <tr><td><strong>Auth-Guard</strong></td><td>users, user_sns, withdrawal_requests</td><td>회원 관리</td></tr>
                    <tr><td><strong>Seat</strong></td><td>seats, blocks, match_seats, seat_holds, price_policies</td><td>좌석/가격 구조</td></tr>
                    <tr><td><strong>Order-Core</strong></td><td>orders, order_seats, payments, cash_receipts</td><td>주문/결제</td></tr>
                    <tr><td><strong>common-core</strong></td><td>matches, clubs, stadiums</td><td>공유 도메인</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
