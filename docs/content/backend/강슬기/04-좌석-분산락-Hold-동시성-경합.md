# 좌석 분산 락과 Hold 동시성 경합 문제

> 추천 ON / 추천 OFF / 교차 충돌 — 세 가지 시나리오의 락 전략과 해결 방법

---

## 1. 문제 배경

대규모 티켓팅 서비스에서 좌석 선점(Hold)은 두 가지 방식으로 동시에 일어난다.

| 방식 | 설명 | 사용자 행동 | 락 단위 |
|------|------|-----------|---------|
| **추천 좌석 배정** | 서버가 블럭 내 최적 N연석을 자동 배정 | 블럭 카드 선택 → "예매하기" | 블럭(block) |
| **일반 좌석 선택 (포도알)** | 유저가 좌석맵에서 직접 좌석 클릭 | 좌석 1개씩 직접 클릭 | 좌석(seat) |

두 방식은 **동시에 같은 블럭에서 일어날 수 있으며**, 동시성 제어 없이는 중복 배정 문제가 발생한다.

---

## 2. 초기 구현: SETNX 기반 분산 락의 한계

### 2.1 초기 방식

Spring Data Redis의 `setIfAbsent`를 사용한 단순 분산 락.

```java
// 락 획득
Boolean acquired = redisTemplate.opsForValue()
    .setIfAbsent("seat:lock:block:" + blockId, "LOCKED", Duration.ofSeconds(5));

// 락 해제
redisTemplate.delete("seat:lock:block:" + blockId);
```

### 2.2 발생한 문제들

**문제 1: 락 소유자 검증 불가**

SETNX는 누가 락을 걸었는지 검증하지 않는다. 다른 스레드가 실수로 락을 삭제할 수 있다.

```
스레드A: SET key LOCKED NX EX 5  → 락 획득
스레드B: DEL key                  → 스레드A의 락을 삭제!
스레드C: SET key LOCKED NX EX 5  → 락 획득 → 스레드A와 동시 실행!
```

**문제 2: Watch Dog 부재 (TTL 만료 시 락 이탈)**

추천 좌석 배정은 **조회 → 연석 계산 → DB UPDATE → Hold 생성**의 복합 연산이다. DB 부하로 트랜잭션이 지연되면 고정 TTL(5초)이 먼저 만료된다.

```
유저A: SETNX 락 획득 (TTL 5초)
유저A: 빈 좌석 조회 (100ms)
유저A: 연석 계산 (50ms)
유저A: DB UPDATE 시작... ← DB 부하로 3초 지연
       ← TTL 5초 만료! 락 해제됨!
유저B: SETNX 락 획득 → 같은 좌석 조회 → 중복 배정!
```

**문제 3: 재시도 로직 직접 구현 필요**

자동 대기(spin-wait) 기능이 없어서 비효율적인 polling을 직접 구현해야 했다.

### 2.3 SETNX 한계 정리

| 문제 | 영향 | 심각도 |
|------|------|--------|
| 소유자 검증 없음 | 다른 스레드가 락 삭제 → 동시 실행 | **높음** |
| Watch Dog 없음 | DB 지연 시 TTL 만료 → 중복 배정 | **높음** |
| 재시도 미지원 | 직접 구현 필요 → 비효율적 polling | 중간 |
| 예외 안전성 | unlock 실패 시 별도 처리 필요 | 중간 |

---

## 3. 해결: Redisson RLock 전환

### 3.1 Redisson이 SETNX 문제를 해결하는 방식

**Watch Dog (자동 TTL 갱신)**

Redisson RLock에서 `leaseTime`을 지정하지 않으면 Watch Dog이 활성화된다. 기본 30초 TTL로 락을 생성하고, 락을 보유한 스레드가 살아있는 한 **10초마다 자동으로 TTL을 30초로 갱신**한다.

```
유저A: tryLock() → 락 획득 (TTL 30초, Watch Dog 활성화)
유저A: DB UPDATE 시작... (DB 부하로 지연)
       ← Watch Dog: 10초 경과 → TTL 30초로 갱신
       ← Watch Dog: 20초 경과 → TTL 30초로 갱신
유저A: DB UPDATE 완료
유저A: unlock() → 락 해제, Watch Dog 중지
```

**소유자 검증**

