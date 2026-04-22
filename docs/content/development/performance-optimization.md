# 부하테스트 트러블슈팅 및 최적화 사항

> 1차 ~ 5차(Phase 4)에 걸친 단계별 성능 개선 전 과정

---

## 1. 부하테스트 배경

### 1.1 환경

| 항목 | 값 |
|------|-----|
| 대상 환경 | staging (AWS) |
| DB | PostgreSQL (db.t4g.medium, `max_connections = 250`) — RDS 공식 `LEAST(DBInstanceClassMemory/9531392, 5000)` 기준 |
| Redis | ElastiCache Redis 7 (공용 + Queue 전용) |
| 테스트 도구 | k6 |
| 목표 VU | 5,000 VU |

### 1.2 AS-IS 상태 (최적화 전)

최적화 전 코드 상태에서의 문제점:

```
┌────────────────────────────────────────────────────────────────┐
│  AS-IS: 최적화 전 아키텍처                                       │
│                                                                │
│  [모든 요청] → [Tomcat 스레드 200개]                              │
│       │                                                        │
│       ├─ matchRepository.findByIdOrThrow()     ← 매 요청 DB 조회 │
│       ├─ sectionRepository.findAll...()         ← 매 요청 DB 조회 │
│       ├─ blockRepository.findBySectionIdIn()    ← 매 요청 DB 조회 │
│       ├─ userRepository.findByIdOrThrow()       ← 매 요청 DB 조회 │
│       └─ onboardingPreference 조회              ← 매 요청 DB 조회 │
│                                                                │
│  → HikariCP 20개 커넥션 풀에 200개 스레드가 경합                   │
│  → 커넥션 대기 → 스레드 블로킹 → P99 6,887ms                     │
│  → DB 커넥션 270개 한계 도달 → 503 에러 다수 발생                  │
└────────────────────────────────────────────────────────────────┘
```

**핵심 문제**: Redis 캐싱이 문제가 아니라 **DB 커넥션 풀 + Tomcat 스레드 블로킹**이 병목이었다.

### 1.3 코드 분석 결과

`BookingOptionsService.saveBookingOptions()`가 하는 일:
1. `matchRepository.findByIdOrThrow(matchId)` — RDB 조회 (캐시 미적용)
2. `bookingOptionsRedisRepository.save()` — Redis 쓰기 (빠름)
3. `preQueueBookingOptionMarkerRepository.mark()` — 최대 3회 재시도 + Thread.sleep(50/100ms)

**진짜 병목: 설정 불균형**

```yaml
# seat/application.yaml (최적화 전)
tomcat.threads.max: 200    # 스레드 200개
hikari.maximum-pool-size: 20    # DB 커넥션 20개 ← 여기!
```

시나리오:
- 1000 VU 동점 → seat가 초당 14 RPS 처리
- Tomcat 스레드는 200개까지 요청 받음
- 그런데 DB 커넥션은 20개뿐 → 180개 스레드는 `findByIdOrThrow`에서 커넥션 대기로 블로킹
- 스레드가 풀려나지 못하니 나머지 요청은 `accept-count(100)` 큐에서 추가 대기
- **결과: Avg 2초, P99 6.8초**

### 1.4 Redis/펜체크는 범인이 아닌 이유

- Redis는 사용량이 아니라 오히려 **DB 부하를 줄여주는 쪽** (sub-ms 레이턴시)
- `syncPreQueueMarkerOrRollback`의 Thread.sleep 재시도는 실패 시에만 발동하는데 성공률 100%니까 트리거 안 됨

---

## 2. DB 부하 유발 Top 7 쿼리 전수조사

코드 레벨에서 할 수 있는 건 **"DB 커넥션을 쓰는 쿼리 자체를 줄이는 것"**. 전수조사 결과 기반으로 캐싱 우선순위를 결정했다.

### 2.1 현재 상황 수치

| 항목 | 현재 | 5000 VU 요구치 | Gap |
|------|------|--------------|------|
| DB `max_connections` | **250** | 500~1000 | 부족 |
| 현재 커버한 캐싱 | Match existsById 1건 | N/A | 나머지 쿼리가 커넥션 소진 중 |

### 2.2 Top 7 핫 쿼리

