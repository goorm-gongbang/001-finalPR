import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="infrastructure" title="트래픽 대응">
            <h1>트래픽 대응</h1>
            <p>
                티켓팅 서비스는 오픈 시각에 트래픽이 순간적으로 집중됩니다.
                트래픽이 발생한 이후에 Pod를 확장하면 수십 초~1분의 지연이 생겨 사용자 경험이 크게 저하됩니다.
            </p>

            <hr />

            <h2>해결 전략: Pre-Warming</h2>
            <p>
                KEDA Cron 스케줄러를 활용해 티켓 오픈 <strong>10분 전에 Pod를 미리 확장</strong>합니다.
                11시 정각에는 이미 서버가 준비 완료된 상태로, 트래픽이 몰려도 응답 지연 없이 즉시 처리됩니다.
            </p>
            <ul>
                <li><strong>기존 방식</strong>: 트래픽 폭주 (11:00:00) → 확장 시작 (11:00:30) → 확장 완료 (11:01:00) — 수십 초~1분 지연</li>
                <li><strong>Pre-Warming</strong>: Pod 미리 확장 (10:50) → 준비 완료 (10:51) → 즉시 처리 (11:00)</li>
            </ul>

            <hr />

            <h2>확장 전략 조합</h2>
            <table>
                <thead><tr><th>전략</th><th>도구</th><th>효과</th></tr></thead>
                <tbody>
                    <tr><td><strong>Pre-Warming</strong></td><td>KEDA Cron</td><td>티켓 오픈 10분 전 미리 확장</td></tr>
                    <tr><td><strong>Pod 자동 확장</strong></td><td>HPA</td><td>실시간 부하 기반 Pod 증감</td></tr>
                    <tr><td><strong>Node 자동 확장</strong></td><td>Karpenter</td><td>노드 자동 증설로 피크 대응 (60초 내 추가)</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
