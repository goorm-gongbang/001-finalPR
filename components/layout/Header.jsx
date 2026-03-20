"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { docsConfig, sandboxConfig } from "@/config/docs";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search } from "lucide-react";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

export function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = React.useState(false);

    const [searchIndex, setSearchIndex] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const down = (e) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener("keydown", down);

        fetch("/api/search-index")
            .then(res => res.json())
            .then(data => {
                setSearchIndex(data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));

        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = React.useCallback((command) => {
        setOpen(false);
        command();
    }, []);

    const activeItem = docsConfig.mainNav.find(item => pathname?.startsWith(item.href))?.href;

    return (
        <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200">
            <div className="flex h-16 items-center px-8 w-full justify-between gap-6">
                <div className="flex items-center h-full sm:w-[300px] shrink-0">
                    <Link href="/" className="flex items-center mr-8">
                        <img src="/playball_logo.svg" alt="Playball Logo" className="h-[22px] w-auto object-contain" />
                    </Link>
                    <nav className="flex items-center text-[15px] font-semibold text-gray-500">
                        <ToggleGroup
                            value={activeItem ? [activeItem] : []}
                            onValueChange={(val) => {
                                const path = Array.isArray(val) ? val[0] : val;
                                if (path) router.push(path);
                            }}
                            spacing={2}
                        >
                            {docsConfig.mainNav.map((item) => (
                                <ToggleGroupItem
                                    key={item.href}
                                    value={item.href}
                                    className="h-9 px-3 text-[14.5px] font-medium rounded-lg transition-colors cursor-pointer text-gray-600 bg-transparent hover:bg-transparent hover:text-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:font-bold data-pressed:bg-primary/10 data-pressed:text-primary data-pressed:font-bold aria-[pressed=true]:bg-primary/10 aria-[pressed=true]:text-primary aria-[pressed=true]:font-bold aria-[pressed=true]:hover:bg-primary/10 border-none shadow-none"
                                >
                                    {item.title}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    </nav>
                </div>

                <div className="flex flex-1 items-center justify-center">
                    <div className="relative w-full max-w-[400px] hidden md:block">
                        <button
                            onClick={() => setOpen(true)}
                            className="inline-flex items-center w-full justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 h-9 text-[14px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shadow-sm"
                        >
                            <span className="inline-flex items-center">
                                <Search className="mr-2 h-4 w-4" />
                                내용 전체 검색...
                            </span>
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-slate-500 opacity-100">
                                <span className="text-xs">⌘</span>K
                            </kbd>
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-end sm:w-[300px] shrink-0">
                    <Link
                        href="#"
                        className="inline-flex whitespace-nowrap h-10 items-center justify-center rounded-lg bg-primary px-5 py-2 text-[14px] font-semibold text-white shadow hover:bg-primary/90 transition-colors"
                    >
                        서비스 바로가기
                    </Link>
                </div>
            </div>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <Command className="w-full">
                    <CommandInput placeholder="문서 내용이나 시뮬레이션을 검색하세요..." />
                    <CommandList>
                        <CommandEmpty>{isLoading ? "검색 엔진 연동 중..." : "검색 결과가 없습니다."}</CommandEmpty>
                        {searchIndex.length > 0 ? (
                            Array.from(new Set(searchIndex.map(c => c.type + "|" + c.group))).map(key => {
                                const groupDocs = searchIndex.filter(c => c.type + "|" + c.group === key);
                                const isDocs = groupDocs[0].type === "docs";
                                return (
                                    <CommandGroup key={key} heading={`${isDocs ? '개발 문서' : '시뮬레이션'} - ${groupDocs[0].group}`}>
                                        {groupDocs.map((navItem) => (
                                            <CommandItem
                                                key={navItem.href}
                                                value={`${navItem.title} ${navItem.content}`}
                                                onSelect={() => runCommand(() => router.push(navItem.href))}
                                                className="cursor-pointer font-medium"
                                            >
                                                {navItem.title}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                );
                            })
                        ) : (
                            docsConfig.sidebarNav.map((group) => (
                                <CommandGroup key={group.title} heading={`개발 문서 - ${group.title}`}>
                                    {group.items.map((navItem) => (
                                        <CommandItem
                                            key={navItem.href}
                                            value={`[문서] ${navItem.title}`}
                                            onSelect={() => runCommand(() => router.push(navItem.href))}
                                            className="cursor-pointer font-medium"
                                        >
                                            {navItem.title}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            ))
                        )}
                    </CommandList>
                </Command>
            </CommandDialog>
        </header>
    );
}
