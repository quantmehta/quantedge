import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { Suspense } from "react";

export default function ShellLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-slate-50">
            <AppSidebar />
            <div className="flex-1 pl-64 transition-all">
                <Suspense fallback={<div className="h-16 border-b bg-white" />}>
                    <AppHeader />
                </Suspense>
                <main className="p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
