import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="시스템 아키텍처">
            <h1>프론트 시스템 아키텍처</h1>
            <p>
                프론트엔드는 <code>Next.js App Router</code>를 라우팅/렌더링의 중심으로 두고, UI 컴포넌트,
                Zustand 기반 클라이언트 상태, 서비스/API 계층, 인증 복구를 분리해 유지보수성과 운영 안정성을 확보한 구조입니다.
            </p>

            <hr />

            <h2>전체 구조</h2>
            <img src="/front.png" alt="프론트엔드 이미지" className="w-[500px]" />


            <hr />

            <h2>서비스별 역할</h2>
            <table>
                <thead><tr><th>계층</th><th></th><th>핵심 책임</th></tr></thead>
                <tbody>
                    <tr><td><strong>App Router</strong></td><td></td><td>URL과 페이지 진입점 관리</td></tr>
                    <tr><td><strong>Layout / Provider</strong></td><td></td><td>공통 레이아웃, 인증 초기화, 전역 환경 구성</td></tr>
                    <tr><td><strong>Components</strong></td><td></td><td>재사용 가능한 UI와 도메인 화면 조각 구성</td></tr>
                    <tr><td><strong>Stores</strong></td><td></td><td>로그인, 사용자, 온보딩 등 클라이언트 전역 상태 관리</td></tr>
                    <tr><td><strong>Services / API</strong></td><td></td><td>백엔드 API 호출과 인증 요청 처리</td></tr>
                    <tr><td><strong>Config / Security</strong></td><td></td><td>배포, 이미지, 보안 헤더, CDN 설정 관리</td></tr>
                </tbody>
            </table>

            <hr />

            <h1>백엔드 시스템 아키텍처 (이너)</h1>
            <p>
                사용자 요청은 CDN → NLB → Istio를 통과한 뒤 API Gateway에 도달합니다.
                Gateway에서 JWT를 중앙 검증하고 <code>X-User-Id</code> 헤더를 주입하여 하위 서비스로 라우팅합니다.
                하위 서비스는 JWT를 직접 파싱하지 않고 헤더만 신뢰합니다.
            </p>
            <p>
                PlayBall 백엔드는 <strong>5개 마이크로서비스</strong>와 <strong>1개 공통 라이브러리</strong>로 구성되며,
                서비스 간 직접 REST 호출 없이 <strong>Redis / Kafka를 통한 간접 데이터 공유</strong>만 존재합니다.
            </p>

            <hr />

            <h2>전체 구조</h2>
            <pre><code>{`flowchart TD
    U[사용자] --> CDN[Vercel CDN DDOS 방어]
    CDN --> NLB[NLB 접근 제한]
    NLB --> ISTIO[Istio Gateway WAF + mTLS]
    ISTIO --> G[API-Gateway :8085]
    G --> AG[Auth-Guard :8080]
    G --> Q[Queue :8081]
    G --> S[Seat :8082]
    G --> O[Order-Core :8083]

    AG -.-> RC[공용 Redis :6379]
    S -.-> RC
    O -.-> RC
    G -.-> RC
    Q -.-> RQ[Queue 전용 Redis :6380]
    S -.-> RQ

    AG --> DB[(PostgreSQL :5432)]
    S --> DB
    O --> DB

    AG -->|publish| KF[Kafka :9092]
    O -->|publish| KF
    S -->|consume| KF
    O -->|consume| KF`}</code></pre>

            <hr />

            <h2>서비스별 역할</h2>
            <table>
                <thead><tr><th>서비스</th><th>포트</th><th>프레임워크</th><th>핵심 책임</th></tr></thead>
                <tbody>
                    <tr><td><strong>API-Gateway</strong></td><td>8085</td><td>Spring Cloud Gateway (WebFlux)</td><td>JWT 중앙 검증, 라우팅, CORS, Rate Limiting, 봇 차단</td></tr>
                    <tr><td><strong>Auth-Guard</strong></td><td>8080</td><td>Spring Boot MVC</td><td>Kakao OAuth, JWT 발급/갱신(RTR), 로그아웃/블랙리스트, 유저 차단/해제</td></tr>
                    <tr><td><strong>Queue</strong></td><td>8081</td><td>Spring Boot MVC</td><td>Redis ZSET 대기열, Admission Token 발급, Pre-Queue 검증</td></tr>
                    <tr><td><strong>Seat</strong></td><td>8082</td><td>Spring Boot MVC</td><td>좌석 추천/배정, Redisson 분산 락, Hold 관리</td></tr>
                    <tr><td><strong>Order-Core</strong></td><td>8083</td><td>Spring Boot MVC</td><td>주문 생성, 결제, 이메일 발송, 마이페이지</td></tr>
                    <tr><td><strong>common-core</strong></td><td>—</td><td>공유 라이브러리</td><td>도메인 엔티티, Kafka 설정, 암호화, 전역 예외</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>데이터 인프라</h2>

            <h3>PostgreSQL</h3>
            <p>
                단일 PostgreSQL 16 인스턴스에서 테이블 소유권을 서비스별로 명확히 분리합니다.
                각 서비스는 자신의 테이블만 쓰기하고, 다른 서비스 테이블은 읽기만 합니다.
                AES-256-GCM 필드 암호화가 <code>email, nickname, phone</code>에 적용됩니다.
            </p>
            <table>
                <thead><tr><th>서비스</th><th>소유 테이블</th></tr></thead>
                <tbody>
                    <tr><td><strong>Auth-Guard</strong></td><td>users, user_sns, dev_users, withdrawal_requests</td></tr>
                    <tr><td><strong>Seat</strong></td><td>seats, match_seats, seat_holds, blocks, sections, areas, price_policies</td></tr>
                    <tr><td><strong>Order-Core</strong></td><td>orders, order_seats, payments, cash_receipts, cancellation_fee_policies, inquiries</td></tr>
                    <tr><td><strong>공유 (common-core)</strong></td><td>matches, clubs, stadiums, onboarding_preferences, onboarding_preferred_blocks</td></tr>
                </tbody>
            </table>

            <h3>Redis 2대 분리</h3>
            <p>
                Redis는 <strong>Queue 전용(:6380)</strong>과 <strong>공용(:6379)</strong>으로 두 인스턴스를 분리합니다.
                티켓 오픈 시 대기열 트래픽이 폭발하더라도 인증이나 좌석 분산 락에 영향을 주지 않도록 설계했습니다.
            </p>

            <h3>Kafka 이벤트 메시징 (Apache Kafka 3.7.1)</h3>
            <table>
                <thead><tr><th>토픽</th><th>Producer</th><th>Consumer</th><th>용도</th></tr></thead>
                <tbody>
                    <tr><td><code>payment-completed</code></td><td>Order-Core</td><td>Seat</td><td>결제 완료 시 좌석 BLOCKED → SOLD 전환</td></tr>
                    <tr><td><code>order-cancelled</code></td><td>Order-Core</td><td>Seat</td><td>주문 취소 시 좌석 SOLD → AVAILABLE 복원</td></tr>
                    <tr><td><code>bank-transfer-expired</code></td><td>Order-Core</td><td>Seat</td><td>무통장 입금 기한 만료 시 좌석 복원</td></tr>
                    <tr><td><code>user-blocked</code></td><td>Auth-Guard</td><td>Order-Core</td><td>유저 차단 시 활성 주문 UNDER_REVIEW 처리</td></tr>
                </tbody>
            </table>
            <p>
                파티션 3 / Acks all / 3회 재시도 후 실패 시 <code>{`{토픽}.DLT`}</code>(Dead Letter Topic)로 전송됩니다.
            </p>

            <hr />

            <h2>캐싱 전략</h2>

            <h3>Caffeine 로컬 캐시 (JVM 인-메모리)</h3>
            <p>
                W-TinyLFU 교체 알고리즘을 사용하는 고성능 로컬 캐시. 네트워크 홉 없이 sub-microsecond 접근이 가능하며,
                거의 불변 데이터(Match, Section, Block)에 적용되어 DB 커넥션 부하를 크게 낮췄습니다.
            </p>
            <table>
                <thead><tr><th>서비스</th><th>캐시</th><th>최대 크기</th><th>TTL</th><th>대상 데이터</th></tr></thead>
                <tbody>
                    <tr><td>Seat</td><td><code>match-exists</code></td><td>1,000</td><td>10분</td><td>Match 존재 검증</td></tr>
                    <tr><td>Seat</td><td><code>match-detail</code></td><td>1,000</td><td>10분</td><td>Match 메타데이터 (JOIN FETCH)</td></tr>
                    <tr><td>Seat</td><td><code>section-all</code></td><td>16</td><td>1시간</td><td>스타디움 섹션 구조 (영구 불변)</td></tr>
                    <tr><td>Seat</td><td><code>blocks-by-section-ids</code></td><td>512</td><td>1시간</td><td>스타디움 블럭 매핑</td></tr>
                    <tr><td>Queue</td><td><code>match-for-queue</code></td><td>1,000</td><td>1분</td><td>Match saleStatus 검증</td></tr>
                    <tr><td>Order-Core</td><td><code>match-detail</code></td><td>1,000</td><td>10분</td><td>주문서용 Match 메타데이터</td></tr>
                </tbody>
            </table>

            <h3>Redis 분산 캐시</h3>
            <p>
                인스턴스 간 공유가 필요한 변동 데이터(User, 응답 캐시)는 Redis 분산 캐시를 사용합니다.
            </p>
            <table>
                <thead><tr><th>서비스</th><th>캐시</th><th>TTL</th><th>목적</th></tr></thead>
                <tbody>
                    <tr><td>Auth-Guard</td><td><code>user-by-id</code></td><td>10분</td><td>User DTO 스냅샷 (Pod 간 즉시 전파)</td></tr>
                    <tr><td>Auth-Guard</td><td><code>auth-me</code></td><td>30초</td><td>/me 엔드포인트 응답</td></tr>
                    <tr><td>Seat</td><td><code>seat-groups-response</code></td><td>5초</td><td>좌석맵 API 응답 (유저 독립적)</td></tr>
                    <tr><td>Order-Core</td><td><code>matches-list-response</code></td><td>30초</td><td>경기 목록 API 응답</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>스케줄러 (백그라운드 작업)</h2>
            <table>
                <thead><tr><th>서비스</th><th>스케줄러</th><th>주기</th><th>역할</th></tr></thead>
                <tbody>
                    <tr><td>Queue</td><td>QueuePromotionScheduler</td><td>1초</td><td>대기열 → Ready 승격 (배치 100명)</td></tr>
                    <tr><td>Seat</td><td>MatchSeatScheduler</td><td>매일 00:00 KST</td><td>경기 7일 전 좌석 데이터 자동 생성</td></tr>
                    <tr><td>Seat</td><td>SeatHoldCleanupScheduler</td><td>60초</td><td>만료된 Hold 정리 + 좌석 AVAILABLE 복원</td></tr>
                    <tr><td>Order-Core</td><td>MatchStatusScheduler</td><td>10:59 / 00:00 KST</td><td>경기 판매 개시(ON_SALE) / 종료(CLOSED)</td></tr>
                    <tr><td>Order-Core</td><td>BankTransferExpirationScheduler</td><td>5분</td><td>입금 기한 초과 무통장 주문 자동 취소</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
