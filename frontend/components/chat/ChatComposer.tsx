"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { useChatStore } from "../useChatStore";

export function ChatComposer() {
  const [value, setValue] = useState("");
  const { send, sending } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!value.trim() || sending) return;
    const messageToSend = value;
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await send(messageToSend);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  return (
    <div className="shrink-0 border-t border-white/[0.07] p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything…"
          disabled={sending}
          rows={1}
          className="flex-1 resize-none rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-40"
          style={{ maxHeight: "120px", minHeight: "40px" }}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || sending}
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.08] text-white/60 transition-colors hover:bg-white/[0.14] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
