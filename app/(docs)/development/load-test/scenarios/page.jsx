import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="테스트 시나리오 Flow">
            <h1>테스트 시나리오 — Flow 설명</h1>
            <p>
                각 <code>flow.js</code> 스크립트가 호출하는 엔드포인트 조합과 순서를 정리한 문서입니다.
                실제 유저가 밟는 단계(경기 상세 → 대기열 → 좌석 → 결제)를 시뮬레이션하기 위해
                여러 엔드포인트를 순차적으로 호출합니다.
            </p>

            <hr />

            <h2>0. Flow 공통 구조</h2>
            <p>
                k6 스크립트에서 <strong>Flow</strong>는 한 VU가 실행할 <strong>요청 시퀀스</strong>입니다.
                실제 유저의 예매 동선을 재현하기 위해 여러 단계로 구성됩니다.
            </p>

            <pre><code>{`VU 1개 = 1명의 가상 사용자
  └─ iteration 반복 (duration 만료까지)
       ├─ Phase 1: booking-options
       ├─ Phase 2: queue-enter
       ├─ Phase 3: queue-status 폴링 (READY까지)
       ├─ Phase 4: rec-seat-entry
       ├─ Phase 5: rec-blocks
       ├─ Phase 6: rec-assign
       ├─ Phase 7: order-sheet
       ├─ Phase 8: order-create
       └─ Phase 9: order-payment`}</code></pre>

            <p>
                Flow가 실패하면 중간에서 끊기므로, 각 Phase의 성공률/응답시간이 전체 흐름의 건강도를 나타냅니다.
            </p>

            <hr />

            <h2>1. Queue Flow (<code>queue/flow.js</code>)</h2>
            <p><strong>목적</strong>: 예매 옵션 저장 + 대기열 진입 기본 동작 검증 (경량 부하 측정용)</p>

            <h3>호출 엔드포인트</h3>
            <table>
                <thead>
                    <tr><th>#</th><th>Service</th><th>Endpoint</th><th>Method</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/booking-options`}</code></td><td>POST</td></tr>
                    <tr><td>2</td><td>Queue</td><td><code>{`/queue/matches/{matchId}/enter`}</code></td><td>POST</td></tr>
                </tbody>
            </table>

            <h3>특징</h3>
            <ul>
                <li>VU당 iteration마다 한 번씩만 실행</li>
                <li>폴링/좌석 선택은 생략 → 가장 가벼운 Flow</li>
                <li>Phase 1 ~ Phase 4에서 반복적으로 이 Flow로 병목을 측정</li>
            </ul>

            <hr />

            <h2>2. Seat Flow (<code>seat/flow.js</code>) — 추천 OFF (포도알)</h2>
            <p>
                <strong>목적</strong>: 추천 OFF 상태에서 <strong>포도알(블럭 좌석맵) 직접 선택 → Hold</strong>
                플로우 전체 검증
            </p>

            <h3>호출 엔드포인트</h3>
            <table>
                <thead>
                    <tr><th>#</th><th>Service</th><th>Endpoint</th><th>Method</th><th>설명</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/booking-options`}</code></td><td>POST</td><td>recommendationEnabled=false</td></tr>
                    <tr><td>2</td><td>Queue</td><td><code>{`/queue/matches/{matchId}/enter`}</code></td><td>POST</td><td>대기열 진입</td></tr>
                    <tr><td>3</td><td>Queue</td><td><code>{`/queue/matches/{matchId}/status`}</code></td><td>GET</td><td>READY까지 폴링 (1.5~5초 간격)</td></tr>
                    <tr><td>4</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/seat-groups`}</code></td><td>GET</td><td>포도알(블럭) 목록 조회</td></tr>
                    <tr><td>5</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/sections/{sectionId}/blocks`}</code></td><td>GET</td><td>섹션별 블럭 상세 (AVAILABLE 좌석)</td></tr>
                    <tr><td>6</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/seat-holds`}</code></td><td>POST</td><td>좌석 Hold 요청 (1~8석)</td></tr>
                </tbody>
            </table>

            <h3>특징</h3>
            <ul>
                <li><code>admissionToken</code>을 Set-Cookie에서 추출하여 후속 요청에 전달 (HttpOnly 쿠키)</li>
                <li>좌석 Hold 시 <strong>409 (이선좌)</strong>가 발생하면 <strong>다른 블럭으로 재시도</strong> (최대 5회)</li>
                <li>이선좌 경합은 정상 동시성 제어 결과이지만, 반복되면 좌석 부족 상태</li>
                <li>
                    동적 폴링 간격: 서버가 <code>pollingMs</code> 내려주는 값 사용
                    (rank ≤100 → 1.5s, ≤1000 → 3s, &gt;1000 → 5s)
                </li>
            </ul>

            <hr />

            <h2>3. Recommendation Flow (<code>recommendation/flow.js</code>) — 추천 ON</h2>
            <p>
                <strong>목적</strong>: 추천 ON 상태에서 <strong>블럭 추천 → 자동 배정</strong> 전체 플로우 검증
            </p>

            <h3>호출 엔드포인트</h3>
            <table>
                <thead>
                    <tr><th>#</th><th>Service</th><th>Endpoint</th><th>Method</th><th>설명</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/booking-options`}</code></td><td>POST</td><td>recommendationEnabled=true, ticketCount</td></tr>
                    <tr><td>2</td><td>Queue</td><td><code>{`/queue/matches/{matchId}/enter`}</code></td><td>POST</td><td>대기열 진입</td></tr>
                    <tr><td>3</td><td>Queue</td><td><code>{`/queue/matches/{matchId}/status`}</code></td><td>GET</td><td>READY까지 폴링</td></tr>
                    <tr><td>4</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/recommendations/seat-entry`}</code></td><td>GET</td><td>추천 좌석 진입 (세션 초기화)</td></tr>
                    <tr><td>5</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/recommendations/blocks`}</code></td><td>GET</td><td>추천 블럭 리스트 (1~10순위)</td></tr>
                    <tr><td>6</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/recommendations/blocks/{blockId}/assign`}</code></td><td>POST</td><td>블럭 선택 → 자동 N연석 배정</td></tr>
                </tbody>
            </table>

            <h3>특징</h3>
            <ul>
                <li>
                    블럭 배정 시 <strong>1순위부터 순차 시도</strong>
                    <ul>
                        <li><code>200/201</code> → 성공, 종료</li>
                        <li><code>409</code> (경합) → 같은 순위 1회 재시도 후 다음 순위</li>
                        <li><code>404</code> (연석 없음) → 바로 다음 순위</li>
                        <li><code>410</code> (admissionToken 만료) → 중단</li>
                    </ul>
                </li>
                <li><strong>실연석/준연석 구분</strong>: 응답의 <code>semiConsecutive</code> 필드로 측정</li>
                <li>모든 블럭 시도 실패 시 좌석 배정 실패</li>
            </ul>

            <hr />

            <h2>4. Order Flow (<code>order/flow.js</code>) — E2E 전체</h2>
            <p>
                <strong>목적</strong>: 추천 배정 성공 후 <strong>주문서 → 주문 생성 → 결제</strong>까지
                엔드투엔드 검증
            </p>

            <h3>호출 엔드포인트 (9단계)</h3>
            <table>
                <thead>
                    <tr><th>#</th><th>Service</th><th>Endpoint</th><th>Method</th><th>설명</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/booking-options`}</code></td><td>POST</td><td>recommendationEnabled=true</td></tr>
                    <tr><td>2</td><td>Queue</td><td><code>{`/queue/matches/{matchId}/enter`}</code></td><td>POST</td><td>대기열 진입</td></tr>
                    <tr><td>3</td><td>Queue</td><td><code>{`/queue/matches/{matchId}/status`}</code></td><td>GET</td><td>READY까지 폴링</td></tr>
                    <tr><td>4</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/recommendations/seat-entry`}</code></td><td>GET</td><td>추천 세션 진입</td></tr>
                    <tr><td>5</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/recommendations/blocks`}</code></td><td>GET</td><td>추천 블럭 리스트</td></tr>
                    <tr><td>6</td><td>Seat</td><td><code>{`/seat/matches/{matchId}/recommendations/blocks/{blockId}/assign`}</code></td><td>POST</td><td>좌석 자동 배정 (Hold 5분)</td></tr>
                    <tr><td>7</td><td>Order-Core</td><td><code>{`/order/mypage/orders/sheet?matchId={m}&seatIds={s}`}</code></td><td>GET</td><td>주문서 조회 (가격 계산)</td></tr>
                    <tr><td>8</td><td>Order-Core</td><td><code>/order/mypage/orders</code></td><td>POST</td><td>주문 생성 (PAYMENT_PENDING)</td></tr>
                    <tr><td>9</td><td>Order-Core</td><td><code>{`/order/mypage/orders/{orderId}/payment`}</code></td><td>POST</td><td>결제 처리 (TOSS_PAY/KAKAO_PAY/BANK_TRANSFER)</td></tr>
                </tbody>
            </table>

            <h3>특징</h3>
            <ul>
                <li>추천 Flow의 모든 단계 + 주문/결제 3단계 추가</li>
                <li>
                    주문서 조회에서 <strong>서버사이드 가격 재계산</strong> (클라이언트 조작 방지)
                    <ul>
                        <li><code>totalPrice = Σ(seatPrice) + 2000</code> (예매 수수료)</li>
                    </ul>
                </li>
                <li>결제 완료 후 Kafka <code>payment-completed</code> 이벤트 → Seat가 <code>BLOCKED → SOLD</code> 전환</li>
                <li>경기당 최대 <strong>8매 제한</strong> (<code>MAX_TICKETS_PER_ORDER</code>)</li>
            </ul>

            <hr />

            <h2>5. Flow별 엔드포인트 매트릭스</h2>
            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Queue</th>
                        <th>Seat</th>
                        <th>Rec</th>
                        <th>Order(E2E)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>POST <code>/seat/.../booking-options</code></td><td>O</td><td>O</td><td>O</td><td>O</td></tr>
                    <tr><td>POST <code>/queue/.../enter</code></td><td>O</td><td>O</td><td>O</td><td>O</td></tr>
                    <tr><td>GET <code>/queue/.../status</code></td><td></td><td>O</td><td>O</td><td>O</td></tr>
                    <tr><td>GET <code>/seat/.../seat-groups</code></td><td></td><td>O</td><td></td><td></td></tr>
                    <tr><td>GET <code>{`/seat/.../sections/{s}/blocks`}</code></td><td></td><td>O</td><td></td><td></td></tr>
                    <tr><td>POST <code>/seat/.../seat-holds</code></td><td></td><td>O</td><td></td><td></td></tr>
                    <tr><td>GET <code>/seat/.../rec/seat-entry</code></td><td></td><td></td><td>O</td><td>O</td></tr>
                    <tr><td>GET <code>/seat/.../rec/blocks</code></td><td></td><td></td><td>O</td><td>O</td></tr>
                    <tr><td>POST <code>{`/seat/.../rec/blocks/{b}/assign`}</code></td><td></td><td></td><td>O</td><td>O</td></tr>
                    <tr><td>GET <code>/order/.../orders/sheet</code></td><td></td><td></td><td></td><td>O</td></tr>
                    <tr><td>POST <code>/order/.../orders</code></td><td></td><td></td><td></td><td>O</td></tr>
                    <tr><td>POST <code>{`/order/.../orders/{o}/payment`}</code></td><td></td><td></td><td></td><td>O</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>6. Flow별 부하 특성</h2>
            <table>
                <thead>
                    <tr><th>Flow</th><th>RPS 경향</th><th>주요 병목 지점</th><th>측정 목적</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>Queue</strong></td><td>높음 (300+ RPS)</td><td>DB 커넥션, booking-options 저장</td><td><strong>최소 부하로 DB/커넥션 풀 측정</strong></td></tr>
                    <tr><td><strong>Seat (추천 OFF)</strong></td><td>중간 (280 RPS)</td><td>포도알 조회 (N+1 쿼리), 좌석 경합</td><td>동시 좌석 선택 경합 검증</td></tr>
                    <tr><td><strong>Recommendation (추천 ON)</strong></td><td>중간 (290 RPS)</td><td>추천 블럭 계산, 블럭 분산 락</td><td><strong>핵심 기능</strong> 안정성 검증</td></tr>
                    <tr><td><strong>Order E2E</strong></td><td>낮음 (190 RPS)</td><td>전체 체인, 주문 생성 Hold 검증</td><td><strong>엔드투엔드 안정성</strong> 검증</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>7. Flow 데이터 준비</h2>

            <h3>7.1 MATCH_IDS</h3>
            <p>Flow는 <code>MATCH_IDS</code> 환경변수로 대상 경기를 설정합니다.</p>
            <ul>
                <li>단일: <code>MATCH_IDS=100</code></li>
                <li>복수 로테이션: <code>MATCH_IDS=100,101,102</code> → VU/iteration 별로 rotation</li>
            </ul>

            <h3>7.2 로그인 계정</h3>
            <p>k6는 <strong>1,001개의 부하테스트 전용 계정</strong> (<code>loadtest-login</code>)을 순환 사용합니다.</p>
            <ul>
                <li>각 VU당 별도 계정 → 동시 인증 흐름 시뮬레이션</li>
                <li>Refresh Token TTL은 15분 (부하테스트용 단축)</li>
                <li>기본 RefreshToken은 4시간 TTL (Redis 메모리 누적 방지)</li>
            </ul>

            <h3>7.3 AuthMode</h3>
            <table>
                <thead>
                    <tr><th>모드</th><th>설명</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>multiple</code></td><td>여러 계정을 VU별로 순환 (기본)</td></tr>
                    <tr><td><code>single</code></td><td>모든 VU가 같은 계정 사용 (인증 캐시 테스트용)</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>8. 폴링 간격 동적 조절</h2>
            <p>
                Queue 서비스는 클라이언트에 <code>pollingMs</code>를 내려보내, 클라이언트가 서버 부하에 맞춰
                폴링 간격을 조절하도록 합니다.
            </p>
            <table>
                <thead>
                    <tr><th>대기 순위</th><th><code>pollingMs</code></th><th>효과</th></tr>
                </thead>
                <tbody>
                    <tr><td>rank ≤ 100</td><td>1,500ms</td><td>곧 입장 가능한 유저에 빠른 피드백</td></tr>
                    <tr><td>rank ≤ 1,000</td><td>3,000ms</td><td>중간 대기</td></tr>
                    <tr><td>rank &gt; 1,000</td><td>5,000ms</td><td>긴 대기 유저는 서버 부하 절감</td></tr>
                    <tr><td><code>READY</code> 상태</td><td>1,000ms</td><td>입장 가능 알림 빈도</td></tr>
                </tbody>
            </table>
            <p>k6도 이 값을 존중하여 실제 사용자 폴링을 재현합니다.</p>

            <hr />

            <h2>9. 예외 상황 처리</h2>

            <h3>9.1 429 (Too Many Requests) — CDN/ALB Rate Limit</h3>
            <ul>
                <li>발생 시 백오프: <code>pollIntervalSec * 1.5</code>, 최대 10초</li>
                <li>최대 3회 재시도 (booking-options, queue-enter)</li>
            </ul>

            <h3>9.2 409 (Conflict) — 좌석 경합</h3>
            <ul>
                <li><strong>이선좌 = 다른 유저가 이미 선점</strong> (정상 동시성 제어 결과)</li>
                <li>Seat Flow: 다른 블럭(포도알)으로 재시도 (최대 5회)</li>
                <li>Recommendation Flow: 같은 순위 1회 재시도 → 다음 순위</li>
            </ul>

            <h3>9.3 410 (Gone) — Admission Token 만료</h3>
            <ul>
                <li>좌석 진입 15분 초과</li>
                <li>재시도 없이 중단 (대기열 재진입 필요)</li>
            </ul>

            <h3>9.4 404 (Not Found)</h3>
            <ul>
                <li><code>/recommendations/blocks</code>: 선호 블럭 내 연석 없음 → Flow 종료</li>
                <li><code>{`/recommendations/blocks/{b}/assign`}</code>: 블럭 내 연석 없음 → 다음 순위</li>
            </ul>

            <hr />

            <p>
                이 Flow 구조를 이해하면, 각 테스트 결과의 <strong>병목 지점</strong>을 정확히 짚을 수 있습니다.
                예를 들어 <code>booking-options</code>이 1.5s, <code>rec-blocks</code>가 1.2s라면
                Seat 서비스 내부에서 DB 조회/캐시 miss가 발생하고 있다는 의미입니다.
            </p>
        </DocPageLayout>
    );
}
