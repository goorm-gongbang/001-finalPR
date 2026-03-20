import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="ai" title="AI 방어 개요">
            <h1>AI 방어 개요</h1>
            <p>
                티켓팅 시스템의 봇 방어는 딜레마를 가집니다. 모든 트래픽을 검사하면 서버가 마비되고
                정상 사용자의 결제가 지연됩니다. 반대로 검사를 생략하면 정교한 봇을 차단할 수 없습니다.
            </p>
            <p>
                AI팀은 이 문제를 <strong>경로 선택적 하이브리드 아키텍처</strong>로 해결합니다.
                중요 API만 실시간으로 검사하고, 단순한 요청은 검사 없이 통과시키는 대신
                백그라운드에서 행동 데이터를 수집합니다.
            </p>

            <hr />

            <h2>AI 방어 구성 요소</h2>
            <table>
                <thead><tr><th>구성</th><th>역할</th><th>기술</th></tr></thead>
                <tbody>
                    <tr><td><strong>Attack Agent (Red Team)</strong></td><td>방어 시스템을 검증하기 위한 자체 공격 봇</td><td>LangGraph, Playwright</td></tr>
                    <tr><td><strong>Hybrid Architecture</strong></td><td>트래픽을 중요도에 따라 분기하는 라우팅 구조</td><td>Istio Envoy, ext_authz</td></tr>
                    <tr><td><strong>Telemetry</strong></td><td>프론트엔드에서 행동 데이터를 수집하는 센서</td><td>HTTP Header / Body 분리 전송</td></tr>
                    <tr><td><strong>Runtime Detection</strong></td><td>실시간 봇 스코어링 및 제어</td><td>EWMA, Redis, T0~T3 티어링</td></tr>
                    <tr><td><strong>Control Plane</strong></td><td>사후 AI 분석 결과를 인프라/백엔드에 하달</td><td>S3 Data Lake, Istio Adapter</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>방어 vs 성능 트레이드오프 해결</h2>
            <table>
                <thead><tr><th>문제</th><th>해결책</th></tr></thead>
                <tbody>
                    <tr><td>모든 트래픽 AI 검사 → 서버 부하 + UX 지연</td><td>중요 API만 선택적(Targeted)으로 실시간 검사</td></tr>
                    <tr><td>정적 룰은 쉽게 우회 / LLM은 실시간 적용 불가</td><td>초경량 수학 통계(실시간) + 대형 LLM(사후 분석) 분리</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
