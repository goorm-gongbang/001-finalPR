import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="infrastructure" title="환경 구성">
            <h1>환경 구성</h1>
            <p>
                인프라팀은 Dev, Staging, Prod 세 가지 환경을 목적에 따라 분리하여 구성했습니다.
                Dev에서 기능을 개발하고, Staging에서 운영 환경과 동일한 구성으로 검증한 뒤, Prod로 배포합니다.
            </p>

            <hr />

            <h2>환경 개요</h2>
            <table>
                <thead><tr><th>환경</th><th>인프라</th><th>목적</th><th>상태</th></tr></thead>
                <tbody>
                    <tr><td><strong>Dev</strong></td><td>kubeadm (MiniPC 2대)</td><td>서비스 개발, 기능 테스트</td><td>✅ 완료</td></tr>
                    <tr><td><strong>Staging</strong></td><td>AWS EKS</td><td>QA, 부하테스트, 보안테스트</td><td>✅ 완료</td></tr>
                    <tr><td><strong>Prod</strong></td><td>AWS EKS (고가용성)</td><td>실제 운영</td><td>📋 설계 단계</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>Dev 환경</h2>
            <p>
                On-Premise MiniPC 2대에 kubeadm으로 Kubernetes 클러스터를 구성했습니다.
                로컬 개발 환경으로 사용하며, 기능 단위 테스트와 초기 통합 검증을 진행합니다.
            </p>

            <h2>Staging 환경</h2>
            <p>AWS EKS로 구성한 검증 환경입니다. Prod와 동일한 구성을 유지하여 실제 배포 전 최종 검증을 수행합니다.</p>
            <ul>
                <li><strong>QA</strong>: 기능 시나리오 전체 검증</li>
                <li><strong>부하 테스트</strong>: 티켓팅 오픈 시나리오 기준 동시 접속 부하 테스트</li>
                <li><strong>보안 테스트</strong>: Istio WAF, mTLS, AI 방어 시스템 검증</li>
            </ul>
        </DocPageLayout>
    );
}
