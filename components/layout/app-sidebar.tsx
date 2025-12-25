"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    UploadCloud,
    LayoutDashboard,
    Sliders,
    Zap,
    Lightbulb,
    FileText,
    History,
    TrendingUp,
    Briefcase
} from "lucide-react";

const links = [
    { href: "/upload", label: "Upload", icon: UploadCloud },
    { href: "/analysis", label: "Analysis Dashboard", icon: Zap },
];

export function AppSidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 bg-white transition-transform">
            <div className="flex h-16 items-center border-b border-slate-200 px-6">
                <Link href="/" className="flex items-center gap-2">
                    <div className="bg-primary rounded-lg p-1.5 text-white">
                        <TrendingUp size={20} strokeWidth={3} />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-slate-900">
                        QuantEdge
                    </span>
                </Link>
            </div>

            <div className="py-4 px-3">
                <nav className="space-y-1">
                    {links.map((link) => {
                        const Icon = link.icon;
                        const isActive = pathname.startsWith(link.href);

                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                <Icon size={18} />
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-8 mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Legacy Modules
                </div>
                <nav className="space-y-1">
                    <Link
                        href="/decision-matrix"
                        className={cn(
                            "flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium transition-colors text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                    >
                        <Briefcase size={18} />
                        Decision Matrix
                    </Link>
                </nav>
            </div>
        </aside>
    );
}
