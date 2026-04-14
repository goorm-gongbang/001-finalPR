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
                    href: "/infrastructure/gitops",
                    children: [
                        { title: "GitOps 롤백", href: "/infrastructure/gitops-rollback" },
                    ],
                },
                { title: "트래픽 대응", href: "/infrastructure/traffic" },
                { title: "장애 대응", href: "/infrastructure/failover" },
                { title: "모니터링", href: "/infrastructure/monitoring" },
            ],
        },
        {
            title: "보안",
            items: [
                { title: "개요", href: "/security/overview" },
                { title: "보안 흐름", href: "/security/flow" },
                { title: "Istio/mTLS", href: "/security/istio-mtls" },
                { title: "클라이언트 보안", href: "/security/client" },
                { title: "접근 제어", href: "/security/iam" },
                { title: "클러스터 정책", href: "/security/kyverno" },
                { title: "봇 대응 체계", href: "/security/bot-defense" },
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
