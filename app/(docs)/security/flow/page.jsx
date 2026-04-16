import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="security" title="보안 흐름">
            <h1>보안 흐름</h1>
            <p>
                외부에서 내부 서비스까지 모든 트래픽은 4개의 보안 계층을 순서대로 통과합니다.
                각 계층은 서로 다른 위협을 전담하며, 단일 장비의 실패가 전체 시스템 붕괴로 이어지지 않는
                심층 방어(Defense in Depth) 구조를 형성합니다.
            </p>

            <hr />

            <h2>전체 보안 계층 구조</h2>
            <table>
                <thead><tr><th>계층</th><th>도구</th><th>역할</th><th>상태</th></tr></thead>
                <tbody>
                    <tr><td><strong>CDN / Edge</strong></td><td>CloudFront + AWS Shield</td><td>DDoS 방어, Origin IP 숨김, 정적 자원 캐시</td><td>✅ 완료</td></tr>
                    <tr><td><strong>NLB / ALB</strong></td><td>AWS ALB + Security Group</td><td>CDN IP만 허용, 외부 직접 접근 차단</td><td>✅ 완료</td></tr>
                    <tr><td><strong>Istio Gateway</strong></td><td>Lua WAF + mTLS + Rate Limit</td><td>WAF, 서비스 간 암호화, 과도한 요청 제한</td><td>✅ 완료</td></tr>
                    <tr><td><strong>애플리케이션</strong></td><td>JWT + AI Defense</td><td>인증/인가, 행동 기반 봇 탐지</td><td>🔧 개발 중</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>각 계층 상세</h2>

            <h3>CDN / Edge 계층 (1차 방어선)</h3>
            <p>
                전 세계에 분산된 CloudFront 인프라로 모든 요청을 수용합니다.
                AWS의 물리적 글로벌 대역폭으로 DDoS를 효과적으로 완화하고,
                Origin 서버의 실제 IP를 숨겨 직접 공격을 원천 차단합니다.
            </p>

            <h3>ALB / 보안 그룹 (2차 방어선)</h3>
            <p>
                CloudFront를 우회한 직접 접근을 차단합니다.
                보안 그룹에 CloudFront 전용 Managed Prefix List를 강제 참조하도록 설정해,
                인가되지 않은 외부 IP의 직접 접근을 완전 거부(Drop)합니다.
            </p>

            <h3>Istio Ingress Gateway (3차 방어선)</h3>
            <ul>
                <li><strong>Lua WAF</strong>: SQL Injection, XSS 등 웹 공격 차단 (자체 구현, 비용 $0)</li>
                <li><strong>Rate Limiting</strong>: 좌석 조회는 높은 허용치, 결제/예매는 429 즉시 반환</li>
                <li><strong>mTLS</strong>: 서비스 간 내부 통신 전체를 상호 인증 + 암호화</li>
            </ul>

            <h3>애플리케이션 계층 (4차 방어선)</h3>
            <ul>
                <li><strong>JWT 검증</strong>: API Gateway에서 RSA-256 서명 기반 중앙 검증</li>
                <li><strong>AI Defense</strong>: 행동 기반 실시간 봇 탐지 및 차단</li>
            </ul>
        </DocPageLayout>
    );
}
