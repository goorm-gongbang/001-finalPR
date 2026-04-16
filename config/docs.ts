export const docsConfig = {
    mainNav: [
        { title: "프로젝트 소개", href: "/planning/overview" },
        { title: "Sandbox", href: "/sandbox" },
    ],
    sidebarNav: [
        {
            title: "기획/디자인",
            items: [
                { title: "프로젝트 개요", href: "/planning/overview" },
            ],
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
                { title: "MSA · EDA 전환 (Kafka 채택)", href: "/development/eda-architecture" },
                { title: "Kafka · Caffeine 캐싱", href: "/development/kafka-caching" },
                { title: "좌석 분산락/Hold 동시성", href: "/development/seat-concurrency" },
                { title: "성능 최적화 요약", href: "/development/performance-optimization" },
                {
                    title: "부하테스트 (3일차 통합)",
                    href: "/development/load-test",
                    children: [
                        { title: "부하테스트 개요", href: "/development/load-test/overview" },
                        { title: "테스트 시나리오 Flow", href: "/development/load-test/scenarios" },
                        { title: "기술 용어 해설", href: "/development/load-test/tech-terms" },
                        { title: "Phase별 최적화 타임라인", href: "/development/load-test/phases" },
                        { title: "테스트별 결과 요약", href: "/development/load-test/results" },
                        { title: "503 트러블슈팅 스토리", href: "/development/load-test/503-story" },
                        { title: "Before/After 시각화", href: "/development/load-test/comparison" },
                    ],
                },
            ],
        },
        {
            title: "클라우드 인프라",
            items: [
                { title: "개요", href: "/infrastructure/overview" },
                { title: "환경 구성", href: "/infrastructure/environment" },
                { title: "인프라 아키텍처", href: "/infrastructure/architecture" },
                {
                    title: "CI/CD",
                    href: "/infrastructure/ci-cd",
                    children: [
                        { title: "배포 복구 검증", href: "/infrastructure/deployment-recovery" },
                    ],
                },
                { title: "트래픽 대응", href: "/infrastructure/traffic" },
                {
                    title: "모니터링",
                    href: "/infrastructure/monitoring",
                    children: [
                        { title: "그라파나 대시보드", href: "/infrastructure/grafana-dashboards" },
                    ],
                },
                { title: "장애 대응", href: "/infrastructure/incident-response" },
                { title: "로그/백업/보관 정책", href: "/infrastructure/log-backup-policy" },
                { title: "클러스터 정책", href: "/infrastructure/cluster-policy" },
            ],
        },
        {
            title: "보안",
            items: [
                { title: "개요", href: "/security/overview" },
                { title: "보안 흐름", href: "/security/flow" },
                { title: "Gateway / mTLS", href: "/security/gateway-mtls" },
                { title: "클라이언트 보안", href: "/security/client-security" },
                { title: "접근 제어", href: "/security/access-control" },
                { title: "데이터 보안", href: "/security/data-security" },
                { title: "봇 대응 체계", href: "/security/bot-defense" },
                { title: "백엔드 방어 체계", href: "/security/backend-defense" },
                { title: "취약점 관리", href: "/security/vulnerability-management" },
            ],
        },
        {
            title: "AI",
            items: [
                { title: "AI 방어 개요", href: "/ai/overview" },
                { title: "공격 에이전트", href: "/ai/attack-agent" },
                { title: "하이브리드 아키텍처", href: "/ai/hybrid-architecture" },
                { title: "텔레메트리", href: "/ai/telemetry" },
                { title: "런타임 탐지", href: "/ai/runtime-detection" },
                { title: "Control Plane", href: "/ai/control-plane" },
            ],
        },
        {
            title: "APPENDIX",
            items: [
                { title: "APPENDIX", href: "/appendix/main" },
            ],
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
