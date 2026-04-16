import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="MSA · EDA 전환">
            <h1>MSA 구조와 EDA 전환 — Kafka 채택 이유</h1>
            <p>
                PlayBall은 <strong>5개 마이크로서비스(MSA)</strong>로 구성되지만, 데이터베이스는 아직 단일 인스턴스에
                논리적 소유권만 분리된 과도기 상태입니다. 이번 스프린트에서는 서비스 간 강결합을 풀기 위해
                <strong>Apache Kafka 기반 EDA(Event-Driven Architecture)</strong>로 전환했습니다.
                또한 추후 <strong>Payment 서비스 분리</strong>와 <strong>DB 스키마 분리</strong>를 위한 사전 설계로
                Kafka를 선제적으로 도입한 배경을 정리합니다.
            </p>

            <hr />

            <h2>1. 현재 상태 (AS-IS)</h2>

            <h3>1-1. MSA 구성</h3>
            <table>
                <thead><tr><th>서비스</th><th>포트</th><th>역할</th></tr></thead>
                <tbody>
                    <tr><td>API-Gateway</td><td>8085</td><td>JWT 중앙 검증, 라우팅, Rate Limiting, 봇 차단</td></tr>
                    <tr><td>Auth-Guard</td><td>8080</td><td>Kakao OAuth, JWT 발급/갱신(RTR), 유저 차단/해제</td></tr>
                    <tr><td>Queue</td><td>8081</td><td>Redis ZSET 대기열, Admission Token 발급</td></tr>
                    <tr><td>Seat</td><td>8082</td><td>좌석 추천/배정, Redisson 분산 락, Hold 관리</td></tr>
                    <tr><td>Order-Core</td><td>8083</td><td><strong>주문 + 결제 + 마이페이지가 한 서비스에 혼재</strong></td></tr>
                </tbody>
            </table>

            <h3>1-2. DB — "MSA인데 DB는 하나"</h3>
            <p>
                물리적으로는 <strong>단일 PostgreSQL 인스턴스 (db.t4g.small)</strong>를 공유합니다.
                각 서비스가 자신의 테이블만 쓰기하고 타 서비스 테이블은 읽기만 하는 <strong>논리적 소유권 규칙</strong>만
                정했을 뿐, 물리적 스키마는 분리되어 있지 않습니다.
            </p>
            <table>
                <thead><tr><th>서비스</th><th>소유 테이블</th></tr></thead>
                <tbody>
                    <tr><td>Auth-Guard</td><td>users, user_sns, dev_users, withdrawal_requests</td></tr>
                    <tr><td>Seat</td><td>seats, match_seats, seat_holds, blocks, sections, areas, price_policies</td></tr>
                    <tr><td>Order-Core</td><td>orders, order_seats, <strong>payments</strong>, cash_receipts, cancellation_fee_policies, inquiries, qr_tokens</td></tr>
                    <tr><td>공유 (common-core)</td><td>matches, clubs, stadiums, onboarding_preferences, onboarding_preferred_blocks, onboarding_viewpoint_priority</td></tr>
                </tbody>
            </table>
            <p>
                <strong>한계</strong>: 모든 서비스가 같은 DB 커넥션 한도(max_connections=270)를 공유하기 때문에,
                어느 한 서비스의 쿼리 폭주가 다른 서비스 전체의 응답 지연으로 전이됩니다
                (<a href="/development/load-test/503-story">503 트러블슈팅 참고</a>).
            </p>

            <h3>1-3. 서비스 간 통신 — 직접 호출 없음</h3>
            <p>
                PlayBall은 <strong>서비스 간 직접 REST 호출을 사용하지 않습니다</strong>.
                다음 경로로만 데이터를 간접 공유합니다:
            </p>
            <ul>
                <li><strong>공용 DB</strong>: matches, users 같은 공유 도메인을 읽기 전용으로 조회</li>
                <li><strong>공용 Redis</strong>: 토큰 블랙리스트, 분산 락, 세션</li>
                <li><strong>Queue Redis</strong>: 대기열 상태 + PreQueue 옵션 마커</li>
                <li><strong>Kafka</strong> (신규): 상태 변경 이벤트 비동기 전파</li>
            </ul>

            <hr />

            <h2>2. EDA로 전환한 동기</h2>

            <h3>2-1. 강결합 문제</h3>
            <p>
                초기에는 상태 변경을 서비스 간 동기 호출로 처리할 수도 있었지만, 다음 문제가 명확했습니다:
            </p>
            <pre><code>{`[동기 REST 호출의 문제]

Order-Core ─(결제 완료 REST)→ Seat
     │                          │
     │                          └─ DB 업데이트 실패하면?
     │
     └─ Seat 응답 기다리다 타임아웃?
     └─ Seat가 일시 장애면 결제 자체가 실패?
     └─ 결제 완료 트랜잭션이 열려 있는 시간이 길어짐

→ 한 서비스의 장애가 다른 서비스로 즉시 전파되는 강결합`}</code></pre>

            <h3>2-2. 트랜잭션 경계의 복잡성</h3>
            <p>
                Order-Core에서 결제 완료 처리를 하면서 동시에 Seat의 좌석 상태도 바꿔야 합니다.
                만약 Order-Core의 <code>Payment</code> INSERT는 성공했는데 Seat 호출이 실패하면,
                데이터 정합성을 어떻게 맞출지 복잡한 보상 로직이 필요해집니다.
            </p>

            <h3>2-3. 확장 방향과의 충돌</h3>
            <p>
                결제 수단이 늘어날수록(카카오페이, 토스페이, 무통장, 향후 포인트/쿠폰 등)
                Payment 로직은 독립 서비스로 분리되는 것이 자연스럽습니다.
                그런데 Order-Core가 Seat과 강결합되어 있으면 Payment 분리 시 구조를 대대적으로 바꿔야 합니다.
                <strong>"나중에 분리할 경계"에 미리 Kafka를 놓아두면</strong> 분리 시 이벤트 Producer만 위치를 옮기면 됩니다.
            </p>

            <hr />

            <h2>3. Kafka 채택 이유</h2>

            <p>RabbitMQ/SQS/NATS/Redis Streams 등 여러 옵션 중 Kafka를 선택한 이유:</p>

            <h3>3-1. At-least-once 보장 + DLT</h3>
            <ul>
                <li><code>acks=all</code>: 모든 replica가 확인해야 Producer 응답</li>
                <li>Consumer 실패 시 <strong>3회 재시도 (1초 간격)</strong> → 그래도 실패하면 <code>{`{토픽}.DLT`}</code>로 격리</li>
                <li>티켓팅의 결제/좌석 확정은 <strong>절대 유실되면 안 되는 메시지</strong>라 At-least-once 신뢰성이 필요</li>
            </ul>

            <h3>3-2. 순서 보장 (파티션 키)</h3>
            <ul>
                <li>파티션 키로 <code>orderId</code>를 사용 → 같은 주문의 이벤트는 항상 같은 파티션에서 순서대로 처리</li>
                <li>"결제 완료 → 주문 취소" 같은 상태 전이가 역순으로 처리되는 사고 방지</li>
            </ul>

            <h3>3-3. @TransactionalEventListener + AFTER_COMMIT</h3>
            <p>
                Kafka의 가장 중요한 효용은 <strong>"DB 커밋 이후에만 이벤트가 나간다"</strong>는 보장입니다.
            </p>
            <pre><code>{`@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void publish(PaymentCompletedEvent event) {
    kafkaTemplate.send("payment-completed", event.getOrderId().toString(), event);
}

흐름:
  1. PaymentService.processPayment() 호출
  2. Payment INSERT + Order.status = PAID 업데이트 (동일 트랜잭션)
  3. applicationEventPublisher.publishEvent(PaymentCompletedEvent) 발행
  4. 트랜잭션 커밋 성공 후에만 AFTER_COMMIT 리스너 동작
  5. Kafka로 payment-completed 이벤트 발행
  6. Seat 서비스가 구독해서 BLOCKED → SOLD 전환

→ "DB는 롤백됐는데 Kafka만 발행" 같은 정합성 깨짐 방지`}</code></pre>

            <h3>3-4. 복원력 (Consumer Group + 오프셋)</h3>
            <ul>
                <li>Consumer가 다운돼도 Kafka가 메시지를 보관 → 복구 후 마지막 오프셋부터 이어서 처리</li>
                <li>동기 REST였다면 요청이 사라지지만, Kafka는 72시간 리텐션 동안 메시지가 남아있음</li>
            </ul>

            <h3>3-5. 수평 확장 (Consumer Group)</h3>
            <ul>
                <li>Seat 서비스 Pod 수가 늘면 같은 Consumer Group 내에서 파티션이 자동 분배</li>
                <li>3개 파티션 → 최대 3개 Pod 까지 병렬 처리 가능</li>
            </ul>

            <h3>3-6. 추후 Payment 서비스 분리에 최적</h3>
            <p>
                <strong>가장 결정적인 이유</strong>: Payment 서비스를 분리할 때 Kafka가 이미 자리 잡고 있으면
                Producer의 위치만 Order-Core에서 Payment 서비스로 옮기면 됩니다.
                Consumer(Seat)는 아무것도 바꿀 필요가 없습니다.
                "Kafka를 두고 있느냐/없느냐"가 분리 난이도를 결정합니다.
            </p>

            <hr />

            <h2>4. 현재 적용된 이벤트 토픽</h2>

            <table>
                <thead><tr><th>토픽</th><th>파티션</th><th>Producer</th><th>Consumer</th><th>트리거 시점</th><th>처리 내용</th></tr></thead>
                <tbody>
                    <tr>
                        <td><code>payment-completed</code></td>
                        <td>3</td>
                        <td>Order-Core</td>
                        <td>Seat</td>
                        <td>결제 완료 트랜잭션 커밋 후</td>
                        <td>MatchSeat.saleStatus: BLOCKED → SOLD</td>
                    </tr>
                    <tr>
                        <td><code>order-cancelled</code></td>
                        <td>3</td>
                        <td>Order-Core</td>
                        <td>Seat</td>
                        <td>주문 취소 트랜잭션 커밋 후</td>
                        <td>MatchSeat.saleStatus: SOLD → AVAILABLE</td>
                    </tr>
                    <tr>
                        <td><code>bank-transfer-expired</code></td>
                        <td>3</td>
                        <td>Order-Core</td>
                        <td>Seat</td>
                        <td>입금 기한 초과 스케줄러</td>
                        <td>MatchSeat 상태 복원 + 주문 자동 취소 기록</td>
                    </tr>
                    <tr>
                        <td><code>user-blocked</code></td>
                        <td>3</td>
                        <td>Auth-Guard</td>
                        <td>Order-Core</td>
                        <td>AI 서버의 유저 차단 API 호출</td>
                        <td>해당 유저의 PAID 주문 → UNDER_REVIEW</td>
                    </tr>
                </tbody>
            </table>

            <h3>Kafka 설정 정책</h3>
            <ul>
                <li>Apache Kafka <strong>3.7.1</strong></li>
                <li>파티션 3 / Replication factor 1 (staging) / Log retention 72h</li>
                <li>Acks = all / Key/Value Serializer = StringSerializer / JsonSerializer</li>
                <li>Consumer: 3회 재시도 후 <code>{`{토픽}.DLT`}</code>로 전송</li>
                <li>Trusted packages 지정으로 역직렬화 안전성 확보</li>
            </ul>

            <hr />

            <h2>5. 이벤트 흐름 시각화</h2>

            <h3>5-1. 결제 완료 → 좌석 SOLD 확정</h3>
            <pre><code>{`┌────────────────────┐
│  PaymentController │  POST /mypage/orders/{orderId}/payment
└──────────┬─────────┘
           ▼
┌──────────────────────────┐
│     PaymentService       │  @Transactional
│  ├─ Payment INSERT (PAID)│
│  ├─ Order.status = PAID  │
│  └─ publishEvent(...)    │
└──────────┬───────────────┘
           ▼  (트랜잭션 커밋)
┌──────────────────────────────────────┐
│ PaymentEventPublisher @AFTER_COMMIT  │
│  └─ kafkaTemplate.send(...)          │
└──────────┬───────────────────────────┘
           ▼
┌──────────────────────┐
│  Kafka payment-completed  (partition key: orderId)
└──────────┬──────────┘
           ▼
┌───────────────────────────────────┐
│ Seat: PaymentCompletedConsumer    │
│  └─ match_seats.sale_status = SOLD│
└───────────────────────────────────┘

장애 시나리오:
- Seat 서비스가 다운 → Kafka에 메시지 그대로 남음 → 복구 후 자동 처리
- Consumer가 3회 실패 → payment-completed.DLT 로 격리 → 운영자가 수동 재처리`}</code></pre>

            <h3>5-2. 유저 차단 → 주문 검토 대기</h3>
            <pre><code>{`AI 방어 서버
   │ POST /internal/users/{userId}/block  (X-Internal-Api-Key)
   ▼
Auth-Guard (트랜잭션)
  ├─ User.status = BLOCKED
  └─ [AFTER_COMMIT] publish → user-blocked
        │  payload: { userId, occurredAt }
        ▼
Order-Core: UserBlockedEventConsumer
  └─ 해당 userId의 활성 주문 → UNDER_REVIEW`}</code></pre>

            <hr />

            <h2>6. 추후 확장 계획</h2>

            <h3>6-1. Payment 서비스 분리 (최우선)</h3>
            <p>
                현재 <code>Order-Core/payment/</code> 패키지는 독립 서비스로 분리될 전제로 설계되어 있습니다.
            </p>
            <pre><code>{`현재:  Order-Core :8083
         ├─ order/      (주문 생성, 취소, 마이페이지)
         └─ payment/    (결제 처리, 현금영수증)  ◀── 분리 대상

계획:  Order-Core :8083  +  Payment :8084
         ├─ order/              ├─ payment/        (결제 수단별 핸들러)
         │                      ├─ refund/         (환불)
         │                      └─ pg-adapter/     (외부 PG 연동: 토스, 카카오, ...)
         │
         └─ [Kafka] order-placed  ─→  Payment (주문 → 결제 요청 이벤트)
         ◀─ [Kafka] payment-completed  (이미 구축됨)`}</code></pre>

            <h3>분리 시 Kafka가 해주는 일</h3>
            <ul>
                <li>Order-Core → Payment: <code>order-placed</code> 토픽 신설 (결제 요청 이벤트)</li>
                <li>Payment → Seat: <strong>기존 <code>payment-completed</code> 토픽 그대로 재사용</strong>
                    → Consumer 측 코드 무변경 (Kafka 덕분에 가능)</li>
                <li>Payment → Order-Core: <code>payment-failed</code> 토픽 신설 시
                    주문 상태 롤백 (Saga Pattern)</li>
            </ul>

            <h3>분리가 필요한 이유</h3>
            <ol>
                <li><strong>결제 수단 추가 대응</strong>: 카카오페이/토스페이/무통장 외에 포인트/쿠폰/간편결제 추가 시 Order 코드 변경 최소화</li>
                <li><strong>외부 PG 의존성 격리</strong>: 외부 PG 장애 시 주문 생성 기능은 영향 없이 유지</li>
                <li><strong>보안 경계 분리</strong>: 민감한 결제 정보(카드번호, 현금영수증)를 처리하는 서비스를 분리하면 PCI-DSS 요건 대응이 쉬워짐</li>
                <li><strong>스케일링 독립</strong>: 결제 트래픽과 주문 조회 트래픽 특성이 다르므로 Pod 수를 독립 조정</li>
            </ol>

            <h3>6-2. DB 스키마 분리</h3>
            <p>
                현재 단일 DB → 서비스별 스키마/DB 분리로 진행 예정입니다.
            </p>

            <pre><code>{`현재:  postgres/goormgb  (단일 DB, 논리적 소유권만 분리)
          ├─ users, user_sns ...                 ← Auth-Guard 쓰기
          ├─ seats, match_seats, seat_holds ...  ← Seat 쓰기
          ├─ orders, order_seats, payments ...   ← Order-Core 쓰기
          └─ matches, clubs, stadiums ...        ← 공유 읽기

계획:  postgres/
        ├─ auth_db        (Auth-Guard 전용)
        ├─ seat_db        (Seat 전용)
        ├─ order_db       (Order-Core 전용)
        ├─ payment_db     (Payment 신규)
        └─ reference_db   (matches, clubs — 읽기 전용 공유)`}</code></pre>

            <h3>스키마 분리로 얻는 것</h3>
            <ul>
                <li><strong>장애 격리</strong>: Seat DB가 I/O 폭주해도 Auth/Order는 영향 없음</li>
                <li><strong>커넥션 풀 독립</strong>: 현재 max_connections=270을 전 서비스가 공유 → 스키마 분리 시 각자 할당</li>
                <li><strong>스키마 진화 자유도</strong>: 한 서비스의 테이블 구조 변경이 다른 서비스 빌드에 영향 주지 않음</li>
                <li><strong>백업/복구 경계 명확화</strong>: 민감 DB(payment)만 별도 백업 정책 적용 가능</li>
            </ul>

            <h3>분리 시 필요한 패턴</h3>
            <ul>
                <li><strong>Outbox Pattern</strong>: DB 트랜잭션과 Kafka 발행의 원자성 보장.
                    현재 <code>@TransactionalEventListener(AFTER_COMMIT)</code>는 베스트-에포트 수준 →
                    완전한 정합성을 원하면 <code>outbox_events</code> 테이블 + Debezium CDC로 전환</li>
                <li><strong>Saga Pattern</strong>: 결제 실패 시 주문/좌석 상태 롤백을 이벤트 체인으로 처리</li>
                <li><strong>읽기 전용 공유 DB(reference_db)</strong>: matches/clubs 같은 공유 도메인은 read-only로 유지</li>
            </ul>

            <hr />

            <h2>7. 요약</h2>

            <table>
                <thead><tr><th>구분</th><th>AS-IS</th><th>현재 (EDA 도입)</th><th>TO-BE</th></tr></thead>
                <tbody>
                    <tr>
                        <td>서비스 구성</td>
                        <td>5 MSA</td>
                        <td>5 MSA (동일)</td>
                        <td>6 MSA (Payment 분리)</td>
                    </tr>
                    <tr>
                        <td>DB</td>
                        <td>단일 DB, 테이블 소유권만 분리</td>
                        <td><strong>동일</strong></td>
                        <td>서비스별 스키마 분리</td>
                    </tr>
                    <tr>
                        <td>서비스 간 통신</td>
                        <td>공용 DB/Redis만</td>
                        <td>+ <strong>Kafka 이벤트</strong></td>
                        <td>+ Outbox + Saga</td>
                    </tr>
                    <tr>
                        <td>결제 위치</td>
                        <td>Order-Core 내부</td>
                        <td>Order-Core 내부 (분리 준비)</td>
                        <td><strong>Payment 독립 서비스</strong></td>
                    </tr>
                    <tr>
                        <td>상태 전이 정합성</td>
                        <td>동일 트랜잭션 내</td>
                        <td>AFTER_COMMIT 이벤트</td>
                        <td>Outbox CDC</td>
                    </tr>
                </tbody>
            </table>

            <p>
                <strong>한 줄 요약</strong>: "지금 당장 필요해서가 아니라, 곧 필요해질 Payment 분리 · DB 스키마 분리의
                경계에 미리 Kafka를 깔아둔 것. 이벤트 기반 통신으로 갈아끼우기 쉬운 설계가 됐다."
            </p>
        </DocPageLayout>
    );
}
