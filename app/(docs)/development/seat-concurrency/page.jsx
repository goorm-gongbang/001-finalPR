import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="좌석 분산락/Hold 동시성">
            <h1>좌석 분산 락과 Hold 동시성 경합 문제</h1>
            <p>
                대규모 티켓팅 서비스에서 좌석 선점(Hold)은 두 가지 방식으로 동시에 일어납니다.
                추천 자동 배정과 일반 좌석 선택이 같은 블럭에서 충돌할 수 있으며, 동시성 제어 없이는 중복 배정 문제가 발생합니다.
            </p>

            <hr />

            <h2>두 가지 Hold 방식</h2>
            <table>
                <thead><tr><th>방식</th><th>설명</th><th>사용자 행동</th><th>락 단위</th></tr></thead>
                <tbody>
                    <tr>
                        <td><strong>추천 좌석 배정</strong></td>
                        <td>서버가 블럭 내 최적 N연석을 자동 배정</td>
                        <td>블럭 카드 선택 → "예매하기"</td>
                        <td>블럭(block)</td>
                    </tr>
                    <tr>
                        <td><strong>일반 좌석 선택 (포도알)</strong></td>
                        <td>유저가 좌석맵에서 직접 좌석 클릭</td>
                        <td>좌석 1개씩 직접 클릭</td>
                        <td>좌석(seat)</td>
                    </tr>
                </tbody>
            </table>

            <hr />

            <h2>SETNX → Redisson 전환</h2>
            <p>
                초기에 Spring Data Redis의 <code>setIfAbsent</code> 기반 단순 분산 락을 썼으나,
                <strong>Watch Dog 부재</strong>, <strong>소유자 검증 불가</strong>, <strong>재시도 로직 직접 구현</strong> 등의 문제로
                Redisson RLock으로 전환했습니다.
            </p>

            <table>
                <thead><tr><th></th><th>SETNX</th><th>Redisson RLock</th></tr></thead>
                <tbody>
                    <tr><td><strong>Watch Dog</strong></td><td>없음 → TTL 만료 시 락 이탈</td><td>자동 TTL 갱신 → 작업 완료까지 안전</td></tr>
                    <tr><td><strong>소유자 검증</strong></td><td>없음 → 아무나 삭제 가능</td><td>스레드 ID 기반 → 소유자만 해제</td></tr>
                    <tr><td><strong>대기/재시도</strong></td><td>직접 구현 (polling)</td><td><code>tryLock(waitTime)</code> 내장</td></tr>
                    <tr><td><strong>예외 안전</strong></td><td>직접 처리 필요</td><td>unlock 실패 시 Watch Dog이 만료 처리</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>시나리오 1: 추천 vs 추천 (같은 블럭)</h2>
            <p>
                <strong>블럭 단위 Redisson RLock + Watch Dog</strong>.
                추천 배정은 조회 → 연석 계산 → DB UPDATE → Hold 생성의 복합 연산이므로, 블럭 단위로 락을 잡습니다.
            </p>

            <h3>락-트랜잭션 분리 구조 (핵심 설계)</h3>
            <pre><code>{`SeatAssignmentService (락 관리, @Transactional 없음)
  └─ 🔒 락 획득
       └─ SeatAssignmentTransactionalService (@Transactional)
            └─ 조회 → 연석 계산 → markBlockedIfAvailable() → Hold 생성
            └─ 트랜잭션 커밋 ✅
       └─ 🔓 락 해제`}</code></pre>
            <p>
                이 구조는 <strong>트랜잭션 커밋이 반드시 락 해제보다 먼저 완료됨</strong>을 보장합니다.
                <code>@Transactional</code>이 걸린 서비스에서 직접 락을 관리하면, Spring AOP 프록시 특성상
                락 해제 → 트랜잭션 커밋 순서가 될 수 있어 위험합니다.
            </p>

            <h3>동작 흐름</h3>
            <pre><code>{`추천 유저A: 204블럭 5연석 요청
추천 유저B: 204블럭 3연석 요청 (동시)

유저A: 🔒 seat:recommendation:match:10:block:204 획득
유저B: 🔒 같은 키 획득 시도 → 대기 (최대 3초)

유저A: 빈 좌석 조회 → [3열 1~5번] 배정 → Hold 생성 → 트랜잭션 커밋
유저A: 🔓 락 해제

유저B: 🔒 락 획득 성공
유저B: 빈 좌석 조회 → [3열 1~5번]은 BLOCKED → [3열 6~8번] 배정`}</code></pre>

            <hr />

            <h2>시나리오 2: 일반 vs 일반 (같은 좌석)</h2>
            <p>
                <strong>좌석 단위 Redisson RLock</strong>.
                유저가 직접 선택한 좌석들만 잠그며, <strong>seatId 정렬 순 획득 + 역순 해제</strong>로 데드락을 방지합니다.
            </p>
            <table>
                <thead><tr><th></th><th>추천 블럭 락</th><th>일반 좌석 락</th></tr></thead>
                <tbody>
                    <tr><td><strong>락 단위</strong></td><td>블럭 (block)</td><td>개별 좌석 (seat)</td></tr>
                    <tr><td><strong>락 키</strong></td><td><code>seat:recommendation:match:{"{m}"}:block:{"{b}"}</code></td><td><code>seat:hold:match:{"{m}"}:seat:{"{s}"}</code></td></tr>
                    <tr><td><strong>Wait Time</strong></td><td>3초</td><td>500ms</td></tr>
                    <tr><td><strong>Lease Time</strong></td><td>Watch Dog (무제한 자동 갱신)</td><td>5초 (고정)</td></tr>
                </tbody>
            </table>

            <h3>데드락 방지: seatId 정렬 순 획득</h3>
            <pre><code>{`유저A가 좌석 [3, 1, 2]를 선택 → 정렬: [1, 2, 3] → 순서대로 락 획득
유저B가 좌석 [2, 3, 1]을 선택 → 정렬: [1, 2, 3] → 순서대로 락 획득

항상 같은 순서로 락을 획득하므로 데드락이 발생하지 않음.`}</code></pre>

            <hr />

            <h2>시나리오 3: 추천 ON vs 추천 OFF 교차 충돌</h2>
            <p>
                추천 블럭 락과 일반 좌석 락은 <strong>서로 다른 키</strong>를 사용합니다. 따라서 추천 유저가 블럭 락을 잡고 있어도,
                일반 유저는 같은 블럭의 좌석을 잡을 수 있습니다. 이 경우 <strong>조건부 UPDATE (Optimistic Lock)</strong>로 충돌을 감지합니다.
            </p>

            <pre><code>{`UPDATE match_seats
SET sale_status = 'BLOCKED'
WHERE id = :matchSeatId
  AND sale_status = 'AVAILABLE'
-- return 0이면 이미 다른 유저가 선점 → 롤백 후 재시도`}</code></pre>

            <p>
                충돌 시 최대 3회 재시도하며 다른 연석 구간을 탐색합니다.
            </p>

            <hr />

            <h2>충돌 시나리오별 처리 정리</h2>
            <table>
                <thead><tr><th>시나리오</th><th>락 메커니즘</th><th>충돌 감지</th><th>결과</th></tr></thead>
                <tbody>
                    <tr>
                        <td>추천 vs 추천 (같은 블럭)</td>
                        <td>Redisson RLock (블럭)</td>
                        <td>블럭 락 직렬화 (3초 대기)</td>
                        <td>먼저 획득한 유저 배정, 두 번째는 남은 좌석</td>
                    </tr>
                    <tr>
                        <td>일반 vs 일반 (같은 좌석)</td>
                        <td>Redisson RLock (좌석)</td>
                        <td>좌석 단위 직렬화 (500ms 대기)</td>
                        <td>먼저 획득한 유저 Hold, 두 번째는 에러</td>
                    </tr>
                    <tr>
                        <td>추천 vs 일반 (같은 좌석)</td>
                        <td>조건부 UPDATE</td>
                        <td><code>markBlockedIfAvailable()</code> return 0</td>
                        <td>추천 측이 롤백 후 다른 연석 재탐색</td>
                    </tr>
                    <tr>
                        <td>다른 블럭 간</td>
                        <td>독립</td>
                        <td>서로 다른 락 키</td>
                        <td>완전 병렬 처리, 충돌 없음</td>
                    </tr>
                </tbody>
            </table>

            <hr />

            <h2>SeatHold 엔티티와 TTL 관리</h2>
            <p>
                SeatHold는 <code>seat_holds</code> 테이블에 저장되며, <code>match_seat_id</code>에 UK 제약이 있어 좌석당 하나의 Hold만 허용합니다.
                TTL은 5분이며, <code>SeatHoldCleanupScheduler</code>가 60초 간격으로 만료 Hold를 정리합니다.
            </p>

            <h3>Hold 연장</h3>
            <p>
                유저가 이미 Hold 중인 좌석을 다시 요청하면 기존 Hold의 <code>expiresAt</code>을 갱신합니다 (새 Hold 생성 없이 연장).
            </p>

            <hr />

            <h2>트러블슈팅 히스토리</h2>
            <table>
                <thead><tr><th>커밋</th><th>문제</th><th>해결</th></tr></thead>
                <tbody>
                    <tr><td><code>0e1d3de</code></td><td>SETNX TTL 만료로 DB 트랜잭션 중 락 이탈</td><td>Redisson RLock + Watch Dog 도입</td></tr>
                    <tr><td><code>9012b12</code></td><td>Redisson에 leaseTime 지정 → Watch Dog 비활성화</td><td><code>tryLock(waitTime)</code>로 변경 (leaseTime 미지정)</td></tr>
                    <tr><td><code>1355c9a</code></td><td>@Transactional 서비스에서 락 관리 → 락 해제 후 커밋 순서 역전</td><td>락 관리를 외부(비트랜잭션) 서비스로 분리</td></tr>
                    <tr><td><code>2d97cb1</code></td><td>일반 좌석 WAIT_TIME 100ms → 피크 시 락 획득 실패율 증가</td><td>100ms → 500ms 상향</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
