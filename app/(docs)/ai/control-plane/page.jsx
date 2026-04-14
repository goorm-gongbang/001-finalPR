import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="ai" title="Control Plane">
            <h1>Control Plane</h1>
            <p>
                실시간 방어망을 통과한 신종 봇들은 결국 S3 Data Lake에 방대한 행동 데이터를 남깁니다.
                오프라인 AI 파이프라인이 이 데이터를 분석해 새로운 봇 패턴을 탐지하고,
                탐지 결과를 인프라 계층과 비즈니스 계층에 자동으로 하달합니다.
            </p>

            <hr />

            <h2>제어 정책</h2>
            <table>
                <thead><tr><th>제어 정책</th><th>타겟</th><th>작용 방식</th><th>목적</th></tr></thead>
                <tbody>
                    <tr>
                        <td><strong>인프라 락 (Lock)</strong></td>
                        <td>Istio Adapter & WAF</td>
                        <td>API 통신으로 IP 블랙리스트 즉시 캐싱 갱신</td>
                        <td>반복 공격을 첫 번째 관문에서 최소 비용으로 영구 차단</td>
                    </tr>
                    <tr>
                        <td><strong>비즈니스 락 (Lock)</strong></td>
                        <td>Backend API (Spring Boot)</td>
                        <td>봇 판정 세션 ID 전송 (멱등성 보장 API)</td>
                        <td>이미 티켓을 점유한 악성 유저의 세션 종료 및 재고 회수</td>
                    </tr>
                </tbody>
            </table>

            <hr />

            <h2>관심사 분리 원칙</h2>
            <p>AI 시스템은 <strong>판별만 담당</strong>합니다. 실제 제재 집행은 각 도메인 시스템이 주도합니다.</p>
            <ul>
                <li><strong>인프라 계층</strong> (Istio/WAF): IP 레벨 차단, 네트워크 접근 제한</li>
                <li><strong>비즈니스 계층</strong> (Backend API): 사용자 계정 세션 종료, 보유 티켓 회수</li>
            </ul>
            <p>
                이를 통해 AI 방어 시스템이 인프라나 백엔드 코드에 직접 침투하지 않으면서도,
                전체 시스템에 걸쳐 일관된 제재를 적용할 수 있습니다.
            </p>
        </DocPageLayout>
    );
}