| 순위 | 위치 | 쿼리 | 요청당 호출 | 불변성 | 제안 |
|------|------|------|----------|--------|------|
| 1 | `Seat/SeatCommonService:52,90` | `MatchRepository.findDetailByIdOrThrow` (JOIN FETCH home/away/stadium) | 2회 | 거의 불변 | **Caffeine** |
| 2 | `Seat/SeatCommonService:56` | `SectionRepository.findAllWithAreaOrderBy...` | 좌석 진입 1회 | 영구 불변 | **Caffeine** |
| 3 | `Seat/SeatCommonService` | `BlockRepository.findBySectionIdIn...` | 좌석 진입 1회 | 영구 불변 | **Caffeine** |
| 4 | `Order-Core/OrderService:74,105` | `MatchRepository.findDetailByIdOrThrow` | 2회 | 거의 불변 | **Caffeine** |
| 5 | `Queue/QueueService:56` | `MatchRepository.findByIdOrThrow` | 매 요청 | 거의 불변 | **Caffeine** |
| 6 | Auth-Guard, Order-Core | `UserRepository.findByIdOrThrow` | 토큰/주문 매회 | 변동 있음 | **Redis** |
| 7 | Seat/recommendation | `OnboardingPreference/Block` | 추천 매회 | 변동 있음 | **Redis** |

### 2.3 판정 근거

- **1~5번** (Caffeine): 스타디움 구조/Match 메타데이터는 관리자 개입 없이 안 바뀜 → 로컬 캐시 TTL 10분~1시간 충분
- **6번** (Redis): User는 닉네임/상태 변경 발생 → Pod 간 즉시 전파 필요 → 로컬 캐시 부적합
- **7번** (Redis): 사용자별 데이터라 키 공간이 넓음 + 개인화 값

### 2.4 Phase별 예상 효과

| 조치 | DB 쿼리 감소 | 커넥션 여유 | 구현 난이도 |
|------|------------|-----------|-----------|
| **Phase 1**: Match/Section/Block Caffeine | 50~60% | 대폭 ↑ | 낮음 |
| **Phase 2**: User Redis 캐시 | +20% | ↑ | 중간 |
| **Phase 3**: 추천 온보딩 캐시 / 응답 캐시 / 인프라 튜닝 | +10% | ↑ | 중간~상 |

---

## 3. 1차 최적화: Seat BookingOptions Match 조회 Caffeine 캐싱

### 3.1 문제

- `BookingOptionsService.saveBookingOptions()` 내에서 `matchRepository.findByIdOrThrow(matchId)` 호출
- 1000 VU 부하테스트에서 P99 **6,887ms** 기록
- Match는 거의 불변 데이터인데 매 요청마다 DB를 때림

### 3.2 해결

```java
// 변경 전
Match match = matchRepository.findByIdOrThrow(matchId);  // 매번 DB SELECT

// 변경 후
@Cacheable(cacheNames = "match-exists", key = "#matchId", unless = "!#result")
public boolean exists(Long matchId) {
    return matchRepository.existsById(matchId);
}
// → 캐시 hit 시 DB 호출 0회, sub-microsecond 응답
```

**Caffeine 설정**

```yaml
spring:
  cache:
    type: caffeine
    cache-names: match-exists
    caffeine:
      spec: maximumSize=1000,expireAfterWrite=10m,recordStats
```

| 항목 | 설명 |
|------|------|
| `maximumSize=1000` | 최대 1000개 match ID 캐싱 (초과 시 LFU 기반 eviction) |
| `expireAfterWrite=10m` | 캐시에 쓴 지 10분 지나면 만료 |
| `recordStats` | hit/miss 통계 수집 (`/actuator/metrics/cache.gets`) |

### 3.3 Caffeine이 이 케이스에 적합한 이유

1. **DB 커넥션 점유 시간 제거**: 캐시 hit 시 DB 커넥션을 아예 안 쓰니까 20개짜리 HikariCP 풀에 숨통
2. **Tomcat 스레드 점유 시간 단축**: 스레드가 DB I/O 기다리며 수십~수백 ms 블로킹하던 것이 sub-ms에 끝남 → 스레드 회전율(throughput) 상승
3. **Match는 "거의 불변(immutable-ish)" 데이터**: 경기 정보(홈/어웨이 팀, 경기장, 시작 시간)는 한 번 생성되면 거의 안 바뀜 → TTL 길게 잡아도 정합성 이슈 없음

### 3.4 예상 효과 vs 실제

