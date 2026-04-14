import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="security" title="클라이언트 보안">
            <h1>클라이언트 보안</h1>
            <p>
                프론트엔드 코드와 클라이언트 환경 자체를 보호합니다.
                JavaScript 코드 분석을 어렵게 만들어 API 구조 노출을 최소화하고,
                CI 파이프라인에 정적 분석을 도입해 개발 단계부터 보안 취약점을 통제합니다.
            </p>

            <hr />

            <h2>JavaScript 난독화 (Obfuscation)</h2>
            <table>
                <thead><tr><th>옵션</th><th>설명</th></tr></thead>
                <tbody>
                    <tr><td><strong>compact</strong></td><td>코드를 한 줄로 압축해 가독성 제거</td></tr>
                    <tr><td><strong>string-array</strong></td><td>문자열 리터럴을 배열 참조로 변환</td></tr>
                    <tr><td><strong>base64 인코딩</strong></td><td>문자열 배열을 Base64로 인코딩</td></tr>
                    <tr><td><strong>변수/함수 이름 변환</strong></td><td>의미 있는 식별자를 무작위 문자열로 치환</td></tr>
                    <tr><td><strong>코드 흐름 난독화</strong></td><td>제어 흐름을 복잡하게 변환해 역분석 어렵게 만듦</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>SAST (정적 소스 코드 분석)</h2>
            <p>CI 파이프라인에 SAST 도구를 도입해 코드 변경 시마다 자동으로 보안 취약점을 검열합니다.</p>
            <ul>
                <li><strong>Merge 게이트</strong>: 룰셋을 위반하는 코드는 병합(Merge)이 강제로 실패</li>
                <li><strong>개발 초기 단계 통제</strong>: 코드 리뷰 이전에 기계적으로 보안 위협을 차단</li>
                <li><strong>가이드라인 연동</strong>: 공식 보안 가이드라인을 SAST 룰셋으로 등록해 자동 강제화</li>
            </ul>

            <hr />

            <h2>보안 가이드라인 정식화</h2>
            <p>제정된 보안 개발 가이드라인은 내부 기술 아키텍처 문서에 공식 지침으로 등록되어 모든 팀이 동일한 기준을 따릅니다.</p>
            <ul>
                <li><strong>인증/인가</strong>: JWT 처리, 토큰 저장 위치, 만료 처리 가이드</li>
                <li><strong>API 설계</strong>: 파라미터 검증, 에러 메시지 노출 방지</li>
                <li><strong>의존성 관리</strong>: 취약한 npm 패키지 사용 금지 목록</li>
            </ul>
        </DocPageLayout>
    );
}
