"use client";

import { useDecisionChatbot } from "@/hooks/useDecisionChatbot";
import { ChatContainer } from "@/components/decision/ChatComponents";

export default function DecisionMatrixPage() {
    const {
        history,
        sendMessage,
        reset,
        isComputing
    } = useDecisionChatbot();

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Decision Assistant</h1>
                        <p className="text-slate-500">
                            Interactive Decision Theory Chatbot (Deterministic)
                        </p>
                    </div>
                </div>

                <div className="flex justify-center">
                    <ChatContainer
                        messages={history}
                        onSend={sendMessage}
                        isLoading={isComputing}
                        onReset={reset}
                    />
                </div>

                {/* Helper / Legend */}
                <div className="max-w-3xl mx-auto mt-8 text-xs text-slate-400">
                    <p>Commands: /reset, /set criterion=EMV, /set context="..."</p>
                </div>
            </div>
        </div>
    );
}
