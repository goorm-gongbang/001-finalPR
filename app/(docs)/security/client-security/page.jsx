import { getDocContent } from "@/lib/docs";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default async function Page() {
    const content = await getDocContent(["security", "client-security"]);

    return (
        <DocPageLayout category="security" title="클라이언트 보안">
            <MarkdownRenderer content={content} />
        </DocPageLayout>
    );
}
