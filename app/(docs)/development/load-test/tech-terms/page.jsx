import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="기술 용어 해설">
            <h1>기술 용어 해설</h1>
            <p>
                부하테스트 및 최적화 과정에서 등장한 핵심 기술 개념을 상세히 설명합니다.
                HikariCP, Caffeine, Redis, OSIV, Resilience4j, Redisson, Lua Script, JOIN FETCH 등
                팀이 실제로 도입·튜닝한 요소 위주로 정리했습니다.
            </p>

            <hr />

            <h2>1. HikariCP (DB 커넥션 풀)</h2>

            <h3>1.1 커넥션 풀이란?</h3>
            <p>
                DB 연결(TCP Connection)은 <strong>생성 비용이 비싼 자원</strong>입니다.
                매 요청마다 연결/해제를 반복하면:
            </p>
            <ul>
                <li>TCP 3-way handshake (수 ms)</li>
                <li>PostgreSQL 인증 절차 (수십 ms)</li>
                <li>매번 수십~수백 ms 추가 지연</li>
            </ul>
            <p>
                <strong>커넥션 풀</strong>은 미리 일정 개수의 커넥션을 만들어 놓고 <strong>재사용</strong>합니다.
            </p>

            <pre><code>{`[Tomcat 스레드] ──(1) borrow──▶ [HikariCP 풀] ──▶ [PostgreSQL]
       ▲                                ▲
       │                                │
       └──────(2) 쿼리 실행 ────────────┘
       │
       └──(3) return ─▶ [풀에 반환]
       │
       └──(4) 다른 스레드가 같은 커넥션 재사용`}</code></pre>

            <h3>1.2 HikariCP 설정값 해설</h3>
            <pre><code>{`spring:
  datasource:
    hikari:
      maximum-pool-size: 30        # 풀이 유지할 최대 커넥션 수
      minimum-idle: 5              # 최소 유휴 커넥션 수
      connection-timeout: 30000    # 커넥션 획득 대기 타임아웃(ms)
      leak-detection-threshold: 10000  # 10초 이상 반환 안 되면 로그 경고
      idle-timeout: 600000         # 10분 이상 놀면 풀에서 제거`}</code></pre>

            <table>
                <thead>
                    <tr><th>설정</th><th>설명</th><th>본 프로젝트 값</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>maximum-pool-size</code></td><td>최대 커넥션 수</td><td><strong>20 → 30 (Phase 3)</strong></td></tr>
                    <tr><td><code>minimum-idle</code></td><td>항상 유지할 최소 유휴 커넥션</td><td><strong>20 → 5 (Phase 3)</strong></td></tr>
                    <tr><td><code>connection-timeout</code></td><td>커넥션 대기 타임아웃</td><td>30초</td></tr>
                    <tr><td><code>leak-detection-threshold</code></td><td>커넥션 리크 감지 시간</td><td>10초</td></tr>
                    <tr><td><code>idle-timeout</code></td><td>유휴 커넥션 정리 시간</td><td>10분</td></tr>
                </tbody>
            </table>

            <h3>1.3 왜 Pool Size를 무작정 늘릴 수 없는가?</h3>
            <p><strong>DB 서버 자체의 한계</strong>때문입니다.</p>
            <ul>
                <li>PostgreSQL <code>max_connections = 270</code> (db.t4g.small 기본값)</li>
                <li>전체 서비스 Pool 합계가 270 이내여야 함</li>
                <li>넘으면 DB에서 "too many connections" 에러</li>
            </ul>

            <h3>1.4 Pool Size 계산 공식</h3>
            <pre><code>{`합계 = (Seat 30) + (Queue 30) + (Auth-Guard 20) + (Order-Core 20)
     + (Batch / Admin 20) + (여유 50)
     ≤ 270 (max_connections)`}</code></pre>

            <h3>1.5 <code>hikaricp_connections_pending</code> — 병목의 증거</h3>
            <p>
                <strong><code>pending</code></strong>은
                <strong>"커넥션을 빌리기 위해 줄 서서 기다리는 스레드 수"</strong>입니다.
            </p>

            <pre><code>{`Tomcat 스레드 200개 ────┐
                        ├──▶ HikariCP Pool (20개) ──▶ PostgreSQL (270)
                        │      │
                        │      ├─ active: 20
                        │      └─ pending: 180  ◀── 여기가 병목!
                        │
                        └── 스레드가 DB I/O 대기로 블로킹됨`}</code></pre>

            <p>
                <strong>pending 지표가 0이 아니면</strong> → 풀이 포화 상태이며, 대기 시간이 응답 지연의 주범.
            </p>

            <hr />

            <h2>2. Caffeine (로컬 캐시)</h2>

            <h3>2.1 Caffeine이란?</h3>
            <p>
                <a href="https://github.com/ben-manes/caffeine" target="_blank" rel="noopener noreferrer">Caffeine</a>은
                Java용 <strong>고성능 인-메모리 로컬 캐시</strong> 라이브러리입니다.
            </p>
            <ul>
                <li>Guava Cache의 개선 버전</li>
                <li>Google 엔지니어 Ben Manes가 개발</li>
                <li>현재 Java 생태계에서 사실상 표준 로컬 캐시</li>
            </ul>

            <h3>2.2 핵심 개념 — "로컬"의 의미</h3>
            <pre><code>{`[HTTP 요청]
     │
     ▼
[Spring Application (JVM 프로세스 안)]
     │
     ├─ Caffeine Cache (JVM 힙 메모리)
     │   ├─ ConcurrentHashMap + 통계/만료/교체 알고리즘
     │   └─ 네트워크 홉 없음 → sub-microsecond (< 1μs) 접근
     │
     ├─ 캐시 hit → 즉시 반환
     └─ 캐시 miss → DB 조회 → 캐시 저장 → 반환`}</code></pre>

            <p>
                <strong>"로컬"</strong>이라는 것은 각 JVM 프로세스(Pod) 안에 캐시가 저장된다는 뜻입니다.
            </p>
            <ul>
                <li><strong>장점</strong>: 극도로 빠름 (메모리 내부), 네트워크 부하 없음, Redis 장애와 무관</li>
                <li><strong>단점</strong>: 여러 Pod 간 캐시가 <strong>공유되지 않음</strong> (Pod A 갱신 → Pod B는 모름)</li>
            </ul>

            <h3>2.3 Redis vs Caffeine 비교</h3>
            <table>
                <thead>
                    <tr><th>항목</th><th>Caffeine (로컬)</th><th>Redis (원격)</th></tr>
                </thead>
                <tbody>
                    <tr><td>저장 위치</td><td>JVM 힙 메모리</td><td>별도 서버</td></tr>
                    <tr><td>접근 시간</td><td><strong>&lt; 1μs</strong></td><td>0.5~2ms (+네트워크)</td></tr>
                    <tr><td>용량</td><td>JVM 힙 한도 내</td><td>GB~TB 가능</td></tr>
                    <tr><td>인스턴스 간 공유</td><td><strong>불가</strong> (각 Pod 따로)</td><td><strong>가능</strong> (단일 소스)</td></tr>
                    <tr><td>일관성</td><td>노드별 다를 수 있음</td><td>단일 소스</td></tr>
                    <tr><td>장애 격리</td><td>JVM과 운명 공유</td><td>Redis 다운 시 영향</td></tr>
                </tbody>
            </table>

            <h3>2.4 W-TinyLFU 알고리즘</h3>
            <p>Caffeine의 핵심 교체(eviction) 알고리즘 — <strong>LRU보다 높은 hit rate</strong>를 보장합니다.</p>
            <pre><code>{`TinyLFU = Frequency Sketch (4-bit counting) + Tiny admission window
W-TinyLFU = TinyLFU + 최근 접근 가중치 (Window)`}</code></pre>
            <p>
                기존 LRU는 <strong>"가장 최근에 접근한 것을 유지"</strong>하는데,
                가끔 급등하는 데이터가 자주 쓰이는 데이터를 밀어내는 문제가 있습니다.
                W-TinyLFU는 <strong>빈도</strong>도 함께 고려해 hit rate를 높입니다.
            </p>

            <h3>2.5 본 프로젝트의 Caffeine 설정</h3>
            <pre><code>{`spring:
  cache:
    type: caffeine
    cache-names: match-exists
    caffeine:
      spec: maximumSize=1000,expireAfterWrite=10m,recordStats`}</code></pre>

            <table>
                <thead>
                    <tr><th>옵션</th><th>의미</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>maximumSize=1000</code></td><td>최대 1,000개 엔트리 (초과 시 W-TinyLFU eviction)</td></tr>
                    <tr><td><code>expireAfterWrite=10m</code></td><td>쓴 지 10분 지나면 만료</td></tr>
                    <tr><td><code>expireAfterAccess=5m</code></td><td>마지막 접근 후 5분 (옵션)</td></tr>
                    <tr><td><code>refreshAfterWrite=1m</code></td><td>1분 후 백그라운드 갱신 (옵션)</td></tr>
                    <tr><td><code>recordStats</code></td><td>hit/miss 통계 수집 (<code>/actuator/metrics/cache.gets</code>)</td></tr>
                </tbody>
            </table>

            <h3>2.6 본 프로젝트의 Caffeine 맵</h3>
            <table>
                <thead>
                    <tr><th>서비스</th><th>캐시</th><th>최대 크기</th><th>TTL</th><th>대상 데이터</th></tr>
                </thead>
                <tbody>
                    <tr><td>Seat</td><td><code>match-exists</code></td><td>1,000</td><td>10분</td><td>Match 존재 검증</td></tr>
                    <tr><td>Seat</td><td><code>match-detail</code></td><td>1,000</td><td>10분</td><td>Match 메타 (JOIN FETCH home/away/stadium)</td></tr>
                    <tr><td>Seat</td><td><code>section-all</code></td><td>16</td><td>1시간</td><td>스타디움 섹션 구조 (영구 불변)</td></tr>
                    <tr><td>Seat</td><td><code>blocks-by-section-ids</code></td><td>512</td><td>1시간</td><td>섹션별 블럭 매핑 (영구 불변)</td></tr>
                    <tr><td>Queue</td><td><code>match-for-queue</code></td><td>1,000</td><td><strong>1분</strong></td><td>Match saleStatus (짧은 TTL — 판매 개시 반영)</td></tr>
                    <tr><td>Order-Core</td><td><code>match-detail</code></td><td>1,000</td><td>10분</td><td>주문서용 Match 메타</td></tr>
                </tbody>
            </table>

            <h3>2.7 주의할 점</h3>
            <ol>
                <li><strong>멀티 인스턴스 시 캐시 불일치</strong> — 자주 바뀌는 데이터엔 부적합</li>
                <li><strong>JVM 힙 사용</strong> — 너무 큰 객체/많은 엔트리를 담으면 GC 압박</li>
                <li><strong>재시작 시 휘발</strong> (cold start) — 프로세스 재시작 후 첫 요청은 miss</li>
            </ol>

            <hr />

            <h2>3. Redis 분산 캐시</h2>

            <h3>3.1 왜 Redis 분산 캐시가 필요한가?</h3>
            <p><strong>변경 가능한 데이터</strong>(User 프로필, 상태)는 로컬 캐시로 못 씁니다.</p>

            <pre><code>{`문제 시나리오 (Caffeine만 쓸 때):
Pod A: user-by-id:42 = {nickname: "새닉네임"}  ← 갱신됨
Pod B: user-by-id:42 = {nickname: "옛닉네임"}  ← stale!
→ 로그인 Pod에 따라 다른 결과`}</code></pre>

            <p>Redis는 <strong>모든 Pod이 공유하는 단일 저장소</strong>이므로 일관성을 보장합니다.</p>

            <h3>3.2 본 프로젝트의 Redis 분산 캐시</h3>
            <table>
                <thead>
                    <tr><th>서비스</th><th>캐시</th><th>TTL</th><th>Evict 조건</th></tr>
                </thead>
                <tbody>
                    <tr><td>Auth-Guard</td><td><code>user-by-id</code></td><td>10분</td><td>프로필/상태 변경 시 <code>@CacheEvict</code></td></tr>
                    <tr><td>Auth-Guard</td><td><code>auth-me</code></td><td>30초</td><td>프로필 변경 시 evict</td></tr>
                    <tr><td>Order-Core</td><td><code>user-by-id</code></td><td>10분</td><td>Auth-Guard 캐시 공유</td></tr>
                    <tr><td>Seat</td><td><code>seat-groups-response</code></td><td>5초</td><td>좌석 상태 변경 시 (자연 만료)</td></tr>
                    <tr><td>Order-Core</td><td><code>matches-list-response</code></td><td>30초</td><td>(자연 만료)</td></tr>
                </tbody>
            </table>

            <h3>3.3 직렬화 이슈 (트러블슈팅)</h3>
            <p>Redis는 객체를 바이트로 저장하므로 <strong>직렬화/역직렬화</strong>가 필요합니다.</p>
            <ul>
                <li>초기: <code>DefaultTyping.NON_FINAL</code> → 다형성 역직렬화 실패</li>
                <li>해결: <code>DefaultTyping.EVERYTHING</code> 으로 전환 + <code>JavaTimeModule</code> 추가</li>
            </ul>

            <pre><code>{`@Bean
public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
    RedisTemplate<String, Object> template = new RedisTemplate<>();
    template.setConnectionFactory(factory);

    ObjectMapper mapper = new ObjectMapper();
    mapper.registerModule(new JavaTimeModule());
    mapper.activateDefaultTyping(
        LaissezFaireSubTypeValidator.instance,
        ObjectMapper.DefaultTyping.EVERYTHING,  // 다형성 지원
        JsonTypeInfo.As.PROPERTY
    );

    template.setValueSerializer(new GenericJackson2JsonRedisSerializer(mapper));
    return template;
}`}</code></pre>

            <hr />

            <h2>4. OSIV (Open Session In View)</h2>

            <h3>4.1 OSIV란?</h3>
            <p>
                Spring Data JPA의 기본 설정으로,
                <strong>HTTP 요청 전체 구간에서 DB 커넥션/영속성 컨텍스트를 유지</strong>하는 패턴입니다.
            </p>

            <pre><code>{`OSIV ON (기본값):
[요청 시작] → HikariCP 커넥션 획득 → Controller → Service → Repository
                                                                   ↓
[응답 완료] ← ─── ─── ─── ─── ─── ─── ← 커넥션 반환 ← ─── ─── ─┘
               전 구간에서 커넥션 점유`}</code></pre>

            <h3>4.2 왜 문제가 되는가?</h3>
            <p>
                <strong>Controller → View 렌더링 단계에서도 커넥션을 잡고 있음</strong>. 실제로 DB를 쓰지 않아도 점유하게 됩니다.
            </p>
            <ul>
                <li>커넥션 회전율 저하</li>
                <li>Pending 증가</li>
            </ul>

            <h3>4.3 OSIV OFF 효과</h3>
            <pre><code>{`spring:
  jpa:
    open-in-view: false`}</code></pre>

            <pre><code>{`OSIV OFF:
[요청 시작] → Controller → Service → [트랜잭션 시작] HikariCP 획득
                                         ↓
                          Repository → [트랜잭션 종료] 커넥션 즉시 반환
                                         ↓
[응답 완료] ← Controller 나머지 로직 (커넥션 없이 진행)`}</code></pre>

            <p>
                <strong>같은 Pool 크기로 약 2배의 요청 처리 가능</strong> (Phase 4에서 Queue 서비스에 적용).
            </p>

            <h3>4.4 OSIV OFF 부작용</h3>
            <ul>
                <li>
                    <strong>Lazy 로딩 불가</strong>: 영속성 컨텍스트 밖에서 프록시 접근 → <code>LazyInitializationException</code>
                </li>
                <li>해결: <strong>JOIN FETCH</strong> 또는 DTO 프로젝션으로 필요한 연관관계를 한 번에 로드</li>
            </ul>

            <hr />

            <h2>5. Resilience4j @Retry</h2>

            <h3>5.1 Thread.sleep 재시도의 문제</h3>
            <pre><code>{`// 변경 전: Thread.sleep 블로킹 재시도
for (int i = 0; i < 3; i++) {
    try {
        preQueueRedis.mark(matchId, userId);
        return;
    } catch (Exception e) {
        Thread.sleep(50 * (i + 1));  // 50ms, 100ms, 150ms 블로킹!
    }
}`}</code></pre>
            <p><strong>문제</strong>: Tomcat 워커 스레드가 300ms 동안 block → 스레드 회전율 저하.</p>

            <h3>5.2 Resilience4j @Retry</h3>
            <p>
                <a href="https://resilience4j.readme.io/" target="_blank" rel="noopener noreferrer">Resilience4j</a>는
                Netflix Hystrix 후속 라이브러리로, 비동기 재시도/서킷브레이커/Rate Limiter 등을 제공합니다.
            </p>
            <pre><code>{`resilience4j.retry:
  instances:
    prequeue-marker:
      max-attempts: 3
      wait-duration: 20ms
      exponential-backoff-multiplier: 2`}</code></pre>

            <pre><code>{`@Retry(name = "prequeue-marker", fallbackMethod = "markFallback")
public void mark(Long matchId, Long userId) {
    preQueueStringRedisTemplate.opsForValue()
        .set(bookingOptionKey(matchId, userId), "1", Duration.ofSeconds(ttlSeconds));
}

public void markFallback(Long matchId, Long userId, Exception e) {
    log.warn("PreQueue marker 재시도 실패: {}", e.getMessage());
    throw new CustomException(PREQUEUE_MARKER_SYNC_FAILED);
}`}</code></pre>

            <p><strong>효과</strong>: 평균 대기 300ms → 60ms (80% 감소).</p>

            <hr />

            <h2>6. Redis Lua 스크립트 (원자 연산)</h2>

            <h3>6.1 다중 Redis 명령 문제</h3>
            <p>대기열 재진입 시 여러 Redis 명령이 필요합니다.</p>
            <pre><code>{`→ Redis: ZREM queue:wait:{matchId} {userId}          ← 1 RTT
→ Redis: DEL queue:ready:{matchId}:{userId}          ← 2 RTT
→ Redis: ZADD queue:wait:{matchId} {score} {userId}  ← 3 RTT
→ Redis: ZRANK queue:wait:{matchId} {userId}         ← 4 RTT
→ Redis: ZCARD queue:wait:{matchId}                  ← 5 RTT`}</code></pre>
            <p>
                <strong>RTT (Round Trip Time)</strong>: 네트워크 왕복 시간. 각 명령마다 ~0.5~2ms 추가.
            </p>

            <h3>6.2 Lua 스크립트로 통합</h3>
            <pre><code>{`-- queue:re-enter atomic script
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2])
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
local rank = redis.call('ZRANK', KEYS[1], ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
return {rank, count}`}</code></pre>

            <pre><code>{`redisTemplate.execute(
    new DefaultRedisScript<>(LUA_SCRIPT, List.class),
    Arrays.asList(waitKey, readyKey),
    userId, scoreStr
);`}</code></pre>

            <h3>6.3 효과</h3>
            <ul>
                <li><strong>3~5 RTT → 1 RTT</strong></li>
                <li>Redis 서버 부하 감소 (명령 디스패치 횟수 감소)</li>
                <li>원자성 보장 (중간에 다른 명령이 끼어들 수 없음)</li>
            </ul>

            <hr />

            <h2>7. Redisson 분산 락</h2>

            <h3>7.1 SETNX의 한계</h3>
            <pre><code>{`Boolean acquired = redisTemplate.opsForValue()
    .setIfAbsent("seat:lock:block:" + blockId, "LOCKED", Duration.ofSeconds(5));`}</code></pre>
            <p><strong>문제</strong>:</p>
            <ol>
                <li><strong>소유자 검증 없음</strong> — 다른 스레드가 삭제 가능</li>
                <li><strong>Watch Dog 없음</strong> — TTL 만료 시 작업 도중 락 이탈</li>
                <li><strong>대기/재시도 직접 구현</strong> — polling 비효율적</li>
            </ol>

            <h3>7.2 Redisson RLock</h3>
            <pre><code>{`RLock lock = redissonClient.getLock(key);
boolean locked = lock.tryLock(3, TimeUnit.SECONDS);  // 3초 대기
try {
    // 임계 영역
} finally {
    if (lock.isHeldByCurrentThread()) {
        lock.unlock();
    }
}`}</code></pre>

            <h3>핵심 기능</h3>
            <table>
                <thead>
                    <tr><th>기능</th><th>설명</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>Watch Dog</strong></td><td>leaseTime 미지정 시 30초 TTL + 10초마다 자동 갱신</td></tr>
                    <tr><td><strong>소유자 검증</strong></td><td><code>isHeldByCurrentThread()</code> — 스레드 ID 기반</td></tr>
                    <tr><td><strong>Pub/Sub 대기</strong></td><td>polling 없이 락 해제 알림 수신</td></tr>
                    <tr><td><strong>자동 언락</strong></td><td>스레드 종료 시 락 자동 해제</td></tr>
                </tbody>
            </table>

            <h3>7.3 본 프로젝트의 락 전략</h3>
            <table>
                <thead>
                    <tr><th>시나리오</th><th>락 키</th><th>Wait</th><th>Lease</th></tr>
                </thead>
                <tbody>
                    <tr><td>추천 블럭 배정</td><td><code>{`seat:recommendation:match:{m}:block:{b}`}</code></td><td>3s</td><td>Watch Dog</td></tr>
                    <tr><td>일반 좌석 Hold</td><td><code>{`seat:hold:match:{m}:seat:{s}`}</code></td><td>500ms</td><td>5s</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>8. 조건부 UPDATE (Optimistic Lock)</h2>

            <h3>8.1 문제 상황</h3>
            <p>
                추천 블럭 락과 일반 좌석 락은 <strong>서로 다른 키</strong>를 사용합니다.
                따라서 동시에 같은 좌석을 노리면 충돌이 발생할 수 있습니다.
            </p>

            <h3>8.2 해결: 조건부 UPDATE</h3>
            <pre><code>{`UPDATE match_seats
SET sale_status = 'BLOCKED'
WHERE id = :matchSeatId
  AND sale_status = 'AVAILABLE'`}</code></pre>

            <ul>
                <li>해당 좌석이 <code>AVAILABLE</code> 상태일 때만 <code>BLOCKED</code>로 변경</li>
                <li>return 값이 0이면 <strong>이미 다른 유저가 선점</strong> → 재시도 트리거</li>
            </ul>

            <pre><code>{`int updated = matchSeatRepository.markBlockedIfAvailable(seat.getId());
if (updated == 0) {
    // 충돌 감지 → 지금까지 잡은 좌석 모두 롤백 후 재시도
    blocked.forEach(s -> matchSeatRepository.markAvailableIfBlocked(s.getId()));
    return false;
}`}</code></pre>

            <hr />

            <h2>9. JOIN FETCH vs Lazy Loading</h2>

            <h3>9.1 N+1 문제</h3>
            <pre><code>{`// Lazy 로딩: 좌석 조회 시마다 Match도 1번씩 추가 쿼리
List<MatchSeat> seats = matchSeatRepository.findAll();  // 1번 쿼리
for (MatchSeat seat : seats) {
    seat.getMatch().getHomeTeam();  // N번 쿼리 (N+1)
}`}</code></pre>
            <p>100개의 좌석 → <strong>101번</strong>의 쿼리 실행.</p>

            <h3>9.2 JOIN FETCH</h3>
            <pre><code>{`@Query("""
    SELECT m FROM Match m
    JOIN FETCH m.homeTeam
    JOIN FETCH m.awayTeam
    JOIN FETCH m.stadium
    WHERE m.id = :id
""")
Optional<Match> findDetailByIdOrThrow(@Param("id") Long id);`}</code></pre>
            <p>한 번의 쿼리로 <strong>모든 연관관계를 즉시 로딩</strong> (eager fetch)합니다.</p>

            <hr />

            <h2>10. 용어 정리 요약표</h2>
            <table>
                <thead>
                    <tr><th>용어</th><th>핵심 기능</th><th>본 프로젝트 적용</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>HikariCP</strong></td><td>DB 커넥션 풀 재사용</td><td>Pool 20 → 30, Min-idle 20 → 5</td></tr>
                    <tr><td><strong>Caffeine</strong></td><td>JVM 인-메모리 로컬 캐시</td><td>Match/Section/Block 10분~1시간</td></tr>
                    <tr><td><strong>Redis 분산 캐시</strong></td><td>여러 Pod 간 공유 캐시</td><td>User / 응답 캐시</td></tr>
                    <tr><td><strong>OSIV</strong></td><td>요청 전 구간 DB 커넥션 유지</td><td>OFF로 전환 (Queue)</td></tr>
                    <tr><td><strong>Resilience4j @Retry</strong></td><td>비동기 재시도</td><td>Thread.sleep → @Retry</td></tr>
                    <tr><td><strong>Redis Lua Script</strong></td><td>다중 명령 원자 실행</td><td>대기열 재진입 3 RTT → 1 RTT</td></tr>
                    <tr><td><strong>Redisson RLock</strong></td><td>Watch Dog 기반 분산 락</td><td>블럭/좌석 단위 락</td></tr>
                    <tr><td><strong>조건부 UPDATE</strong></td><td>Optimistic Lock</td><td><code>markBlockedIfAvailable</code></td></tr>
                    <tr><td><strong>JOIN FETCH</strong></td><td>N+1 제거</td><td><code>findDetailByIdOrThrow</code></td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
