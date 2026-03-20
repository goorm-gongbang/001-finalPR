import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="티켓팅 플로우">
            <h1>티켓팅 플로우</h1>
            <p>
                티켓팅은 대기열 진입부터 결제 완료까지 6개 Phase로 구성됩니다.
                각 단계는 보안 토큰과 분산 락으로 보호되어 대기열 우회, 좌석 중복 선점, 미결제 점유를 원천 차단합니다.
            </p>

            <hr />

            <h2>단계별 핵심 메커니즘</h2>
            <table>
                <thead><tr><th>Phase</th><th>핵심 기술</th><th>목적</th></tr></thead>
                <tbody>
                    <tr><td><strong>1. 대기열</strong></td><td>Redis Sorted Set</td><td>순서 보장 + 대량 트래픽 흡수</td></tr>
                    <tr><td><strong>2. 폴링</strong></td><td>동적 간격 (rank 기반)</td><td>서버 부하 최소화</td></tr>
                    <tr><td><strong>3. Seat 진입</strong></td><td>Admission Token (TTL 30초)</td><td>대기열 우회 차단</td></tr>
                    <tr><td><strong>4. 추천</strong></td><td>선호도 점수 (max 70점)</td><td>사용자 취향 반영</td></tr>
                    <tr><td><strong>5. 배정</strong></td><td>분산 락 + 연석/준연석 알고리즘</td><td>동시성 제어 + 연석 보장</td></tr>
                    <tr><td><strong>6. 주문/결제</strong></td><td>Hold 검증 (TTL 5분)</td><td>좌석 점유 증명</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>Phase 1 — 대기열 진입</h2>
            <p>
                사용자가 대기열에 진입하면 Redis Sorted Set에 타임스탬프 기반으로 순서가 기록됩니다.
                온보딩에서 입력된 좌석 선호도도 함께 <code>seat:preference</code> 키로 저장됩니다 (TTL 900초).
            </p>

            <h2>Phase 2 — 동적 폴링</h2>
            <p>클라이언트는 자신의 순위(rank)에 따라 폴링 간격을 조절합니다.</p>
            <table>
                <thead><tr><th>순위</th><th>폴링 간격</th></tr></thead>
                <tbody>
                    <tr><td>rank ≤ 100</td><td>1.5초</td></tr>
                    <tr><td>rank ≤ 1000</td><td>3초</td></tr>
                    <tr><td>rank &gt; 1000</td><td>5초</td></tr>
                </tbody>
            </table>
            <p>스케줄러가 상위 사용자를 READY로 승격시키면 30초짜리 Admission Token을 발급합니다.</p>

            <h2>Phase 3 — Seat 진입</h2>
            <p>
                Seat 서비스는 Admission Token을 검증하고 즉시 소멸시킵니다.
                일회용 토큰으로 재사용 및 대기열 우회를 원천 차단합니다.
            </p>

            <h2>Phase 4~5 — 추천 및 배정</h2>
            <p>
                추천 블록을 계산하고, 사용자가 블록을 선택하면 분산 락을 걸고 연석 탐색 알고리즘을 실행합니다.
                배정된 좌석은 5분간 Hold 됩니다.
            </p>

            <h2>Phase 6 — 주문 및 결제</h2>
            <p>Hold된 좌석을 검증하여 주문을 생성하고 결제를 처리합니다. 결제 수단은 카드, 가상계좌를 지원합니다.</p>
        </DocPageLayout>
    );
}
