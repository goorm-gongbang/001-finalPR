import { AppSidebar } from "@/components/layout/Sidebar";
import { docsConfig } from "@/config/docs";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function DocsLayout({ children }) {
    // Force turbopack to invalidate layout cache
    return (
        <SidebarProvider>
            <div className="flex w-full min-h-screen">
                <AppSidebar items={docsConfig.sidebarNav} />
                <main className="flex-1 w-full relative">
                    <div className="md:hidden flex items-center py-2 px-4 border-b border-gray-100 bg-slate-50/50">
                        <SidebarTrigger />
                        <span className="ml-3 font-semibold text-[14px] text-slate-700">목차 열기</span>
                    </div>
                    <div className="mx-auto max-w-4xl px-6 py-10 md:px-12 md:py-16">
                        {children}
                    </div>
                </main>
            </div>
        </SidebarProvider>
    );
}
