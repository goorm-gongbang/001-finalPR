import { NextResponse } from "next/server";
import { docsConfig, sandboxConfig } from "@/config/docs";
import { getDocContent } from "@/lib/docs";

export async function GET() {
    const searchDocs = [];

    // Helper to extract content
    const processConfig = async (config, type) => {
        for (const group of config.sidebarNav) {
            for (const item of group.items) {
                // Determine slug array
                // href examples: "/docs/planning/overview", "/sandbox/traffic"
                const parts = item.href.split("/").filter(Boolean); // ["docs", "planning", "overview"]
                const slug = parts.slice(1); // ["planning", "overview"]

                let content = "";
                if (type === "docs") {
                    content = await getDocContent(slug);
                } else {
                    // Pre-fill some sandbox descriptions since they don't have getDocContent
                    if (item.href === "/sandbox/traffic") content = "대규모 트래픽 대응 시나리오 쿠버네티스 HPA KEDA 스케일아웃 테스트 대기열";
                    if (item.href === "/sandbox/ai-defense") content = "AI 기반 봇 방어 티켓팅 공격 매크로 캡챠 우회 하이브리드 탐지 모델";
                }

                // Remove excessive markdown and newlines for clean search index
                const cleanContent = content.replace(/[#*>_\[\]]/g, ' ').replace(/\s+/g, ' ').trim();

                searchDocs.push({
                    title: item.title,
                    href: item.href,
                    group: group.title,
                    type: type,
                    content: cleanContent
                });
            }
        }
    };

    await processConfig(docsConfig, "docs");
    await processConfig(sandboxConfig, "sandbox");

    return NextResponse.json(searchDocs);
}
