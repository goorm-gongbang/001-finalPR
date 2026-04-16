import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="추천 알고리즘">
            <h1>추천 알고리즘</h1>
            <p>
                PlayBall의 추천 서비스는 일반 티켓팅 사이트와 차별화된 핵심 기능입니다.
                유저가 직접 좌석맵에서 좌석을 고르는 대신, <strong>온보딩 시 입력한 선호 데이터</strong>를 기반으로
                최적의 블럭을 1순위~10순위로 추천하고, 블럭을 선택하면 <strong>서버가 자동으로 최적 연석을 배정</strong>합니다.
                추천 시스템은 <strong>블록 추천(Phase 1)</strong>과 <strong>좌석 배정(Phase 2)</strong> 두 단계로 나뉩니다.
            </p>

            <hr />

            <h2>온보딩 선호 데이터</h2>
            <p>회원가입 직후 온보딩 과정에서 다음 데이터를 수집합니다.</p>
            <table>
                <thead><tr><th>데이터</th><th>엔티티</th><th>추천 알고리즘 사용</th></tr></thead>
                <tbody>
                    <tr><td>선호 구단</td><td><code>OnboardingPreference.favoriteClub</code></td><td>1루/3루 블럭 방향 결정</td></tr>
                    <tr><td>응원석 인접 선호</td><td><code>cheerProximityPref</code> (NEAR/FAR/ANY)</td><td>응원석 근접 블럭 가산점</td></tr>
                    <tr><td>뷰포인트 우선순위</td><td><code>OnboardingViewpointPriority</code> (1~3순위)</td><td>뷰포인트 매칭 가산점</td></tr>
                    <tr><td>선호 블럭 목록</td><td><code>OnboardingPreferredBlock</code></td><td>추천 대상 블럭 필터링</td></tr>
                </tbody>
            </table>

            <h3>구단 기반 1루/3루 자동 판정</h3>
            <pre><code>{`경기: 삼성 라이온즈 vs 한화 이글스
유저 선호 구단: 삼성 라이온즈

Case 1: 삼성이 홈(1루)일 때    → 1루(홈) 블럭 쪽 추천 가산점 +25점
Case 2: 삼성이 어웨이(3루)일 때 → 3루(어웨이) 블럭 쪽 추천 가산점 +25점
Case 3: 삼성이 참여하지 않는 경기 → 뷰포인트 우선순위로 판정`}</code></pre>

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
                    <tr><td><strong>응원구단 매칭</strong></td><td>경기 참가 구단 선호 + 블럭 진영 일치</td><td>+25점</td></tr>
                    <tr><td><strong>응원석 근접 (NEAR)</strong></td><td>NEAR 선호 + cheerRank ≤ 3</td><td>+15점</td></tr>
                    <tr><td><strong>응원석 원거리 (FAR)</strong></td><td>FAR 선호 + cheerRank &gt; 3</td><td>+15점</td></tr>
                </tbody>
            </table>

            <h3>정렬 기준</h3>
            <ol>
                <li><strong>1차</strong>: 가용 연석 수 (차이가 10석 초과 시 바로 결정)</li>
                <li><strong>2차</strong>: 연석 수 차이 ≤ 10 → 취향 점수 높은 순</li>
                <li><strong>3차</strong>: 동점 시 → 연석 개수 순</li>
            </ol>

            <pre><code>{`예시 (N=4명 요청):

블럭 A: 연석 42개, 선호도 65점
블럭 B: 연석 38개, 선호도 55점
블럭 C: 연석 40개, 선호도 70점

A vs C: |42-40| = 2 ≤ 10 → 선호도 비교 → C(70) > A(65) → C가 상위
A vs B: |42-38| = 4 ≤ 10 → 선호도 비교 → A(65) > B(55) → A가 상위
최종: C(1순위) → A(2순위) → B(3순위)

만약 블럭 D: 연석 5개, 선호도 70점이라면
A vs D: |42-5| = 37 > 10 → 연석 수 비교 → A가 상위
(선호도가 아무리 높아도 좌석이 너무 적으면 하위 랭크)`}</code></pre>

            <hr />

            <h2>Phase 2 — 좌석 배정</h2>
            <p>
                사용자가 블록을 선택하면 <strong>Redisson 블럭 단위 분산 락</strong>을 획득하고,
                실연석(같은 열 연속 N석) → 준연석(인접 2열 N석) 순으로 탐색합니다.
            </p>

            <h3>배정 우선순위</h3>
            <ol>
                <li><strong>실연석 (Real Consecutive)</strong> — 같은 행의 연속 좌석
                    <ul>
                        <li>Priority 1: 앞줄 (rowNo 오름차순)</li>
                        <li>Priority 2: 통로 근접 (aisleDistance 오름차순)</li>
                        <li>Priority 3: 왼쪽 (startCol 오름차순)</li>
                    </ul>
                </li>
                <li><strong>준연석 (Semi-Consecutive)</strong> — 인접 2행 겹침 (인접석 토글 ON 시)
                    <ul>
                        <li>두 행이 물리적으로 인접 (rowNo 차이 = 1)</li>
                        <li>수평 겹침(overlap) &gt; 0 필수</li>
                        <li>Priority: 앞줄 합 → 겹침 수 최대 → 평균 통로 근접</li>
                    </ul>
                </li>
                <li><strong>준연석도 없는 경우</strong> — 추천 좌석 없음 반환</li>
            </ol>

            <h3>통로 근접도 (Aisle Distance) 계산</h3>
            <pre><code>{`rowStartCol = 해당 열의 첫 번째 좌석 열번호
rowEndCol = 해당 열의 마지막 좌석 열번호

leftDistance = groupStartCol - rowStartCol   (왼쪽 통로까지 거리)
rightDistance = rowEndCol - groupEndCol       (오른쪽 통로까지 거리)

aisleDistance = min(leftDistance, rightDistance)`}</code></pre>

            <h3>동시성 제어 (조건부 UPDATE)</h3>
            <p>
                좌석 상태 변경 시 <code>markBlockedIfAvailable()</code> 조건부 UPDATE로 일반 좌석 선택 모드와의 충돌까지 안전하게 감지합니다.
                실연석/준연석 각각 최대 3회 재시도로 다른 연석 구간을 탐색합니다.
            </p>
            <pre><code>{`UPDATE match_seats
SET sale_status = 'BLOCKED'
WHERE id = :matchSeatId
  AND sale_status = 'AVAILABLE'
-- return 0이면 이미 다른 유저가 선점 → 롤백 후 재시도`}</code></pre>

            <p>
                배정된 좌석은 <strong>5분간 Hold</strong> 상태가 되며, 만료 시 <code>SeatHoldCleanupScheduler</code>에 의해
                60초 간격으로 자동 해제됩니다.
            </p>

            <hr />

            <h2>추천 ON vs 추천 OFF</h2>
            <table>
                <thead><tr><th>항목</th><th>추천 ON</th><th>추천 OFF (일반 선택)</th></tr></thead>
                <tbody>
                    <tr><td>블럭 선택</td><td>서버가 추천 (1~10순위)</td><td>유저가 직접 선택</td></tr>
                    <tr><td>좌석 배정</td><td>서버가 자동 배정 (연석)</td><td>유저가 좌석맵에서 직접 클릭</td></tr>
                    <tr><td>락 단위</td><td>블럭 단위 Redisson RLock (Watch Dog)</td><td>좌석 단위 Redisson RLock (500ms wait)</td></tr>
                    <tr><td>인원수</td><td>예매 옵션에서 사전 설정</td><td>클릭한 좌석 수 = 인원수</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
