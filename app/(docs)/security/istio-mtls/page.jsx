import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="security" title="Istio / mTLS">
            <h1>Istio / mTLS</h1>
            <p>
                Istio 서비스 메시를 활용해 서비스 간 내부 통신 전체에 Zero Trust 보안 관계를 구현합니다.
                외부에서 인증된 요청이라도 내부 서비스 간에는 서로를 암호화된 채널과 인증서로 다시 검증합니다.
            </p>

            <hr />

            <h2>mTLS 동작 원리</h2>
            <table>
                <thead><tr><th>단계</th><th>동작</th></tr></thead>
                <tbody>
                    <tr><td><strong>1. 인증서 발급</strong></td><td>Istiod가 각 Pod의 Sidecar에 X.509 인증서를 실시간으로 주입</td></tr>
                    <tr><td><strong>2. 상호 인증</strong></td><td>두 서비스가 서로의 인증서를 교차 검증해 신뢰 확인</td></tr>
                    <tr><td><strong>3. 암호화 통신</strong></td><td>검증 완료 후 TLS 암호화 채널로 데이터 전송</td></tr>
                    <tr><td><strong>4. 자동 갱신</strong></td><td>Istiod가 인증서 만료 전 자동 교체, 운영자 개입 불필요</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>Rate Limiting 정책</h2>
            <table>
                <thead><tr><th>API 유형</th><th>허용 정책</th><th>이유</th></tr></thead>
                <tbody>
                    <tr><td><strong>/seat/**</strong></td><td>높은 허용치</td><td>사용자 경험(UX)과 직결, 가용성 우선</td></tr>
                    <tr><td><strong>/payments, /orders</strong></td><td>보수적 제한</td><td>DB Lock 유발 가능, 429로 즉시 거부</td></tr>
                    <tr><td><strong>/queue/**</strong></td><td>중간 허용치</td><td>폴링 간격이 있어 부하 자연 분산</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>Coraza WAF</h2>
            <p>Istio Ingress Gateway에 Coraza WAF를 통합하여 웹 공격을 자체 구현으로 차단합니다.</p>
            <ul>
                <li><strong>차단 항목</strong>: SQL Injection, XSS, CSRF, 경로 순회(Path Traversal) 등 OWASP 주요 공격</li>
                <li><strong>비용</strong>: AWS WAF 대비 비용 $0 (자체 구현)</li>
                <li><strong>성능</strong>: Envoy 필터로 동작해 별도 홉 없이 처리</li>
            </ul>
        </DocPageLayout>
    );
}
