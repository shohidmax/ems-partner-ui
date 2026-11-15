'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle, 
    SheetDescription 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { formatToBDTime } from '@/lib/utils';
import { 
    Sparkles, 
    Send, 
    Trash2, 
    Loader2, 
    Bot, 
    User, 
    CloudRain, 
    Thermometer, 
    Waves, 
    Compass,
    AlertCircle,
    RotateCcw
} from 'lucide-react';

interface ChatMessage {
    _id?: string;
    role: 'user' | 'assistant';
    message: string;
    timestamp?: string | Date;
}

interface DeviceAiChatProps {
    uid: string;
    deviceName?: string | null;
    location?: string | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    showFab?: boolean;
}

const SUGGESTED_PROMPTS = [
    {
        icon: CloudRain,
        label: 'আগামীকালের আবহাওয়া কেমন হবে?',
        prompt: 'এই ডিভাইসের সাম্প্রতিক তাপমাত্রা, আর্দ্রতা ও বায়ুমণ্ডলীয় পরিবর্তন অনুযায়ী আগামীকালের আবহাওয়া ও বৃষ্টির পূর্বাভাস কেমন?'
    },
    {
        icon: Waves,
        label: 'পানির স্তর ও বন্যার কোনো ঝুঁকি আছে?',
        prompt: 'বর্তমানে পানির স্তর কত এবং এটি কি বৃদ্ধি পাচ্ছে? কোনো বন্যা বা জলাবদ্ধতার ঝুঁকি আছে কি?'
    },
    {
        icon: Thermometer,
        label: 'বর্তমান সেন্সর অবস্থার সারাংশ দাও',
        prompt: 'এই ডিভাইসের বর্তমান তাপমাত্রা, আর্দ্রতা ও আবহাওয়া পরিস্থিতির একটি সংক্ষিপ্ত বিশ্লেষণ দাও।'
    },
    {
        icon: Compass,
        label: 'কৃষি ও ফসলের জন্য পরামর্শ কি?',
        prompt: 'বর্তমান আর্দ্রতা, বৃষ্টি ও তাপমাত্রা অনুযায়ী স্থানীয় কৃষকদের জন্য কি কি সতর্কতা বা সেচ পরামর্শ দেওয়া যায়?'
    }
];

