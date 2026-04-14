import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="개요">
            <h1>백엔드 개요</h1>
            <p>
                백엔드팀은 두 가지 목표를 중심으로 시스템을 구축했습니다.
                <strong>MSA 기반의 티켓팅 시스템</strong>으로 대기열부터 결제까지 전체 플로우를 안정적으로 처리하는 것,
                그리고 <strong>추천 좌석 배정 알고리즘</strong>으로 사용자 취향을 반영한 연석 배정을 보장하는 것입니다.
            </p>

            <hr />

            <h2>구현 현황</h2>
            <table>
                <thead><tr><th>구분</th><th>내용</th><th>상태</th></tr></thead>
                <tbody>
                    <tr><td><strong>MSA 아키텍처</strong></td><td>5개 서비스 + API Gateway + 공통 모듈</td><td>✅ 완료</td></tr>
                    <tr><td><strong>인증/인가</strong></td><td>JWT RSA-256 + API Gateway 중앙화</td><td>✅ 완료</td></tr>
                    <tr><td><strong>좌석 추천/배정</strong></td><td>연석 탐색 + 선호도 점수 + 분산 락</td><td>✅ 완료</td></tr>
                    <tr><td><strong>주문/결제</strong></td><td>Hold 검증 + Mock 결제 + 마이페이지</td><td>✅ 완료</td></tr>
                    <tr><td><strong>대기열</strong></td><td>Redis ZSET 기반 대기열 + Admission Token</td><td>🔧 진행 중</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>서비스 구성</h2>
            <table>
                <thead><tr><th>서비스</th><th>포트</th><th>핵심 책임</th></tr></thead>
                <tbody>
                    <tr><td><strong>API-Gateway</strong></td><td>8085</td><td>JWT 중앙 검증 (RSA 공개키), 라우팅, CORS, Swagger 통합</td></tr>
                    <tr><td><strong>Auth-Guard</strong></td><td>8080</td><td>Kakao OAuth, JWT 발급/갱신(RTR), 로그아웃/블랙리스트, 회원 탈퇴</td></tr>
                    <tr><td><strong>Queue</strong></td><td>8081</td><td>대기열 진입/폴링, Admission Token 발급, 선호도 저장</td></tr>
                    <tr><td><strong>Seat</strong></td><td>8082</td><td>좌석맵, 추천 블록 계산, 연석/준연석 배정, 분산 락 Hold</td></tr>
                    <tr><td><strong>Order-Core</strong></td><td>8083</td><td>주문 생성, Mock 결제, 마이페이지, 온보딩, 경기/구단 조회</td></tr>
                    <tr><td><strong>common-core</strong></td><td>—</td><td>공통 엔티티, 인증 필터, 설정, 예외 처리 (공유 라이브러리)</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>향후 계획</h2>
            <table>
                <thead><tr><th>상태</th><th>작업</th></tr></thead>
                <tbody>
                    <tr><td>🔧 진행 중</td><td>Queue Controller / Service</td></tr>
                    <tr><td>🔧 진행 중</td><td>일반 좌석 선택 플로우</td></tr>
                    <tr><td>🔧 진행 중</td><td>주문 취소 / 환불 처리</td></tr>
                    <tr><td>📋 확장 예정</td><td>Kafka 이벤트 비동기 처리</td></tr>
                    <tr><td>📋 확장 예정</td><td>Redis 이중 인스턴스 배포</td></tr>
                    <tr><td>📋 확장 예정</td><td>실시간 좌석 상태 브로드캐스트</td></tr>
                    <tr><td>📋 확장 예정</td><td>QR 입장권 발급 / 부하 테스트</td></tr>
                </tbody>
            </table>
        </DocPageLayout>
    );
}
