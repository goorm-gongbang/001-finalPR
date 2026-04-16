import { getDocContent } from "@/lib/docs";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default async function Page() {
    const content = await getDocContent(["security", "gateway-mtls"]);

    return (
        <DocPageLayout category="security" title="Gateway / mTLS">
            <MarkdownRenderer content={content} />
        </DocPageLayout>
    );
}
