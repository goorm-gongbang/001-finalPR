import { getDocContent } from "@/lib/docs";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const categoryMap = {
    development: "개발",
    infrastructure: "클라우드 인프라",
    security: "보안",
    ai: "AI",
    planning: "기획/디자인",
    appendix: "APPENDIX"
};

export default async function DocPage({ params }) {
    const { slug } = await params;
    const content = await getDocContent(slug);

    const category = categoryMap[slug[0]] || slug[0];
    const subPathTitle = slug.length > 1 ? content.split('\n')[0].replace(/^#+\s*/, '') : '';

    return (
        <div className="w-full">
            <div className="mb-4">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href="/docs">프로젝트 소개</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink href={`/${slug[0]}/overview`}>{category}</BreadcrumbLink>
                        </BreadcrumbItem>
                        {subPathTitle && (
                            <>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="font-semibold text-gray-900">{subPathTitle}</BreadcrumbPage>
                                </BreadcrumbItem>
                            </>
                        )}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>

            <div className="prose prose-slate prose-gray max-w-none prose-headings:font-bold prose-h1:text-[36px] prose-h2:text-[24px] prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-gray-100 prose-h2:pb-3 prose-h3:text-[18px] prose-p:text-[15px] prose-p:leading-relaxed prose-p:text-gray-600 prose-a:text-primary prose-pre:bg-slate-900 prose-pre:text-slate-50 prose-img:rounded-lg prose-code:before:content-none prose-code:after:content-none [&_:not(pre)>code]:relative [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-[0.3rem] [&_:not(pre)>code]:py-[0.2rem] [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-sm [&_:not(pre)>code]:font-semibold">
                <MarkdownRenderer content={content} />
            </div>
        </div>
    );
}
