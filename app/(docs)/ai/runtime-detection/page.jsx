import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="ai" title="런타임 탐지">
            <h1>런타임 탐지</h1>
            <p>
                Envoy가 헤더로 전달한 텔레메트리 요약 수치를 실시간으로 분석해 사용자의 위험 티어를 산정합니다.
                무작위 캡챠 대신, 티어에 따라 보이지 않게 제어하는 <strong>비가시적(Invisible)</strong> 방어 전략을 채택했습니다.
            </p>

            <hr />

            <h2>위험 티어 분류</h2>
            <table>
                <thead><tr><th>티어</th><th>판단 기준</th><th>런타임 방어 액션</th><th>효과</th></tr></thead>
                <tbody>
                    <tr>
                        <td><strong>T0~T1 (사람)</strong></td>
                        <td>정상 범위의 떨림, 마우스 체류 시간</td>
                        <td>ALLOW (정상 통과)</td>
                        <td>UX 저하 0%. 밀리초 단위로 백엔드 API 정상 호출</td>
                    </tr>
                    <tr>
                        <td><strong>T2 (의심 봇)</strong></td>
                        <td>기계적으로 일정한 클릭 주기 및 궤적</td>
                        <td>THROTTLE (동적 속도 지연)</td>
                        <td>UI에는 정상처럼 보이나, 응답을 고의로 늦춰 매크로의 선점 효율 무력화</td>
                    </tr>
                    <tr>
                        <td><strong>T3 (위험 봇)</strong></td>
                        <td>완전히 인위적인 좌표 직행, 식별된 IP</td>
                        <td>BLOCK (원천 차단)</td>
                        <td>Envoy 단에서 즉시 Connection 강제 종료 (403). 백엔드 부하 0</td>
                    </tr>
                </tbody>
            </table>

            <hr />

            <h2>비가시적 방어 전략</h2>
            <p>
                일반적인 캡챠 방식은 정상 사용자에게도 불편함을 줍니다. 티켓팅 필수 관문인 VQA 미션은
                모든 사용자가 동일하게 거치는 1회성 고정 관문으로 분리하고,
                이후에는 <strong>사용자가 인식하지 못하는 형태로 제어</strong>합니다.
            </p>
            <ul>
                <li>T2 봇은 에러나 팝업 없이, 단지 응답이 수백 ms 느리게 옵니다. 표를 선점할 수 없게 됩니다.</li>
                <li>T3 봇은 백엔드 서버와 커넥션조차 맺지 못하고 Envoy에서 즉시 차단됩니다.</li>
            </ul>
        </DocPageLayout>
    );
}
