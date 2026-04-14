import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="ai" title="텔레메트리">
            <h1>텔레메트리</h1>
            <p>
                프론트엔드 센서가 수집하는 마우스/키보드 행동 데이터를 두 채널로 분리해서 전송합니다.
                실시간 검사용 압축 요약 수치는 HTTP 헤더로,
                오프라인 AI 학습용 원본 좌표 데이터는 전용 API의 HTTP 바디로 전송합니다.
            </p>

            <hr />

            <h2>데이터 분리 비교</h2>
            <table>
                <thead><tr><th>항목</th><th>Fast Path (실시간 동기용)</th><th>Bypass Path (사후 비동기용)</th></tr></thead>
                <tbody>
                    <tr><td><strong>데이터 사이즈</strong></td><td>초경량 (직선성, 체류시간 등 8개 압축 수치)</td><td>매우 무거움 (수백~수천 개의 원시 x, y 좌표 배열)</td></tr>
                    <tr><td><strong>전송 시점</strong></td><td>결제 등 중요 API 호출 시 헤더에 기생(piggyback) 전송</td><td>5초 간격 또는 화면 이탈 시 단독 전송</td></tr>
                    <tr><td><strong>수신 주체</strong></td><td>Istio Envoy가 가로채어 AI 서버로 릴레이</td><td>텔레메트리 수집 전용 백엔드(S3/DB)로 전달</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>설계 이유</h2>
            <p>
                결제 API마다 수천 개의 좌표 배열을 바디에 실어 보내면 파싱 부하가 생기고,
                백엔드 API 스펙이 AI 방어 로직에 오염됩니다.
            </p>
            <p>
                그래서 프론트엔드에서 자체적으로 8개의 요약 수치를 계산한 뒤 HTTP 헤더(<code>x-defense-features</code>)에 실어 보냅니다.
                <strong>백엔드는 이 사실을 몰라도 됩니다.</strong> Envoy가 헤더를 가로채어 AI 서버로 릴레이하기 때문입니다.
            </p>
        </DocPageLayout>
    );
}
