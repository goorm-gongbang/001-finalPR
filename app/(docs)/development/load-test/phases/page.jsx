import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="Phase별 최적화 타임라인">
            <h1>Phase별 최적화 타임라인</h1>
            <blockquote>
                AS-IS → Phase 1 → Phase 2 → Phase 3 → Phase 4 → TO-BE 단계별 작업 내용·코드 변경·측정 결과
            </blockquote>

            <hr />

            <h2>전체 타임라인 요약</h2>
            <table>
                <thead>
                    <tr>
                        <th>Phase</th>
                        <th>시점</th>
                        <th>주요 작업</th>
                        <th>Seat P99</th>
                        <th>DB 커넥션 peak</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td><strong>Phase 0 (AS-IS)</strong></td><td>2026-04-14</td><td>최적화 없음</td><td><strong>6,887ms</strong></td><td>270 (한계)</td></tr>
                    <tr><td><strong>Phase 1 (1차)</strong></td><td>2026-04-15 오전</td><td>Seat <code>match-exists</code> Caffeine</td><td>2,100ms</td><td>250</td></tr>
                    <tr><td><strong>Phase 1 확대</strong></td><td>2026-04-15 오후</td><td>Multi-Service Caffeine 6종</td><td>1,200ms</td><td>180</td></tr>
                    <tr><td><strong>Phase 2</strong></td><td>2026-04-15 저녁</td><td>Redis 분산 캐시 (User 데이터)</td><td>900ms</td><td>150</td></tr>
                    <tr><td><strong>Phase 3</strong></td><td>2026-04-16 새벽</td><td>응답 Redis 캐시 + 인프라 튜닝</td><td>600ms</td><td>120</td></tr>
                    <tr><td><strong>Phase 4</strong></td><td>2026-04-16 오전</td><td>OSIV OFF + Lua + Resilience4j</td><td><strong>400ms</strong></td><td>100</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>Phase 0 — AS-IS (최적화 전)</h2>

            <h3>상태</h3>
            <ul>
                <li>Tomcat 스레드 200 / HikariCP Pool 20 설정 불균형</li>
                <li>Match / Section / Block 모든 조회가 DB로 직접 갔음</li>
                <li>Spring JPA OSIV ON (기본값)</li>
                <li>대기열 재진입 시 Redis 다중 명령 (3 RTT)</li>
                <li>PreQueue 마커 동기화에 <code>Thread.sleep</code> 사용</li>
            </ul>

            <h3>측정 결과</h3>
            <p><strong>3000 VU 큐 Flow (폴더 01)</strong> — Queue P95 6,544ms, 503 40건 (1.7%) / Seat P95 6,177ms, 503 18건 (0.3%)</p>
            <img src="/load-test/01-as-is-queue-3000.png" alt="AS-IS 3000 VU 큐 테스트 결과" className="w-full my-4 rounded border" />

            <p><strong>4000 VU 큐 Flow (폴더 02)</strong> — 시스템 과부하, 로컬 k6 및 크롬이 터짐</p>
            <img src="/load-test/02-as-is-queue-4000-before-crash.png" alt="4000 VU 크래시 직전" className="w-full my-4 rounded border" />
            <img src="/load-test/02-as-is-queue-4000-timeout.png" alt="4000 VU 타임아웃 대량 발생" className="w-full my-4 rounded border" />
            <img src="/load-test/02-as-is-queue-4000-503-storm.png" alt="4000 VU 503 스톰" className="w-full my-4 rounded border" />

            <p><strong>1000 VU 추천 ON Flow (폴더 03)</strong> — 실행 시간 2분 38초, 실행 자체는 PASS</p>
            <img src="/load-test/03-as-is-rec-on-1000-01.png" alt="AS-IS 추천 ON 1000 VU 결과 1" className="w-full my-4 rounded border" />
            <img src="/load-test/03-as-is-rec-on-1000-02.png" alt="AS-IS 추천 ON 1000 VU 결과 2" className="w-full my-4 rounded border" />

            <h3>진단</h3>
            <ul>
                <li>RDS CPU 10%, Memory 25% → <strong>사양 문제가 아님</strong></li>
                <li>HikariCP <code>pending</code> 48, Tomcat 스레드 peak 735 → <strong>커넥션 대기 블로킹</strong></li>
                <li>결론: <strong>DB를 때리는 쿼리 수 자체를 줄여야 함</strong></li>
            </ul>

            <hr />

            <h2>중간 조치 A — DB 커넥션 풀 30으로 상향 (인프라 튜닝만)</h2>

            <h3>상태</h3>
            <ul>
                <li>HikariCP <code>maximum-pool-size</code> 20 → 30으로만 증가</li>
                <li>코드 최적화 없음 (비교 대조군)</li>
            </ul>

            <h3>측정 결과 — 1000 VU 큐 Flow (폴더 04)</h3>
            <img src="/load-test/04-infra-pool30-queue-1000-01.png" alt="인프라 풀 30 1000 VU 결과 1" className="w-full my-4 rounded border" />
            <img src="/load-test/04-infra-pool30-queue-1000-02.png" alt="인프라 풀 30 1000 VU 결과 2" className="w-full my-4 rounded border" />

            <h3>측정 결과 — 2000 VU 큐 Flow (폴더 05)</h3>
            <img src="/load-test/05-infra-pool30-queue-2000.png" alt="인프라 풀 30 2000 VU 결과" className="w-full my-4 rounded border" />

            <h3>중간 최적화 실험 (폴더 06)</h3>
            <img src="/load-test/06-mid-opt-01.png" alt="중간 최적화 1" className="w-full my-4 rounded border" />
            <img src="/load-test/06-mid-opt-02.png" alt="중간 최적화 2" className="w-full my-4 rounded border" />

            <h3>관찰</h3>
            <ul>
                <li>커넥션 풀만 늘려도 <strong>여전히 P99 고점 존재</strong> → 쿼리 수를 줄이지 않으면 큰 개선 없음을 확인</li>
                <li><strong>"DB 인스턴스 업그레이드는 근본 해결이 아님"</strong> 판단의 근거가 됨</li>
            </ul>

            <hr />

            <h2>Phase 1 (1차) — Seat <code>match-exists</code> Caffeine PoC</h2>

            <h3>작업 내용</h3>
            <p>변경 파일: <code>Seat/src/main/java/com/goormgb/be/seat/config/CacheConfig.java</code>, <code>BookingOptionsService.java</code></p>
            <pre><code>{`@Cacheable(cacheNames = "match-exists", key = "#matchId", unless = "!#result")
public boolean exists(Long matchId) {
    return matchRepository.existsById(matchId);
}`}</code></pre>

            <pre><code>{`spring.cache:
  type: caffeine
  cache-names: match-exists
  caffeine:
    spec: maximumSize=1000,expireAfterWrite=10m,recordStats`}</code></pre>

            <h3>측정 결과 (폴더 07 — 1000 VU, Queue Flow)</h3>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>VU</td><td>1,001</td></tr>
                    <tr><td>RPS</td><td><strong>483.6</strong></td></tr>
                    <tr><td>총 요청</td><td>30,212건</td></tr>
                    <tr><td>Avg</td><td>1,604.6ms</td></tr>
                    <tr><td>P50</td><td>1,613.7ms</td></tr>
                    <tr><td>P95</td><td>2,147.4ms</td></tr>
                    <tr><td>P99</td><td><strong>2,434.1ms</strong></td></tr>
                    <tr><td>503</td><td>1건 (0.003%)</td></tr>
                </tbody>
            </table>
            <img src="/load-test/07-phase1-caffeine-poc-01.png" alt="Phase 1 PoC 캐싱 결과 1" className="w-full my-4 rounded border" />
            <img src="/load-test/07-phase1-caffeine-poc-02.png" alt="Phase 1 PoC 캐싱 결과 2" className="w-full my-4 rounded border" />
            <img src="/load-test/07-phase1-caffeine-poc-03.png" alt="Phase 1 PoC 캐싱 결과 3" className="w-full my-4 rounded border" />

            <h3>폴더 08 — 2000 VU 스케일 테스트</h3>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>VU</td><td>2,000</td></tr>
                    <tr><td>RPS</td><td>397.0</td></tr>
                    <tr><td>P50</td><td>1.65s</td></tr>
                    <tr><td>P95</td><td>3.05s</td></tr>
                    <tr><td>P99</td><td>3.34s</td></tr>
                    <tr><td>에러</td><td>0건</td></tr>
                </tbody>
            </table>
            <img src="/load-test/08-phase1-caffeine-2000vu-01.png" alt="Phase 1 2000 VU 결과 1" className="w-full my-4 rounded border" />
            <img src="/load-test/08-phase1-caffeine-2000vu-02.png" alt="Phase 1 2000 VU 결과 2" className="w-full my-4 rounded border" />

            <h3>PoC 검증</h3>
            <ul>
                <li><code>matchRepository.existsById()</code> 하나만 캐싱해도 <strong>P99 8초대 → 2초대로 대폭 개선</strong></li>
                <li>"Match 조회 한 번 제거" 효과가 이 정도라면, 나머지 JOIN FETCH 쿼리도 캐싱하면 더 좋아질 것 → <strong>Phase 1 확대 결정</strong></li>
            </ul>

            <hr />

            <h2>중간 조치 B — DB 부하 유발 Top 7 쿼리 전수조사</h2>

            <table>
                <thead>
                    <tr><th>순위</th><th>위치</th><th>쿼리</th><th>제안</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td><code>Seat/SeatCommonService:52,90</code></td><td><code>MatchRepository.findDetailByIdOrThrow</code></td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>2</td><td><code>Seat/SeatCommonService:56</code></td><td><code>SectionRepository.findAllWithArea...</code></td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>3</td><td><code>Seat/SeatCommonService</code></td><td><code>BlockRepository.findBySectionIdIn...</code></td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>4</td><td><code>Order-Core/OrderService:74,105</code></td><td><code>MatchRepository.findDetailByIdOrThrow</code></td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>5</td><td><code>Queue/QueueService:56</code></td><td><code>MatchRepository.findByIdOrThrow</code></td><td><strong>Caffeine</strong></td></tr>
                    <tr><td>6</td><td><code>Auth-Guard, Order-Core</code></td><td><code>UserRepository.findByIdOrThrow</code></td><td><strong>Redis</strong> (Phase 2)</td></tr>
                    <tr><td>7</td><td><code>Seat/recommendation</code></td><td><code>OnboardingPreference/Block</code></td><td><strong>Redis</strong> (Phase 2)</td></tr>
                </tbody>
            </table>

            <img src="/load-test/09-top7-query-analysis-01.png" alt="Top 7 쿼리 분석 1" className="w-full my-4 rounded border" />
            <img src="/load-test/09-top7-query-analysis-02.png" alt="Top 7 쿼리 분석 2" className="w-full my-4 rounded border" />
            <img src="/load-test/09-top7-query-analysis-03.png" alt="Top 7 쿼리 분석 3" className="w-full my-4 rounded border" />
            <img src="/load-test/09-top7-query-analysis-04.png" alt="Top 7 쿼리 분석 4" className="w-full my-4 rounded border" />

            <hr />

            <h2>Phase 1 확대 — Multi-Service Caffeine 전면 확대</h2>

            <h3>작업 범위</h3>
            <table>
                <thead>
                    <tr><th>서비스</th><th>캐시 이름</th><th>최대 크기</th><th>TTL</th><th>대상 데이터</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>Seat</strong></td><td><code>match-exists</code></td><td>1,000</td><td>10분</td><td>Match 존재 검증</td></tr>
                    <tr><td><strong>Seat</strong></td><td><code>match-detail</code></td><td>1,000</td><td>10분</td><td>Match 메타 (JOIN FETCH)</td></tr>
                    <tr><td><strong>Seat</strong></td><td><code>section-all</code></td><td>16</td><td>1시간</td><td>스타디움 섹션 구조 (영구 불변)</td></tr>
                    <tr><td><strong>Seat</strong></td><td><code>blocks-by-section-ids</code></td><td>512</td><td>1시간</td><td>섹션별 블럭 매핑</td></tr>
                    <tr><td><strong>Queue</strong></td><td><code>match-for-queue</code></td><td>1,000</td><td>1분</td><td>saleStatus 검증 (짧은 TTL)</td></tr>
                    <tr><td><strong>Order-Core</strong></td><td><code>match-detail</code></td><td>1,000</td><td>10분</td><td>주문서용 Match</td></tr>
                </tbody>
            </table>
            <p>릴리즈 태그: <code>v1.11.0-staging</code> (커밋 <code>1746faa</code>, <code>92ffa7f</code>, <code>1583897</code>)</p>

            <h3>폴더 10 — Phase 1,2 적용 1000 VU</h3>
            <img src="/load-test/10-phase12-queue-1000-01.png" alt="Phase 1,2 1000 VU 결과 1" className="w-full my-4 rounded border" />
            <img src="/load-test/10-phase12-queue-1000-02.png" alt="Phase 1,2 1000 VU 결과 2" className="w-full my-4 rounded border" />
            <img src="/load-test/10-phase12-result-01.png" alt="Phase 1,2 결과 요약 1" className="w-full my-4 rounded border" />
            <img src="/load-test/10-phase12-result-02.png" alt="Phase 1,2 결과 요약 2" className="w-full my-4 rounded border" />

            <h3>폴더 11 — 2000 VU 30초 듀레이션</h3>
            <img src="/load-test/11-phase12-queue-2000-30s-01.png" alt="Phase 1,2 2000 VU 30s 1" className="w-full my-4 rounded border" />
            <img src="/load-test/11-phase12-queue-2000-30s-02.png" alt="Phase 1,2 2000 VU 30s 2" className="w-full my-4 rounded border" />
            <img src="/load-test/11-phase12-queue-2000-30s-03.png" alt="Phase 1,2 2000 VU 30s 3" className="w-full my-4 rounded border" />
            <img src="/load-test/11-phase12-queue-2000-30s-04.png" alt="Phase 1,2 2000 VU 30s 4" className="w-full my-4 rounded border" />
            <img src="/load-test/11-phase12-queue-2000-30s-05.png" alt="Phase 1,2 2000 VU 30s 5" className="w-full my-4 rounded border" />

            <h3>폴더 12 — 2000 VU 1분 듀레이션 (안정성 검증)</h3>
            <img src="/load-test/12-phase12-queue-2000-60s-01.png" alt="Phase 1,2 2000 VU 60s 1" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-02.png" alt="Phase 1,2 2000 VU 60s 2" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-03.png" alt="Phase 1,2 2000 VU 60s 3" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-04.png" alt="Phase 1,2 2000 VU 60s 4" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-05.png" alt="Phase 1,2 2000 VU 60s 5" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-06.png" alt="Phase 1,2 2000 VU 60s 6" className="w-full my-4 rounded border" />

            <h3>효과</h3>
            <ul>
                <li>DB 쿼리 감소: <strong>50~60%</strong></li>
                <li>커넥션 peak: 250 → <strong>150</strong></li>
                <li>P95: ~3s → ~1s</li>
            </ul>

            <hr />

            <h2>중간 조치 C — HttpClient Pool 상향</h2>

            <h3>작업</h3>
            <ul>
                <li>Gateway/Seat의 HTTP 클라이언트 커넥션 풀 상향</li>
                <li>Redis/DB 외부 호출 대기 감소</li>
            </ul>

            <h3>폴더 13 — HTTP Pool 상향 직후</h3>
            <img src="/load-test/13-httpclient-pool-01.png" alt="HTTP Pool 상향 1" className="w-full my-4 rounded border" />
            <img src="/load-test/13-httpclient-pool-02.png" alt="HTTP Pool 상향 2" className="w-full my-4 rounded border" />

            <h3>폴더 14 — 1000 VU (Pool 상향 + Caffeine 병합 효과)</h3>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>VU</td><td>1,001</td></tr>
                    <tr><td>RPS</td><td><strong>325.7</strong></td></tr>
                    <tr><td>Avg</td><td><strong>31ms</strong> (극적 단축)</td></tr>
                    <tr><td>P50</td><td>29ms</td></tr>
                    <tr><td>P95</td><td>39ms</td></tr>
                    <tr><td>P99</td><td><strong>60ms</strong></td></tr>
                    <tr><td>에러</td><td>0건</td></tr>
                </tbody>
            </table>
            <p>응답시간 평균 2,000ms → <strong>32ms로 60배 단축</strong>.</p>
            <img src="/load-test/14-httppool-phase12-queue-1000-01.png" alt="HTTP Pool + Phase 1,2 1000 VU 1" className="w-full my-4 rounded border" />
            <img src="/load-test/14-httppool-phase12-queue-1000-02.png" alt="HTTP Pool + Phase 1,2 1000 VU 2" className="w-full my-4 rounded border" />
            <img src="/load-test/14-httppool-phase12-queue-1000-03.png" alt="HTTP Pool + Phase 1,2 1000 VU 3" className="w-full my-4 rounded border" />

            <h3>폴더 15 — 추천 ON 1000명 재측정 (폴더 03과 동일 조건)</h3>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>VU</td><td>1,001</td></tr>
                    <tr><td>RPS</td><td>294.0</td></tr>
                    <tr><td>총 요청</td><td>54,877건 (폴링 포함)</td></tr>
                    <tr><td>P95</td><td>157ms</td></tr>
                    <tr><td>P99</td><td>826ms</td></tr>
                </tbody>
            </table>
            <img src="/load-test/15-httppool-phase12-rec-on-1000-01.png" alt="HTTP Pool + 추천 ON 1" className="w-full my-4 rounded border" />
            <img src="/load-test/15-httppool-phase12-rec-on-1000-02.png" alt="HTTP Pool + 추천 ON 2" className="w-full my-4 rounded border" />
            <img src="/load-test/15-httppool-phase12-rec-on-1000-03.png" alt="HTTP Pool + 추천 ON 3" className="w-full my-4 rounded border" />

            <hr />

            <h2>Phase 2 — Redis 분산 캐시 (User 데이터)</h2>

            <h3>작업 범위</h3>
            <table>
                <thead>
                    <tr><th>서비스</th><th>캐시 이름</th><th>TTL</th><th>Evict 전략</th></tr>
                </thead>
                <tbody>
                    <tr><td>Auth-Guard</td><td><code>user-by-id</code></td><td>10분</td><td>프로필/상태 변경 시 @CacheEvict</td></tr>
                    <tr><td>Auth-Guard</td><td><code>auth-me</code></td><td>30초</td><td>프로필 변경 시 evict</td></tr>
                    <tr><td>Order-Core</td><td><code>user-by-id</code></td><td>10분</td><td>Auth-Guard 캐시 공유</td></tr>
                </tbody>
            </table>

            <h3>효과</h3>
            <ul>
                <li><code>/auth/me</code> P99: 400~600ms → <strong>50ms</strong></li>
                <li>DB 커넥션 +20% 추가 절감</li>
            </ul>

            <hr />

            <h2>Phase 3 / 4 — 응답 캐시 · 인프라 튜닝 · 핫픽스</h2>

            <h3>Phase 3 작업</h3>
            <table>
                <thead><tr><th>서비스</th><th>캐시</th><th>TTL</th><th>대상 API</th></tr></thead>
                <tbody>
                    <tr><td>Seat</td><td><code>seat-groups-response</code></td><td>5초</td><td><code>GET /matches/{`{id}`}/seat-groups</code></td></tr>
                    <tr><td>Order-Core</td><td><code>matches-list-response</code></td><td>30초</td><td><code>GET /matches?date=...</code></td></tr>
                </tbody>
            </table>

            <h3>인프라 튜닝</h3>
            <table>
                <thead><tr><th>파라미터</th><th>변경 전</th><th>변경 후</th></tr></thead>
                <tbody>
                    <tr><td>Tomcat <code>max-threads</code></td><td>200</td><td><strong>400</strong></td></tr>
                    <tr><td>HikariCP <code>maximum-pool-size</code></td><td>20</td><td><strong>30</strong></td></tr>
                    <tr><td>HikariCP <code>minimum-idle</code></td><td>20</td><td><strong>5</strong></td></tr>
                    <tr><td>총 DB 커넥션</td><td>~80</td><td>≤250</td></tr>
                </tbody>
            </table>

            <h3>Phase 4 — 커넥션 회전율 · 스레드 점유 핫픽스 3종</h3>
            <ol>
                <li><strong>Queue OSIV OFF</strong> — 커넥션 회전율 2배 향상</li>
                <li><strong>BookingOptions Resilience4j @Retry</strong> — <code>Thread.sleep</code> 블로킹 재시도 → 비동기 재시도 (평균 대기 300ms → 60ms)</li>
                <li><strong>Queue Redis Lua 스크립트 통합</strong> — ZREM + DEL + ZADD + ZRANK + ZCARD → Lua 1회 호출 (3 RTT → 1 RTT)</li>
            </ol>

            <h3>폴더 17 — Phase 3,4 적용 전/후 엔드투엔드 비교</h3>
            <table>
                <thead><tr><th>서비스</th><th>적용 전 Avg</th><th>적용 후 Avg</th><th>개선률</th></tr></thead>
                <tbody>
                    <tr><td><strong>Queue</strong></td><td>325ms</td><td>96ms</td><td><strong>-70.4%</strong></td></tr>
                    <tr><td><strong>Seat</strong></td><td>741ms</td><td>236ms</td><td><strong>-68.2%</strong></td></tr>
                    <tr><td><strong>Order-Core</strong></td><td>304ms</td><td>68ms</td><td><strong>-77.6%</strong></td></tr>
                    <tr><td><strong>전체 평균</strong></td><td><strong>503ms</strong></td><td><strong>149ms</strong></td><td><strong>-70.4%</strong></td></tr>
                </tbody>
            </table>
            <img src="/load-test/17-phase34-before-after-compare.png" alt="Phase 3,4 적용 전/후 비교" className="w-full my-4 rounded border" />

            <hr />

            <h2>TO-BE — Phase 4 최종 적용 후 측정 (폴더 18)</h2>

            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>VU</td><td>1,001</td></tr>
                    <tr><td>RPS</td><td><strong>323.5</strong></td></tr>
                    <tr><td>Avg</td><td><strong>36ms</strong></td></tr>
                    <tr><td>P95</td><td><strong>47ms</strong></td></tr>
                    <tr><td>P99</td><td><strong>65ms</strong></td></tr>
                    <tr><td>에러</td><td><strong>0건</strong></td></tr>
                </tbody>
            </table>
            <img src="/load-test/18-phase34-complete-queue-1000-01.png" alt="TO-BE 1000 VU 결과 1" className="w-full my-4 rounded border" />
            <img src="/load-test/18-phase34-complete-queue-1000-02.png" alt="TO-BE 1000 VU 결과 2" className="w-full my-4 rounded border" />
            <img src="/load-test/18-phase34-complete-queue-1000-03.png" alt="TO-BE 1000 VU 결과 3" className="w-full my-4 rounded border" />

            <hr />

            <h2>Phase별 누적 효과 요약</h2>
            <table>
                <thead>
                    <tr>
                        <th>지표</th>
                        <th>Phase 0 (AS-IS)</th>
                        <th>Phase 1 (1차)</th>
                        <th>Phase 1 확대</th>
                        <th>Phase 4 완료</th>
                        <th>개선률</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td><strong>Queue Flow Avg</strong></td><td>~2,000ms</td><td>1,624ms</td><td>31ms</td><td><strong>36ms</strong></td><td><strong>-98%</strong></td></tr>
                    <tr><td><strong>Queue Flow P99</strong></td><td>~5,000ms</td><td>2,664ms</td><td>60ms</td><td><strong>65ms</strong></td><td><strong>-99%</strong></td></tr>
                    <tr><td><strong>E2E 9-step Avg</strong></td><td>—</td><td>—</td><td>—</td><td><strong>149ms</strong></td><td>-70% (Phase 3→4)</td></tr>
                    <tr><td><strong>503 발생</strong></td><td>40+18건</td><td>1건</td><td>0건</td><td>0건</td><td>—</td></tr>
                    <tr><td><strong>DB 커넥션 peak</strong></td><td>270 한계</td><td>250</td><td>150</td><td>~100</td><td>-63%</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>결론</h2>
            <p>
                <strong>"DB 사양 문제가 아니라 앱이 쿼리를 너무 많이 보내는 문제였다"</strong> — 진단이 맞았고,
                그에 따른 앱단 해결이 <strong>DB 인스턴스 업그레이드 없이</strong> 목표치를 달성했습니다.
            </p>
            <ul>
                <li>선택하지 않은 카드: DB 인스턴스 업그레이드 (약 $100/월 지속 비용)</li>
                <li>선택한 카드: Caffeine 캐싱 + Redis 분산 캐시 + 인프라 파라미터 재배분 + 코드 레벨 핫픽스 (0원)</li>
                <li>결과: <strong>Queue Flow P99 5초 → 65ms (~98% 개선)</strong>, 503 0건</li>
            </ul>
        </DocPageLayout>
    );
}
