import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="추천 ON/OFF 실측 비교">
            <h1>좌석 추천 ON / OFF 실측 비교</h1>
            <blockquote>
                <p>
                    k6 부하 테스트 1,000 VU 시나리오로 좌석 경합 상황에서
                    <strong> 추천 ON(서버 자동 배정)</strong> vs <strong>추천 OFF(포도알 직접 선택)</strong>의
                    실측 지표를 비교한 문서입니다.
                </p>
                <p>측정 환경: Staging · 2026-04-17 · k6 LOCAL · 1,000 VU · matchId 로테이션</p>
            </blockquote>

            <hr />

            <h2>핵심 한 줄 요약</h2>
            <blockquote>
                <p>
                    <strong>추천 OFF(직접 선택)는 seat-holds에서 경합(409) 1,236건 · 시도 성공률 38.2%.
                    추천 ON(서버 자동 배정)은 동일 부하에서 경합 0건 · 성공률 100%로
                    재시도 자체를 구조적으로 제거했습니다.</strong>
                </p>
            </blockquote>

            <table>
                <thead>
                    <tr><th>지표</th><th>추천 OFF</th><th>추천 ON</th><th>효과</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>이선좌 (409) 경합</td>
                        <td style={{ color: "#DC2626", fontWeight: 700 }}>1,236건</td>
                        <td style={{ color: "#059669", fontWeight: 700 }}>0건</td>
                        <td><strong>경합 완전 제거</strong></td>
                    </tr>
                    <tr>
                        <td>Seat 서비스 성공률</td>
                        <td style={{ color: "#DC2626", fontWeight: 700 }}>84.5%</td>
                        <td style={{ color: "#059669", fontWeight: 700 }}>100%</td>
                        <td>+15.5%p</td>
                    </tr>
                    <tr>
                        <td>seat-holds 시도 성공률</td>
                        <td style={{ color: "#DC2626", fontWeight: 700 }}>38.2%</td>
                        <td style={{ color: "#059669", fontWeight: 700 }}>100%</td>
                        <td>+61.8%p</td>
                    </tr>
                    <tr>
                        <td>전체 요청 수</td>
                        <td>10,000</td>
                        <td>10,000</td>
                        <td>동일 부하</td>
                    </tr>
                </tbody>
            </table>

            <hr />

            <h2>테스트 조건</h2>
            <table>
                <thead><tr><th>항목</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>환경</td><td>Staging · <code>https://api.staging.playball.one</code></td></tr>
                    <tr><td>측정일</td><td>2026-04-17</td></tr>
                    <tr><td>가상 유저 (VU)</td><td>1,000</td></tr>
                    <tr><td>Duration</td><td>VU당 1 iteration</td></tr>
                    <tr><td>로그인</td><td>loadtest-login (1,000개 계정 순환)</td></tr>
                    <tr><td>Token Batch</td><td>100개씩 병렬 획득</td></tr>
                    <tr><td>재시도 정책</td><td>이선좌(409) 발생 시 다른 블럭/좌석으로 재시도</td></tr>
                    <tr><td>실행 모드</td><td>LOCAL (Docker · k6 binary)</td></tr>
                </tbody>
            </table>

            <h3>테스트 대상 엔드포인트</h3>
            <table>
                <thead><tr><th>#</th><th>추천 OFF Flow</th><th>추천 ON Flow</th></tr></thead>
                <tbody>
                    <tr><td>1</td><td><code>POST /seat/matches/{`{matchId}`}/booking-options</code> (OFF)</td><td><code>POST /seat/matches/{`{matchId}`}/booking-options</code> (ON)</td></tr>
                    <tr><td>2</td><td><code>POST /queue/matches/{`{matchId}`}/enter</code></td><td><code>POST /queue/matches/{`{matchId}`}/enter</code></td></tr>
                    <tr><td>3</td><td><code>GET /queue/matches/{`{matchId}`}/status</code></td><td><code>GET /queue/matches/{`{matchId}`}/status</code></td></tr>
                    <tr><td>4</td><td><code>GET /seat/matches/{`{matchId}`}/sections/{`{id}`}/seat-groups</code> (포도알)</td><td><code>POST /seat/matches/{`{matchId}`}/recommendations/seat-entry</code></td></tr>
                    <tr><td>5</td><td><code>GET /seat/matches/{`{matchId}`}/sections/{`{id}`}/blocks</code> (섹션블럭)</td><td><code>GET /seat/matches/{`{matchId}`}/recommendations/blocks</code></td></tr>
                    <tr><td>6</td><td><code>POST /seat/matches/{`{matchId}`}/seat-holds</code> (좌석선점)</td><td><code>POST /seat/matches/{`{matchId}`}/recommendations/blocks/{`{blockId}`}/assign</code> (자동 배정)</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>1. 추천 OFF — 포도알 직접 선택</h2>

            <h3>1-1. 요약 카드 (상태 코드 분포)</h3>
            <ul>
                <li>총 요청 <strong>11,236</strong> · P95 <strong>2,403ms</strong> · P99 <strong>3,344ms</strong> · 5XX 0건</li>
                <li>200 OK <strong>8,764 (78.0%)</strong> · 409 충돌 <strong>2,472 (22.0%)</strong></li>
                <li>재시도 누적치 — VU가 이선좌를 만나면 다른 블럭으로 재시도</li>
            </ul>
            <img src="/load-test/23-rec-off-summary-cards.png" alt="추천 OFF 요약 카드" className="w-full my-4 rounded border" />

            <h3>1-2. 전체 대시보드 (재시도 포함 누적)</h3>
            <img src="/load-test/23-rec-off-full-dashboard.png" alt="추천 OFF 전체 대시보드" className="w-full my-4 rounded border" />

            <h3>1-3. 서비스별 상세 통계 (단일 Iteration)</h3>
            <p>
                VU당 1 iteration 기준 Queue 2,000건 + Seat 8,000건 = 총 <strong>10,000건</strong>.
                이 중 <strong>seat-holds phase에서만 409 1,236건</strong> 발생 (다른 phase는 100%).
            </p>
            <img src="/load-test/23-rec-off-service-stats.png" alt="추천 OFF 서비스별 통계" className="w-full my-4 rounded border" />

            <h3>1-4. 엔드포인트별 수치</h3>
            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th><th>req</th><th>성공률</th>
                        <th>P50</th><th>P95</th><th>P99</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>booking-options-off</td><td>2,000</td><td>100%</td><td>689ms</td><td>1,961ms</td><td>2,152ms</td></tr>
                    <tr><td>queue-enter</td><td>2,000</td><td>100%</td><td>644ms</td><td>1,137ms</td><td>1,204ms</td></tr>
                    <tr><td>seat-groups</td><td>2,000</td><td>100%</td><td>838ms</td><td>1,301ms</td><td>1,907ms</td></tr>
                    <tr><td>section-blocks</td><td>2,000</td><td>100%</td><td>1,593ms</td><td>3,316ms</td><td>3,831ms</td></tr>
                    <tr style={{ background: "#FEF2F2" }}>
                        <td><strong>seat-holds</strong></td>
                        <td><strong>2,000</strong></td>
                        <td style={{ color: "#DC2626", fontWeight: 700 }}>38.2%</td>
                        <td>822ms</td><td>2,284ms</td><td>2,909ms</td>
                    </tr>
                </tbody>
            </table>

            <h3>1-5. Grafana · 백엔드 지표</h3>
            <img src="/load-test/23-rec-off-grafana-1.png" alt="추천 OFF Grafana 1" className="w-full my-4 rounded border" />
            <img src="/load-test/23-rec-off-grafana-2.png" alt="추천 OFF Grafana 2" className="w-full my-4 rounded border" />
            <img src="/load-test/23-rec-off-grafana-3.png" alt="추천 OFF Grafana 3" className="w-full my-4 rounded border" />
            <img src="/load-test/23-rec-off-grafana-4.png" alt="추천 OFF Grafana 4" className="w-full my-4 rounded border" />

            <hr />

            <h2>2. 추천 ON — 서버 자동 배정</h2>

            <h3>2-1. 요약 카드 (상태 코드 분포)</h3>
            <ul>
                <li>총 요청 <strong>10,000</strong> · P95 <strong>3,411ms</strong> · P99 <strong>4,345ms</strong> · 5XX 0건</li>
                <li>200 OK <strong>10,000 (100.0%)</strong> · <strong>409 충돌 0건</strong></li>
                <li>서버가 블럭 단위 분산 락으로 1명씩 순차 진입 → 경합 자체가 발생하지 않음</li>
            </ul>
            <img src="/load-test/22-rec-on-summary-cards.png" alt="추천 ON 요약 카드" className="w-full my-4 rounded border" />

            <h3>2-2. 전체 대시보드</h3>
            <img src="/load-test/22-rec-on-full-dashboard.png" alt="추천 ON 전체 대시보드" className="w-full my-4 rounded border" />

            <h3>2-3. 서비스별 상세 통계</h3>
            <p>
                VU당 1 iteration 기준 Queue 2,000건 + Seat 8,000건 = 총 <strong>10,000건</strong>.
                <strong>모든 phase 100% 성공</strong> — 재시도 불필요.
            </p>
            <img src="/load-test/22-rec-on-service-stats.png" alt="추천 ON 서비스별 통계" className="w-full my-4 rounded border" />

            <h3>2-4. 엔드포인트별 수치</h3>
            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th><th>req</th><th>성공률</th>
                        <th>P50</th><th>P95</th><th>P99</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>booking-options-on</td><td>2,000</td><td>100%</td><td>465ms</td><td>701ms</td><td>765ms</td></tr>
                    <tr><td>queue-enter</td><td>2,000</td><td>100%</td><td>637ms</td><td>801ms</td><td>898ms</td></tr>
                    <tr><td>rec-seat-entry</td><td>2,000</td><td>100%</td><td>860ms</td><td>2,537ms</td><td>3,164ms</td></tr>
                    <tr><td>rec-blocks</td><td>2,000</td><td>100%</td><td>1,497ms</td><td>2,670ms</td><td>3,565ms</td></tr>
                    <tr style={{ background: "#ECFDF5" }}>
                        <td><strong>rec-seat-hold</strong> (자동 배정)</td>
                        <td><strong>2,000</strong></td>
                        <td style={{ color: "#059669", fontWeight: 700 }}>100%</td>
                        <td>2,248ms</td><td>4,345ms</td><td>4,749ms</td>
                    </tr>
                </tbody>
            </table>

            <h3>2-5. Grafana · 백엔드 지표</h3>
            <img src="/load-test/22-rec-on-grafana-1.png" alt="추천 ON Grafana 1" className="w-full my-4 rounded border" />
            <img src="/load-test/22-rec-on-grafana-2.png" alt="추천 ON Grafana 2" className="w-full my-4 rounded border" />

            <hr />

            <h2>3. 정량 비교표</h2>

            <h3>3-1. 엔드포인트(좌석 확정) 기준</h3>
            <table>
                <thead>
                    <tr>
                        <th>지표</th>
                        <th>OFF · seat-holds</th>
                        <th>ON · rec-seat-hold</th>
                        <th>효과</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>총 시도</td>
                        <td>2,000</td>
                        <td>2,000</td>
                        <td>동일</td>
                    </tr>
                    <tr>
                        <td>200 (성공)</td>
                        <td style={{ color: "#DC2626", fontWeight: 700 }}>764</td>
                        <td style={{ color: "#059669", fontWeight: 700 }}>2,000</td>
                        <td><strong>+1,236건</strong></td>
                    </tr>
                    <tr>
                        <td>409 (경합)</td>
                        <td style={{ color: "#DC2626", fontWeight: 700 }}>1,236</td>
                        <td style={{ color: "#059669", fontWeight: 700 }}>0</td>
                        <td><strong>경합 완전 제거</strong></td>
                    </tr>
                    <tr>
                        <td>시도 성공률</td>
                        <td style={{ color: "#DC2626", fontWeight: 700 }}>38.2%</td>
                        <td style={{ color: "#059669", fontWeight: 700 }}>100%</td>
                        <td><strong>+61.8%p</strong></td>
                    </tr>
                    <tr>
                        <td>TPS</td>
                        <td>17.8</td>
                        <td>47.6</td>
                        <td>+167%</td>
                    </tr>
                </tbody>
            </table>

            <h3>3-2. 응답 속도 (좌석 확정 phase)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Percentile</th>
                        <th>OFF · seat-holds</th>
                        <th>ON · rec-seat-hold</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>Avg</td><td>824ms</td><td>2,248ms</td></tr>
                    <tr><td>P50</td><td>822ms</td><td>2,248ms</td></tr>
                    <tr><td>P95</td><td>2,284ms</td><td>4,345ms</td></tr>
                    <tr><td>P99</td><td>2,909ms</td><td>4,749ms</td></tr>
                </tbody>
            </table>
            <blockquote>
                응답 속도 자체는 ON이 느림 — 서버가 빈 연석을 실시간으로 계산해 배정하기 때문.
                반면 OFF는 <strong>빠르지만 38.2%만 성공</strong>해서 실질 체감은 ON이 더 좋음
                (재시도 · 이선좌 · 네트워크 왕복 제거).
            </blockquote>

            <hr />

            <h2>4. 해석</h2>

            <h3>왜 OFF는 38.2%만 성공하는가</h3>
            <ul>
                <li><strong>1,000명이 같은 좌석맵을 보고 클릭</strong>하면 인기 좌석에 트래픽이 집중</li>
                <li>먼저 클릭한 사람이 분산락을 선점 → 나머지 요청은 409 반환</li>
                <li>네트워크가 빠른 VU에 유리 → <strong>구조적 불공정</strong></li>
                <li>실제 서비스에서는 재시도 로직으로 최종 성공률을 끌어올리지만, 매 재시도마다 RTT와 DB 부하가 누적</li>
            </ul>

            <h3>왜 ON은 0건 경합인가</h3>
            <ul>
                <li><strong>블럭 단위 분산 락</strong>으로 블럭에 1명씩 순차 진입</li>
                <li>서버가 블럭 내 <strong>빈 연석(연속석)을 실시간 계산</strong>해 자동 배정</li>
                <li>두 유저가 같은 좌석을 받을 수 없는 구조 → 경합 자체가 발생하지 않음</li>
                <li>네트워크 속도와 무관하게 <strong>공정한 분배</strong></li>
            </ul>

            <hr />

            <h2>5. 결론</h2>
            <blockquote>
                <p>
                    추천 ON은 응답 속도는 OFF보다 느리지만,
                    <strong> 좌석 확정 성공률 38.2% → 100%</strong>,
                    <strong> 경합 1,236건 → 0건</strong>으로
                    티켓팅 경합 문제를 구조적으로 해결했습니다.
                </p>
                <p>
                    사용자는 <strong>한 번의 요청으로 좌석을 확정</strong>받고,
                    서버는 <strong>재시도 트래픽 없이 안정적인 처리량</strong>을 확보합니다.
                </p>
            </blockquote>
        </DocPageLayout>
    );
}
