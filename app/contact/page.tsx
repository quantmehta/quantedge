import { Button } from "@/components/ui/button";
import { Mail, Phone, User } from "lucide-react";

export default function ContactPage() {
    return (
        <div className="min-h-[calc(100vh-80px)] bg-slate-50 py-16 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 space-y-8">

                    <div className="text-center space-y-2">
                        <h1 className="text-3xl font-bold text-slate-900">Get in Touch</h1>
                        <p className="text-slate-500">Our quantitative specialists are ready to discuss your specific needs.</p>
                    </div>

                    <form className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <User size={16} /> Full Name
                            </label>
                            <input
                                type="text"
                                placeholder="Enter your name"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Phone size={16} /> Contact Number
                            </label>
                            <input
                                type="tel"
                                placeholder="Enter your phone number"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Mail size={16} /> Email Address
                            </label>
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                    </form>

                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg rounded-xl shadow-lg shadow-indigo-600/20 mt-4 font-bold">
                        Submit
                    </Button>

                </div>
            </div>
        </div>
    );
}