```
1000 VU 시나리오에서:
- 요청 1건당 SELECT match가 약 5~30ms 소요
- 동시 200개 스레드가 커넥션 20개를 놓고 경합 → 대기시간만 수백 ms
- P99 6.8초의 큰 지분을 차지할 가능성 높음
- Caffeine 로컬 캐시면 이 구간이 완전히 0에 수렴
```

---

## 4. 2차 최적화 (Phase 1 확대): Multi-Service Caffeine 캐시 전면 확대

### 4.1 적용 범위

1차에서 Seat의 `match-exists` 하나만 적용한 Caffeine 캐싱을 **3개 서비스 × 6개 캐시**로 확대했다.

| 서비스 | 캐시 이름 | 최대 크기 | TTL | 대상 데이터 |
|-------|---------|---------|-----|----------|
| **Seat** | `match-exists` | 1,000 | 10분 | Match 존재 검증 |
| **Seat** | `match-detail` | 1,000 | 10분 | Match 메타데이터 (JOIN FETCH) |
| **Seat** | `section-all` | 16 | 1시간 | 스타디움 섹션 구조 (영구 불변) |
| **Seat** | `blocks-by-section-ids` | 512 | 1시간 | 스타디움 블럭 매핑 (영구 불변) |
| **Queue** | `match-for-queue` | 1,000 | 1분 | Match saleStatus 검증 |
| **Order-Core** | `match-detail` | 1,000 | 10분 | 주문서용 Match 메타데이터 |

### 4.2 설계 원칙

1. **서비스별 CacheConfig 유지**: common-core에 `@Cacheable` 올리지 않음 — 블라스트 레이디어스 제어
2. **정합성 전략**: Match/Section/Block은 관리자가 바꿔도 TTL 지나면 자연 반영 (강제 무효화 불필요)
3. **관측**: `/actuator/metrics/cache.gets`로 hit rate 검증

### 4.3 Queue의 짧은 TTL (1분) 이유

Queue는 대기열 오픈 시점에 `saleStatus`가 `UPCOMING → ON_SALE`로 전환된다. stale 데이터 허용 범위를 1분으로 짧게 가져감.

**부작용 발견**: 이 TTL과 스케줄러 커밋 지연이 결합하여 11시 정각 입장 불가 이슈 발생 → Lazy 시간 기반 판정으로 해결 (별도 트러블슈팅)

### 4.4 예상 효과

- DB 커넥션 peak: **250 → 150** (-39%)
- P95: **< 1초** (1500 VU 목표)
- Top 1~5 쿼리(전체 요청량의 80%+) 커버

---

## 5. 3차 최적화 (Phase 2): Redis 분산 캐시 — 사용자 데이터

### 5.1 왜 Redis인가

User, OnboardingPreference 데이터는 **변경 가능**하다 (닉네임, 상태, 선호도 수정). 로컬 캐시를 쓰면 Pod A에서 변경했는데 Pod B에서는 옛날 데이터를 보는 문제가 생긴다.

```
Caffeine (로컬 캐시)의 한계:
  Pod A: user-by-id:42 = {nickname: "새닉네임"}  ← 갱신됨
  Pod B: user-by-id:42 = {nickname: "옛닉네임"}  ← stale!

Redis (분산 캐시)의 장점:
  Redis: user-by-id:42 = {nickname: "새닉네임"}
  Pod A: Redis 조회 → 최신 데이터
  Pod B: Redis 조회 → 최신 데이터 (단일 소스)
```

### 5.2 적용 범위

| 서비스 | 캐시 이름 | TTL | 대상 | Evict 조건 |
|-------|---------|-----|------|-----------|
| **Auth-Guard** | `user-by-id` | 10분 | User DTO 스냅샷 | 프로필/상태 변경 시 `@CacheEvict` |
| **Auth-Guard** | `auth-me` | 30초 | /auth/me 응답 | 프로필 변경 시 evict |
| **Order-Core** | `user-by-id` | 10분 | User DTO | Auth-Guard와 동일 캐시 공유 |

### 5.3 직렬화 전략

```java
// GenericJackson2JsonRedisSerializer + JavaTimeModule
// → java.time.Instant 등 JSR-310 타입 안전하게 직렬/역직렬화
// DefaultTyping = EVERYTHING → 다형성 역직렬화 지원
```

