import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="성능 최적화 / 부하테스트">
            <h1>성능 최적화 / 부하테스트 트러블슈팅</h1>
            <p>
                1차부터 5차(Phase 4)에 걸쳐 단계별로 진행한 성능 개선 이력입니다.
                <strong>AS-IS P99 6,887ms / 503 에러 다수</strong>에서 캐싱과 인프라 튜닝으로 5,000 VU 수용을 목표로 개선했습니다.
            </p>

            <hr />

            <h2>AS-IS: 최적화 전 상태</h2>
            <p>
                Seat 서비스에 <strong>Tomcat 스레드 200개 vs HikariCP 커넥션 20개</strong>의 설정 불균형이 있었습니다.
                180개 스레드가 <code>findByIdOrThrow</code>에서 커넥션 대기로 블로킹되면서 P99가 6.8초까지 치솟았습니다.
            </p>
            <pre><code>{`[모든 요청] → [Tomcat 스레드 200개]
     │
     ├─ matchRepository.findByIdOrThrow()     ← 매 요청 DB 조회
     ├─ sectionRepository.findAll...()        ← 매 요청 DB 조회
     ├─ blockRepository.findBySectionIdIn()   ← 매 요청 DB 조회
     ├─ userRepository.findByIdOrThrow()      ← 매 요청 DB 조회
     └─ onboardingPreference 조회             ← 매 요청 DB 조회

→ HikariCP 20개 커넥션 풀에 200개 스레드가 경합
→ 커넥션 대기 → 스레드 블로킹 → P99 6,887ms
→ DB 커넥션 270개 한계 도달 → 503 에러 다수 발생`}</code></pre>

            <p>
                <strong>핵심 진단</strong>: Redis 캐싱이 문제가 아니라 <strong>DB 커넥션 풀 + Tomcat 스레드 블로킹</strong>이 병목.
                "코드 레벨에서 할 수 있는 건 <strong>DB 커넥션을 쓰는 쿼리 자체를 줄이는 것</strong>"
            </p>

            <hr />

            <h2>DB 부하 유발 Top 7 쿼리 전수조사</h2>
            <table>
                <thead><tr><th>순위</th><th>위치</th><th>쿼리</th><th>요청당 호출</th><th>불변성</th><th>제안</th></tr></thead>
                <tbody>
                    <tr><td>1</td><td>Seat/SeatCommonService</td><td>MatchRepository.findDetailByIdOrThrow (JOIN FETCH)</td><td>2회</td><td>거의 불변</td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>2</td><td>Seat/SeatCommonService</td><td>SectionRepository.findAllWithAreaOrderBy</td><td>좌석 진입 1회</td><td>영구 불변</td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>3</td><td>Seat/SeatCommonService</td><td>BlockRepository.findBySectionIdIn</td><td>좌석 진입 1회</td><td>영구 불변</td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>4</td><td>Order-Core/OrderService</td><td>MatchRepository.findDetailByIdOrThrow</td><td>2회</td><td>거의 불변</td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>5</td><td>Queue/QueueService</td><td>MatchRepository.findByIdOrThrow</td><td>매 요청</td><td>거의 불변</td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>6</td><td>Auth-Guard, Order-Core</td><td>UserRepository.findByIdOrThrow</td><td>토큰/주문 매회</td><td>변동 있음</td><td><strong>Redis</strong></td></tr>
                    <tr><td>7</td><td>Seat/recommendation</td><td>OnboardingPreference/Block</td><td>추천 매회</td><td>변동 있음</td><td><strong>Redis</strong></td></tr>
                </tbody>
            </table>

            <hr />

            <h2>1차: Seat BookingOptions Match Caffeine 캐싱</h2>
            <p>
                <code>BookingOptionsService.saveBookingOptions()</code> 내 <code>matchRepository.findByIdOrThrow()</code>를
                Caffeine 로컬 캐시(<code>match-exists</code>, TTL 10분)로 교체. DB 커넥션 점유 시간 제거 + Tomcat 스레드 회전율 향상.
            </p>
            <pre><code>{`@Cacheable(cacheNames = "match-exists", key = "#matchId", unless = "!#result")
public boolean exists(Long matchId) {
    return matchRepository.existsById(matchId);
}

# Caffeine 설정
spec: maximumSize=1000,expireAfterWrite=10m,recordStats`}</code></pre>

            <h2>2차 (Phase 1 확대): Multi-Service Caffeine 전면 확대</h2>
            <p>
                <strong>Seat/Queue/Order-Core × 6개 캐시</strong>로 확대.
                DB 쿼리 50~60% 감소, DB 커넥션 peak 250 → 150 (-39%).
            </p>
            <table>
                <thead><tr><th>서비스</th><th>캐시</th><th>TTL</th><th>대상</th></tr></thead>
                <tbody>
                    <tr><td>Seat</td><td><code>match-exists</code>, <code>match-detail</code></td><td>10분</td><td>Match 조회</td></tr>
                    <tr><td>Seat</td><td><code>section-all</code>, <code>blocks-by-section-ids</code></td><td>1시간</td><td>스타디움 구조 (영구 불변)</td></tr>
                    <tr><td>Queue</td><td><code>match-for-queue</code></td><td>1분</td><td>saleStatus 검증 (짧은 TTL)</td></tr>
                    <tr><td>Order-Core</td><td><code>match-detail</code></td><td>10분</td><td>주문서용 Match</td></tr>
                </tbody>
            </table>

            <h2>3차 (Phase 2): Redis 분산 캐시 — User 데이터</h2>
            <p>
                User, OnboardingPreference는 변경 가능한 데이터라 로컬 캐시 대신 Redis 분산 캐시 사용.
                Pod A에서 닉네임 갱신 → Pod B에서도 즉시 반영.
            </p>
            <ul>
                <li>Auth-Guard <code>user-by-id</code> (10분), <code>auth-me</code> (30초)</li>
                <li>Order-Core <code>user-by-id</code> (10분, Auth-Guard 캐시 공유)</li>
                <li><code>@CacheEvict</code>로 프로필 변경 시 즉시 무효화</li>
                <li><code>DefaultTyping.EVERYTHING</code>으로 다형성 역직렬화 지원</li>
            </ul>
            <p>결과: <code>/auth/me</code> P99 <strong>400ms → 50ms</strong></p>

            <h2>4차 (Phase 3): API 응답 Redis 캐시 + 인프라 튜닝</h2>
            <table>
                <thead><tr><th>파라미터</th><th>변경 전</th><th>변경 후</th><th>이유</th></tr></thead>
                <tbody>
                    <tr><td>Tomcat max-threads</td><td>200</td><td><strong>400</strong></td><td>스레드 점유 시간 감소 → 동시 처리 증가</td></tr>
                    <tr><td>HikariCP max-pool-size</td><td>20</td><td><strong>30</strong></td><td>DB 의존 쿼리 감소로 여유 확보</td></tr>
                    <tr><td>HikariCP min-idle</td><td>20</td><td><strong>5</strong></td><td>유연한 커넥션 관리</td></tr>
                    <tr><td>총 DB 커넥션</td><td>~80</td><td><strong>≤250</strong></td><td><code>max_connections=250</code> 한계 내</td></tr>
                </tbody>
            </table>
            <ul>
                <li>Seat <code>seat-groups-response</code> 5초 캐시 → P99 <strong>2000ms → 200ms</strong></li>
                <li>Order-Core <code>matches-list-response</code> 30초 캐시</li>
            </ul>

            <h2>5차 (Phase 4): 커넥션 회전율 · 스레드 점유 핫픽스</h2>

            <h3>(1) Queue OSIV OFF</h3>
            <p>
                <code>spring.jpa.open-in-view=false</code>로 변경. HTTP 요청 전체가 아닌 트랜잭션 경계에서만 DB 커넥션 점유.
                <strong>커넥션 회전율 2배</strong> 향상.
            </p>

            <h3>(2) BookingOptions Resilience4j @Retry</h3>
            <p>
                <code>Thread.sleep(50~150ms)</code> 블로킹 재시도 → Resilience4j 비동기 재시도로 교체.
                평균 대기: <strong>300ms → 60ms</strong>.
            </p>

            <h3>(3) Queue Redis Lua 스크립트 통합</h3>
            <p>
                대기열 재진입 시 ZREM + ZADD + ZRANK + ZCARD를 각각 호출 → Lua 스크립트 1회 호출로 통합.
                <strong>3 RTT → 1 RTT</strong>.
            </p>

            <hr />

            <h2>전체 최적화 타임라인</h2>
            <pre><code>{`AS-IS (최적화 전)
│  P99: 6,887ms / DB 커넥션 270 한계 / 503 에러 다수
│
├─ 1차: Seat BookingOptions Match Caffeine 캐싱
│  └─ match-exists 캐시 도입 → 요청당 DB 조회 1회 제거
│
├─ 2차 (Phase 1 확대): Multi-Service Caffeine 전면 확대
│  └─ Seat/Queue/Order-Core × 6개 캐시
│  └─ DB 쿼리 50~60% 감소, 커넥션 peak 250→150
│
├─ 3차 (Phase 2): Redis 분산 캐시 — User 데이터
│  └─ user-by-id, auth-me Redis 캐싱
│  └─ /auth/me P99: 400ms → 50ms
│
├─ 4차 (Phase 3): API 응답 Redis 캐시 + 인프라 튜닝
│  └─ seat-groups-response 5초 캐시, matches-list 30초 캐시
│  └─ Tomcat 200→400, HikariCP 20→30
│  └─ seat-groups P99: 2000ms → 200ms
│
├─ 5차 (Phase 4): 커넥션 회전율 · 스레드 점유 핫픽스
│  └─ Queue OSIV OFF (커넥션 회전율 2배)
│  └─ BookingOptions Resilience4j @Retry
│  └─ Queue Redis Lua 통합 (3 RTT → 1 RTT)
│
TO-BE
   캐싱이 정적 데이터 쿼리를 흡수하고,
   DB 커넥션은 좌석 조회/추천 등 정말 필요한 곳에만 사용.`}</code></pre>

            <hr />

            <h2>HikariCP 커넥션 풀이란</h2>
            <p>
                HikariCP는 Java에서 가장 빠른 JDBC 커넥션 풀 라이브러리로, Spring Boot의 기본 커넥션 풀입니다.
                DB 커넥션은 TCP 연결이라 생성 비용이 비싸므로(수십~수백 ms), 미리 커넥션을 생성해놓고 재사용합니다.
            </p>
            <table>
                <thead><tr><th>설정</th><th>값</th><th>의미</th></tr></thead>
                <tbody>
                    <tr><td>maximum-pool-size</td><td>20~30</td><td>풀에서 최대 몇 개 커넥션을 유지할지</td></tr>
                    <tr><td>minimum-idle</td><td>5~20</td><td>최소 유지 커넥션 수</td></tr>
                    <tr><td>connection-timeout</td><td>30초</td><td>커넥션을 못 빌리면 이 시간 후 예외</td></tr>
                    <tr><td>leak-detection-threshold</td><td>10초</td><td>이 시간 이상 커넥션 반환 안 하면 로그 경고</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>기타 트러블슈팅</h2>
            <ul>
                <li><strong>대기열 오픈 11시 정각 입장 지연</strong>: DB <code>saleStatus</code> 의존 → 시간 기반 Lazy 판정으로 변경</li>
                <li><strong>Seat Hold Detached Entity</strong>: OSIV OFF 후 JPA dirty checking 실패 → Bulk UPDATE로 교체</li>
                <li><strong>AES-GCM Hibernate 불필요 UPDATE</strong>: 랜덤 IV로 매번 다른 암호문 → IV 캐싱으로 해결</li>
                <li><strong>Redis 메모리 초과</strong>: Refresh Token TTL 7일 → 4시간 단축, 부하테스트용 15분</li>
                <li><strong>seat-groups N+1 쿼리</strong>: JOIN FETCH 추가 + 인덱스 최적화</li>
            </ul>
        </DocPageLayout>
    );
}
