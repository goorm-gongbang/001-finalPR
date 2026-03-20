import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="infrastructure" title="모니터링">
            <h1>모니터링</h1>
            <p>
                EKS 내부는 Prometheus, Loki, Tempo로 메트릭, 로그, 트레이싱을 수집하고,
                Grafana로 통합 시각화합니다. 모든 알림은 Discord로 수신합니다.
            </p>

            <hr />

            <h2>모니터링 스택</h2>
            <table>
                <thead><tr><th>도구</th><th>역할</th><th>대상</th></tr></thead>
                <tbody>
                    <tr><td><strong>Prometheus</strong></td><td>메트릭 수집</td><td>CPU, Memory, 요청 수, 응답 시간</td></tr>
                    <tr><td><strong>Loki</strong></td><td>로그 수집</td><td>앱 로그, 에러 로그</td></tr>
                    <tr><td><strong>Tempo</strong></td><td>분산 트레이싱</td><td>요청 흐름 추적</td></tr>
                    <tr><td><strong>Grafana</strong></td><td>대시보드</td><td>통합 시각화</td></tr>
                    <tr><td><strong>Alertmanager</strong></td><td>EKS 내부 알람</td><td>임계치 기반 알림</td></tr>
                    <tr><td><strong>CloudWatch / EventBridge / SNS</strong></td><td>AWS 네이티브 알람</td><td>AWS 리소스, 보안 이벤트</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>주요 알람 설정</h2>
            <table>
                <thead><tr><th>알람</th><th>조건</th><th>심각도</th></tr></thead>
                <tbody>
                    <tr><td><strong>5xx 에러율 증가</strong></td><td>&gt; 1% (5분) / &gt; 3% (5분)</td><td>Warning / Critical</td></tr>
                    <tr><td><strong>응답 지연(P99)</strong></td><td>&gt; 3초 / &gt; 5초</td><td>Warning / Critical</td></tr>
                    <tr><td><strong>Pod CrashLoop</strong></td><td>재시작 &gt; 3회 (10분)</td><td>Critical</td></tr>
                    <tr><td><strong>Node NotReady</strong></td><td>Ready 아닌 노드 1개 이상 (5분)</td><td>Critical</td></tr>
                    <tr><td><strong>클러스터 CPU</strong></td><td>&gt; 65% / &gt; 80%</td><td>Warning / Critical</td></tr>
                    <tr><td><strong>클러스터 메모리</strong></td><td>&gt; 70% / &gt; 90%</td><td>Warning / Critical</td></tr>
                    <tr><td><strong>PostgreSQL 연결 포화</strong></td><td>&gt; 70% / &gt; 90%</td><td>Warning / Critical</td></tr>
                    <tr><td><strong>RDS 백업 상태 이상</strong></td><td>Backup 실패, PITR 비활성</td><td>Critical</td></tr>
                    <tr><td><strong>Redis 메모리 사용률</strong></td><td>&gt; 80% / &gt; 90%</td><td>Warning / Critical</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