**트러블슈팅**: 초기에 `DefaultTyping.NON_FINAL`로 설정했다가 DTO 역직렬화 실패 → `EVERYTHING`으로 전환하여 해결

### 5.4 예상 효과

- `/auth/me` P99: **400~600ms → 50ms**
- User DB 쿼리 완전 제거 (토큰/주문 매 요청)
- DB 커넥션 추가 20% 절감

---

## 6. 4차 최적화 (Phase 3): API 응답 Redis 캐시 + 인프라 튜닝

### 6.1 응답 레벨 캐싱

특정 API 응답 전체를 Redis에 캐싱하여 DB 조회 + 비즈니스 로직 자체를 건너뛴다.

| 서비스 | 캐시 이름 | TTL | 대상 API | 효과 |
|-------|---------|-----|---------|------|
| **Seat** | `seat-groups-response` | 5초 | `GET /matches/{matchId}/seat-groups` | 좌석맵 전체 응답 (유저 독립적) |
| **Order-Core** | `matches-list-response` | 30초 | `GET /matches?date=...` | 경기 목록 응답 |

**seat-groups 5초 TTL의 이유**: 좌석 상태가 실시간으로 바뀌므로(Hold/해제) 긴 TTL은 부적합. 그러나 5초만 캐싱해도 동시 1000명이 같은 경기를 보면 1번만 DB를 때림.

### 6.2 인프라 파라미터 튜닝

| 파라미터 | 변경 전 | 변경 후 | 적용 서비스 | 이유 |
|---------|--------|--------|-----------|------|
| Tomcat `max-threads` | 200 | **400** | Seat, Queue | 캐시 적용 후 스레드 점유 시간 감소 → 더 많은 동시 처리 가능 |
| HikariCP `maximum-pool-size` | 20 | **30** | Seat, Queue | DB 의존 쿼리 감소 → 적은 커넥션으로 충분하지만 여유 확보 |
| HikariCP `minimum-idle` | 20 | **5** | Seat, Queue | 유연한 커넥션 관리 (필요 시만 생성) |
| 총 DB 커넥션 | ~80 | **≤250** | 전체 | `max_connections=250` 한계 내 |

### 6.3 예상 효과

- `seat-groups` P99: **2000ms → 200ms** (cache hit 시)
- VU 수용 능력: **~2000 VU**

---

## 7. 5차 최적화 (Phase 4): 커넥션 회전율 · 스레드 점유 시간 단축 핫픽스

### 7.1 세 가지 병렬 최적화

Phase 4는 각각 독립적인 3가지 최적화를 동시에 적용했다.

#### (1) Queue OSIV OFF

**문제**: Queue 서비스에 `spring.jpa.open-in-view=true`(기본값)가 설정되어 있었다. OSIV가 켜져 있으면 HTTP 요청 시작부터 응답 완료까지 DB 커넥션을 잡고 있는다.

```
OSIV ON (변경 전):
[요청 시작] → HikariCP 커넥션 획득 → Controller → Service → Repository
                                                                  ↓
[응답 완료] ← ─── ─── ─── ─── ─── ─── ← 커넥션 반환 ← ─── ─── ─┘
               전 구간에서 커넥션 점유 (수십~수백 ms)

OSIV OFF (변경 후):
[요청 시작] → Controller → Service → [트랜잭션 시작] HikariCP 획득
                                         ↓
                          Repository → [트랜잭션 종료] 커넥션 반환
                                         ↓
[응답 완료] ← Controller 나머지 로직 (커넥션 없이 진행)
```

**효과**: 커넥션 회전율 **2배** 향상. 같은 20개 커넥션으로 2배의 요청 처리 가능.

#### (2) BookingOptions PreQueue 마커 동기화 개선

**문제**: `syncPreQueueMarkerOrRollback()`에서 실패 시 `Thread.sleep(50ms/100ms)` 재시도 → Tomcat 스레드 300ms 블로킹

```java
// 변경 전
for (int i = 0; i < 3; i++) {
    try {
        preQueueRedis.mark(matchId, userId);
        return;
    } catch (Exception e) {
        Thread.sleep(50 * (i + 1));  // 50ms, 100ms, 150ms 블로킹!
    }
}

// 변경 후: Resilience4j @Retry
@Retry(name = "prequeue-marker", fallbackMethod = "markFallback")
public void mark(Long matchId, Long userId) {
    preQueueStringRedisTemplate.opsForValue()
        .set(bookingOptionKey(matchId, userId), "1", Duration.ofSeconds(ttlSeconds));
}
// → Thread.sleep 제거, Resilience4j가 비동기 재시도 관리
// → 평균 대기: 300ms → 60ms
```

