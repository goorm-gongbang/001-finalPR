import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="테스트별 결과 요약">
            <h1>테스트별 결과 요약 (01~21번 폴더)</h1>
            <blockquote>
                21개 테스트 폴더의 개별 결과 일람 — 각 테스트의 조건·수치·캡쳐를 한눈에 정리합니다.
            </blockquote>

            <hr />

            <h2>전체 테스트 인덱스</h2>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>폴더</th>
                        <th>날짜</th>
                        <th>상태</th>
                        <th>VU</th>
                        <th>Flow</th>
                        <th>Phase</th>
                        <th>주요 결과</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>01</td><td>개선안한상태 큐 3000</td><td>04-14</td><td>AS-IS</td><td>3,000</td><td>Queue</td><td>0</td><td>Queue P95 6.5s, 503 40건</td></tr>
                    <tr><td>02</td><td>큐 4000 (k6 툴 죽음)</td><td>04-14</td><td>AS-IS</td><td>4,000</td><td>Queue</td><td>0</td><td>시스템 과부하 / 중단</td></tr>
                    <tr><td>03</td><td>추천 on 1000명</td><td>04-14</td><td>AS-IS</td><td>1,001</td><td>Recommendation</td><td>0</td><td>2m 38s PASS</td></tr>
                    <tr><td>04</td><td>인프라 풀30 큐 1000</td><td>04-15</td><td>중간 A</td><td>1,000</td><td>Queue</td><td>인프라</td><td>이미지</td></tr>
                    <tr><td>05</td><td>인프라 풀30 큐 2000</td><td>04-15</td><td>중간 A</td><td>2,000</td><td>Queue</td><td>인프라</td><td>이미지</td></tr>
                    <tr><td>06</td><td>중간 최적화 01</td><td>04-15</td><td>중간</td><td>—</td><td>—</td><td>—</td><td>이미지</td></tr>
                    <tr><td>07</td><td>matchId Caffeine 1차</td><td>04-15</td><td>Phase 1 시작</td><td>1,001</td><td>Queue</td><td>1차</td><td><strong>P99 2.4s</strong> (PoC 성공)</td></tr>
                    <tr><td>08</td><td>matchId 1차 큐 2000</td><td>04-15</td><td>Phase 1</td><td>2,000</td><td>Queue</td><td>1차</td><td>P99 3.34s</td></tr>
                    <tr><td>09</td><td>중간 02 DB Top7 쿼리</td><td>04-15</td><td>Phase 1 확대 준비</td><td>—</td><td>분석</td><td>—</td><td>Top 7 쿼리 전수조사</td></tr>
                    <tr><td>10</td><td>Phase 1,2 큐 1000</td><td>04-15</td><td>Phase 1 확대</td><td>1,000</td><td>Queue</td><td>1,2</td><td>이미지</td></tr>
                    <tr><td>11</td><td>Phase 1,2 큐 2000 30s</td><td>04-15</td><td>Phase 1,2</td><td>2,000</td><td>Queue</td><td>1,2</td><td>이미지</td></tr>
                    <tr><td>12</td><td>Phase 1,2 큐 2000 60s</td><td>04-15</td><td>Phase 1,2</td><td>2,000</td><td>Queue</td><td>1,2</td><td>이미지</td></tr>
                    <tr><td>13</td><td>HTTP pool 상향</td><td>04-15</td><td>중간 C</td><td>—</td><td>—</td><td>—</td><td>이미지</td></tr>
                    <tr><td>14</td><td>pool + Phase 1,2 큐 1000</td><td>04-15</td><td>중간 C</td><td>1,001</td><td>Queue</td><td>1,2</td><td><strong>P99 60ms</strong> (60배 개선)</td></tr>
                    <tr><td>15</td><td>pool + Phase 1,2 추천on</td><td>04-15</td><td>중간 C</td><td>1,001</td><td>Recommendation</td><td>1,2</td><td>Seat P99 1.23s</td></tr>
                    <tr><td>16</td><td>Phase 3,4 적용 완료</td><td>04-16</td><td>Phase 3,4</td><td>—</td><td>—</td><td>3,4</td><td>마커 폴더</td></tr>
                    <tr><td>17</td><td>Phase 3,4 전/후 비교</td><td>04-16</td><td>Phase 3,4</td><td>1</td><td>Order E2E</td><td><strong>3,4 전후</strong></td><td>Avg 503→149ms (-70%)</td></tr>
                    <tr><td>18</td><td>Phase 3,4 완료 큐 1000</td><td>04-16</td><td><strong>TO-BE</strong></td><td>1,001</td><td>Queue</td><td>완료</td><td><strong>P99 65ms</strong></td></tr>
                    <tr><td>19</td><td>추천on 1000명</td><td>04-16</td><td><strong>TO-BE</strong></td><td>1,000</td><td>Recommendation</td><td>완료</td><td>Seat P99 700ms</td></tr>
                    <tr><td>20</td><td>추천 off 1000</td><td>04-16</td><td><strong>TO-BE</strong></td><td>1,001</td><td>Seat E2E</td><td>완료</td><td>Hold 성공 83.6%</td></tr>
                    <tr><td>21</td><td>추천off + Order 1000</td><td>04-16</td><td><strong>TO-BE</strong></td><td>1,001</td><td>Order E2E</td><td>완료</td><td>경합률 심화</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>상세 — 각 테스트 결과</h2>

            <h3>폴더 01 — 개선 전 큐 3000명</h3>
            <ul>
                <li>날짜: 2026-04-14</li>
                <li>상태: AS-IS (Phase 0)</li>
                <li>Flow: Queue / VU: 3,000</li>
            </ul>
            <p><strong>측정값</strong>: Queue P95 6,544ms · 503 40건 (1.7%) / Seat P95 6,177ms · 503 18건 (0.3%)</p>
            <img src="/load-test/01-as-is-queue-3000.png" alt="AS-IS 큐 3000" className="w-full my-4 rounded border" />

            <h3>폴더 02 — 개선 전 큐 4000명 (시스템 다운)</h3>
            <ul>
                <li>날짜: 2026-04-14</li>
                <li>결과: 503 대량, 타임아웃 다수 → 중단 (k6 + 로컬 크롬 종료)</li>
            </ul>
            <img src="/load-test/02-as-is-queue-4000-before-crash.png" alt="4000 VU 크래시 직전" className="w-full my-4 rounded border" />
            <img src="/load-test/02-as-is-queue-4000-503-storm.png" alt="4000 VU 503 스톰" className="w-full my-4 rounded border" />

            <h3>폴더 03 — 개선 전 추천 ON 1000명</h3>
            <ul>
                <li>날짜: 2026-04-14 23:47~23:50 / VU: 1,001</li>
                <li>Flow: 매치옵션(ON) → 큐진입 → 폴링 → 추천진입 → 추천블럭 → 자동배정</li>
                <li>실행시간: 2분 38초, PASS (대기시간 과다)</li>
            </ul>
            <img src="/load-test/03-as-is-rec-on-1000-01.png" alt="AS-IS 추천 ON 1000 1" className="w-full my-4 rounded border" />
            <img src="/load-test/03-as-is-rec-on-1000-02.png" alt="AS-IS 추천 ON 1000 2" className="w-full my-4 rounded border" />

            <h3>폴더 04 — 인프라 커넥션풀 30 큐 1000명</h3>
            <ul>
                <li>날짜: 2026-04-15 / 상태: 중간 A (HikariCP pool 20 → 30)</li>
            </ul>
            <img src="/load-test/04-infra-pool30-queue-1000-01.png" alt="인프라 풀30 큐 1000 1" className="w-full my-4 rounded border" />

            <h3>폴더 05 — 인프라 커넥션풀 30 큐 2000명</h3>
            <img src="/load-test/05-infra-pool30-queue-2000.png" alt="인프라 풀30 큐 2000" className="w-full my-4 rounded border" />

            <h3>폴더 06 — 중간 최적화 01</h3>
            <img src="/load-test/06-mid-opt-01.png" alt="중간 최적화 1" className="w-full my-4 rounded border" />
            <img src="/load-test/06-mid-opt-02.png" alt="중간 최적화 2" className="w-full my-4 rounded border" />

            <h3>폴더 07 — matchId Caffeine 1차 PoC</h3>
            <ul>
                <li>날짜: 2026-04-15 02:00 / VU: 1,001 / Flow: Queue</li>
                <li>상태: Phase 1 시작 (Seat <code>match-exists</code> 하나만 Caffeine)</li>
            </ul>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>RPS</td><td><strong>483.6</strong></td></tr>
                    <tr><td>총 요청</td><td>30,212건</td></tr>
                    <tr><td>Avg</td><td>1,604.6ms</td></tr>
                    <tr><td>P95</td><td>2,147.4ms</td></tr>
                    <tr><td>P99</td><td><strong>2,434.1ms</strong></td></tr>
                    <tr><td>503</td><td>1건</td></tr>
                </tbody>
            </table>
            <p>의의: Match 조회 하나 캐싱만으로 <strong>P99 8초대 → 2초대 (PoC 성공)</strong>.</p>
            <img src="/load-test/07-phase1-caffeine-poc-01.png" alt="Phase 1 PoC 1" className="w-full my-4 rounded border" />
            <img src="/load-test/07-phase1-caffeine-poc-02.png" alt="Phase 1 PoC 2" className="w-full my-4 rounded border" />

            <h3>폴더 08 — matchId Caffeine 1차 큐 2000명</h3>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>VU</td><td>2,000</td></tr>
                    <tr><td>RPS</td><td>397.0</td></tr>
                    <tr><td>P95</td><td>3.05s</td></tr>
                    <tr><td>P99</td><td>3.34s</td></tr>
                    <tr><td>에러</td><td>0건</td></tr>
                </tbody>
            </table>
            <img src="/load-test/08-phase1-caffeine-2000vu-01.png" alt="Phase 1 2000 VU 1" className="w-full my-4 rounded border" />
            <img src="/load-test/08-phase1-caffeine-2000vu-02.png" alt="Phase 1 2000 VU 2" className="w-full my-4 rounded border" />

            <h3>폴더 09 — DB 부하 유발 Top 7 쿼리 (분석)</h3>
            <ul>
                <li>날짜: 2026-04-15 / 상태: Phase 1 확대 전 분석 단계</li>
                <li>결과: Top 7 핫 쿼리 식별 + 캐싱 우선순위 정립</li>
            </ul>
            <img src="/load-test/09-top7-query-analysis-01.png" alt="Top 7 분석 1" className="w-full my-4 rounded border" />
            <img src="/load-test/09-top7-query-analysis-02.png" alt="Top 7 분석 2" className="w-full my-4 rounded border" />

            <h3>폴더 10 — Phase 1,2 큐 1000명</h3>
            <img src="/load-test/10-phase12-queue-1000-01.png" alt="Phase 1,2 1000 1" className="w-full my-4 rounded border" />
            <img src="/load-test/10-phase12-result-01.png" alt="Phase 1,2 결과 1" className="w-full my-4 rounded border" />

            <h3>폴더 11 — Phase 1,2 큐 2000명 30초</h3>
            <img src="/load-test/11-phase12-queue-2000-30s-01.png" alt="Phase 1,2 2000 30s 1" className="w-full my-4 rounded border" />
            <img src="/load-test/11-phase12-queue-2000-30s-02.png" alt="Phase 1,2 2000 30s 2" className="w-full my-4 rounded border" />

            <h3>폴더 12 — Phase 1,2 큐 2000명 1분 (안정성 검증)</h3>
            <img src="/load-test/12-phase12-queue-2000-60s-01.png" alt="Phase 1,2 2000 60s 1" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-02.png" alt="Phase 1,2 2000 60s 2" className="w-full my-4 rounded border" />

            <h3>폴더 13 — HTTP 클라이언트 풀 상향</h3>
            <img src="/load-test/13-httpclient-pool-01.png" alt="HTTP Pool 1" className="w-full my-4 rounded border" />
            <img src="/load-test/13-httpclient-pool-02.png" alt="HTTP Pool 2" className="w-full my-4 rounded border" />

            <h3>폴더 14 — HTTP pool + Phase 1,2 큐 1000명 (극적 개선)</h3>
            <ul>
                <li>날짜: 2026-04-15 23:05 / VU: 1,001 / Flow: Queue</li>
            </ul>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>RPS</td><td><strong>325.7</strong></td></tr>
                    <tr><td>총 요청</td><td>2,002건</td></tr>
                    <tr><td>Avg</td><td><strong>31ms</strong> (2000ms에서 60배 단축)</td></tr>
                    <tr><td>P95</td><td>39ms</td></tr>
                    <tr><td>P99</td><td><strong>60ms</strong></td></tr>
                    <tr><td>에러</td><td>0건</td></tr>
                </tbody>
            </table>
            <img src="/load-test/14-httppool-phase12-queue-1000-01.png" alt="HTTP pool + Phase 1,2 1" className="w-full my-4 rounded border" />
            <img src="/load-test/14-httppool-phase12-queue-1000-02.png" alt="HTTP pool + Phase 1,2 2" className="w-full my-4 rounded border" />

            <h3>폴더 15 — HTTP pool + Phase 1,2 + 추천 ON 1000명</h3>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>RPS</td><td>294.0</td></tr>
                    <tr><td>총 요청</td><td>54,877건</td></tr>
                    <tr><td>P95</td><td>157ms</td></tr>
                    <tr><td>P99</td><td>826ms</td></tr>
                </tbody>
            </table>
            <p><strong>서비스별</strong> — Queue: P99 194ms / Seat: P95 1.03s · P99 1.23s</p>
            <img src="/load-test/15-httppool-phase12-rec-on-1000-01.png" alt="HTTP pool + 추천 ON 1" className="w-full my-4 rounded border" />
            <img src="/load-test/15-httppool-phase12-rec-on-1000-02.png" alt="HTTP pool + 추천 ON 2" className="w-full my-4 rounded border" />

            <h3>폴더 16 — Phase 3,4 staging 적용 완료 (마커)</h3>
            <ul>
                <li>날짜: 2026-04-16 / 작업 완료 마커 (빈 폴더)</li>
            </ul>

            <h3>폴더 17 — Phase 3,4 적용 전/후 엔드투엔드 비교 (★)</h3>
            <ul>
                <li>날짜: 2026-04-16 02:43 / 02:49 / Flow: Order E2E (9단계) / VU: 1</li>
            </ul>
            <table>
                <thead>
                    <tr><th>서비스</th><th>적용 전</th><th>적용 후</th><th>개선률</th></tr>
                </thead>
                <tbody>
                    <tr><td>Queue</td><td>325ms</td><td>96ms</td><td><strong>-70.4%</strong></td></tr>
                    <tr><td>Seat</td><td>741ms</td><td>236ms</td><td><strong>-68.2%</strong></td></tr>
                    <tr><td>Order-Core</td><td>304ms</td><td>68ms</td><td><strong>-77.6%</strong></td></tr>
                    <tr><td><strong>전체 Avg</strong></td><td><strong>503ms</strong></td><td><strong>149ms</strong></td><td><strong>-70.4%</strong></td></tr>
                </tbody>
            </table>
            <img src="/load-test/17-phase34-before-after-compare.png" alt="Phase 3,4 before/after 비교" className="w-full my-4 rounded border" />

            <h3>폴더 18 — Phase 3,4 완료 Queue Flow 1000 VU (TO-BE)</h3>
            <ul>
                <li>날짜: 2026-04-16 03:11 / VU: 1,001 / Flow: Queue</li>
            </ul>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>RPS</td><td><strong>323.5</strong></td></tr>
                    <tr><td>Avg</td><td><strong>36ms</strong></td></tr>
                    <tr><td>P95</td><td><strong>47ms</strong></td></tr>
                    <tr><td>P99</td><td><strong>65ms</strong></td></tr>
                    <tr><td>에러</td><td><strong>0건</strong></td></tr>
                </tbody>
            </table>
            <p><strong>서비스별</strong> — Queue: P99 59ms / Seat: P99 65ms</p>
            <img src="/load-test/18-phase34-complete-queue-1000-01.png" alt="TO-BE 큐 1000 1" className="w-full my-4 rounded border" />
            <img src="/load-test/18-phase34-complete-queue-1000-02.png" alt="TO-BE 큐 1000 2" className="w-full my-4 rounded border" />

            <h3>폴더 19 — 추천 ON 1000명 (TO-BE)</h3>
            <ul>
                <li>날짜: 2026-04-16 오전 / VU: 1,000 / 에러 0건</li>
            </ul>
            <table>
                <thead>
                    <tr><th>서비스</th><th>요청 수</th><th>Avg</th><th>P95</th><th>P99</th></tr>
                </thead>
                <tbody>
                    <tr><td>Seat</td><td>2,000</td><td>368ms</td><td>604ms</td><td>700ms</td></tr>
                    <tr><td>Queue</td><td>2,000</td><td>282ms</td><td>459ms</td><td>526ms</td></tr>
                </tbody>
            </table>
            <img src="/load-test/19-tobe-rec-on-1000-01.png" alt="TO-BE 추천 ON 1" className="w-full my-4 rounded border" />
            <img src="/load-test/19-tobe-rec-on-1000-02.png" alt="TO-BE 추천 ON 2" className="w-full my-4 rounded border" />

            <h3>폴더 20 — 추천 OFF 1000명 (TO-BE)</h3>
            <ul>
                <li>날짜: 2026-04-16 10:35~10:39 / VU: 1,001 / Flow: Seat E2E</li>
            </ul>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>RPS</td><td>280.4</td></tr>
                    <tr><td>총 요청</td><td>60,316건</td></tr>
                    <tr><td>에러율</td><td><strong>0.2%</strong> (정상 동시성 경합)</td></tr>
                    <tr><td>Avg</td><td>105ms</td></tr>
                    <tr><td>P95</td><td>263ms</td></tr>
                    <tr><td>P99</td><td>1.88s</td></tr>
                </tbody>
            </table>
            <p><strong>좌석 Hold 경합</strong>: 성공 VU 92/110 = <strong>83.6%</strong> / 이선좌(409) 114건 (정상) / VU당 평균 시도 1.87회</p>
            <img src="/load-test/20-tobe-rec-off-1000-01.png" alt="TO-BE 추천 OFF 1" className="w-full my-4 rounded border" />
            <img src="/load-test/20-tobe-rec-off-1000-02.png" alt="TO-BE 추천 OFF 2" className="w-full my-4 rounded border" />

            <h3>폴더 21 — 추천 OFF + Order Flow E2E 1000명 (TO-BE)</h3>
            <ul>
                <li>날짜: 2026-04-16 10:41~10:44 / VU: 1,001 / Flow: Seat → Order Full E2E</li>
            </ul>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>RPS</td><td>192.0</td></tr>
                    <tr><td>총 요청</td><td>36,945건</td></tr>
                    <tr><td>에러율</td><td>6.6% (409 경합 1,952건)</td></tr>
                    <tr><td>Avg</td><td>180ms</td></tr>
                    <tr><td>P95</td><td>1.20s</td></tr>
                    <tr><td>P99</td><td>1.75s</td></tr>
                </tbody>
            </table>
            <p>
                <strong>좌석 경합 심화</strong>: 성공률 44.7% (350/783) · 이선좌 1,952건 · 주문서 조회 350건 모두 404.
                <strong>현 인프라 1000 VU 기준 한계치</strong>를 정직하게 드러냄 (정상 범위: 500~800 VU).
            </p>
            <img src="/load-test/21-tobe-order-e2e-1000-01.png" alt="TO-BE Order E2E 1" className="w-full my-4 rounded border" />
            <img src="/load-test/21-tobe-order-e2e-1000-02.png" alt="TO-BE Order E2E 2" className="w-full my-4 rounded border" />
        </DocPageLayout>
    );
}
