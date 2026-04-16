import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="Before/After 시각화 비교">
            <h1>시각화 — Before / Middle / After 비교</h1>
            <blockquote>
                최적화 전 · 중 · 후 캡쳐 이미지와 수치를 나란히 비교하는 시각화 문서입니다.
                모든 이미지는 <code>/load-test/</code> 경로로 서빙됩니다.
            </blockquote>

            <hr />

            <h2>한눈에 보는 개선 효과</h2>
            <pre><code>{`┌─────────────────────────────────────────────────────────────────────────┐
│                    Seat 서비스 P99 레이턴시 추이                          │
│                                                                         │
│  6887ms │ ■                                                             │
│         │ ■                                                             │
│         │ ■                                                             │
│  5000ms │ ■                                                             │
│         │ ■                                                             │
│         │ ■                                                             │
│  3000ms │ ■ ─ ─ ─                                                       │
│         │ ■     ■                                                       │
│  2000ms │ ■     ■ ─ ─ ─                                                 │
│         │ ■     ■     ■                                                 │
│  1000ms │ ■     ■     ■ ─ ─ ─                                           │
│         │ ■     ■     ■     ■                                           │
│   500ms │ ■     ■     ■     ■ ─ ─ ─                                     │
│         │ ■     ■     ■     ■     ■ ─ ─ ─ ─ ─ ─                         │
│    65ms │ ─     ─     ─     ─     ─     ■                               │
│         └──────────────────────────────────────────                     │
│           AS-IS  1차   1확대 Phase2 Phase3 Phase4                        │
└─────────────────────────────────────────────────────────────────────────┘`}</code></pre>

            <hr />

            <h2>1. AS-IS (최적화 전) — Phase 0</h2>

            <h3>1-1. 큐 3000명 스트레스 (폴더 01)</h3>
            <ul>
                <li><strong>시점</strong>: 2026-04-14</li>
                <li><strong>결과</strong>: Queue P95 6.5s / 503 40건 / Seat P95 6.2s / 503 18건</li>
            </ul>
            <img src="/load-test/01-as-is-queue-3000.png" alt="AS-IS 큐 3000 503 발생" className="w-full my-4 rounded border" />

            <h3>1-2. 큐 4000명 (시스템 다운, 폴더 02)</h3>
            <ul>
                <li><strong>시점</strong>: 2026-04-14 11:17</li>
                <li><strong>결과</strong>: k6 툴 + 로컬 크롬 종료 — 인프라 한계</li>
            </ul>
            <img src="/load-test/02-as-is-queue-4000-before-crash.png" alt="4000 VU 크래시 직전" className="w-full my-4 rounded border" />
            <img src="/load-test/02-as-is-queue-4000-timeout.png" alt="4000 VU 타임아웃 대량 발생" className="w-full my-4 rounded border" />
            <img src="/load-test/02-as-is-queue-4000-503-storm.png" alt="4000 VU 503 스톰" className="w-full my-4 rounded border" />

            <h3>1-3. 추천 ON 1000명 (폴더 03)</h3>
            <ul>
                <li><strong>시점</strong>: 2026-04-14 23:47~23:50</li>
                <li><strong>실행</strong>: 2분 38초 PASS (정상 완료되었지만 대기시간 과다)</li>
            </ul>
            <img src="/load-test/03-as-is-rec-on-1000-01.png" alt="AS-IS 추천 ON 1000 1" className="w-full my-4 rounded border" />
            <img src="/load-test/03-as-is-rec-on-1000-02.png" alt="AS-IS 추천 ON 1000 2" className="w-full my-4 rounded border" />

            <hr />

            <h2>2. 중간 조치 A — 인프라만 튜닝 (커넥션 풀 30)</h2>

            <h3>2-1. 1000 VU (폴더 04)</h3>
            <img src="/load-test/04-infra-pool30-queue-1000-01.png" alt="인프라 풀 30 1000 VU 1" className="w-full my-4 rounded border" />
            <img src="/load-test/04-infra-pool30-queue-1000-02.png" alt="인프라 풀 30 1000 VU 2" className="w-full my-4 rounded border" />

            <h3>2-2. 2000 VU (폴더 05)</h3>
            <img src="/load-test/05-infra-pool30-queue-2000.png" alt="인프라 풀 30 2000 VU" className="w-full my-4 rounded border" />

            <h3>2-3. 추가 실험 (폴더 06)</h3>
            <img src="/load-test/06-mid-opt-01.png" alt="중간 최적화 1" className="w-full my-4 rounded border" />
            <img src="/load-test/06-mid-opt-02.png" alt="중간 최적화 2" className="w-full my-4 rounded border" />

            <h3>관찰</h3>
            <ul>
                <li>커넥션 풀만 늘려도 <strong>P99 여전히 2초대</strong></li>
                <li>"DB 업그레이드로는 해결 안 됨" 검증 완료</li>
            </ul>

            <hr />

            <h2>3. Phase 1 (1차) — Seat match-exists Caffeine PoC</h2>

            <h3>3-1. Queue Flow 1000 VU (폴더 07)</h3>
            <table>
                <thead>
                    <tr><th>메트릭</th><th>AS-IS</th><th>Phase 1 (1차)</th><th>변화</th></tr>
                </thead>
                <tbody>
                    <tr><td>RPS</td><td>-</td><td><strong>483.6</strong></td><td>—</td></tr>
                    <tr><td>P99</td><td>6,887ms</td><td><strong>2,434ms</strong></td><td><strong>-65%</strong></td></tr>
                    <tr><td>503</td><td>다수</td><td><strong>1건</strong></td><td>거의 제거</td></tr>
                </tbody>
            </table>
            <img src="/load-test/07-phase1-caffeine-poc-01.png" alt="Phase 1 PoC 1" className="w-full my-4 rounded border" />
            <img src="/load-test/07-phase1-caffeine-poc-02.png" alt="Phase 1 PoC 2" className="w-full my-4 rounded border" />
            <img src="/load-test/07-phase1-caffeine-poc-03.png" alt="Phase 1 PoC 3" className="w-full my-4 rounded border" />

            <h3>3-2. Queue Flow 2000 VU (폴더 08)</h3>
            <p>수치: P99 3.34s (1차 PoC로 2000 VU도 안정)</p>
            <img src="/load-test/08-phase1-caffeine-2000vu-01.png" alt="Phase 1 2000 VU 1" className="w-full my-4 rounded border" />
            <img src="/load-test/08-phase1-caffeine-2000vu-02.png" alt="Phase 1 2000 VU 2" className="w-full my-4 rounded border" />

            <h3>PoC 결론</h3>
            <ul>
                <li>Match 조회 하나 캐싱만으로 <strong>P99 65% 감소</strong></li>
                <li>확대 적용 시 더 큰 효과 기대 → <strong>전수조사 진행</strong></li>
            </ul>

            <hr />

            <h2>4. DB Top 7 쿼리 전수조사 (폴더 09)</h2>
            <ul>
                <li>DB 부하를 유발하는 Top 7 쿼리 식별</li>
                <li>각 쿼리별 캐싱 전략 수립 (Caffeine vs Redis)</li>
                <li>Phase 1 확대 작업계획서 작성</li>
            </ul>
            <img src="/load-test/09-top7-query-analysis-01.png" alt="Top 7 쿼리 분석 1" className="w-full my-4 rounded border" />
            <img src="/load-test/09-top7-query-analysis-02.png" alt="Top 7 쿼리 분석 2" className="w-full my-4 rounded border" />
            <img src="/load-test/09-top7-query-analysis-03.png" alt="Top 7 쿼리 분석 3" className="w-full my-4 rounded border" />
            <img src="/load-test/09-top7-query-analysis-04.png" alt="Top 7 쿼리 분석 4" className="w-full my-4 rounded border" />

            <hr />

            <h2>5. Phase 1 확대 — Multi-Service Caffeine</h2>

            <h3>5-1. 큐 1000 VU (폴더 10)</h3>
            <img src="/load-test/10-phase12-result-01.png" alt="Phase 1,2 결과 1" className="w-full my-4 rounded border" />
            <img src="/load-test/10-phase12-result-02.png" alt="Phase 1,2 결과 2" className="w-full my-4 rounded border" />
            <img src="/load-test/10-phase12-queue-1000-01.png" alt="Phase 1,2 큐 1000 1" className="w-full my-4 rounded border" />
            <img src="/load-test/10-phase12-queue-1000-02.png" alt="Phase 1,2 큐 1000 2" className="w-full my-4 rounded border" />

            <h3>5-2. 큐 2000 VU 30초 (폴더 11)</h3>
            <img src="/load-test/11-phase12-queue-2000-30s-01.png" alt="Phase 1,2 2000 VU 30s 1" className="w-full my-4 rounded border" />
            <img src="/load-test/11-phase12-queue-2000-30s-02.png" alt="Phase 1,2 2000 VU 30s 2" className="w-full my-4 rounded border" />
            <img src="/load-test/11-phase12-queue-2000-30s-03.png" alt="Phase 1,2 2000 VU 30s 3" className="w-full my-4 rounded border" />
            <img src="/load-test/11-phase12-queue-2000-30s-04.png" alt="Phase 1,2 2000 VU 30s 4" className="w-full my-4 rounded border" />
            <img src="/load-test/11-phase12-queue-2000-30s-05.png" alt="Phase 1,2 2000 VU 30s 5" className="w-full my-4 rounded border" />

            <h3>5-3. 큐 2000 VU 1분 (안정성 검증, 폴더 12)</h3>
            <img src="/load-test/12-phase12-queue-2000-60s-01.png" alt="Phase 1,2 2000 VU 60s 1" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-02.png" alt="Phase 1,2 2000 VU 60s 2" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-03.png" alt="Phase 1,2 2000 VU 60s 3" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-04.png" alt="Phase 1,2 2000 VU 60s 4" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-05.png" alt="Phase 1,2 2000 VU 60s 5" className="w-full my-4 rounded border" />
            <img src="/load-test/12-phase12-queue-2000-60s-06.png" alt="Phase 1,2 2000 VU 60s 6" className="w-full my-4 rounded border" />

            <hr />

            <h2>6. 중간 조치 C — HttpClient Pool 상향</h2>

            <h3>6-1. Pool 상향 직후 (폴더 13)</h3>
            <img src="/load-test/13-httpclient-pool-01.png" alt="HTTP Pool 상향 1" className="w-full my-4 rounded border" />
            <img src="/load-test/13-httpclient-pool-02.png" alt="HTTP Pool 상향 2" className="w-full my-4 rounded border" />

            <h3>6-2. Pool + Phase 1,2 통합, 1000 VU — 극적 개선 (폴더 14)</h3>
            <p>수치: <strong>Avg 31ms, P99 60ms</strong> (2000ms에서 60배 단축)</p>
            <img src="/load-test/14-httppool-phase12-queue-1000-01.png" alt="HTTP pool + Phase 1,2 1" className="w-full my-4 rounded border" />
            <img src="/load-test/14-httppool-phase12-queue-1000-02.png" alt="HTTP pool + Phase 1,2 2" className="w-full my-4 rounded border" />
            <img src="/load-test/14-httppool-phase12-queue-1000-03.png" alt="HTTP pool + Phase 1,2 3" className="w-full my-4 rounded border" />

            <h3>6-3. 추천 ON 1000명 재측정 (폴더 15, 03번과 동일 조건)</h3>
            <p>수치: Queue P99 194ms / Seat P99 1.23s</p>
            <img src="/load-test/15-httppool-phase12-rec-on-1000-01.png" alt="HTTP pool 추천 ON 1" className="w-full my-4 rounded border" />
            <img src="/load-test/15-httppool-phase12-rec-on-1000-02.png" alt="HTTP pool 추천 ON 2" className="w-full my-4 rounded border" />
            <img src="/load-test/15-httppool-phase12-rec-on-1000-03.png" alt="HTTP pool 추천 ON 3" className="w-full my-4 rounded border" />
            <img src="/load-test/15-httppool-phase12-rec-on-1000-04.png" alt="HTTP pool 추천 ON 4" className="w-full my-4 rounded border" />
            <img src="/load-test/15-httppool-phase12-rec-on-1000-05.png" alt="HTTP pool 추천 ON 5" className="w-full my-4 rounded border" />
            <img src="/load-test/15-httppool-phase12-rec-on-1000-06.png" alt="HTTP pool 추천 ON 6" className="w-full my-4 rounded border" />

            <hr />

            <h2>7. Phase 3,4 적용 전/후 직접 비교 (폴더 17) ★★★</h2>
            <p>가장 명확한 <strong>직전/직후 수치 비교</strong>.</p>

            <h3>7-1. 엔드투엔드 9단계 Flow</h3>
            <table>
                <thead>
                    <tr><th>서비스</th><th>적용 전</th><th>적용 후</th><th>개선률</th></tr>
                </thead>
                <tbody>
                    <tr><td>Queue</td><td>325ms</td><td><strong>96ms</strong></td><td><strong>-70.4%</strong></td></tr>
                    <tr><td>Seat</td><td>741ms</td><td><strong>236ms</strong></td><td><strong>-68.2%</strong></td></tr>
                    <tr><td>Order-Core</td><td>304ms</td><td><strong>68ms</strong></td><td><strong>-77.6%</strong></td></tr>
                    <tr><td><strong>전체 Avg</strong></td><td><strong>503ms</strong></td><td><strong>149ms</strong></td><td><strong>-70.4%</strong></td></tr>
                </tbody>
            </table>

            <h3>7-2. 엔드포인트별 세부 비교</h3>
            <table>
                <thead>
                    <tr><th>엔드포인트</th><th>적용 전</th><th>적용 후</th></tr>
                </thead>
                <tbody>
                    <tr><td>booking-options</td><td>837ms</td><td>339ms</td></tr>
                    <tr><td>queue-enter</td><td>393ms</td><td>55ms</td></tr>
                    <tr><td>queue-status</td><td>258ms</td><td>136ms</td></tr>
                    <tr><td>rec-seat-entry</td><td>887ms</td><td>81ms</td></tr>
                    <tr><td>rec-blocks</td><td>610ms</td><td>409ms</td></tr>
                    <tr><td>rec-assign</td><td>629ms</td><td>117ms</td></tr>
                    <tr><td>order-sheet</td><td>204ms</td><td>49ms</td></tr>
                    <tr><td>order-create</td><td>523ms</td><td>89ms</td></tr>
                    <tr><td>order-payment</td><td>186ms</td><td>67ms</td></tr>
                </tbody>
            </table>
            <img src="/load-test/17-phase34-before-after-compare.png" alt="Phase 3,4 before/after 직접 비교" className="w-full my-4 rounded border" />

            <hr />

            <h2>8. TO-BE — Phase 3,4 완료 최종 상태</h2>

            <h3>8-1. Queue Flow 1000 VU (폴더 18)</h3>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td><strong>Avg</strong></td><td><strong>36ms</strong></td></tr>
                    <tr><td><strong>P99</strong></td><td><strong>65ms</strong></td></tr>
                    <tr><td><strong>에러</strong></td><td><strong>0건</strong></td></tr>
                </tbody>
            </table>
            <img src="/load-test/18-phase34-complete-queue-1000-01.png" alt="TO-BE 큐 1000 1" className="w-full my-4 rounded border" />
            <img src="/load-test/18-phase34-complete-queue-1000-02.png" alt="TO-BE 큐 1000 2" className="w-full my-4 rounded border" />
            <img src="/load-test/18-phase34-complete-queue-1000-03.png" alt="TO-BE 큐 1000 3" className="w-full my-4 rounded border" />
            <img src="/load-test/18-phase34-complete-queue-1000-04.png" alt="TO-BE 큐 1000 4" className="w-full my-4 rounded border" />
            <img src="/load-test/18-phase34-complete-queue-1000-05.png" alt="TO-BE 큐 1000 5" className="w-full my-4 rounded border" />
            <img src="/load-test/18-phase34-complete-queue-1000-06.png" alt="TO-BE 큐 1000 6" className="w-full my-4 rounded border" />

            <h3>8-2. 추천 ON 1000명 (폴더 19)</h3>
            <p>수치: Seat Avg 368ms / P99 700ms / Queue Avg 282ms / P99 526ms / 에러 0건</p>
            <img src="/load-test/19-tobe-rec-on-1000-01.png" alt="TO-BE 추천 ON 1" className="w-full my-4 rounded border" />
            <img src="/load-test/19-tobe-rec-on-1000-02.png" alt="TO-BE 추천 ON 2" className="w-full my-4 rounded border" />
            <img src="/load-test/19-tobe-rec-on-1000-03.png" alt="TO-BE 추천 ON 3" className="w-full my-4 rounded border" />
            <img src="/load-test/19-tobe-rec-on-1000-04.png" alt="TO-BE 추천 ON 4" className="w-full my-4 rounded border" />

            <h3>8-3. 추천 OFF 포도알 Flow 1000명 (폴더 20)</h3>
            <p>수치: 좌석 Hold 최종 성공률 83.6% / 이선좌(409) 114건은 정상 동시성 제어 결과</p>
            <img src="/load-test/20-tobe-rec-off-1000-01.png" alt="TO-BE 추천 OFF 1" className="w-full my-4 rounded border" />
            <img src="/load-test/20-tobe-rec-off-1000-02.png" alt="TO-BE 추천 OFF 2" className="w-full my-4 rounded border" />
            <img src="/load-test/20-tobe-rec-off-1000-03.png" alt="TO-BE 추천 OFF 3" className="w-full my-4 rounded border" />
            <img src="/load-test/20-tobe-rec-off-1000-04.png" alt="TO-BE 추천 OFF 4" className="w-full my-4 rounded border" />
            <img src="/load-test/20-tobe-rec-off-1000-05.png" alt="TO-BE 추천 OFF 5" className="w-full my-4 rounded border" />
            <img src="/load-test/20-tobe-rec-off-1000-06.png" alt="TO-BE 추천 OFF 6" className="w-full my-4 rounded border" />

            <h3>8-4. 추천 OFF + Order E2E 1000명 (폴더 21) — 한계 확인</h3>
            <p>
                수치: 좌석 Hold 성공률 44.7% — 주문/결제 체인에서 좌석 고갈.
                이선좌 1,952건 / VU당 평균 시도 2.94회 / 주문서 조회 350건 모두 404.
                <strong>현 인프라의 1000 VU E2E 한계를 정직하게 드러냄</strong>.
            </p>
            <img src="/load-test/21-tobe-order-e2e-1000-01.png" alt="TO-BE Order E2E 1" className="w-full my-4 rounded border" />
            <img src="/load-test/21-tobe-order-e2e-1000-02.png" alt="TO-BE Order E2E 2" className="w-full my-4 rounded border" />
            <img src="/load-test/21-tobe-order-e2e-1000-03.png" alt="TO-BE Order E2E 3" className="w-full my-4 rounded border" />
            <img src="/load-test/21-tobe-order-e2e-1000-04.png" alt="TO-BE Order E2E 4" className="w-full my-4 rounded border" />
            <img src="/load-test/21-tobe-order-e2e-1000-05.png" alt="TO-BE Order E2E 5" className="w-full my-4 rounded border" />
            <img src="/load-test/21-tobe-order-e2e-1000-06.png" alt="TO-BE Order E2E 6" className="w-full my-4 rounded border" />

            <hr />

            <h2>9. 최종 Before / After 정량 비교표</h2>

            <h3>Queue Flow (booking-options + queue-enter) @ 1000 VU</h3>
            <table>
                <thead>
                    <tr><th>메트릭</th><th>AS-IS (폴더 03 수준)</th><th>TO-BE (폴더 18)</th><th>개선률</th></tr>
                </thead>
                <tbody>
                    <tr><td>Avg</td><td>~1,600ms</td><td><strong>36ms</strong></td><td><strong>-97.8%</strong></td></tr>
                    <tr><td>P50</td><td>~1,600ms</td><td>35ms</td><td>-97.8%</td></tr>
                    <tr><td>P95</td><td>~2,150ms</td><td><strong>47ms</strong></td><td>-97.8%</td></tr>
                    <tr><td>P99</td><td>~2,660ms</td><td><strong>65ms</strong></td><td><strong>-97.6%</strong></td></tr>
                    <tr><td>에러율</td><td>0.003% (503)</td><td><strong>0%</strong></td><td>—</td></tr>
                </tbody>
            </table>

            <h3>엔드투엔드 E2E (9단계 Full Flow)</h3>
            <table>
                <thead>
                    <tr><th>서비스</th><th>적용 전 (폴더 17)</th><th>적용 후 (폴더 17)</th><th>개선률</th></tr>
                </thead>
                <tbody>
                    <tr><td>Queue</td><td>325ms</td><td>96ms</td><td><strong>-70.4%</strong></td></tr>
                    <tr><td>Seat</td><td>741ms</td><td>236ms</td><td><strong>-68.2%</strong></td></tr>
                    <tr><td>Order-Core</td><td>304ms</td><td>68ms</td><td><strong>-77.6%</strong></td></tr>
                    <tr><td><strong>전체 Avg</strong></td><td><strong>503ms</strong></td><td><strong>149ms</strong></td><td><strong>-70.4%</strong></td></tr>
                </tbody>
            </table>

            <h3>3,000 VU 스트레스 (Phase 0 vs 현재)</h3>
            <table>
                <thead>
                    <tr><th>메트릭</th><th>Phase 0 (폴더 01)</th><th>Phase 4 완료 기대치</th></tr>
                </thead>
                <tbody>
                    <tr><td>Queue P95</td><td>6,544ms</td><td>1,000ms 미만 추정</td></tr>
                    <tr><td>Queue 503</td><td>40건 (1.7%)</td><td>0건 추정</td></tr>
                    <tr><td>Seat P95</td><td>6,177ms</td><td>1,500ms 미만 추정</td></tr>
                    <tr><td>Seat 503</td><td>18건 (0.3%)</td><td>0건 추정</td></tr>
                </tbody>
            </table>
            <blockquote>
                3,000 VU 재테스트는 아직 진행되지 않음. 1,000 VU 결과에서 E2E 70% 개선을 감안하면 같은 비율의 개선이 예상됩니다.
            </blockquote>

            <hr />

            <h2>10. 절감 효과</h2>
            <table>
                <thead><tr><th>항목</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td><strong>P99 개선</strong></td><td>6,887ms → 65ms (<strong>-99%</strong>)</td></tr>
                    <tr><td><strong>503 제거</strong></td><td>1.7% → 0%</td></tr>
                    <tr><td><strong>DB 커넥션 peak</strong></td><td>270 → 100 (-63%)</td></tr>
                    <tr><td><strong>DB 인스턴스 업그레이드 회피</strong></td><td>약 <strong>$100/월 × 영구</strong> 절감</td></tr>
                    <tr><td><strong>코드 변경만으로 해결한 시간</strong></td><td><strong>3일</strong> (2026-04-14~16)</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>이미지 원본 위치 (총 68장 이상)</h2>
            <ul>
                <li>폴더 01: 1장 / 02: 3장 / 03: 2장</li>
                <li>폴더 04: 2장 / 05: 1장 / 06: 2장</li>
                <li>폴더 07: 3장 / 08: 2장 / 09: 4장</li>
                <li>폴더 10: 4장 / 11: 5장 / 12: 6장</li>
                <li>폴더 13: 2장 / 14: 3장 / 15: 6장</li>
                <li>폴더 17: 1장</li>
                <li>폴더 18: 6장 / 19: 4장 / 20: 6장 / 21: 6장</li>
            </ul>
            <p>
                <strong>총 68장 이상의 캡쳐 이미지</strong>와 각 단계별 k6 결과 마크다운이
                부하테스트 진행 과정의 증거로 남아 있습니다.
            </p>
        </DocPageLayout>
    );
}