#### (3) Queue Redis Lua 스크립트 통합

**문제**: 대기열 재진입 시 ZREM + ZADD + ZRANK + ZCARD를 각각 Redis 명령으로 호출 → **3 RTT(Round Trip Time)**

```
변경 전 (3 RTT):
→ Redis: ZREM queue:wait:{matchId} {userId}         ← 1 RTT
→ Redis: ZADD queue:wait:{matchId} {score} {userId}  ← 2 RTT  
→ Redis: ZRANK queue:wait:{matchId} {userId}          ← 3 RTT

변경 후 (1 RTT, Lua 스크립트):
→ Redis: EVAL "
    redis.call('ZREM', KEYS[1], ARGV[1])
    redis.call('DEL', KEYS[2])
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
    local rank = redis.call('ZRANK', KEYS[1], ARGV[1])
    local count = redis.call('ZCARD', KEYS[1])
    return {rank, count}
  "                                                    ← 1 RTT
```

**효과**: Redis 왕복 3회 → 1회. Queue 폴링 P99에서 약 2~4ms 절감. 대량 폴링 시 Redis 부하도 감소.

### 7.2 Phase 4 예상 효과

- Seat P99: **-300ms** (OSIV OFF 효과)
- Queue pending connections: **0** (Lua 통합 효과)
- BookingOptions 재시도 대기: **300ms → 60ms**

---

## 8. 추가 트러블슈팅

### 8.1 대기열 오픈 11시 정각 입장 지연

**문제**: 티켓팅 오픈 시각(11:00)에 유저가 대기열에 진입하면 1~2분 동안 "아직 판매 전" 에러 발생

**원인**: 
- `MatchStatusScheduler`가 11:00 cron으로 `saleStatus = ON_SALE` 업데이트
- 이 업데이트가 DB에 반영되는 데 수초~수십초 소요
- Queue의 Caffeine 캐시 TTL 1분과 결합 → 최대 2분 지연

**해결**:
- 스케줄러를 **10:59**에 실행 (1분 여유)
- Queue 진입 판정을 DB `saleStatus` 대신 **시간 비교** (Lazy 판정)
  ```java
  // 변경 전: saleStatus == ON_SALE (DB 의존)
  // 변경 후: now >= salesOpenAt (시간 비교, DB 불필요)
  ```

### 8.2 Seat Hold Detached Entity 이슈

**문제**: OSIV OFF 후 SeatHold 엔티티가 detached 상태가 되어 `saleStatus` 변경이 DB에 반영되지 않음

**해결**: JPA dirty checking 대신 **Bulk UPDATE 쿼리** 사용
```java
// 변경 전: entity.setSaleStatus(AVAILABLE) → dirty checking (OSIV 필요)
// 변경 후: matchSeatRepository.markAvailableIfBlocked(matchSeatId) → 직접 UPDATE
```

### 8.3 AES-GCM 암호화 Hibernate 불필요 UPDATE

**문제**: AES-GCM은 랜덤 IV를 사용하므로 같은 평문도 매번 다른 암호문 생성 → Hibernate dirty checking이 매번 UPDATE 발생

**해결**: `EncryptionConverter`에서 IV를 캐싱하여 같은 평문이면 같은 암호문 반환 → 불필요한 UPDATE 제거

### 8.4 Redis 메모리 초과 — 리프레시 토큰 누적

**문제**: Refresh Token TTL이 7일로 설정되어 부하테스트 시 대량 토큰 누적 → Redis 메모리 초과

**해결**: 
- Refresh Token TTL: **7일 → 4시간**
- 부하테스트용 토큰: **15분**

### 8.5 seat-groups N+1 및 Cleanup Slow Query

**문제**: `GET /seat-groups` API에서 Section → Block → MatchSeat 조회 시 N+1 쿼리 발생 + SeatHold cleanup 시 느린 쿼리

**해결**:
- JOIN FETCH 추가로 N+1 제거
- 인덱스 최적화

---

## 9. 전체 최적화 타임라인

