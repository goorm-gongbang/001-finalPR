import { getDocContent } from "@/lib/docs";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default async function Page() {
    const content = await getDocContent(["security", "flow"]);

    return (
        <DocPageLayout category="security" title="보안 흐름">
            <MarkdownRenderer content={content} />
        </DocPageLayout>
    );
}
