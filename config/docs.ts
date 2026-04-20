export const docsConfig = {
  mainNav: [
    { title: "프로젝트 소개", href: "/planning/overview" },
    { title: "Sandbox", href: "/sandbox" },
  ],
  sidebarNav: [
    {
      title: "기획/디자인",
      items: [{ title: "프로젝트 개요", href: "/planning/overview" }],
    },
    {
      title: "개발",
      items: [
        { title: "개요", href: "/development/overview" },
        { title: "시스템 아키텍처", href: "/development/system-architecture" },
        { title: "인증 아키텍처", href: "/development/auth-architecture" },
        { title: "티켓팅 플로우", href: "/development/ticketing-flow" },
        { title: "추천 알고리즘", href: "/development/recommendation" },
        { title: "Redis 구성", href: "/development/redis" },
        {
          title: "MSA · EDA 전환 (Kafka 채택)",
          href: "/development/eda-architecture",
        },
        { title: "Kafka · Caffeine 캐싱", href: "/development/kafka-caching" },
        {
          title: "좌석 분산락/Hold 동시성",
          href: "/development/seat-concurrency",
        },
        {
          title: "성능 최적화 요약",
          href: "/development/performance-optimization",
        },
        {
          title: "부하테스트 (3일차 통합)",
          href: "/development/load-test",
          children: [
            {
              title: "부하테스트 개요",
              href: "/development/load-test/overview",
            },
            {
              title: "테스트 시나리오 Flow",
              href: "/development/load-test/scenarios",
            },
            {
              title: "기술 용어 해설",
              href: "/development/load-test/tech-terms",
            },
            {
              title: "Phase별 최적화 타임라인",
              href: "/development/load-test/phases",
            },
            {
              title: "테스트별 결과 요약",
              href: "/development/load-test/results",
            },
            {
              title: "503 트러블슈팅 스토리",
              href: "/development/load-test/503-story",
            },
            {
              title: "Before/After 시각화",
              href: "/development/load-test/comparison",
            },
            {
              title: "추천 ON/OFF 실측 비교",
              href: "/development/load-test/recommendation-on-off",
            },
          ],
        },
        {
          title: "트러블 슈팅",
          href: "/development/trouble",
          children: [
            {
              title: "프론트엔드",
              href: "/development/trouble/front",
            }
          ],
        },
      ],
    },
    {
      title: "클라우드 인프라",
      items: [
        { title: "개요", href: "/infrastructure/overview" },
        { title: "환경 구성", href: "/infrastructure/environment" },
        {
          title: "인프라 아키텍처",
          href: "/infrastructure/architecture",
          children: [
            {
              title: "도메인 · 라우팅",
              href: "/infrastructure/domain-routing",
            },
            { title: "외부 진입 구조", href: "/infrastructure/external-entry" },
            { title: "계정 경계", href: "/infrastructure/account-boundary" },
            {
              title: "아우터 아키텍처 - Dev",
              href: "/infrastructure/outer-architecture-dev",
            },
            {
              title: "아우터 아키텍처 - EKS",
              href: "/infrastructure/outer-architecture-eks",
            },
            {
              title: "내부 구성",
              href: "/infrastructure/internal-composition",
            },
            { title: "K8s 클러스터 구성", href: "/infrastructure/k8s-cluster" },
          ],
        },
        {
          title: "CI/CD",
          href: "/infrastructure/ci-cd",
          children: [
            {
              title: "배포 복구 검증",
              href: "/infrastructure/deployment-recovery",
            },
            {
              title: "TeamCity 연동 및 파이프라인",
              href: "/infrastructure/teamcity",
            },
          ],
        },
        {
          title: "모니터링",
          href: "/infrastructure/monitoring",
          children: [
            {
              title: "Grafana 운영 체계",
              href: "/infrastructure/grafana-dashboards",
            },
            {
              title: "인프라 관측",
              href: "/infrastructure/infrastructure-observability",
            },
            {
              title: "서비스 관측",
              href: "/infrastructure/service-observability",
            },
            {
              title: "보안 관측",
              href: "/infrastructure/security-observability",
            },
            {
              title: "부하테스트 전용",
              href: "/infrastructure/load-test-observability",
            },
          ],
        },
        {
          title: "트래픽 대응",
          href: "/infrastructure/traffic",
        },
        { title: "장애 대응", href: "/infrastructure/incident-response" },
        {
          title: "로그/백업/보관 정책",
          href: "/infrastructure/log-backup-policy",
        },
        {
          title: "클러스터 정책",
          href: "/infrastructure/cluster-policy",
        },
        {
          title: "[부록] 운영 보완 및 트러블슈팅",
          href: "/infrastructure/operational-troubleshooting",
        },
      ],
    },
    {
      title: "보안",
      items: [
        { title: "개요", href: "/security/overview" },
        { title: "클라이언트 보안", href: "/security/client-security" },
        { title: "Gateway / mTLS", href: "/security/gateway-mtls" },
        { title: "봇 대응 체계", href: "/security/bot-defense" },
        { title: "백엔드 방어 체계", href: "/security/backend-defense" },
        { title: "데이터 보안", href: "/security/data-security" },
        { title: "인프라 보안", href: "/security/infrastructure-security" },
        {
          title: "접근 제어",
          href: "/security/access-control",
          children: [
            {
              title: "Organization & IAM Identity Center",
              href: "/security/access-control/organization-sso",
            },
          ],
        },
        {
          title: "[부록] 취약점 관리",
          href: "/security/vulnerability-management",
        },
      ],
    },
    {
      title: "AI — 공격 에이전트",
      items: [
        { title: "개요", href: "/ai/reference/attack/00-overview" },
        { title: "아키텍처", href: "/ai/reference/attack/01-architecture" },
        {
          title: "FlowState 상태머신",
          href: "/ai/reference/attack/02-workflow-states",
        },
        {
          title: "오픈 시각 동기화",
          href: "/ai/reference/attack/03-open-at-sync",
        },
        {
          title: "마우스 궤적 합성",
          href: "/ai/reference/attack/04-mouse-trajectory",
        },
        { title: "VQA 자동 풀이", href: "/ai/reference/attack/05-vqa-solver" },
        {
          title: "스웜 인프라",
          href: "/ai/reference/attack/06-swarm-infrastructure",
        },
        {
          title: "LLM 코디네이터",
          href: "/ai/reference/attack/07-llm-coordinator",
        },
        {
          title: "감사 · 증거 수집",
          href: "/ai/reference/attack/08-audit-evidence",
        },
        {
          title: "KPI 자동 집계",
          href: "/ai/reference/attack/09-kpi-evaluation",
        },
        { title: "설정 및 실행", href: "/ai/reference/attack/10-configuration" },
        {
          title: "이벤트 카탈로그",
          href: "/ai/reference/attack/11-events-reference",
        },
        { title: "트러블슈팅", href: "/ai/reference/attack/12-troubleshooting" },
      ],
    },
    {
      title: "AI — 방어 시스템",
      items: [
        { title: "개요", href: "/ai/reference/defense/00-overview" },
        { title: "아키텍처", href: "/ai/reference/defense/01-architecture" },
        { title: "Ext-Authz 연동", href: "/ai/reference/defense/02-ext-authz" },
        {
          title: "Runtime 판단 파이프라인",
          href: "/ai/reference/defense/03-runtime-pipeline",
        },
        {
          title: "위험 점수 계산 (Guard)",
          href: "/ai/reference/defense/04-risk-scoring",
        },
        {
          title: "Tier · Action · 히스테리시스",
          href: "/ai/reference/defense/05-tier-action",
        },
        {
          title: "Analyzer 신호",
          href: "/ai/reference/defense/06-analyzer-signals",
        },
        { title: "VQA 2중 게이트", href: "/ai/reference/defense/07-vqa-gate" },
        {
          title: "정책 권위 · 런타임 캐시",
          href: "/ai/reference/defense/08-policy-authority",
        },
        {
          title: "오프라인 최적화기",
          href: "/ai/reference/defense/09-offline-optimizer",
        },
        {
          title: "Post-Review Copilot",
          href: "/ai/reference/defense/10-post-review",
        },
        {
          title: "Observability · ETL",
          href: "/ai/reference/defense/11-observability",
        },
        {
          title: "Storage · Deployment",
          href: "/ai/reference/defense/12-storage-deployment",
        },
        {
          title: "실패 모델 · 복구",
          href: "/ai/reference/defense/13-failure-recovery",
        },
        {
          title: "KPI 평가",
          href: "/ai/reference/defense/kpi-evaluation",
        },
        {
          title: "트러블슈팅",
          href: "/ai/reference/defense/troubleshooting",
        },
      ],
    },
    {
      title: "APPENDIX",
      items: [{ title: "APPENDIX", href: "/appendix/main" }],
    },
  ],
};

export const sandboxConfig = {
  sidebarNav: [
    {
      title: "시뮬레이션",
      items: [
        { title: "대규모 트래픽 대응", href: "/sandbox/traffic" },
        { title: "AI 공격/방어 대응", href: "/sandbox/ai-defense" },
      ],
    },
  ],
};
