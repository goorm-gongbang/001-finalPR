import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="infrastructure" title="장애 대응">
            <h1>장애 대응</h1>
            <p>
                Prod 환경은 Multi-AZ 구성으로 EKS 노드, RDS, Redis를 모두 2개의 Availability Zone에 분산합니다.
                한쪽 AZ에 장애가 발생해도 다른 쪽이 서비스를 이어받아 중단 없이 운영됩니다.
            </p>

            <hr />

            <h2>장애 대응 (Failover)</h2>
            <table>
                <thead><tr><th>계층</th><th>장애 시 동작</th><th>복구 시간</th><th>데이터 손실</th></tr></thead>
                <tbody>
                    <tr><td><strong>EKS</strong></td><td>다른 AZ Pod 처리 + Kubernetes self-healing</td><td>즉시~수분</td><td>없음</td></tr>
                    <tr><td><strong>RDS</strong></td><td>Standby 자동 승격, 필요 시 PITR/스냅샷 복구</td><td>자동 Failover 약 2분</td><td>없음 또는 최소화</td></tr>
                    <tr><td><strong>Redis</strong></td><td>Replica 승격 기반 복구</td><td>수초~수분</td><td>최소</td></tr>
                </tbody>
            </table>
            <p>
                Pod는 Kubernetes self-healing과 컨테이너 이미지, Helm values, GitOps 이력으로 복구합니다.
                RDS는 시점 복구(PITR) 기능으로 특정 시각으로의 복구가 가능합니다.
            </p>

            <hr />

            <h2>백업 및 로그 보관 전략</h2>
            <table>
                <thead><tr><th>대상</th><th>전략</th><th>보관 기간</th></tr></thead>
                <tbody>
                    <tr><td><strong>RDS</strong></td><td>Automated Backup + PITR</td><td>35일</td></tr>
                    <tr><td><strong>수동 스냅샷</strong></td><td>릴리즈/스키마 변경 전 생성</td><td>stg 7일 / prod 30일</td></tr>
                    <tr><td><strong>운영 로그</strong></td><td>Loki + S3 Warm</td><td>14일</td></tr>
                    <tr><td><strong>결제/예매 로그</strong></td><td>Loki + S3 Warm</td><td>Hot 30일 + Warm 90일</td></tr>
                    <tr><td><strong>일반 감사로그</strong></td><td>S3 → Glacier Flexible Retrieval</td><td>총 400일</td></tr>
                    <tr><td><strong>개인정보 접속기록</strong></td><td>S3 → Glacier Flexible Retrieval</td><td>총 2년</td></tr>
                    <tr><td><strong>회원/CS 증적</strong></td><td>S3 → Deep Archive</td><td>총 3년</td></tr>
                    <tr><td><strong>주문/결제/정산 증적</strong></td><td>S3 → Deep Archive</td><td>총 5년</td></tr>
                    <tr><td><strong>Helm Values</strong></td><td>GitOps</td><td>무제한</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