Redisson RLock은 락을 획득한 스레드의 ID를 Redis에 저장한다. `isHeldByCurrentThread()`로 소유자만 unlock할 수 있다.

**자동 대기 + 타임아웃**

`tryLock(waitTime, TimeUnit)`으로 Redis Pub/Sub 기반 효율적 대기. polling 없이 락 해제 알림을 받는다.

### 3.2 SETNX vs Redisson 비교

| | SETNX | Redisson RLock |
|--|-------|----------------|
| **Watch Dog** | 없음 → TTL 만료 시 락 이탈 | 자동 TTL 갱신 → 작업 완료까지 안전 |
| **소유자 검증** | 없음 → 아무나 삭제 가능 | 스레드 ID 기반 → 소유자만 해제 |
| **대기/재시도** | 직접 구현 (polling) | `tryLock(waitTime)` 내장 |
| **예외 안전** | 직접 처리 필요 | unlock 실패 시 Watch Dog이 만료 처리 |

---

## 4. 현재 락 전략: 세 가지 시나리오

### 4.1 시나리오 1: 추천 vs 추천 (같은 블럭)

**블럭 단위 Redisson RLock + Watch Dog**

추천 배정은 **블럭 전체에서 빈 좌석을 조회**하는 복합 연산이므로, 조회 범위(블럭)와 같은 단위로 락을 잡는다.

```java
// SeatBlockLock.java
private static final String LOCK_KEY_FORMAT = "seat:recommendation:match:%d:block:%d";
private static final long WAIT_TIME_SECONDS = 3;

public boolean tryLock(Long matchId, Long blockId) {
    RLock lock = redissonClient.getLock(buildKey(matchId, blockId));
    return lock.tryLock(WAIT_TIME_SECONDS, TimeUnit.SECONDS);
    // leaseTime 미지정 → Watch Dog 활성화 (기본 30초, 자동 갱신)
}
```

**락-트랜잭션 분리 구조** (핵심 설계)

```
SeatAssignmentService (락 관리, @Transactional 없음)
  └─ 🔒 락 획득
       └─ SeatAssignmentTransactionalService (@Transactional)
            └─ 조회 → 연석 계산 → markBlockedIfAvailable() → Hold 생성
            └─ 트랜잭션 커밋 ✅
       └─ 🔓 락 해제
```

이 구조가 보장하는 것:
- 트랜잭션 커밋이 **반드시** 락 해제보다 먼저 완료된다
- `@Transactional`이 걸린 서비스에서 직접 락을 관리하면, Spring AOP 프록시 특성상 **락 해제 → 트랜잭션 커밋** 순서가 될 수 있어 위험

**동작 흐름**

```
추천 유저A: 204블럭 5연석 요청
추천 유저B: 204블럭 3연석 요청 (동시)

유저A: 🔒 seat:recommendation:match:10:block:204 획득
유저B: 🔒 같은 키 획득 시도 → 대기 (최대 3초)

유저A: 빈 좌석 조회 → [3열 1~5번] 배정 → Hold 생성 → 트랜잭션 커밋
유저A: 🔓 락 해제

유저B: 🔒 락 획득 성공
유저B: 빈 좌석 조회 → [3열 1~5번]은 BLOCKED → [3열 6~8번] 배정
유저B: 🔓 락 해제
```

**결과**: 블럭 락으로 직렬화되어 먼저 락을 획득한 유저가 배정받고, 두 번째 유저는 남은 좌석에서 배정된다.

---

### 4.2 시나리오 2: 일반(포도알) vs 일반(포도알) (같은 좌석)

**좌석 단위 Redisson RLock**

일반 선택은 유저가 **특정 좌석을 직접 클릭**하므로, 블럭 전체를 잠글 필요 없이 선택한 좌석들만 잠근다.

```java
// SeatHoldLockManager.java
private static final Duration WAIT_TIME = Duration.ofMillis(500);
private static final Duration LEASE_TIME = Duration.ofSeconds(5);

public List<RLock> lockAll(Long matchId, List<Long> sortedSeatIds) {
    List<RLock> acquired = new ArrayList<>();
    for (Long seatId : sortedSeatIds) {  // 정렬된 순서로 획득 → 데드락 방지
        RLock lock = redissonClient.getLock(buildKey(matchId, seatId));
        boolean locked = lock.tryLock(WAIT_TIME, LEASE_TIME, TimeUnit.MILLISECONDS);
        if (!locked) {
            unlockAll(acquired);  // 실패 시 이미 획득한 락 모두 해제
            throw new CustomException(SEAT_LOCK_ACQUISITION_FAILED);
        }
        acquired.add(lock);
    }
    return acquired;
}
```

