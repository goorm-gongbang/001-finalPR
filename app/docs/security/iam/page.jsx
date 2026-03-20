import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="security" title="IAM 접근 제어">
            <h1>IAM 접근 제어</h1>
            <p>
                운영 클라우드 환경의 접근 권한을 세분화하여 관리합니다.
                관리 계정 탈취나 권한 남용이 전체 서비스 붕괴(SPOF)로 번지지 않도록
                RBAC(역할 기반 접근 제어) 모델을 설계했습니다.
            </p>

            <hr />

            <h2>역할별 권한 설계</h2>
            <table>
                <thead><tr><th>역할</th><th>허용 권한</th><th>제한 이유</th></tr></thead>
                <tbody>
                    <tr><td><strong>관리자</strong></td><td>EKS, RDS, Redis 생성/수정/삭제</td><td>최소 인원에게만 부여, MFA 강제</td></tr>
                    <tr><td><strong>개발자</strong></td><td>CloudWatch 로그 조회, kubectl exec (제한 네임스페이스)</td><td>운영 데이터 직접 접근 차단</td></tr>
                    <tr><td><strong>Read-Only</strong></td><td>리소스 상태 조회만</td><td>변경 작업 불가</td></tr>
                    <tr><td><strong>CI/CD</strong></td><td>ECR 이미지 Push, EKS 특정 Deployment 업데이트만</td><td>파이프라인 전용 최소 권한</td></tr>
                </tbody>
            </table>

            <hr />

            <h2>접근 제어 정책</h2>

            <h3>MFA 강제화</h3>
            <p>관리자 역할과 AWS 콘솔 접근 시 MFA를 필수로 요구합니다. MFA 없이 접근 시 Deny 정책이 먼저 적용됩니다.</p>

            <h3>자격증명 자동 순환</h3>
            <ul>
                <li>IRSA(IAM Role for Service Account)로 임시 토큰 자동 발급</li>
                <li>장기 Access Key 사용 금지</li>
                <li>키 유출 시 즉시 폐기 가능한 토큰 기반 인증 채택</li>
            </ul>

            <h3>접근 이력 감사</h3>
            <ul>
                <li><strong>CloudTrail</strong>: 모든 AWS API 호출을 S3에 기록</li>
                <li><strong>보관 기간</strong>: 일반 감사 로그 400일, 개인정보처리시스템 접속 기록 2년</li>
                <li><strong>EventBridge + SNS</strong>: 이상 접근 탐지 시 Discord 즉시 알림</li>
            </ul>
        </DocPageLayout>
    );
}
