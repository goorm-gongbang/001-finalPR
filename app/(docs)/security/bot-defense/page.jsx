import { getDocContent } from "@/lib/docs";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default async function Page() {
    const content = await getDocContent(["security", "bot-defense"]);

    return (
        <DocPageLayout category="security" title="봇 대응 체계">
            <MarkdownRenderer content={content} />
        </DocPageLayout>
    );
}
