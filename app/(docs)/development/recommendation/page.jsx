import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="추천 알고리즘">
            <h1>추천 알고리즘</h1>
            <p>
                추천 시스템은 <strong>블록 추천(Phase 1)</strong>과 <strong>좌석 배정(Phase 2)</strong> 두 단계로 나뉩니다.
                사용자 온보딩 선호도를 기반으로 최적 블록을 추천하고, 선택 후 분산 락을 이용해 연석을 안전하게 배정합니다.
            </p>

            <hr />

            <h2>Phase 1 — 블록 추천</h2>
            <p>선호 블록(최대 10개)만 탐색하여 실제 N연석이 가능한 묶음 수를 계산하고, 취향 점수를 매깁니다.</p>

            <h3>취향 점수 계산 (최대 70점)</h3>
            <table>
                <thead><tr><th>항목</th><th>조건</th><th>점수</th></tr></thead>
                <tbody>
                    <tr><td><strong>뷰포인트 우선순위</strong></td><td>1순위 블록</td><td>30점</td></tr>
                    <tr><td><strong>뷰포인트 우선순위</strong></td><td>2순위 블록</td><td>20점</td></tr>
                    <tr><td><strong>뷰포인트 우선순위</strong></td><td>3순위 블록</td><td>10점</td></tr>
                    <tr><td><strong>응원구단 매칭</strong></td><td>경기 참가 구단 선호</td><td>+25점</td></tr>
                    <tr><td><strong>응원석 근접</strong></td><td>NEAR 선호 + cheerRank ≤ 3</td><td>+15점</td></tr>
                    <tr><td><strong>응원석 원거리</strong></td><td>FAR 선호 + cheerRank &gt; 3</td><td>+15점</td></tr>
                </tbody>
            </table>

            <h3>정렬 기준</h3>
            <ol>
                <li>연석 수 차이 &gt; 10 → 연석 개수 많은 순</li>
                <li>연석 수 차이 ≤ 10 → 취향 점수 높은 순</li>
                <li>동점 시 → 연석 개수 순</li>
            </ol>

            <hr />

            <h2>Phase 2 — 좌석 배정</h2>
            <p>사용자가 블록을 선택하면 Redis 분산 락을 걸고 연석 탐색을 시작합니다.</p>

            <h3>배정 우선순위</h3>
            <ol>
                <li><strong>같은 행(row)의 연속 좌석</strong> — 가장 앞 열, 통로에 가까운 좌석 우선</li>
                <li><strong>연석이 없는 경우</strong> — 인접 2행에 걸친 준연석으로 fallback</li>
                <li><strong>준연석도 없는 경우</strong> — 추천 좌석 없음 반환</li>
            </ol>
            <p>
                배정된 좌석은 <strong>5분간 Hold</strong> 상태가 되며, 그 안에 결제를 완료해야 합니다.
                만료 시 Hold가 자동 해제됩니다.
            </p>
        </DocPageLayout>
    );
}
