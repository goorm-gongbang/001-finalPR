import { DocPageLayout } from "@/components/docs/DocPageLayout";
import Link from "next/link";

export default function Page() {
    return (
        <DocPageLayout category="development" title="부하테스트">
            <h1>부하테스트 (3일차 통합)</h1>
            <p>
                2026-04-14 ~ 2026-04-16, 3일간 진행한 백엔드 MSA 전 서비스 부하테스트와 단계별 최적화 전 과정입니다.
                AS-IS 상태에서 발견된 <strong>503 에러</strong>의 진짜 원인을 파고들어, DB 인스턴스 업그레이드 없이
                코드·인프라 레벨에서 <strong>Queue Flow P99를 6,887ms에서 65ms로 개선</strong>한 여정입니다.
            </p>

            <hr />

            <h2>핵심 한 줄 요약</h2>
            <blockquote>
                <p>
                    <strong>DB 인스턴스 업그레이드(돈)로 해결할 수도 있었지만, 원인을 파고드니 사양 문제가 아니라
                    앱이 쿼리를 너무 많이 보내는 문제였다. 그래서 앱단 최적화로 해결했다.</strong>
                </p>
            </blockquote>

            <table>
                <thead><tr><th>구간</th><th>Seat P99</th><th>DB 커넥션 peak</th><th>비용</th></tr></thead>
                <tbody>
                    <tr><td><strong>AS-IS (Phase 0)</strong></td><td>6,887ms</td><td>270 (한계)</td><td>—</td></tr>
                    <tr><td>Phase 1 (Caffeine 도입)</td><td>~2,000ms</td><td>180</td><td>0원</td></tr>
                    <tr><td>Phase 1 확대 (Multi-Service)</td><td>~1,200ms</td><td>150</td><td>0원</td></tr>
                    <tr><td>Phase 2 (Redis 분산 캐시)</td><td>~900ms</td><td>120</td><td>0원</td></tr>
                    <tr><td>Phase 3 (응답 캐시 + 인프라)</td><td>~600ms</td><td>120</td><td>0원</td></tr>
                    <tr><td><strong>Phase 4 (OSIV/Lua/Resilience4j)</strong></td><td><strong>65ms</strong></td><td>100</td><td>0원</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>문서 구성</h2>
            <table>
                <thead><tr><th>#</th><th>문서</th><th>내용</th></tr></thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td><Link href="/development/load-test/overview">부하테스트 개요</Link></td>
                        <td>테스트 환경, 인프라 스펙, 측정 메트릭, k6 Flow 설명</td>
                    </tr>
                    <tr>
                        <td>2</td>
                        <td><Link href="/development/load-test/scenarios">테스트 시나리오 Flow</Link></td>
                        <td>각 Flow(queue/seat/recommendation/order)가 호출하는 엔드포인트 조합</td>
                    </tr>
                    <tr>
                        <td>3</td>
                        <td><Link href="/development/load-test/tech-terms">기술 용어 해설</Link></td>
                        <td>HikariCP / Caffeine / Redis / OSIV / Resilience4j 등 핵심 개념</td>
                    </tr>
                    <tr>
                        <td>4</td>
                        <td><Link href="/development/load-test/phases">Phase별 최적화 타임라인</Link></td>
                        <td>AS-IS → Phase 1~4 → TO-BE 단계별 작업 내용과 결과</td>
                    </tr>
                    <tr>
                        <td>5</td>
                        <td><Link href="/development/load-test/results">테스트별 결과 요약</Link></td>
                        <td>01~21번 폴더의 각 테스트 결과 표/수치 정리</td>
                    </tr>
                    <tr>
                        <td>6</td>
                        <td><Link href="/development/load-test/503-story">503 트러블슈팅 핵심 스토리</Link></td>
                        <td>"DB가 한가한데 왜 503?" — 커넥션 풀 병목의 진짜 원인</td>
                    </tr>
                    <tr>
                        <td>7</td>
                        <td><Link href="/development/load-test/comparison">Before/After 시각화 비교</Link></td>
                        <td><strong>각 Phase별 캡쳐 이미지와 수치 나란히 비교 (최종 증빙)</strong></td>
                    </tr>
                </tbody>
            </table>

            <hr />

            <h2>최종 측정치 (Phase 4 적용 후)</h2>

            <h3>큐 플로우 — 1,000 VU (booking-options + queue-enter)</h3>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>Avg</td><td><strong>36ms</strong></td></tr>
                    <tr><td>P95</td><td><strong>47ms</strong></td></tr>
                    <tr><td>P99</td><td><strong>65ms</strong></td></tr>
                    <tr><td>Error Rate</td><td><strong>0%</strong></td></tr>
                    <tr><td>503</td><td><strong>0건</strong></td></tr>
                </tbody>
            </table>

            <h3>추천 ON 플로우 — 1,000 VU (E2E)</h3>
            <table>
                <thead><tr><th>서비스</th><th>Requests</th><th>P95</th><th>P99</th></tr></thead>
                <tbody>
                    <tr><td>Queue</td><td>52,895</td><td>95ms</td><td>194ms</td></tr>
                    <tr><td>Seat</td><td>1,982</td><td>1.03s</td><td>1.23s</td></tr>
                </tbody>
            </table>

            <h3>추천 OFF (포도알) 플로우 — 1,000 VU</h3>
            <table>
                <thead><tr><th>메트릭</th><th>값</th></tr></thead>
                <tbody>
                    <tr><td>총 요청</td><td>60,316</td></tr>
                    <tr><td>Error Rate</td><td>0.0%</td></tr>
                    <tr><td>좌석 Hold 성공률</td><td>83.6% (VU 기준)</td></tr>
                    <tr><td>이선좌(409) 경합</td><td>114건 (정상 동시성 제어)</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
