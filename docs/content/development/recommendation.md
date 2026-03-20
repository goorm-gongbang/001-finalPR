# 추천 알고리즘

추천 시스템은 **블록 추천(Phase 1)**과 **좌석 배정(Phase 2)** 두 단계로 나뉩니다. 사용자 온보딩 선호도를 기반으로 최적 블록을 추천하고, 선택 후 분산 락을 이용해 연석을 안전하게 배정합니다.

---

## Phase 1 — 블록 추천

```mermaid
flowchart TD
    START([추천 요청]) --> LOAD[데이터 로드]

    subgraph LOAD_DETAIL[데이터 로드]
        L1[Redis: ticketCount N, preferredBlockIds]
        L2[DB: favoriteClub, cheerProximityPref]
        L3[DB: viewpointPriority 1~3순위]
        L4[DB: Match homeClub, awayClub]
    end

    LOAD --> LOOP{선호 블록 순회}

    LOOP -->|블록 있음| QUERY[AVAILABLE MatchSeat 조회]
    QUERY --> GROUP[row별 그룹화 + templateColNo 정렬]
    GROUP --> SEGMENT[연속 구간 추출]
    SEGMENT --> COUNT["N연석 묶음 수 계산 (구간길이 - N + 1)"]
    COUNT --> CHECK{N연석 > 0?}
    CHECK -->|Yes| ADD[후보 리스트에 추가]
    CHECK -->|No| SKIP[블록 제외]
    ADD --> LOOP
    SKIP --> LOOP

    LOOP -->|순회 완료| EMPTY{후보 있음?}
    EMPTY -->|없음| ERROR[추천 좌석 없음 에러]

    EMPTY -->|있음| SCORE_LOOP{후보 블록 순회}
    SCORE_LOOP -->|블록 있음| VP["뷰포인트 점수 (1순위 30 · 2순위 20 · 3순위 10)"]
    VP --> CLUB{응원구단이 경기 참가?}
    CLUB -->|Yes| CLUB_YES[구단 선호 +25점 HOME→1루 / AWAY→3루]
    CLUB -->|No| CLUB_NO[구단 점수 0점]
    CLUB_YES --> PROX{응원석 근접 선호?}
    CLUB_NO --> PROX
    PROX -->|NEAR| P_NEAR[+15점 cheerRank ≤ 3]
    PROX -->|FAR| P_FAR[+15점 cheerRank > 3]
    PROX -->|ANY| P_ANY[+0점]
    P_NEAR --> TOTAL[tasteScore 합산 최대 70점]
    P_FAR --> TOTAL
    P_ANY --> TOTAL
    TOTAL --> SCORE_LOOP

    SCORE_LOOP -->|순회 완료| SORT[다중 조건 정렬]

    subgraph SORT_DETAIL[정렬 기준]
        S1["1차: 연석수 차이 > 10 → 개수 많은 순"]
        S2["2차: 차이 ≤ 10 → 취향 점수 높은 순"]
        S3[3차: 동점 시 연석 개수 순]
    end

    SORT --> RESULT([추천 블록 카드 리스트 반환])
```

### 취향 점수 계산 (최대 70점)

| 항목 | 조건 | 점수 |
|---|---|---|
| **뷰포인트 우선순위** | 1순위 블록 | 30점 |
| **뷰포인트 우선순위** | 2순위 블록 | 20점 |
| **뷰포인트 우선순위** | 3순위 블록 | 10점 |
| **응원구단 매칭** | 경기 참가 구단 선호 | +25점 |
| **응원석 근접** | NEAR 선호 + cheerRank ≤ 3 | +15점 |
| **응원석 원거리** | FAR 선호 + cheerRank > 3 | +15점 |

연석 수 차이가 10개 이내일 때는 취향 점수가 높은 블록을 우선 추천합니다. 차이가 10개를 초과하면 연석이 더 많은 블록을 우선합니다.

---

## Phase 2 — 좌석 배정

```mermaid
flowchart TD
    SELECT([사용자가 블록 선택]) --> LOCK[Redis 분산 락 획득 SETNX block_lock TTL 5초]
    LOCK --> REAL[진짜 연석 탐색]

    subgraph REAL_DETAIL[진짜 연석 탐색]
        R1[같은 row 내 templateColNo 연속 N개]
        R2["정렬: rowNo ASC → 통로거리 ASC → startCol ASC"]
        R3[앞열 + 통로 가까운 좌석 우선]
    end

    REAL --> FOUND{연석 발견?}
    FOUND -->|Yes| HOLD[좌석 Hold 처리]
    FOUND -->|No| TOGGLE{준연석 토글 ON?}
    TOGGLE -->|OFF| FAIL[추천 좌석 없음 반환]
    TOGGLE -->|ON| SEMI[준연석 탐색]

    subgraph SEMI_DETAIL[준연석 탐색]
        SM1[인접 2개 row에 걸쳐 N석 분배]
        SM2[수평 겹침 overlap > 0 필수]
        SM3["정렬: rowSum ASC → overlap DESC → 통로거리 ASC"]
    end

    SEMI --> SEMI_FOUND{준연석 발견?}
    SEMI_FOUND -->|Yes| HOLD
    SEMI_FOUND -->|No| FAIL

    HOLD --> DB_UPDATE["DB: match_seats → BLOCKED, seat_holds 생성 (5분 TTL)"]
    DB_UPDATE --> UNLOCK[Redis 분산 락 해제]
    UNLOCK --> DONE([배정 좌석 반환 → 결제 이동])
```

### 배정 우선순위

1. **같은 행(row)의 연속 좌석** — 가장 앞 열, 통로에 가까운 좌석 우선
2. **연석이 없는 경우** — 인접 2행에 걸친 준연석으로 fallback
3. **준연석도 없는 경우** — 추천 좌석 없음 반환

배정된 좌석은 **5분간 Hold** 상태가 되며, 그 안에 결제를 완료해야 합니다. 만료 시 Hold가 자동 해제되고 다른 사용자가 선택할 수 있습니다.
