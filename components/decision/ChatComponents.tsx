import React, { useRef, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
// import ReactMarkdown from 'react-markdown'; // Assuming we can use this or simple whitespace handling for now.
// For now, simpler text rendering to avoid dependency issues if react-markdown isn't present.

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const ChatMessage = ({ message }: { message: Message }) => {
    const isUser = message.role === 'user';

    // Rudimentary Markdown rendering for bolding and tables
    // In strict production, use a library. Here we do best-effort purely with React/CSS 
    const formatContent = (text: string) => {
        return text.split('\n').map((line, i) => {
            // Header
            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-2 mb-1">{line.replace('### ', '')}</h3>;
            if (line.startsWith('**') && line.endsWith('**')) return <strong key={i} className="block my-1">{line.replace(/\*\*/g, '')}</strong>;

            // Table row (simple detection)
            if (line.includes('|')) {
                return <div key={i} className="font-mono text-xs whitespace-pre-wrap overflow-x-auto bg-slate-900/5 p-1 rounded my-0.5">{line}</div>;
            }

            return <p key={i} className="min-h-[1.2em]">{line}</p>;
        });
    };

    return (
        <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed",
                isUser
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
            )}>
                {isUser ? message.content : formatContent(message.content)}
            </div>
        </div>
    );
};

export const ChatInput = ({ onSend, disabled }: { onSend: (msg: string) => void, disabled?: boolean }) => {
    const [val, setVal] = useState("");

    const handleSend = () => {
        if (!val.trim()) return;
        onSend(val);
        setVal("");
    };

    return (
        <div className="flex gap-2 p-4 bg-white border-t border-slate-200">
            <Input
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type your response..."
                disabled={disabled}
                className="flex-1"
                autoFocus
            />
            <Button onClick={handleSend} disabled={disabled || !val.trim()}>
                Send
            </Button>
        </div>
    );
};

export const ChatContainer = ({
    messages,
    onSend,
    isLoading,
    onReset
}: {
    messages: Message[],
    onSend: (msg: string) => void,
    isLoading?: boolean,
    onReset: () => void
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    return (
        <div className="flex flex-col h-[600px] w-full max-w-3xl mx-auto bg-slate-50 border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                <h2 className="font-semibold text-slate-700">Decision Assistant</h2>
                <Button variant="ghost" size="sm" onClick={onReset} className="text-slate-500 hover:text-red-500">
                    Reset
                </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                <div className="flex flex-col">
                    {messages.map((m, i) => (
                        <ChatMessage key={i} message={m} />
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-4">
                            <div className="bg-slate-200 rounded-full px-4 py-2 text-xs text-slate-500 animate-pulse">
                                Thinking...
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input */}
            <ChatInput onSend={onSend} disabled={isLoading} />
        </div>
    );
};
