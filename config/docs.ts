export const docsConfig = {
    mainNav: [
        { title: "프로젝트 소개", href: "/docs" },
        { title: "Sandbox", href: "/sandbox" },
    ],
    sidebarNav: [
        {
            title: "기획/디자인",
            items: [
                { title: "프로젝트 개요", href: "/docs/planning/overview" },
            ],
        },
        {
            title: "개발",
            items: [
                { title: "개요", href: "/docs/development/overview" },
                { title: "시스템 아키텍처", href: "/docs/development/system-architecture" },
                { title: "인증 아키텍처", href: "/docs/development/auth-architecture" },
                { title: "티켓팅 플로우", href: "/docs/development/ticketing-flow" },
                { title: "추천 알고리즘", href: "/docs/development/recommendation" },
                { title: "Redis 구성", href: "/docs/development/redis" },
            ],
        },
        {
            title: "클라우드 인프라",
            items: [
                { title: "환경 구성", href: "/docs/infrastructure/environment" },
                { title: "트래픽 대응", href: "/docs/infrastructure/traffic" },
                { title: "장애 대응", href: "/docs/infrastructure/failover" },
                { title: "모니터링", href: "/docs/infrastructure/monitoring" },
            ],
        },
        {
            title: "보안",
            items: [
                { title: "보안 흐름", href: "/docs/security/flow" },
                { title: "Istio/mTLS", href: "/docs/security/istio-mtls" },
                { title: "클라이언트 보안", href: "/docs/security/client" },
                { title: "IAM 접근 제어", href: "/docs/security/iam" },
                { title: "봇 대응 체계", href: "/docs/security/bot-defense" },
            ],
        },
        {
            title: "AI",
            items: [
                { title: "AI 방어 개요", href: "/docs/ai/overview" },
                { title: "공격 에이전트", href: "/docs/ai/attack-agent" },
                { title: "하이브리드 아키텍처", href: "/docs/ai/hybrid-architecture" },
                { title: "텔레메트리", href: "/docs/ai/telemetry" },
                { title: "런타임 탐지", href: "/docs/ai/runtime-detection" },
                { title: "Control Plane", href: "/docs/ai/control-plane" },
            ],
        },
        {
            title: "APPENDIX",
            items: [
                { title: "APPENDIX", href: "/docs/appendix/main" },
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
