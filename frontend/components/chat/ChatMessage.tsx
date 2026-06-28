"use client";

import { memo } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  text: string;
  ts: number;
  type?: "status" | "normal";
}

function ChatMessageComponent({ role, text, type = "normal" }: ChatMessageProps) {
  const isUser = role === "user";

  if (type === "status") {
    return (
      <div className="flex w-full justify-center py-1 mb-1">
        <p className="text-[11px] italic text-white/30">{text}</p>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-2 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-white/[0.1] text-white"
            : "rounded-bl-sm text-white/75"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
