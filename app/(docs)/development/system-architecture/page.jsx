import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="시스템 아키텍처">
            <h1>시스템 아키텍처</h1>
            <p>
                사용자 요청은 CDN → NLB → Istio를 통과한 뒤 API Gateway에 도달합니다.
                Gateway에서 JWT를 중앙 검증하고 <code>X-User-Id</code> 헤더를 주입하여 하위 서비스로 라우팅합니다.
                하위 서비스는 JWT를 직접 파싱하지 않고 헤더만 신뢰합니다.
            </p>

            <hr />

            <h2>전체 구조</h2>
            <pre><code>{`flowchart TD
    U[사용자] --> CDN[Vercel CDN DDOS 방어]
    CDN --> NLB[NLB 접근 제한]
    NLB --> ISTIO[Istio Gateway WAF + mTLS]
    ISTIO --> G[API-Gateway :8085]
    G --> AG[Auth-Guard :8080]
    G --> Q[Queue :8081]
    G --> S[Seat :8082]
    G --> O[Order-Core :8083]`}</code></pre>

            <hr />

            <h2>서비스별 역할</h2>
            <table>
                <thead><tr><th>서비스</th><th>포트</th><th>핵심 책임</th></tr></thead>
                <tbody>
                    <tr><td><strong>API-Gateway</strong></td><td>8085</td><td>JWT 중앙 검증 (RSA 공개키), 라우팅, CORS, Swagger 통합</td></tr>
                    <tr><td><strong>Auth-Guard</strong></td><td>8080</td><td>Kakao OAuth, JWT 발급/갱신(RTR), 로그아웃/블랙리스트, 회원 탈퇴</td></tr>
                    <tr><td><strong>Queue</strong></td><td>8081</td><td>대기열 진입/폴링, Admission Token 발급, 선호도 저장</td></tr>
                    <tr><td><strong>Seat</strong></td><td>8082</td><td>좌석맵, 추천 블록 계산, 연석/준연석 배정, 분산 락 Hold</td></tr>
                    <tr><td><strong>Order-Core</strong></td><td>8083</td><td>주문 생성, Mock 결제, 마이페이지, 온보딩, 경기/구단 조회</td></tr>
                    <tr><td><strong>common-core</strong></td><td>—</td><td>공통 엔티티, 인증 필터, 설정, 예외 처리 (공유 라이브러리)</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>데이터 저장소</h2>
            <p>
                Redis는 <strong>Queue 전용</strong>과 <strong>Auth/Lock 전용</strong>으로 두 인스턴스를 분리합니다.
                티켓 오픈 시 대기열 트래픽이 폭발하더라도 인증이나 좌석 분산 락에 영향을 주지 않도록 설계했습니다.
            </p>
            <p>
                PostgreSQL은 단일 인스턴스에서 테이블 소유권을 서비스별로 명확히 분리합니다.
                각 서비스는 자신의 테이블만 쓰기하고, 다른 서비스 테이블은 읽기만 합니다.
            </p>
        </DocPageLayout>
    );
}
