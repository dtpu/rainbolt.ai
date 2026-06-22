"use client";

import { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useChatStore } from './useChatStore';

export function ChatComposer() {
    const [value, setValue] = useState('');
    const { send, sending } = useChatStore();
    const sessionId = useChatStore((s) => s.sessionId);
    const isDemo = sessionId?.startsWith('demo-') ?? false;
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = async () => {
        if (!value.trim() || sending || isDemo) return;

        const messageToSend = value;
        setValue('');

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        await send(messageToSend);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter to send, Shift+Enter for new line
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [value]);

    return (
        <div className="flex-shrink-0 border-t border-white/10 p-3 md:p-4 bg-gradient-to-t from-black/40 to-transparent">
            <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isDemo ? "Sign in to chat with Rainbolt AI" : sending ? "Sending..." : "Type a message..."}
                        disabled={sending || isDemo}
                        rows={1}
                        className="w-full resize-none rounded-xl px-4 py-2.5 pr-10 bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        style={{ maxHeight: '120px', minHeight: '42px' }}
                        aria-label="Message input"
                    />
                </div>

                <button
                    onClick={handleSend}
                    disabled={!value.trim() || sending || isDemo}
                    className="flex-shrink-0 p-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    aria-label="Send message"
                >
                    <Send className="w-5 h-5 text-white" />
                </button>
            </div>

            {isDemo ? (
                <p className="text-xs text-white/40 mt-2 px-1">
                    This is a read-only example session. <a href="/login" className="text-sky-400 hover:text-sky-300">Sign in</a> to chat and create your own.
                </p>
            ) : (
                <p className="text-xs text-white/40 mt-2 px-1">
                    Press <kbd className="px-1 py-0.5 rounded bg-white/10">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-white/10">Shift+Enter</kbd> for new line
                </p>
            )}
        </div>
    );
}
