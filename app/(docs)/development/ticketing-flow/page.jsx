import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="티켓팅 플로우">
            <h1>티켓팅 플로우 (추천 ON)</h1>
            <p>
                티켓팅은 대기열 진입부터 결제 완료까지 7개 STEP으로 구성됩니다.
                각 단계는 보안 토큰과 분산 락으로 보호되어 대기열 우회, 좌석 중복 선점, 미결제 점유를 원천 차단합니다.
                일반적인 티켓팅 사이트와 달리 PlayBall은 <strong>추천 서비스</strong>를 통해 사용자 선호 기반으로 블럭을 추천하고
                서버가 최적 연석을 자동 배정합니다.
            </p>

            <hr />

            <h2>전체 흐름</h2>
            <pre><code>{`STEP 1          STEP 2          STEP 3         STEP 4           STEP 5          STEP 6          STEP 7
경기 상세       대기열 화면      공잡기 미션     추천 블록 카드     좌석 자동        주문서 확인      결제 완료
페이지          (순번 대기)      (VQA)          선택              배정 완료

[예매하기]  →   대기열 진입  →   VQA 통과   →   추천 블록 10개 →  N연석 배정  →    결제 진행   →   좌석 SOLD
  클릭          폴링 대기        AI 검증         선호도 순위       Hold 5분         카카오페이       주문 완료`}</code></pre>

            <hr />

            <h2>단계별 핵심 메커니즘</h2>
            <table>
                <thead><tr><th>STEP</th><th>핵심 기술</th><th>목적</th></tr></thead>
                <tbody>
                    <tr><td><strong>1. 예매 조건 저장</strong></td><td>Redis <code>seat:booking-options</code> (15분 TTL)</td><td>추천 ON/OFF · 인원수 · 인접석 토글 보존</td></tr>
                    <tr><td><strong>2. 대기열 진입</strong></td><td>Redis Sorted Set <code>queue:wait:{"{matchId}"}</code></td><td>순서 보장 + 대량 트래픽 흡수</td></tr>
                    <tr><td><strong>3. 동적 폴링 + VQA</strong></td><td>Admission Token (RSA JWT, 15분 TTL) + AI 봇 탐지</td><td>대기열 우회 차단 + 매크로 방어</td></tr>
                    <tr><td><strong>4. 블럭 추천</strong></td><td>선호도 점수 (최대 70점) + 가용 연석 수 랭킹</td><td>사용자 취향 반영 1순위~10순위</td></tr>
                    <tr><td><strong>5. 좌석 자동배정</strong></td><td>Redisson 블럭 분산 락 + 실연석/준연석 알고리즘</td><td>동시성 제어 + 연석 보장</td></tr>
                    <tr><td><strong>6. 주문서 확인</strong></td><td>Hold 검증 (5분 TTL) + 서버사이드 가격 재계산</td><td>좌석 점유 증명 + 조작 방지</td></tr>
                    <tr><td><strong>7. 결제 완료</strong></td><td>Kafka <code>payment-completed</code> → Seat</td><td>BLOCKED → SOLD 비동기 확정</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>STEP 1 — 경기 상세 / 예매 옵션 저장</h2>
            <p>
                사용자가 추천 ON/OFF, 인원수, 인접석 토글을 설정하고 [예매하기] 버튼을 누르면,
                Seat 서비스가 예매 옵션을 Redis에 저장하고 Queue 전용 Redis에 PreQueue 마커를 동기화합니다.
            </p>
            <pre><code>{`POST /seat/matches/{matchId}/booking-options
Body: { recommendationEnabled: true, ticketCount: 4, nearAdjacentToggle: false }

→ Seat Redis: SET seat:booking-options:{matchId}:{userId}     (TTL 900s)
→ Queue Redis: SET queue:precheck:booking-option:{m}:{u}      (TTL 900s)
                                                                (Resilience4j @Retry)`}</code></pre>

            <h2>STEP 2 — 대기열 진입</h2>
            <p>
                Redis Sorted Set에 타임스탬프 기반으로 순서가 기록됩니다.
                스케줄러가 1초마다 100명씩 Ready 상태로 승격하고, 승격된 유저에게 Admission Token(RSA JWT, 15분 TTL)이 발급됩니다.
                토큰은 HttpOnly + Secure + SameSite=None 쿠키로 전달됩니다.
            </p>

            <h2>STEP 3 — 동적 폴링 + 공잡기 미션 (VQA)</h2>
            <p>클라이언트는 자신의 순위(rank)에 따라 폴링 간격을 조절합니다.</p>
            <table>
                <thead><tr><th>순위</th><th>폴링 간격</th><th>이유</th></tr></thead>
                <tbody>
                    <tr><td>rank ≤ 100</td><td>1.5초</td><td>곧 입장할 유저에게 빠른 피드백</td></tr>
                    <tr><td>rank ≤ 1000</td><td>3초</td><td>중간 대기</td></tr>
                    <tr><td>rank &gt; 1000</td><td>5초</td><td>긴 대기, 서버 부하 절감</td></tr>
                    <tr><td>READY 상태</td><td>1초</td><td>입장 가능 알림</td></tr>
                </tbody>
            </table>
            <p>
                대기 중 VQA(Visual Question Answering) 야구공잡기 게임이 실행되고, AI 방어 서버가 마우스 패턴/클릭 속도를
                실시간 수집하여 봇 여부를 판단합니다. 의심 시 챌린지/즉시 차단 처리됩니다.
            </p>

            <h2>STEP 4 — 블럭 추천</h2>
            <p>
                사용자의 온보딩 선호 블럭 중에서 가용 연석 수와 선호도 점수를 기준으로 1~10순위 블럭을 반환합니다.
            </p>
            <pre><code>{`GET /seat/matches/{matchId}/recommendations/blocks
→ [
    { rank: 1, blockId: 204, blockName: "오렌지 C", consecutiveCount: 42, score: 65 },
    { rank: 2, blockId: 207, blockName: "옐로 A", consecutiveCount: 38, score: 55 },
    ...
  ]`}</code></pre>

            <h2>STEP 5 — 좌석 자동 배정</h2>
            <p>
                사용자가 블럭을 선택하면 <strong>Redisson 블럭 단위 분산 락</strong>을 획득한 뒤,
                실연석(같은 열 N석) → 준연석(인접 2열 N석) 순으로 탐색합니다.
                <code>markBlockedIfAvailable()</code> 조건부 UPDATE로 일반 좌석 선택과의 충돌도 안전하게 감지합니다.
            </p>

            <h2>STEP 6 — 주문서 확인 / 주문 생성</h2>
            <p>
                Hold 만료 여부 검증, 좌석 가격 서버사이드 재계산(클라이언트 조작 방지), 기존 미결제 주문 자동 취소 후
                Order 엔티티를 <code>PAYMENT_PENDING</code> 상태로 생성합니다. 주문당 <strong>최대 8매</strong>(<code>MAX_TICKETS_PER_ORDER</code>)로 제한됩니다.
            </p>

            <h2>STEP 7 — 결제 처리 + 좌석 SOLD 확정</h2>
            <p>
                결제 완료 후 Kafka <code>payment-completed</code> 이벤트가 발행되며,
                Seat 서비스가 이를 소비하여 좌석 상태를 BLOCKED → SOLD로 전환합니다.
            </p>
            <pre><code>{`Order-Core ──[payment-completed]──→ Kafka ──→ Seat (BLOCKED → SOLD)`}</code></pre>

            <hr />

            <h2>토큰 체인</h2>
            <pre><code>{`Access Token (로그인)
     │
     ├→ 대기열 진입 → Admission Token 발급 (대기열 → 좌석 진입권, 15분 TTL)
     │                    │
     │                    ├→ 좌석 Hold (5분 TTL)
     │                    │       │
     │                    │       ├→ 주문 생성 (PAYMENT_PENDING)
     │                    │       │       │
     │                    │       │       └→ 결제 → SOLD (Kafka 이벤트)
     │                    │       │
     │                    │       └→ 5분 초과 시 자동 해제 (SeatHoldCleanupScheduler)
     │                    │
     │                    └→ 15분 초과 시 Admission Token 만료
     │
     └→ Refresh Token → Access Token 재발급 (RTR 방식)`}</code></pre>
        </DocPageLayout>
    );
}
