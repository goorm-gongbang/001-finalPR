import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="security" title="봇 대응 체계">
            <h1>봇 대응 체계</h1>
            <p>
                단시간에 대규모 동시 접속이 몰리는 티켓팅 특성상, 자동화 봇과 매크로 대응이 서비스 공정성의 핵심입니다.
                인프라 계층의 Rate Limiting과 AI 기반 행동 분석을 결합해 다층으로 봇을 탐지하고 차단합니다.
            </p>

            <hr />

            <h2>계층별 봇 대응</h2>

            <h3>1계층: CDN (CloudFront + AWS Shield)</h3>
            <ul>
                <li>AWS Shield Standard로 인프라 레벨 DDoS 자동 완화</li>
                <li>IP 평판 필터를 통해 알려진 악성 IP 사전 차단</li>
            </ul>

            <h3>2계층: Istio Rate Limiting</h3>
            <ul>
                <li>결제/예매 API에 보수적 요청 제한 적용 (429 Too Many Requests 즉시 반환)</li>
                <li>동일 IP/세션의 단시간 과도 요청을 Ingress Gateway 수준에서 차단</li>
            </ul>

            <h3>3계층: AI Defense (행동 기반 탐지)</h3>
            <table>
                <thead><tr><th>위험 티어</th><th>판단 기준</th><th>대응</th></tr></thead>
                <tbody>
                    <tr><td><strong>T0~T1 (사람)</strong></td><td>정상 마우스 궤적, 자연스러운 체류 시간</td><td>즉시 통과</td></tr>
                    <tr><td><strong>T2 (의심 봇)</strong></td><td>기계적으로 일정한 클릭 주기, 직선 궤적</td><td>고의적 응답 지연 (50~500ms)</td></tr>
                    <tr><td><strong>T3 (악성 봇)</strong></td><td>완전 인위적 좌표 직행, 식별된 IP</td><td>Envoy 단 403 차단</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>대기열 우회 방지</h2>
            <ul>
                <li><strong>Admission Token</strong>: 30초 TTL의 일회용 토큰. 복사/재사용 불가</li>
                <li><strong>Seat Hold 검증</strong>: 좌석 선택 후 주문 생성 시 Hold 토큰 재검증</li>
                <li><strong>AI 사후 분석</strong>: 대기열 통과 후에도 행동 데이터를 수집해 계정 제재</li>
            </ul>
        </DocPageLayout>
    );
}
