import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="Kafka · Caffeine 캐싱">
            <h1>Kafka 이벤트 메시징 / Caffeine 캐싱</h1>
            <p>
                PlayBall은 서비스 간 비동기 메시징으로 <strong>Apache Kafka 3.7.1</strong>을 사용하며,
                DB 부하를 흡수하기 위해 <strong>Caffeine</strong> 로컬 캐시와 <strong>Redis</strong> 분산 캐시를 계층적으로 활용합니다.
            </p>

            <hr />

            <h2>Kafka 이벤트 메시징</h2>

            <h3>토픽 구성</h3>
            <table>
                <thead><tr><th>토픽</th><th>파티션</th><th>Producer</th><th>Consumer</th><th>용도</th></tr></thead>
                <tbody>
                    <tr>
                        <td><code>payment-completed</code></td>
                        <td>3</td>
                        <td>Order-Core</td>
                        <td>Seat</td>
                        <td>결제 완료 시 좌석 BLOCKED → SOLD 전환</td>
                    </tr>
                    <tr>
                        <td><code>order-cancelled</code></td>
                        <td>3</td>
                        <td>Order-Core</td>
                        <td>Seat</td>
                        <td>주문 취소 시 좌석 SOLD → AVAILABLE 복원</td>
                    </tr>
                    <tr>
                        <td><code>bank-transfer-expired</code></td>
                        <td>3</td>
                        <td>Order-Core</td>
                        <td>Seat</td>
                        <td>무통장 입금 기한 만료 시 좌석 복원</td>
                    </tr>
                    <tr>
                        <td><code>user-blocked</code></td>
                        <td>3</td>
                        <td>Auth-Guard</td>
                        <td>Order-Core</td>
                        <td>유저 차단 시 활성 주문 UNDER_REVIEW 처리</td>
                    </tr>
                </tbody>
            </table>

            <h3>신뢰성 정책</h3>
            <ul>
                <li><strong>Acks = all</strong>: 모든 replica 확인 후 응답</li>
                <li><strong>Replication factor = 1</strong>, Log retention = 72h</li>
                <li><strong>재시도</strong>: 실패 시 3회 재시도 (1초 간격)</li>
                <li><strong>DLT (Dead Letter Topic)</strong>: 3회 재시도 후에도 실패하면 <code>{`{토픽}.DLT`}</code>로 전송</li>
                <li><strong>@TransactionalEventListener(phase = AFTER_COMMIT)</strong>: DB 커밋 이후 이벤트 발행으로 정합성 보장</li>
            </ul>

            <h3>이벤트 흐름 예시</h3>
            <pre><code>{`1. 결제 완료
Order-Core
  ├─ Payment 저장 (PAID)
  ├─ Order 상태 전환 (PAYMENT_PENDING → PAID)
  ├─ [AFTER_COMMIT] Kafka publish
  └─ payload: { orderId, matchSeatIds: [123, 124, 125], paymentMethod }
        ▼
Kafka topic: payment-completed
        ▼
Seat (Consumer: seat-service)
  └─ @KafkaListener → MatchSeat.saleStatus: BLOCKED → SOLD

2. 유저 차단
AI 방어 서버
  └─ POST /internal/users/{userId}/block
        ▼
Auth-Guard
  ├─ User.status = BLOCKED
  ├─ [AFTER_COMMIT] Kafka publish
  └─ payload: { userId, occurredAt }
        ▼
Kafka topic: user-blocked
        ▼
Order-Core (Consumer: order-core-notification)
  └─ 해당 userId의 PAID 주문 → UNDER_REVIEW`}</code></pre>

            <hr />

            <h2>Caffeine 캐싱</h2>

            <h3>Caffeine이란?</h3>
            <p>
                Caffeine은 Java용 <strong>고성능 인-메모리 로컬 캐시</strong> 라이브러리입니다. Guava Cache의 개선 버전으로,
                Google 엔지니어 Ben Manes가 만들었으며 현재 Java 생태계에서 사실상 표준 로컬 캐시입니다.
            </p>

            <h3>핵심 개념: "로컬 캐시"</h3>
            <pre><code>{`[요청] → Spring Application (JVM 메모리 안에 HashMap 같은 저장소)
          ↓ 있으면 바로 반환 (sub-ms)
          ↓ 없으면 DB/Redis 조회 후 저장

JVM 프로세스 자신의 힙 메모리에 데이터를 보관.
네트워크 홉이 없으니 접근 시간이 나노~마이크로초 단위.`}</code></pre>

            <h3>Redis vs Caffeine 비교</h3>
            <table>
                <thead><tr><th>항목</th><th>Caffeine (로컬)</th><th>Redis (원격)</th></tr></thead>
                <tbody>
                    <tr><td>저장 위치</td><td>JVM 힙 메모리</td><td>별도 서버</td></tr>
                    <tr><td>접근 시간</td><td>&lt; 1μs</td><td>0.5~2ms (+네트워크)</td></tr>
                    <tr><td>용량</td><td>JVM 힙 한도 내</td><td>GB~TB 가능</td></tr>
                    <tr><td>인스턴스 간 공유</td><td>각자 따로</td><td>공유됨</td></tr>
                    <tr><td>일관성</td><td>노드별 달라질 수 있음</td><td>단일 소스</td></tr>
                    <tr><td>장애 격리</td><td>JVM과 운명공유</td><td>Redis 다운 시 영향</td></tr>
                </tbody>
            </table>

            <h3>Caffeine의 강점</h3>
            <ol>
                <li><strong>매우 빠른 구현</strong> — W-TinyLFU 교체 알고리즘으로 LRU보다 높은 hit rate, Lock-free에 가까운 동시성</li>
                <li><strong>풍부한 만료 정책</strong> — <code>expireAfterWrite</code>, <code>expireAfterAccess</code>, <code>refreshAfterWrite</code>, <code>recordStats</code></li>
                <li><strong>Spring Cache와 자연스러운 통합</strong> — <code>@Cacheable</code> 어노테이션만 붙이면 끝</li>
            </ol>

            <h3>PlayBall에서의 Caffeine 활용</h3>
            <pre><code>{`@Cacheable(cacheNames = "match-exists", key = "#matchId", unless = "!#result")
public boolean exists(Long matchId) {
    return matchRepository.existsById(matchId);
}

# application.yaml
spring:
  cache:
    type: caffeine
    cache-names: match-exists
    caffeine:
      spec: maximumSize=1000,expireAfterWrite=10m,recordStats`}</code></pre>

            <ul>
                <li><strong>maximumSize=1000</strong>: 최대 1000개 캐싱 (초과 시 LFU eviction)</li>
                <li><strong>expireAfterWrite=10m</strong>: 쓰기 후 10분 만료</li>
                <li><strong>recordStats</strong>: <code>/actuator/metrics/cache.gets</code>로 hit/miss 통계</li>
            </ul>

            <h3>주의할 점</h3>
            <ol>
                <li>멀티 인스턴스 시 캐시 불일치 — 자주 바뀌는 데이터엔 부적합</li>
                <li>JVM 힙 사용 — 너무 큰 객체/많은 수를 담으면 GC 압박</li>
                <li>재시작 시 휘발 — 프로세스 재시작하면 캐시는 비어서 시작 (cold start)</li>
            </ol>

            <p>
                <strong>한 줄 요약</strong>: "Redis보다 수백 배 빠른, 프로세스 내부 메모리에 데이터를 보관하는 스마트한 HashMap"
            </p>

            <hr />

            <h2>PlayBall 캐싱 맵</h2>
            <table>
                <thead><tr><th>서비스</th><th>Caffeine (로컬)</th><th>Redis (분산)</th></tr></thead>
                <tbody>
                    <tr>
                        <td>Auth-Guard</td>
                        <td>—</td>
                        <td><code>user-by-id</code> (10분), <code>auth-me</code> (30초)</td>
                    </tr>
                    <tr>
                        <td>Queue</td>
                        <td><code>match-for-queue</code> (1분)</td>
                        <td>—</td>
                    </tr>
                    <tr>
                        <td>Seat</td>
                        <td><code>match-exists</code>, <code>match-detail</code> (10분), <code>section-all</code>, <code>blocks-by-section-ids</code> (1시간)</td>
                        <td><code>seat-groups-response</code> (5초)</td>
                    </tr>
                    <tr>
                        <td>Order-Core</td>
                        <td><code>match-detail</code> (10분)</td>
                        <td><code>user-by-id</code> (10분), <code>matches-list-response</code> (30초)</td>
                    </tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
