# 티켓팅 플로우

티켓팅은 대기열 진입부터 결제 완료까지 6개 Phase로 구성됩니다. 각 단계는 보안 토큰과 분산 락으로 보호되어 대기열 우회, 좌석 중복 선점, 미결제 점유를 원천 차단합니다.

---

## 전체 시퀀스

```mermaid
sequenceDiagram
    participant U as 사용자
    participant G as API-Gateway
    participant Q as Queue
    participant R as Redis
    participant S as Seat
    participant DB as PostgreSQL
    participant O as Order-Core

    Note over U,Q: Phase 1: 대기열 진입
    U ->> G: POST /queue/matches/{matchId}/enter
    Note over G: JWT 검증 + X-User-Id 주입
    G ->> Q: 대기열 진입 요청
    Q ->> R: SET seat:preference:{m}:{u} (TTL 900초)
    Q ->> R: ZADD queue:wait:{matchId} (score=timestamp)
    Q -->> U: WAITING (rank, totalWaitingCount)

    Note over U,Q: Phase 2: 폴링
    loop 동적 간격 (1.5초 / 3초 / 5초)
        U ->> Q: GET /queue/status
        alt WAITING
            Q -->> U: rank, pollingMs
        else READY (스케줄러 승격)
            Q ->> R: SET queue:ready:{m}:{u} (TTL 30초)
            Q -->> U: admissionToken (30초 유효)
        end
    end

    Note over U,S: Phase 3: Seat 진입
    U ->> S: POST /seat/enter (admissionToken)
    S ->> R: GET + DEL queue:ready (토큰 소멸)
    S ->> R: GET seat:preference (선호도 로드)
    S ->> R: SET seat:session + ZADD seat:active
    S -->> U: seat_session 쿠키

    Note over U,S: Phase 4: 추천 블록 조회
    U ->> S: GET /recommendations/blocks
    S ->> DB: 선호 블록별 N연석 가능 개수 계산
    S ->> DB: 온보딩 취향 정보 조회
    S ->> S: 연석수 + 취향점수 기반 정렬
    S -->> U: 추천 블록 카드 리스트

    Note over U,S: Phase 5: 좌석 배정 + Hold
    U ->> S: POST /blocks/{blockId}/assign
    S ->> R: SETNX block_lock:{blockId} (TTL 5초)
    S ->> DB: 연석 탐색 (Real → Semi fallback)
    S ->> DB: match_seats → BLOCKED + seat_holds (TTL 5분)
    S ->> R: DEL block_lock
    S -->> U: 배정 좌석 + holdExpiresAt

    Note over U,O: Phase 6: 주문 + 결제
    U ->> O: GET /orders/sheet (Hold 검증 + 가격 계산)
    O -->> U: 주문서 (좌석 상세 + 총액)
    U ->> O: POST /orders (주문 생성)
    O ->> DB: INSERT orders (PAYMENT_PENDING)
    U ->> O: POST /orders/{id}/payment
    alt 토스페이 / 카카오페이
        O ->> DB: Payment COMPLETED + Order PAID
    else 가상계좌
        O ->> DB: Payment PENDING (입금기한 3일)
    end
    O -->> U: 결제 완료
```

---

## 단계별 핵심 메커니즘

| Phase | 핵심 기술 | 목적 |
|---|---|---|
| **1. 대기열** | Redis Sorted Set | 순서 보장 + 대량 트래픽 흡수 |
| **2. 폴링** | 동적 간격 (rank 기반) | 서버 부하 최소화 |
| **3. Seat 진입** | Admission Token (TTL 30초) | 대기열 우회 차단 |
| **4. 추천** | 선호도 점수 (max 70점) | 사용자 취향 반영 |
| **5. 배정** | 분산 락 + 연석/준연석 알고리즘 | 동시성 제어 + 연석 보장 |
| **6. 주문/결제** | Hold 검증 (TTL 5분) | 좌석 점유 증명 |

---

## 폴링 간격 전략

클라이언트는 자신의 순위(rank)에 따라 폴링 간격을 동적으로 조절합니다. 대기 순위가 높을수록 짧은 간격으로 자주 확인하고, 순위가 낮을수록 긴 간격을 두어 서버 부하를 분산합니다.

| 순위 | 폴링 간격 |
|---|---|
| rank ≤ 100 | 1.5초 |
| rank ≤ 1000 | 3초 |
| rank > 1000 | 5초 |
