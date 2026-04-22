import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="503 트러블슈팅 스토리">
            <h1>503 트러블슈팅 핵심 스토리</h1>
            <blockquote>
                <strong>"DB가 한가한데 왜 503?"</strong> — 커넥션 풀 병목의 진짜 원인을 찾아간 발표용 스토리라인
            </blockquote>

            <hr />

            <h2>핵심 한 줄 메시지</h2>
            <blockquote>
                <strong>
                    "DB 인스턴스 업그레이드(돈)로 해결할 수도 있었지만, 원인을 파고드니 사양 문제가 아니라
                    앱이 쿼리를 너무 많이 보내는 문제였다. 그래서 앱단 최적화로 해결했다."
                </strong>
            </blockquote>

            <hr />

            <h2>기 — 증상부터 시작</h2>

            <h3>부하테스트에서 발견된 문제</h3>
            <ul>
                <li><strong>3,000 VU 스트레스 테스트</strong> — <code>upstream connect error / connection timeout</code> <strong>503 에러</strong> 지속 발생</li>
                <li>k6 결과: <strong>P99 6~7초</strong>, 503 발생률 <strong>1~2%</strong></li>
                <li>Queue P95 6,544ms / 503 40건</li>
                <li>Seat P95 6,177ms / 503 18건</li>
            </ul>
            <img src="/load-test/01-as-is-queue-3000.png" alt="AS-IS 3000 VU 큐 테스트 503 발생" className="w-full my-4 rounded border" />

            <h3>4,000 VU에서는 시스템 자체가 죽음</h3>
            <p>503 대량 + k6 툴 자체가 종료</p>
            <img src="/load-test/02-as-is-queue-4000-timeout.png" alt="4000 VU 타임아웃" className="w-full my-4 rounded border" />
            <img src="/load-test/02-as-is-queue-4000-503-storm.png" alt="4000 VU 503 스톰" className="w-full my-4 rounded border" />

            <h3>일반적인 반응</h3>
            <blockquote>"DB가 부족한가? 인스턴스 업그레이드해야 하나?"</blockquote>

            <hr />

            <h2>승 — 그런데 DB는 놀고 있었다</h2>
            <p>이 부분이 <strong>발표의 반전 포인트</strong>입니다.</p>

            <h3>RDS 모니터링 결과</h3>
            <ul>
                <li><strong>CPU 10%</strong></li>
                <li><strong>Memory 25%</strong></li>
                <li>Connections: 한계 270 도달</li>
            </ul>
            <p>→ <strong>DB 자체는 여유</strong>. 문제는 <strong>DB 처리 능력이 아니다</strong>.</p>
            <blockquote>"그럼 뭐가 문제지?" → 병목 추적 시작</blockquote>

            <hr />

            <h2>전 — 진짜 범인은 커넥션 풀</h2>

            <h3>관찰된 지표</h3>
            <ul>
                <li><strong>Tomcat 스레드 peak 735</strong></li>
                <li><strong>HikariCP pending 48</strong> (커넥션 대기열 누적)</li>
            </ul>

            <p>
                <strong>모순처럼 보이는 상황</strong>: DB는 한가한데 앱은 커넥션 획득만 기다리고 있었습니다.
                하지만 이건 자연스러운 현상입니다.
            </p>

            <h3>왜 이런 일이 일어나는가</h3>
            <pre><code>{`1. DB max_connections: 250 (db.t4g.medium, RDS 공식 LEAST(DBInstanceClassMemory/9531392, 5000) 기준)
2. 동시 요청: 3,000 VU → Tomcat 스레드 수백 개가 커넥션 요청
3. 각 요청이 짧은 쿼리를 여러 번 날림
   ├─ Match 조회 (booking-options 저장 시 1번)
   ├─ Section 조회 (좌석맵 진입 시 1번)
   ├─ Block 조회 (좌석맵 진입 시 1번)
   ├─ User 조회 (모든 인증 경로)
   └─ Onboarding 조회 (추천 계산 시 1번)
4. 쿼리 자체는 빠르지만(5~30ms), 커넥션을 잠깐씩 잡았다 놓는 횟수가 너무 많음
5. 풀 포화 → 스레드 대기 → 타임아웃 → Envoy가 503 반환`}</code></pre>

            <h3>인과관계 도식</h3>
            <pre><code>{`쿼리 많음 → 커넥션 짧게 자주 잡음 → 풀 포화 → Tomcat 스레드 대기 → accept-queue 포화 → 503
                ↑
         여기를 끊는다 (Caffeine 캐시)`}</code></pre>

            <hr />

            <h2>결 — 해결: 쿼리 횟수를 줄여라</h2>

            <h3>선택지 비교</h3>
            <table>
                <thead>
                    <tr><th>선택지</th><th>비용</th><th>해결 여부</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>DB 인스턴스 업그레이드 (~$100/월)</td>
                        <td>지속 비용</td>
                        <td>일시적 — 쿼리가 많다는 근본 원인은 그대로</td>
                    </tr>
                    <tr>
                        <td><strong>앱단 캐싱 + 커넥션 풀 재배분</strong></td>
                        <td><strong>0원</strong></td>
                        <td><strong>근본 원인 해결</strong></td>
                    </tr>
                </tbody>
            </table>

            <h3>판단 근거</h3>
            <blockquote><strong>"CPU/메모리가 한가한데 돈 쓰는 건 낭비"</strong> 라는 엔지니어링 판단.</blockquote>
            <ul>
                <li>사양을 올리면 <code>max_connections</code>만 늘 뿐, 쿼리 수는 그대로.</li>
                <li>더 큰 DB에서도 <strong>같은 현상이 더 큰 규모로 반복</strong>될 뿐.</li>
                <li>먼저 쿼리 수를 줄이고, 그래도 부족하면 그때 인프라.</li>
            </ul>

            <hr />

            <h2>Phase별 개선 스토리</h2>

            <h3>Phase 0: 문제 식별</h3>
            <ul>
                <li>3,000 VU 부하테스트에서 503 발견</li>
                <li>Seat P99 6,887ms, Queue 503 40건, Seat 503 18건</li>
                <li>"DB 사양 문제일까?" → <strong>아니었다</strong></li>
            </ul>

            <h3>Phase 1 (1차): Seat <code>BookingOptions</code> API 선행 캐싱 (PoC)</h3>
            <ul>
                <li>가장 호출량이 많은 <code>matchRepository.findByIdOrThrow</code> 먼저 Caffeine 캐싱</li>
                <li><strong>P99 8초대 → 2초대 (약 75% 감소)</strong></li>
                <li>이 결과로 "캐싱 전략이 먹힌다" 검증 → <strong>확대 적용의 근거</strong></li>
            </ul>
            <img src="/load-test/07-phase1-caffeine-poc-01.png" alt="Phase 1 PoC 결과" className="w-full my-4 rounded border" />

            <h3>Phase 1 확대: 전면 적용</h3>
            <p><strong>적용 범위</strong></p>
            <ul>
                <li><strong>Seat</strong>: Match 상세 + Section 전체 + 섹션별 Block (3종)</li>
                <li><strong>Queue</strong>: 대기열 진입 시 Match 조회 (TTL 1m, saleStatus 반영 주기)</li>
                <li><strong>Order-Core</strong>: 주문서 조회 시 Match (주문 생성 제외 — 영속성 컨텍스트 보존)</li>
            </ul>
            <p><strong>병행 조치</strong></p>
            <ul>
                <li>커넥션 풀 재배분 (seat/queue/auth 합계 DB 한도 내)</li>
                <li>Tomcat 스레드 200 → 400 (CPU 여유 활용)</li>
            </ul>

            <h3>Phase 2: Redis 분산 캐시</h3>
            <ul>
                <li><code>/auth/me</code>, <code>UserRepository</code>, 온보딩 데이터는 사용자별 데이터</li>
                <li>로컬 캐시 부적합 → Redis 분산 캐시로 별도 작업</li>
            </ul>

            <h3>Phase 3~4: 인프라 튜닝 + 코드 핫픽스</h3>
            <ul>
                <li>응답 레벨 Redis 캐시 (seat-groups 5s, matches-list 30s)</li>
                <li>Queue OSIV OFF + Resilience4j + Lua 스크립트 통합</li>
                <li><strong>최종 Queue Flow P99 65ms</strong></li>
            </ul>

            <hr />

            <h2>발표용 숫자 대시보드</h2>
            <table>
                <thead>
                    <tr><th>항목</th><th>값</th><th>맥락</th></tr>
                </thead>
                <tbody>
                    <tr><td>DB CPU</td><td><strong>10%</strong></td><td>사양 문제 아님 입증</td></tr>
                    <tr><td>DB Memory</td><td><strong>25%</strong></td><td>사양 문제 아님 입증</td></tr>
                    <tr><td>DB max_connections</td><td><strong>250</strong></td><td>실제 한계선 (db.t4g.medium)</td></tr>
                    <tr><td>Tomcat 스레드 peak</td><td><strong>735</strong></td><td>자원 고갈의 외형적 증거</td></tr>
                    <tr><td>Seat P99 (AS-IS)</td><td><strong>6,887ms</strong></td><td>개선 전</td></tr>
                    <tr><td>Seat P99 (1차 PoC)</td><td><strong>2,000ms</strong></td><td>하나만 캐싱해도 75% 감소</td></tr>
                    <tr><td>Seat P99 (TO-BE)</td><td><strong>65ms</strong></td><td>최종 98% 감소</td></tr>
                    <tr><td>503 발생률 (AS-IS)</td><td>1.7% (Queue)</td><td>개선 전</td></tr>
                    <tr><td>503 발생률 (TO-BE)</td><td><strong>0%</strong></td><td>완전 제거</td></tr>
                    <tr><td>업그레이드 비용 (안 쓴 돈)</td><td>~$100/월</td><td>"최적화로 아낀 돈"</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>반박 대응 Q&A</h2>

            <h3>Q1. "그래도 DB 올리면 안전하지 않나?"</h3>
            <p>
                <strong>A.</strong> 맞지만 <strong>근본 해결이 아님</strong>. 쿼리 수가 그대로면 더 큰 DB에서도 같은 현상이 더 큰 규모로 반복.
                게다가 CPU/메모리 사용률이 10%/25%인데 올리면 자원 낭비. <strong>"병목을 옮기는 것과 제거하는 것의 차이"</strong>.
            </p>

            <h3>Q2. "캐시 일관성은 괜찮은가?"</h3>
            <p><strong>A.</strong> 캐싱 대상을 고른 기준:</p>
            <ul>
                <li>Match, Stadium, Section, Block → 배포 단위로만 변경되는 <strong>준불변 데이터</strong></li>
                <li>TTL 기반 eventual consistency 허용 가능 (Match 10분, Section 1시간, Queue용 Match 1분)</li>
                <li><strong>사용자별 변동 데이터(User, Onboarding)는 Phase 1에서 제외</strong> → Redis 분산 캐시(Phase 2)로 별도 처리</li>
            </ul>

            <h3>Q3. "왜 Caffeine? Redis 아니고?"</h3>
            <p><strong>A.</strong> 정합성 요구가 낮고 read-heavy/write-rare 한 데이터에는 로컬 캐시가 최적:</p>
            <ul>
                <li>네트워크 홉 제거 → <strong>sub-ms 응답</strong></li>
                <li>Redis도 0.5~2ms 드는데 그만큼도 아낌</li>
                <li>인프라 의존성 추가 없음</li>
                <li>실시간 정합성 필요한 데이터만 Redis로 분리 (Phase 2~3)</li>
            </ul>

            <h3>Q4. "5000 VU는 가능?"</h3>
            <p><strong>A. 현 인프라로는 불가능</strong> — 정직하게 한계 인정.</p>
            <ul>
                <li><code>db.t4g.medium</code> max_connections 250 절대 한계</li>
                <li>5000 VU는 <code>db.m6g.large</code> (max ~900) 이상 필요</li>
                <li><strong>"현 인프라로 1000 VU P95 &lt; 1s 목표 달성"이 본 개선의 현실적 스코프</strong></li>
                <li>폴더 20 결과(좌석 Hold 성공률 83.6%)에서 확인: 1000 VU가 우리 인프라의 정직한 상한</li>
            </ul>

            <hr />

            <h2>시각화 자료</h2>

            <h3>슬라이드 1: Before/After 흐름</h3>
            <pre><code>{`Before: [사용자] → [Envoy] → [Pod: 스레드 대기] → [HikariCP 대기] → [DB 한가]  ❌ 503
After:  [사용자] → [Envoy] → [Pod: 캐시 hit] → 즉시 응답                          ✅`}</code></pre>

            <h3>슬라이드 2: 인과관계 도식</h3>
            <pre><code>{`쿼리 많음 → 커넥션 짧게 자주 잡음 → 풀 포화 → Tomcat 스레드 대기 → accept-queue 포화 → 503
                ↑
         여기를 끊는다 (Caffeine 캐시)`}</code></pre>

            <h3>슬라이드 3: 숫자 대시보드</h3>
            <ul>
                <li><strong>P99: 6,887ms → 65ms (-99%)</strong></li>
                <li><strong>503: 1.7% → 0%</strong></li>
                <li><strong>DB CPU: 10% (사양 문제 아님)</strong></li>
                <li><strong>절감 비용: ~$100/월</strong></li>
            </ul>

            <hr />

            <h2>스토리 톤</h2>
            <ul>
                <li><strong>"돈 쓰면 되는 문제였는데 엔지니어링으로 해결했다"</strong> 서사</li>
                <li><strong>"현상만 보고 사양을 올리는 게 아니라, 원인을 파고든다"</strong> 관점</li>
                <li><strong>겸손한 결론</strong>: "5000 VU는 여전히 DB 업그레이드가 필요하다" — 과도한 자신감 대신 <strong>한계 인정</strong>으로 신뢰 확보</li>
                <li><strong>팀 커뮤니케이션</strong> 언급 (클라우드 그룹장 진단 + 백엔드 조치) — 협업 스토리</li>
            </ul>
        </DocPageLayout>
    );
}
