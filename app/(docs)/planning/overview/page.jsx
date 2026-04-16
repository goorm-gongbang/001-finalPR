import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
  return (
    <DocPageLayout category="planning" title="프로젝트 개요">
      <h1>프로젝트 개요</h1>
      <p>
        Playball(구 Traffic-Master)은 스포츠 티켓팅에서 발생하는{" "}
        <strong>
          좌석 핫스팟 전쟁을 '추천 기반 분산'으로 완화하여 좌석 선택 성공률을
          높이는 대규모 트래픽 제어 플랫폼
        </strong>
        입니다.
      </p>

      <hr />

      <h2>1. 배경 및 문제 정의</h2>
      <p>
        기존 티켓팅 시스템의 좌석 선택 단계는 다음과 같은 구조적 문제를 가지고
        있습니다.
      </p>
      <ol>
        <li>
          <strong>핫스팟 쏠림 현상 (Hotspot Traffic)</strong>
          <br />
          사용자들이 동일한 "최선호 구역/열/중앙부"를 동시에 클릭하면서 특정
          좌석에 트래픽이 집중되어 락 경합, 응답 지연, 예매 실패율 증가가
          발생합니다.
        </li>
        <li>
          <strong>사용자 경험 악화</strong>
          <br />
          "이선좌(이미 선택된 좌석입니다)" 메시지를 반복해서 겪게 되며 피로도와
          이탈률이 급증합니다.
        </li>
        <li>
          <strong>인프라 비효율</strong>
          <br />
          좌석 선택 단계의 병목은 단순한 서버 증설이나 대기열만으로는 근본적
          해결이 불가능합니다.
        </li>
        <li>
          <strong>매크로/봇의 악용</strong>
          <br />
          좌석 선택이 특정 좌표 클릭이라는 단순 반복 작업이 될수록 봇의 선점
          성공률이 높아져 정상 사용자가 피해를 봅니다.
        </li>
      </ol>

      <hr />

      <h2>2. 제품 비전 및 핵심 가치 (Why Us)</h2>
      <p>
        <strong>경쟁사</strong>가 대기열, 단순 서버 증설, 무작위 랜덤 배정 등
        트래픽을 그저 견디는 방식에 의존한다면,
        <strong>저희 팀</strong>은 좌석 선택의 수요 분포를 실시간으로 재형성하여{" "}
        <strong>병목 발생 구조 자체를 재설계</strong>합니다.
      </p>
      <ul>
        <li>
          <strong>사용자 가치</strong>: '최고의 단일 좌석'을 놓고 싸우는 대신,
          '자신의 취향에 맞는 좋은 연석'을 빠르게 추천받아{" "}
          <strong>예매 성공률 자체를 높입니다.</strong>
        </li>
        <li>
          <strong>주최자(B2B) 가치</strong>: 서버 장애와 매크로로 인한 CS/환불을
          획기적으로 줄여 운영 신뢰성을 확보합니다.
        </li>
        <li>
          <strong>플랫폼 가치</strong>: 핫스팟 경합을 분산시켜 전체 시스템의
          레이턴시와 인프라 비용을 절감합니다.
        </li>
      </ul>

      <hr />

      <h2>3. 핵심 사용자 시나리오 (To-Be)</h2>
      <ul>
        <li>
          좌석맵 진입 즉시{" "}
          <strong>내 취향에 맞는 추천 블록 목록(최대 10개)</strong> 노출
        </li>
        <li>
          각 블록은 혼잡도 및 선호 점수 기반으로 정렬되어 가장 락 성공률이 높은
          곳부터 제시
        </li>
        <li>
          사용자가 블록을 선택하면 <strong>연석 우선 자동 배정</strong> 후 즉시
          좌석 Hold (점유)
        </li>
        <li>
          만약 분산 락에 실패할 경우, 기다리지 않고{" "}
          <strong>즉시 다음 대체 블록으로 유도</strong>
        </li>
        <li>
          특정 블록으로 또다시 쏠리는 2차 핫스팟을 방지하기 위한{" "}
          <strong>노출 균형(쿨다운) 정책</strong> 자동 적용
        </li>
      </ul>

      <hr />

      <h2>4. 팀 구성 및 시스템 파트</h2>
      <p>
        이러한 분산 추천과 트래픽 처리를 위해 4개의 파트가 유기적으로
        협력합니다.
      </p>
      <table>
        <thead>
          <tr>
            <th>팀</th>
            <th>핵심 책임</th>
            <th>주요 기술</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>백엔드</strong>
            </td>
            <td>
              MSA 티켓팅 시스템, 분산 락 기반 연석/준연석 배정 및 혼잡도 집계
            </td>
            <td>Spring Boot, Redis, PostgreSQL</td>
          </tr>
          <tr>
            <td>
              <strong>클라우드 인프라</strong>
            </td>
            <td>
              멀티 환경(Dev/Staging/Prod), 고가용성 아키텍처
              <br />
              피크 대비 리소스 확장, 서비스 메쉬/분산 트레이싱 기반 SRE/관측
            </td>
            <td>
              AWS EKS, Karpenter, KEDA, Istio, Grafana
              스택(Prometheus·Loki·Tempo)
            </td>
          </tr>
          <tr>
            <td>
              <strong>보안</strong>
            </td>
            <td>
              외부망부터 애플리케이션까지 5계층 심층 방어 <br /> 엣지(CDN) ·
              LB(ALB) · 메쉬(Istio WAF) · 내부통신(mTLS) · 앱(JWT·보안
              헤더·난독화)
            </td>
            <td>Istio, AWS Shield, Lua, JWT</td>
          </tr>
          <tr>
            <td>
              <strong>AI</strong>
            </td>
            <td>행동 패턴 기반 지능형 봇 탐지 및 무력화 (T0~T3 티어링 분류)</td>
            <td>LangGraph, Playwright, Envoy ext_authz</td>
          </tr>
        </tbody>
      </table>
    </DocPageLayout>
  );
}
