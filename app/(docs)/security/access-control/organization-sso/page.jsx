import { getDocContent } from "@/lib/docs";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default async function Page() {
    const content = await getDocContent(["security", "access-control", "organization-sso"]);

    return (
        <DocPageLayout category="security" title="Organization & SSO">
            <MarkdownRenderer content={content} />
        </DocPageLayout>
    );
}
