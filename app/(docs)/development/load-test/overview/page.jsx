import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="부하테스트 개요">
            <h1>부하테스트 개요</h1>
            <p>
                PlayBall 백엔드는 staging 환경(AWS)에서 <code>k6</code> 기반 부하테스트를 3일간 수행했습니다.
                AS-IS 베이스라인 측정부터 Phase 1~4 최적화까지, 각 단계의 병목 지점과 개선 효과를 수치로 검증했습니다.
            </p>

            <hr />

            <h2>1. 테스트 환경</h2>

            <h3>1.1 인프라 스펙</h3>
            <table>
                <thead>
                    <tr><th>구분</th><th>스펙</th><th>비고</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>환경</strong></td><td>staging (AWS)</td><td><code>api.staging.playball.one</code></td></tr>
                    <tr><td><strong>DB 인스턴스</strong></td><td><code>db.t4g.small</code> (PostgreSQL 16)</td><td><strong><code>max_connections = 270</code></strong> — 실제 한계선</td></tr>
                    <tr><td><strong>Redis (공용)</strong></td><td>ElastiCache Redis 7</td><td>인증·분산락·캐시</td></tr>
                    <tr><td><strong>Redis (Queue)</strong></td><td>ElastiCache Redis 7 (별도)</td><td>대기열 ZSET 전용</td></tr>
                    <tr><td><strong>Kafka</strong></td><td>Apache Kafka 3.7.1</td><td>이벤트 메시징</td></tr>
                    <tr><td><strong>Kubernetes</strong></td><td>EKS (Istio Gateway + mTLS)</td><td>Envoy Proxy</td></tr>
                </tbody>
            </table>

            <h3>1.2 서비스별 포트/역할</h3>
            <table>
                <thead>
                    <tr><th>서비스</th><th>포트</th><th>역할</th></tr>
                </thead>
                <tbody>
                    <tr><td>API-Gateway</td><td>8085</td><td>JWT 중앙 검증, 라우팅, Rate Limiting, 봇 차단</td></tr>
                    <tr><td>Auth-Guard</td><td>8080</td><td>Kakao OAuth, JWT 발급/갱신(RTR), 유저 차단</td></tr>
                    <tr><td>Queue</td><td>8081</td><td>Redis ZSET 대기열, Admission Token 발급</td></tr>
                    <tr><td>Seat</td><td>8082</td><td>좌석 추천/배정, Redisson 분산 락, Hold 관리</td></tr>
                    <tr><td>Order-Core</td><td>8083</td><td>주문 생성, 결제 처리, 마이페이지</td></tr>
                </tbody>
            </table>

            <h3>1.3 기술 스택</h3>
            <ul>
                <li>Java 21 LTS, Spring Boot 4.0.2, Spring Cloud 2025.1.1</li>
                <li>PostgreSQL 16 (HikariCP), Redis 7, Kafka 3.7.1</li>
                <li>Caffeine 3.x (로컬 캐시), Redisson 3.44.0 (분산 락)</li>
                <li>Resilience4j (Retry, Circuit Breaker)</li>
            </ul>

            <hr />

            <h2>2. 테스트 도구: k6</h2>
            <p>
                <a href="https://k6.io" target="_blank" rel="noopener noreferrer">k6</a>는 Grafana Labs의 Go 기반
                오픈소스 부하 테스트 도구입니다. JavaScript로 테스트 시나리오를 작성하며,
                수천 VU(Virtual User) 동시 시뮬레이션에 최적화되어 있습니다.
            </p>

            <h3>2.1 기본 개념</h3>
            <table>
                <thead>
                    <tr><th>개념</th><th>의미</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>VU (Virtual User)</strong></td><td>가상 사용자. 한 VU는 1개 스레드에서 순차적으로 요청을 반복 실행</td></tr>
                    <tr><td><strong>Iteration</strong></td><td>VU가 시나리오를 1회 실행하는 단위</td></tr>
                    <tr><td><strong>Duration</strong></td><td>테스트 총 실행 시간</td></tr>
                    <tr><td><strong>Ramp-up</strong></td><td>VU를 점진적으로 늘리는 구간</td></tr>
                    <tr><td><strong>RPS</strong></td><td>Requests Per Second (초당 요청 수)</td></tr>
                    <tr><td><strong>Percentile (P50/P95/P99)</strong></td><td>응답 시간 분포에서 하위 50%/95%/99% 지점의 값</td></tr>
                </tbody>
            </table>

            <h3>2.2 본 프로젝트의 k6 Controller</h3>
            <ul>
                <li>저장소: <code>304-goormgb-k6-operators</code></li>
                <li>각 Flow 시나리오: <code>{`k6-controller/scripts/{auth|queue|seat|recommendation|order}/flow.js`}</code></li>
                <li>웹 UI에서 VU/Duration 설정 후 실행 → 실시간 대시보드로 결과 확인</li>
                <li>결과: <code>{`k6-test-result-{timestamp}_load.md`}</code> 형태로 저장</li>
            </ul>

            <hr />

            <h2>3. 측정 메트릭</h2>

            <h3>3.1 HTTP 레벨</h3>
            <table>
                <thead>
                    <tr><th>메트릭</th><th>설명</th><th>목표</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>http_reqs</code></td><td>총 요청 수</td><td>—</td></tr>
                    <tr><td><code>http_req_duration</code></td><td>요청 완료까지 소요 시간</td><td>—</td></tr>
                    <tr><td><code>{`http_req_duration{p50}`}</code></td><td>중앙값 응답 시간</td><td>—</td></tr>
                    <tr><td><code>{`http_req_duration{p95}`}</code></td><td>상위 95% 응답 시간</td><td><strong>&lt; 1,000ms</strong></td></tr>
                    <tr><td><code>{`http_req_duration{p99}`}</code></td><td>상위 99% 응답 시간</td><td><strong>&lt; 2,000ms</strong></td></tr>
                    <tr><td><code>http_req_failed</code></td><td>실패율</td><td><strong>&lt; 1%</strong></td></tr>
                </tbody>
            </table>

            <h3>3.2 상태 코드 분포</h3>
            <table>
                <thead>
                    <tr><th>상태</th><th>의미</th><th>주의</th></tr>
                </thead>
                <tbody>
                    <tr><td>2xx</td><td>성공</td><td>—</td></tr>
                    <tr><td>400</td><td>잘못된 요청</td><td>DTO 유효성 검증 실패</td></tr>
                    <tr><td>401</td><td>인증 실패</td><td>토큰 만료/위조</td></tr>
                    <tr><td>403</td><td>권한 없음</td><td>봇 차단, Rate Limit</td></tr>
                    <tr><td>404</td><td>리소스 없음</td><td>연석 부족, Admission Token 만료</td></tr>
                    <tr><td>409</td><td>충돌 (경합)</td><td><strong>좌석 Hold 경합 — 정상 동시성 제어 결과</strong></td></tr>
                    <tr><td>410</td><td>Gone</td><td>Admission Token 만료</td></tr>
                    <tr><td>429</td><td>Too Many Requests</td><td>Rate Limiting 동작</td></tr>
                    <tr><td><strong>503</strong></td><td><strong>Service Unavailable</strong></td><td><strong>Envoy upstream connect timeout — 병목 신호</strong></td></tr>
                </tbody>
            </table>

            <h3>3.3 k6 Custom Metrics (본 프로젝트 전용)</h3>

            <h4>큐 관련</h4>
            <ul>
                <li><code>queue_ready_count</code>: 대기열에서 READY 상태로 승격된 VU 수</li>
                <li><code>queue_fail_count</code>: READY 실패 VU 수</li>
                <li><code>queue_wait_seconds</code>: 큐 진입 → READY까지 실제 대기 시간</li>
            </ul>

            <h4>추천 배정 관련</h4>
            <ul>
                <li><code>rec_assign_success</code>: 좌석 배정 성공 수</li>
                <li><code>rec_assign_contention</code>: 409 경합 발생 수</li>
                <li><code>rec_assign_no_seat</code>: 404 연석 없음</li>
                <li><code>rec_real_consecutive</code>: 실연석 배정 성공</li>
                <li><code>rec_semi_consecutive</code>: 준연석 배정 성공</li>
            </ul>

            <h4>좌석 Hold (포도알) 관련</h4>
            <ul>
                <li><code>seat_hold_final_success</code>: 재시도 포함 최종 성공 VU</li>
                <li><code>seat_hold_final_fail</code>: 모든 블럭 시도 후 실패 VU</li>
                <li><code>seat_hold_contention</code>: 이선좌(409) 총 발생 건수</li>
                <li><code>seat_hold_attempts</code>: VU당 시도 횟수 분포</li>
            </ul>

            <hr />

            <h2>4. 백엔드 모니터링 지표</h2>
            <p>k6 외부 측정값과 함께, 백엔드 내부 지표도 Prometheus로 수집합니다.</p>

            <h3>4.1 DB 관련</h3>
            <table>
                <thead>
                    <tr><th>지표</th><th>의미</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>hikaricp_connections_active</code></td><td>현재 사용 중인 커넥션 수</td></tr>
                    <tr><td><code>hikaricp_connections_idle</code></td><td>유휴 커넥션 수</td></tr>
                    <tr><td><code>hikaricp_connections_pending</code></td><td><strong>커넥션 획득을 기다리는 스레드 수 (핵심 지표)</strong></td></tr>
                    <tr><td><code>hikaricp_connections_max</code></td><td>풀 최대 크기</td></tr>
                    <tr><td><code>postgres_max_connections</code></td><td>DB 서버 측 최대 연결 수 (270)</td></tr>
                    <tr><td><code>rds_cpu_utilization</code></td><td>RDS CPU 사용률</td></tr>
                </tbody>
            </table>

            <h3>4.2 JVM / Tomcat</h3>
            <table>
                <thead>
                    <tr><th>지표</th><th>의미</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>jvm_threads_live</code></td><td>전체 JVM 스레드 수</td></tr>
                    <tr><td><code>tomcat_threads_busy</code></td><td>작업 중인 Tomcat 워커 스레드 수</td></tr>
                    <tr><td><code>tomcat_threads_max</code></td><td>Tomcat 최대 워커 수 (설정값)</td></tr>
                    <tr><td><code>tomcat_connections_current</code></td><td>현재 TCP 연결 수</td></tr>
                    <tr><td><code>tomcat_sessions_active</code></td><td>활성 세션 수</td></tr>
                </tbody>
            </table>

            <h3>4.3 캐시 관련</h3>
            <table>
                <thead>
                    <tr><th>지표</th><th>의미</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>{`cache_gets{result=hit}`}</code></td><td>Caffeine 캐시 hit 수</td></tr>
                    <tr><td><code>{`cache_gets{result=miss}`}</code></td><td>Caffeine 캐시 miss 수</td></tr>
                    <tr><td><code>cache_evictions</code></td><td>eviction 발생 수</td></tr>
                    <tr><td><code>cache_size</code></td><td>현재 캐시 엔트리 수</td></tr>
                    <tr><td>— 조회 경로</td><td><code>/actuator/metrics/cache.gets</code></td></tr>
                </tbody>
            </table>

            <h3>4.4 Redis / 분산 락</h3>
            <table>
                <thead>
                    <tr><th>지표</th><th>의미</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>ticketing_seat_lock_wait_seconds</code></td><td>Redisson 분산 락 획득 대기 시간</td></tr>
                    <tr><td><code>{`ticketing_seat_hold_fail_total{reason}`}</code></td><td>Hold 실패 사유별 카운터</td></tr>
                    <tr><td><code>ticketing_seat_recommend_degrade_total</code></td><td>준연석 폴백 발생</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>5. 부하 패턴</h2>
            <p>k6 실행 시 3단계 패턴을 사용합니다.</p>

            <pre><code>{`VU 수
 ▲
 │
1000│          ┌─────────────┐
 │            /               \\
 │           /                 \\
  0└─────────/─────────────────\\─────── 시간 →
        Ramp-up    유지          Ramp-down
         ~30s     ~2~3min         ~30s`}</code></pre>

            <ul>
                <li><strong>Ramp-up</strong>: VU를 0 → 목표치까지 점진적으로 증가 (급격한 부하로 인한 오탐 방지)</li>
                <li><strong>유지 (Steady state)</strong>: 목표 VU를 일정 시간 유지 (성능 측정 구간)</li>
                <li><strong>Ramp-down</strong>: 정상 종료</li>
            </ul>

            <hr />

            <h2>6. 3일간 테스트 시간표</h2>
            <table>
                <thead>
                    <tr><th>일자</th><th>단계</th><th>내용</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>2026-04-14</strong></td><td>01~03</td><td>AS-IS 베이스라인 측정 (아무 최적화 없는 상태)</td></tr>
                    <tr><td><strong>2026-04-15</strong></td><td>04~15</td><td>1차 Caffeine 캐싱, Phase 1~2 적용 및 검증</td></tr>
                    <tr><td><strong>2026-04-16</strong></td><td>16~21</td><td>Phase 3~4 완료 후 엔드투엔드 검증, 추천 ON/OFF 전체 플로우</td></tr>
                </tbody>
            </table>
            <p>
                각 단계별 상세 결과는 <strong>테스트별 결과 요약</strong> 페이지를 참조하세요.
            </p>
        </DocPageLayout>
    );
}
