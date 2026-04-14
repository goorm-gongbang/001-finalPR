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
                    <tr><td><strong>Refresh Token</strong></td><td>7일</td><td>HttpOnly Cookie + Redis</td><td>토큰 재발급 (RTR)</td></tr>
                    <tr><td><strong>Admission Token</strong></td><td>30초</td><td>Redis (queue:ready)</td><td>대기열 통과 → Seat 진입권</td></tr>
                    <tr><td><strong>Seat Hold</strong></td><td>5분</td><td>PostgreSQL (seat_holds)</td><td>좌석 점유 → 주문 생성 권한</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>핵심 설계 포인트</h2>

            <h3>RTR (Refresh Token Rotation)</h3>
            <p>
                토큰을 재발급할 때 기존 Refresh Token을 즉시 폐기합니다.
                토큰이 탈취되더라도 재사용이 불가능합니다.
            </p>

            <h3>블랙리스트 기반 로그아웃</h3>
            <p>
                로그아웃 시 Access Token의 JTI를 Redis 블랙리스트에 등록하고,
                남은 TTL 동안 API Gateway에서 해당 토큰을 차단합니다.
            </p>

            <h3>서비스 간 2단계 신뢰</h3>
            <p>
                서비스 간 신뢰는 <strong>Admission Token</strong>(대기열 → 좌석)과
                <strong>Seat Hold</strong>(좌석 → 주문) 2단계로 분리하여,
                대기열 우회와 중복 주문을 원천 차단합니다.
            </p>
        </DocPageLayout>
    );
}