**데드락 방지 전략: seatId 정렬 순 획득**

```
유저A가 좌석 [3, 1, 2]를 선택 → 정렬: [1, 2, 3] → 순서대로 락 획득
유저B가 좌석 [2, 3, 1]을 선택 → 정렬: [1, 2, 3] → 순서대로 락 획득

항상 같은 순서로 락을 획득하므로 데드락이 발생하지 않는다.
해제는 역순으로 수행한다.
```

**추천 락과의 차이점**

| | 추천 블럭 락 | 일반 좌석 락 |
|--|------------|------------|
| **락 단위** | 블럭 (block) | 개별 좌석 (seat) |
| **락 키** | `seat:recommendation:match:{m}:block:{b}` | `seat:hold:match:{m}:seat:{s}` |
| **Wait Time** | 3초 | 500ms |
| **Lease Time** | Watch Dog (무제한 자동 갱신) | 5초 (고정) |
| **이유** | DB 트랜잭션 포함, 처리 시간 가변 | 단순 상태 변경, 처리 시간 짧음 |
| **데드락 방지** | 단일 키라 불필요 | seatId 정렬 순 획득 + 역순 해제 |

**동작 흐름**

```
일반 유저A: 좌석 [3열1번, 3열2번] 선택
일반 유저B: 좌석 [3열2번, 3열3번] 선택 (3열2번 겹침)

유저A: 🔒 seat:1 획득 → 🔒 seat:2 획득 → Hold 생성 → 🔓 해제
유저B: 🔒 seat:2 획득 시도 → 500ms 대기 → 유저A 해제 후 획득
       → AVAILABLE 체크 → seat:2는 이미 BLOCKED → 에러 응답
```

---

### 4.3 시나리오 3: 추천 ON vs 추천 OFF 교차 충돌

**문제**: 추천 배정의 블럭 락과 일반 선택의 좌석 락은 **서로 다른 키**를 사용한다. 따라서 추천 유저가 블럭 락을 잡고 있어도, 일반 유저는 아무런 대기 없이 같은 블럭의 좌석을 잡을 수 있다.

```
추천 유저A: 🔒 block_lock:204 획득 → 빈 좌석 조회 → [3열 1~5번] 발견
일반 유저B:                           3열 3번 클릭 → seat_lock 획득 → BLOCKED!
추천 유저A: 3열 3번 markBlockedIfAvailable() 시도 → return 0 (이미 BLOCKED!)
```

**해결: 조건부 UPDATE (Optimistic Lock)**

추천 배정에서 좌석 상태 변경 시 조건부 UPDATE를 사용한다.

```sql
UPDATE match_seats
SET sale_status = 'BLOCKED'
WHERE id = :matchSeatId
  AND sale_status = 'AVAILABLE'
-- return 0이면 이미 다른 유저가 선점 → 롤백 후 재시도
```

```java
// SeatAssignmentTransactionalService.java
private boolean tryHoldSeats(List<MatchSeat> candidates, ...) {
    List<MatchSeat> blocked = new ArrayList<>();
    for (MatchSeat seat : candidates) {
        int updated = matchSeatRepository.markBlockedIfAvailable(seat.getId());
        if (updated == 0) {
            // 일반 유저가 이미 잡은 좌석 → 지금까지 BLOCKED한 좌석 롤백
            blocked.forEach(s -> matchSeatRepository.markAvailableIfBlocked(s.getId()));
            return false;  // 재시도 트리거
        }
        blocked.add(seat);
    }
    return true;  // 모든 좌석 BLOCKED 성공 → Hold 생성
}
```

**재시도 전략**: 충돌 시 최대 3회 재시도하며 다른 연석 구간을 탐색한다.

```
시도 1: [3열 1~5번] → 3열 3번 충돌(일반 유저가 선점) → 롤백 → 재시도
시도 2: [3열 6~10번] → 성공!
```

---

## 5. 충돌 시나리오별 처리 정리

