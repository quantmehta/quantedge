"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TrendingUp, Menu, Bell, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
    const pathname = usePathname();

    const navLinks = [
        { name: "Services", href: "/services" },
        { name: "Portfolio Maximizer", href: "/upload" },
        { name: "Decision Maker", href: "/decision-matrix" },
        { name: "Research", href: "/research" }
    ];

    return (
        <nav className="bg-slate-900/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">

                    {/* Logo Area */}
                    <div className="flex items-center gap-12">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="bg-primary rounded-xl p-2 text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                                <TrendingUp size={22} strokeWidth={3} />
                            </div>
                            <span className="text-2xl font-black tracking-tighter text-white">
                                QUANT<span className="text-primary">EDGE</span>
                            </span>
                        </Link>

                        {/* Nav Links (Desktop) */}
                        <div className="hidden lg:flex items-center gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300",
                                        pathname === link.href
                                            ? "bg-primary/10 text-primary"
                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-4 border-l border-white/10 pl-6 ml-2">
                            <button className="text-slate-400 hover:text-white transition-colors relative">
                                <Bell size={20} />
                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-primary rounded-full" />
                            </button>
                            <button className="text-slate-400 hover:text-white transition-colors">
                                <UserCircle2 size={22} />
                            </button>
                        </div>
                        <Button variant="outline" className="lg:hidden bg-transparent border-white/10 text-white hover:bg-white/5">
                            <Menu size={20} />
                        </Button>
                    </div>

                </div>
            </div>
        </nav>
    );
}