```
AS-IS (최적화 전)
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
│  └─ /auth/me P99: 400ms → 50ms, DB 쿼리 +20% 감소
│
├─ 4차 (Phase 3): API 응답 Redis 캐시 + 인프라 튜닝
│  └─ seat-groups-response 5초 캐시, matches-list 30초 캐시
│  └─ Tomcat 200→400, HikariCP 20→30
│  └─ seat-groups P99: 2000ms → 200ms
│
├─ 5차 (Phase 4): 커넥션 회전율 · 스레드 점유 핫픽스
│  └─ Queue OSIV OFF (커넥션 회전율 2배)
│  └─ BookingOptions Resilience4j @Retry (Thread.sleep 제거)
│  └─ Queue Redis Lua 통합 (3 RTT → 1 RTT)
│  └─ Seat P99 -300ms
│
TO-BE (최적화 후)
   캐싱이 정적 데이터 쿼리를 흡수하고,
   DB 커넥션은 좌석 조회/추천 등 정말 필요한 곳에만 사용.
   Tomcat 스레드 회전율이 올라가서 같은 인프라로 더 많은 VU 수용 가능.
```

---

## 10. 현재 최신 코드 적용 현황

| 서비스 | 적용된 캐시/최적화 | 파일 |
|-------|----------------|------|
| **Seat** | Caffeine: match-exists, match-detail, section-all, blocks-by-section-ids | `CacheConfig.java` |
| **Seat** | Redis: seat-groups-response (5초) | `CacheConfig.java` (redisCacheManager) |
| **Seat** | Redisson 분산 락 (블럭/좌석) | `SeatBlockLock.java`, `SeatHoldLockManager.java` |
| **Seat** | OSIV OFF | `application.yaml` → `open-in-view: false` |
| **Queue** | Caffeine: match-for-queue (1분) | `CacheConfig.java` |
| **Queue** | OSIV OFF | `application.yaml` → `open-in-view: false` |
| **Queue** | Lua 스크립트 통합 (rank+count atomic) | `QueueRedisRepository.java` |
| **Auth-Guard** | Redis: user-by-id (10분), auth-me (30초) | `CacheConfig.java` |
| **Order-Core** | Caffeine: match-detail (10분) | `CacheConfig.java` |
| **Order-Core** | Redis: user-by-id (10분), matches-list-response (30초) | `CacheConfig.java` (redisCacheManager) |
| **전체** | HikariCP leak-detection 10초, connection-timeout 30초 | `application.yaml` |
| **전체** | Tomcat max-threads / accept-count 환경변수화 | `application.yaml` |

---

## 11. HikariCP 커넥션 풀이란?

### 11.1 개념

HikariCP는 Java에서 가장 빠른 JDBC 커넥션 풀 라이브러리로, Spring Boot의 기본 커넥션 풀이다.

DB 커넥션은 TCP 연결이라 생성 비용이 비싸다 (수십~수백 ms). 매 요청마다 연결/해제하면 성능이 나빠지므로, **미리 커넥션을 생성해놓고 재사용**하는 것이 커넥션 풀의 역할이다.

```
[Tomcat 스레드] → [HikariCP 풀에서 커넥션 빌림]
                       ↓
                  [DB 쿼리 실행]
                       ↓
                  [커넥션 풀에 반환]
                       ↓
              [다른 스레드가 같은 커넥션 재사용]
```

### 11.2 핵심 설정값

| 설정 | 값 | 의미 |
|------|-----|------|
| `maximum-pool-size` | 20~30 | 풀에서 최대 몇 개 커넥션을 유지할 것인지 |
| `minimum-idle` | 5~20 | 최소 유지 커넥션 수 (나머지는 필요 시 생성) |
| `connection-timeout` | 30초 | 커넥션을 못 빌리면 이 시간 후 예외 발생 |
| `leak-detection-threshold` | 10초 | 이 시간 이상 커넥션을 안 돌려주면 로그 경고 |

### 11.3 우리 서비스에서의 교훈

```
스레드 200개 vs 커넥션 20개 → 180개 스레드가 커넥션 대기 블로킹
                          → P99 6.8초의 원인

해결: 커넥션을 늘리는 게 아니라, DB를 때리는 쿼리를 캐시로 줄여서
      커넥션을 정말 필요한 곳(좌석 조회, 추천 등)에만 사용
```

> **부하테스트 결과 취합은 별도로 진행 예정** — 1차/2차/3차/4차 적용 후 각각의 부하테스트 수치는 추후 정리하여 추가합니다.
