"use client";

import { memo } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  text: string;
  ts: number;
  type?: "status" | "normal";
  image?: string;
}

function ChatMessageComponent({ role, text, type = "normal", image }: ChatMessageProps) {
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
        className={`max-w-[80%] overflow-hidden rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-white/[0.1] text-white"
            : "rounded-bl-sm text-white/75"
        }`}
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="max-h-44 w-full object-cover" />
        )}
        {text && (
          <p className="whitespace-pre-wrap break-words px-3.5 py-2.5">{text}</p>
        )}
      </div>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