| 시나리오 | 락 메커니즘 | 충돌 감지 | 결과 |
|---------|-----------|---------|------|
| **추천 vs 추천** (같은 블럭) | Redisson RLock (블럭) | 블럭 락으로 직렬화 (3초 대기) | 먼저 획득한 유저 배정, 두 번째는 남은 좌석 |
| **일반 vs 일반** (같은 좌석) | Redisson RLock (좌석) | 좌석 단위 직렬화 (500ms 대기) | 먼저 획득한 유저 Hold, 두 번째는 에러 |
| **추천 vs 일반** (같은 좌석) | 조건부 UPDATE | `markBlockedIfAvailable()` return 0 | 추천 측이 롤백 후 다른 연석 재탐색 |
| **다른 블럭 간** | 독립 | 서로 다른 락 키 | 완전 병렬 처리, 충돌 없음 |

---

## 6. 전체 락 흐름 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        204 블럭                                  │
│                                                                 │
│  ┌───────────────────────────────────────┐                      │
│  │  추천 배정 (Redisson RLock + Watch Dog) │                      │
│  │  키: seat:recommendation:match:10:block:204                  │
│  │  Wait: 3초 / Lease: Watch Dog (자동 갱신)                      │
│  │                                       │                      │
│  │  유저A ── 🔒 락 획득 ──┐                 │                      │
│  │  유저C ── 🔒 대기 (3초)  │               │                      │
│  │                        ▼              │                      │
│  │       [빈 좌석 조회]                     │                      │
│  │       [연석 계산]                       │                      │
│  │       [markBlockedIfAvailable()] ─────┼──   일반 유저가 잡은    │
│  │       [Hold 생성]                      │    좌석 감지 (return 0)│
│  │       [트랜잭션 커밋]                    │    → 롤백 후 재시도      │
│  │                        │              │                      │
│  │                     🔓 해제            │                      │
│  └───────────────────────────────────────┘                      │
│                                                                 │
│  ┌───────────────────────────────────────┐                      │
│  │  일반 선택 (Redisson RLock, 좌석 단위)     │  ← 블럭 락과 독립       │
│  │  키: seat:hold:match:10:seat:{seatId}  │                      │
│  │  Wait: 500ms / Lease: 5초 (고정)        │                      │
│  │                                       │                      │
│  │  유저B ── 🔒 좌석 [3,5] 락 → Hold 생성    │                      │
│  │  유저D ── 🔒 좌석 [3] 대기 → 충돌 에러      │                      │
│  └───────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. SeatHold 엔티티와 TTL 관리

### Hold 생성

```java
@Entity
@Table(name = "seat_holds", uniqueConstraints = {
    @UniqueConstraint(name = "uk_seat_holds_match_seat_id", columnNames = {"match_seat_id"})
})
public class SeatHold {
    Long matchSeatId;     // UK 제약: 좌석당 하나의 Hold만 허용
    Long matchId;
    Long seatId;
    Long userId;
    Instant expiresAt;    // 생성 시점 + 5분
}
```

### Hold 만료 처리

- `SeatHoldCleanupScheduler`: 60초 간격으로 만료된 Hold 스캔
- 만료된 Hold의 좌석: BLOCKED → AVAILABLE 복원
- SeatHold 레코드 삭제
- 메트릭 기록: `ticketing_seat_hold_expired`

### Hold 연장 (같은 좌석 재요청)

유저가 이미 Hold 중인 좌석을 다시 요청하면 기존 Hold의 `expiresAt`을 갱신한다 (새 Hold 생성 없이 연장).

---

## 8. 트러블슈팅 히스토리

| 순서 | 커밋 | 문제 | 해결 |
|------|------|------|------|
| 1 | `0e1d3de` | SETNX의 TTL 만료로 DB 트랜잭션 중 락 이탈 | Redisson RLock + Watch Dog 도입 |
| 2 | `9012b12` | 초기 Redisson에서 leaseTime 지정 → Watch Dog 비활성화 | `tryLock(waitTime)`으로 변경 (leaseTime 미지정) |
| 3 | `1355c9a` | `@Transactional` 서비스에서 락 관리 → 락 해제 후 커밋 순서 역전 | 락 관리를 외부(비트랜잭션) 서비스로 분리 |
| 4 | `2d97cb1` | 일반 좌석 WAIT_TIME 100ms → 피크 트래픽 시 락 획득 실패율 증가 | 100ms → 500ms로 상향 |
