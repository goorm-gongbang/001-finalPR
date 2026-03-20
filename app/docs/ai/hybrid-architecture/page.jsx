import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="ai" title="하이브리드 아키텍처">
            <h1>하이브리드 아키텍처</h1>
            <p>
                핵심은 <strong>선택과 집중</strong>입니다. 결제/예매 같은 중요 API는 실시간 동기 검사를 수행하고,
                단순 콘텐츠 조회는 검사 없이 즉시 통과시킵니다.
            </p>

            <hr />

            <h2>트래픽 분기 구조</h2>
            <table>
                <thead><tr><th>경로</th><th>대상</th><th>검사 방식</th><th>특징</th></tr></thead>
                <tbody>
                    <tr>
                        <td><strong>Fast Path (동기)</strong></td>
                        <td><code>/payments</code>, <code>/tickets</code> 등</td>
                        <td>실시간 런타임 방어</td>
                        <td>티켓 탈취 전 즉각 차단. Envoy <code>ext_authz</code> 연동</td>
                    </tr>
                    <tr>
                        <td><strong>Bypass Path (비동기)</strong></td>
                        <td><code>/assets/</code>, 홈 화면 조회 등</td>
                        <td>검사 생략 + 데이터 수집</td>
                        <td>정상 유저 UX 0ms 지연 보장. 백그라운드 행동 데이터 수집</td>
                    </tr>
                    <tr>
                        <td><strong>Control Plane</strong></td>
                        <td>사후 분석 완료 대상 (봇)</td>
                        <td>인프라/백엔드 차단 룰 하달</td>
                        <td>AI가 WAF 블랙리스트 갱신 및 토큰 무효화 명령</td>
                    </tr>
                </tbody>
            </table>

            <hr />

            <h2>설계 원칙</h2>
            <p>
                <strong>Fast Path</strong>는 결제 등 한 번의 기회가 중요한 API에만 적용합니다.
                검사 지연이 발생하더라도 반드시 막아야 하는 구간입니다.
            </p>
            <p>
                <strong>Bypass Path</strong>는 검사 없이 통과시켜 서버 부하를 0으로 만드는 대신,
                모든 요청의 행동 데이터를 S3에 조용히 수집합니다. 이 데이터가 오프라인 AI 학습의 원료가 됩니다.
            </p>
            <p>
                <strong>Control Plane</strong>은 AI가 판별만 담당하고, 실제 집행은 각 시스템이 수행하는
                관심사 분리 원칙을 지킵니다.
            </p>
        </DocPageLayout>
    );
}
