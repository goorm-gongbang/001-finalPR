import { getDocContent } from "@/lib/docs";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default async function Page() {
    const content = await getDocContent(["security", "access-control"]);

    return (
        <DocPageLayout category="security" title="접근 제어">
            <MarkdownRenderer content={content} />
        </DocPageLayout>
    );
}
