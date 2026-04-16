"use client";

import React, { useEffect, useState, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { Maximize2Icon } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "loose",
    fontFamily: "var(--font-geist-sans), Arial, sans-serif",
    themeVariables: {
        background: "#ffffff",
        primaryColor: "#ffffff",
        primaryTextColor: "#0f172a",
        primaryBorderColor: "#6dd3bf",
        lineColor: "#0f766e",
        secondaryColor: "#f8fafc",
        tertiaryColor: "#f0fdfa",
        clusterBkg: "#f8fffd",
        clusterBorder: "#9bdcca",
        nodeBkg: "#ffffff",
        mainBkg: "#ffffff",
        edgeLabelBackground: "#ecfdf5",
        fontSize: "18px",
    },
    flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: "basis",
    },
});

function MermaidChart({ chart }) {
    const [svg, setSvg] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const reactId = useId();
    // mermaid ID must not start with a number
    const id = `mermaid-${reactId.replace(/:/g, '')}`;

    useEffect(() => {
        let isCancelled = false;

        async function renderMermaid() {
            try {
                const { svg } = await mermaid.render(id, chart);
                if (!isCancelled) setSvg(svg);
            } catch (error) {
                console.error("Mermaid parsing error:", error);
                if (!isCancelled) setSvg(`<pre class="text-red-500">Mermaid Render Error</pre>`);
            }
        }

        renderMermaid();

        return () => {
            isCancelled = true;
        };
    }, [chart, id]);

    if (!svg) return <div className="text-gray-400 my-8 py-10 text-center animate-pulse bg-slate-50 border rounded-xl">다이어그램 렌더링 중...</div>;

    return (
        <>
            <div className="mermaid-shell">
                <button
                    type="button"
                    className="mermaid-preview"
                    onClick={() => setIsOpen(true)}
                    aria-label="다이어그램 확대 보기"
                >
                    <span className="mermaid-preview__icon" aria-hidden="true">
                        <span className="sr-only">확대</span>
                        <span className="mermaid-preview__icon-badge">
                            <Maximize2Icon className="size-4" />
                        </span>
                    </span>
                    <div className="mermaid-preview__canvas">
                        <div
                            className="mermaid-diagram mermaid-diagram--preview"
                            dangerouslySetInnerHTML={{ __html: svg }}
                        />
                    </div>
                </button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogHeader className="sr-only">
                    <DialogTitle>다이어그램 확대 보기</DialogTitle>
                    <DialogDescription>머메이드 차트를 큰 화면으로 확인합니다.</DialogDescription>
                </DialogHeader>
                <DialogContent
                    className="w-[min(96vw,1440px)] max-w-[min(96vw,1440px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 sm:max-w-[min(96vw,1440px)]"
                    showCloseButton
                >
                    <div className="mermaid-dialog">
                        <div className="mermaid-dialog__canvas">
                            <div
                                className="mermaid-diagram mermaid-diagram--fullscreen"
                                dangerouslySetInnerHTML={{ __html: svg }}
                            />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function ZoomableImage({ src, alt = "" }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!src) return null;

    let customWidth = null;
    let cleanSrc = src;

    try {
        const urlObj = src.startsWith('http') ? new URL(src) : new URL(src, 'http://localhost');
        if (urlObj.searchParams.has('w')) {
            customWidth = urlObj.searchParams.get('w');
            urlObj.searchParams.delete('w');
            cleanSrc = src.startsWith('http') ? urlObj.toString() : urlObj.pathname + urlObj.search;
        }
    } catch (e) {
        // parsing 에러 무시
    }

    return (
        <>
            <div 
                className="doc-image-shell" 
                style={customWidth ? { maxWidth: /^\d+$/.test(customWidth) ? `${customWidth}px` : customWidth, margin: '0 auto' } : undefined}
            >
                <button
                    type="button"
                    className="doc-image-preview"
                    onClick={() => setIsOpen(true)}
                    aria-label={alt ? `${alt} 이미지 확대 보기` : "이미지 확대 보기"}
                >
                    <span className="doc-image-preview__icon" aria-hidden="true">
                        <span className="doc-image-preview__icon-badge">
                            <Maximize2Icon className="size-4" />
                        </span>
                    </span>
                    <img src={cleanSrc} alt={alt} className="doc-image-preview__img" />
                </button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogHeader className="sr-only">
                    <DialogTitle>{alt || "이미지 확대 보기"}</DialogTitle>
                    <DialogDescription>문서 이미지를 큰 화면으로 확인합니다.</DialogDescription>
                </DialogHeader>
                <DialogContent
                    className="w-[min(96vw,1440px)] max-w-[min(96vw,1440px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 sm:max-w-[min(96vw,1440px)]"
                    showCloseButton
                >
                    <div className="doc-image-dialog">
                        <div className="doc-image-dialog__canvas">
                            <img src={cleanSrc} alt={alt} className="doc-image-dialog__img" />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function MarkdownRenderer({ content }) {
    const markdownComponents = {
        code(props) {
            const { children, className, node, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            const isMermaid = match && match[1] === "mermaid";

            if (isMermaid) {
                return <MermaidChart chart={String(children).replace(/\n$/, "")} />;
            }

            return (
                <code {...rest} className={className}>
                    {children}
                </code>
            );
        },
        img(props) {
            const { src, alt } = props;
            return <ZoomableImage src={src} alt={alt} />;
        },
        p({ node, children }) {
            const onlyChild =
                node?.children?.length === 1 && node.children[0].tagName === "img";
            if (onlyChild) return <>{children}</>;
            return <p>{children}</p>;
        },
    };

    const renderMarkdownChunk = (chunk, key) => (
        <ReactMarkdown
            key={key}
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
        >
            {chunk}
        </ReactMarkdown>
    );

    const columnPattern = /:::columns\s*\n([\s\S]*?)\n:::/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = columnPattern.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: "markdown",
                content: content.slice(lastIndex, match.index),
            });
        }

        parts.push({
            type: "columns",
            content: match[1],
        });

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        parts.push({
            type: "markdown",
            content: content.slice(lastIndex),
        });
    }

    return (
        <>
            {parts.length === 0 && renderMarkdownChunk(content, "full")}
            {parts.map((part, index) => {
                if (part.type === "markdown") {
                    return renderMarkdownChunk(part.content, `markdown-${index}`);
                }

                const columns = part.content
                    .split(/\n---column---\n/g)
                    .map((column) => column.trim())
                    .filter(Boolean);

                return (
                    <div key={`columns-${index}`} className="doc-columns">
                        {columns.map((column, columnIndex) => (
                            <div key={`column-${index}-${columnIndex}`} className="doc-columns__item">
                                {renderMarkdownChunk(column, `column-markdown-${index}-${columnIndex}`)}
                            </div>
                        ))}
                    </div>
                );
            })}
        </>
    );
}
