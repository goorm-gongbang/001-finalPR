"use client";

import React, { useEffect, useState, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";

mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: "var(--font-geist-sans), Arial, sans-serif"
});

function MermaidChart({ chart }) {
    const [svg, setSvg] = useState("");
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
        <div
            className="flex justify-center my-8 p-6 bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

export function MarkdownRenderer({ content }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
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
                }
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