export function DeviceAiChat({
    uid,
    deviceName,
    location,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    showFab = true
}: DeviceAiChatProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;
    const setIsOpen = isControlled ? (setControlledOpen || (() => {})) : setInternalOpen;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingHistory, setFetchingHistory] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Auto scroll to bottom of chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    // Fetch Chat History when Sheet opens
    useEffect(() => {
        if (isOpen && uid) {
            fetchHistory();
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen, uid]);

    const fetchHistory = async () => {
        setFetchingHistory(true);
        try {
            const { data } = await apiFetch<{ success: boolean; history: ChatMessage[] }>(
                `/api/device/ai-chat/history?uid=${encodeURIComponent(uid)}`
            );
            if (data?.history && Array.isArray(data.history)) {
                setMessages(data.history);
            }
        } catch (err: any) {
            console.error('Failed to load chat history:', err);
        } finally {
            setFetchingHistory(false);
        }
    };

    const handleSend = async (messageText?: string) => {
        const textToSend = (messageText || input).trim();
        if (!textToSend || loading) return;

        const userMsg: ChatMessage = {
            role: 'user',
            message: textToSend,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMsg]);
        if (!messageText) setInput('');
        setLoading(true);

        try {
            const { data } = await apiFetch<{ success: boolean; reply: string; timestamp: string }>(
                '/api/device/ai-chat',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid, message: textToSend })
                }
            );

            if (data?.reply) {
                const aiMsg: ChatMessage = {
                    role: 'assistant',
                    message: data.reply,
                    timestamp: data.timestamp || new Date().toISOString()
                };
                setMessages(prev => [...prev, aiMsg]);
            } else {
                throw new Error('No reply received from AI');
            }
        } catch (err: any) {
            toast({
                title: 'AI Chat Error',
                description: err.message || 'Failed to get answer from AI. Please try again.',
                variant: 'destructive'
            });
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    message: '⚠️ দুঃখিত, এই মুহূর্তে এআই সার্ভিসের সাথে সংযোগ স্থাপন করা সম্ভব হয়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
                    timestamp: new Date().toISOString()
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleClearHistory = async () => {
        if (!confirm('আপনি কি এই ডিভাইসের সমস্ত চ্যাট হিস্ট্রি মুছে ফেলতে চান?')) return;
        try {
            await apiFetch(`/api/device/ai-chat/history?uid=${encodeURIComponent(uid)}`, {
                method: 'DELETE'
            });
            setMessages([]);
            toast({ title: 'Success', description: 'Chat history cleared successfully.' });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message || 'Failed to clear history.', variant: 'destructive' });
        }
    };

    const renderFormattedText = (text: string) => {
        // Simple and clean formatting for Markdown-like outputs
        const lines = text.split('\n');
        return lines.map((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('### ')) {
                return <h3 key={idx} className="font-bold text-sm sm:text-base text-foreground mt-3 mb-1">{trimmed.replace('### ', '')}</h3>;
            }
            if (trimmed.startsWith('## ')) {
                return <h2 key={idx} className="font-bold text-base text-foreground mt-3 mb-1.5">{trimmed.replace('## ', '')}</h2>;
            }
            if (trimmed.startsWith('*   ') || trimmed.startsWith('-   ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
                const bulletText = trimmed.replace(/^(\*\s+|\-\s+|\•\s+|\*\s{3}|\-\s{3})/, '');
                return (
                    <div key={idx} className="flex items-start gap-2 my-1 text-xs sm:text-sm pl-2">
                        <span className="text-primary mt-1 text-xs">•</span>
                        <span>{parseBold(bulletText)}</span>
                    </div>
                );
            }
            if (trimmed === '---') {
                return <hr key={idx} className="my-2 border-border/60" />;
            }
            if (!trimmed) {
                return <div key={idx} className="h-1.5" />;
            }
            return <p key={idx} className="text-xs sm:text-sm leading-relaxed my-0.5">{parseBold(line)}</p>;
        });
    };

    const parseBold = (content: string) => {
        const parts = content.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <>
            {/* Floating Action Button (FAB) */}
            {showFab && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white rounded-full p-3.5 sm:px-4 sm:py-3 shadow-xl hover:shadow-purple-500/35 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 border border-white/20 group"
                    title="Ask AI about device telemetry & weather prediction"
                    aria-label="Ask AI"
                >
                    <div className="relative">
                        <Sparkles className="h-5 w-5 animate-pulse text-amber-200" />
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white animate-ping"></span>
                    </div>
                    <span className="font-semibold text-sm hidden sm:inline tracking-wide">
                        Ask AI
                    </span>
                    <Badge variant="secondary" className="hidden md:inline-flex bg-white/20 text-white text-[10px] px-1.5 py-0 border-none font-normal">
                        Gemini
                    </Badge>
                </button>
            )}

            {/* Chat Drawer Sheet */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetContent 
                    side="right" 
                    className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full bg-background border-l border-border shadow-2xl z-50"
                >
                    {/* Header */}
                    <div className="p-4 border-b bg-muted/30 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md relative shrink-0">
                                <Bot className="h-5 w-5" />
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background"></span>
                            </div>
                            <div>
                                <SheetTitle className="text-base font-bold flex items-center gap-1.5">
                                    <span>EMS AI Assistant</span>
                                    <Badge variant="outline" className="text-[10px] py-0 px-1 border-purple-500/40 text-purple-600 dark:text-purple-400">
                                        Gemini 3.0
                                    </Badge>
                                </SheetTitle>
                                <SheetDescription className="text-xs truncate max-w-[220px] sm:max-w-[260px]">
                                    {deviceName || 'Device'}: <span className="font-mono text-[11px]">{uid}</span>
                                </SheetDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {messages.length > 0 && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={handleClearHistory}
                                    title="Clear chat history"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground"
                                onClick={fetchHistory}
                                title="Refresh history"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {fetchingHistory && messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <p className="text-xs">Loading conversations...</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 space-y-5">
                                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-primary shadow-inner">
                                    <Sparkles className="h-8 w-8 text-purple-500 animate-pulse" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-base text-foreground">
                                        {deviceName || 'ডিভাইস'} এআই অ্যাসিস্ট্যান্ট
                                    </h4>
                                    <p className="text-xs text-muted-foreground max-w-xs">
                                        এই ডিভাইসের লাইভ সেন্সর ডেটা বিশ্লেষণ ও ভবিষ্যৎ আবহাওয়ার পূর্বাভাসের জন্য যেকোনো প্রশ্ন করুন।
                                    </p>
                                </div>

                                {/* Suggested Prompt Cards */}
                                <div className="w-full space-y-2 pt-2 text-left">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                        জনপ্রিয় জিজ্ঞাসা:
                                    </p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {SUGGESTED_PROMPTS.map((item, index) => {
                                            const Icon = item.icon;
                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => handleSend(item.prompt)}
                                                    className="w-full text-left p-2.5 rounded-lg border border-border/70 hover:border-purple-500/50 bg-card hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all text-xs flex items-center gap-2.5 group shadow-sm"
                                                >
                                                    <div className="h-7 w-7 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                        <Icon className="h-3.5 w-3.5" />
                                                    </div>
                                                    <span className="flex-1 font-medium text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400">
                                                        {item.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, index) => {
                                    const isUser = msg.role === 'user';
                                    return (
                                        <div 
                                            key={index} 
                                            className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                                        >
                                            {!isUser && (
                                                <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                                                    <Bot className="h-3.5 w-3.5" />
                                                </div>
                                            )}
                                            <div 
                                                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm shadow-sm ${
                                                    isUser 
                                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none' 
                                                        : 'bg-muted/70 text-foreground border border-border/60 rounded-tl-none'
                                                }`}
                                            >
                                                {isUser ? (
                                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                                ) : (
                                                    <div>{renderFormattedText(msg.message)}</div>
                                                )}
                                                {msg.timestamp && (
                                                    <div className={`text-[10px] mt-1.5 opacity-70 ${isUser ? 'text-right text-purple-100' : 'text-left text-muted-foreground'}`}>
                                                        {formatToBDTime(typeof msg.timestamp === 'string' ? msg.timestamp : new Date(msg.timestamp).toISOString())}
                                                    </div>
                                                )}
                                            </div>
                                            {isUser && (
                                                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0 mt-0.5 shadow-sm">
                                                    <User className="h-3.5 w-3.5" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {loading && (
                                    <div className="flex gap-2.5 justify-start">
                                        <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 animate-pulse">
                                            <Bot className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="bg-muted/70 border border-border/60 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                                            <span>ডিভাইসের সেন্সর তথ্য ও আবহাওয়া বিশ্লেষণ হচ্ছে...</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Suggestion Chips (when chatting) */}
                    {messages.length > 0 && !loading && (
                        <div className="px-4 py-1.5 border-t bg-muted/20 flex gap-1.5 overflow-x-auto no-scrollbar">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] px-2.5 rounded-full shrink-0 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                                onClick={() => handleSend('আগামীকালের বৃষ্টির ঝুঁকি ও আবহাওয়ার পূর্বাভাস কি?')}
                            >
                                <CloudRain className="mr-1 h-3 w-3" />
                                বৃষ্টির পূর্বাভাস
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] px-2.5 rounded-full shrink-0 border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                                onClick={() => handleSend('পানির স্তরের বর্তমান গতিপ্রকৃতি কেমন?')}
                            >
                                <Waves className="mr-1 h-3 w-3" />
                                পানির স্তর
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] px-2.5 rounded-full shrink-0 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={() => handleSend('আজকের সর্বোচ্চ ও সর্বনিম্ন তাপমাত্রা কত ছিল?')}
                            >
                                <Thermometer className="mr-1 h-3 w-3" />
                                তাপমাত্রা
                            </Button>
                        </div>
                    )}

                    {/* Input Bar */}
                    <div className="p-3 sm:p-4 border-t bg-background shrink-0">
                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                            className="flex items-center gap-2"
                        >
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="এই ডিভাইসের তথ্য বা আবহাওয়া সম্পর্কে জিজ্ঞাসা করুন..."
                                disabled={loading}
                                className="flex-1 text-xs sm:text-sm h-10 rounded-full px-4 focus-visible:ring-purple-500"
                            />
                            <Button 
                                type="submit" 
                                disabled={loading || !input.trim()}
                                className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shrink-0 shadow-md p-0"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </form>
                        <p className="text-[10px] text-center text-muted-foreground mt-1.5">
                            Gemini AI দ্বারা চালিত • সেন্সর ইতিহাস ও লাইভ ডেটা সংরক্ষিত
                        </p>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
