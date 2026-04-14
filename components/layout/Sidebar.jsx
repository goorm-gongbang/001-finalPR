"use client";

import { useState, useEffect } from "react";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Sidebar,
    SidebarContent,
} from "@/components/ui/sidebar";

export function AppSidebar({ items }) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const defaultExpanded = React.useMemo(() => items.map((_, index) => String(index)), [items]);

    return (
        <Sidebar className="mt-16 h-[calc(100svh-4rem)] w-[260px] border-r-gray-200">
            <SidebarContent className="p-4 bg-white">
                <Accordion multiple defaultValue={defaultExpanded} className="w-full">
                    {items.map((section, index) => (
                        <AccordionItem key={index} value={String(index)} className="border-b-0">
                            <AccordionTrigger className="px-3 py-3 text-[14px] font-bold text-slate-800 hover:no-underline hover:text-primary transition-colors">
                                {section.title}
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 pt-1">
                                {section.items?.length ? (
                                    <div className="flex flex-col space-y-[2px]">
                                        {section.items.map((item, itemIndex) => {
                                            const isActive = mounted && pathname === item.href;
                                            return (
                                                <Link
                                                    key={itemIndex}
                                                    href={item.href}
                                                    className={cn(
                                                        buttonVariants({ variant: "ghost" }),
                                                        "w-full justify-start h-9 px-3 text-[14.5px] font-medium transition-colors cursor-pointer",
                                                        isActive
                                                            ? "text-primary font-bold bg-primary/10 hover:bg-primary/10 hover:text-primary"
                                                            : "text-gray-600 hover:text-primary hover:bg-transparent"
                                                    )}
                                                >
                                                    {item.title}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </SidebarContent>
        </Sidebar>
    );
}
