"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { EvidenceStrip } from "./EvidenceStrip";
import type { GeoClue, Marker } from "@/components/useChatStore";

/** Chat -> photo view: pop the numbered pin open (page.tsx listens). */
const openPin = (index: number) =>
  window.dispatchEvent(new CustomEvent("rainbolt-open-pin", { detail: index }));

// Turn mentions of pinned clues ("Red paper lanterns", "clue 2", "#3") into
// links that flip the centre stage to the annotated photo and pop that pin.
function linkifyClues(text: string, clues?: GeoClue[]): React.ReactNode {
  if (!clues || clues.length === 0) return text;
  const lower = text.toLowerCase();
  type Hit = { start: number; end: number; index: number };
  const hits: Hit[] = [];

  clues.forEach((c, i) => {
    if (!c.at) return;
    const words = c.sign.split(" ");
    // Full sign first, then its leading words - enough to catch paraphrases
    // like "A raised JR rail embankment closes off..." for "JR rail embankment
    // at the lane's end".
    for (const cand of [c.sign, words.slice(0, 3).join(" "), words.slice(0, 2).join(" ")]) {
      if (cand !== c.sign && cand.split(" ").length < 2) continue;
      const at = lower.indexOf(cand.toLowerCase());
      if (at >= 0) {
        hits.push({ start: at, end: at + cand.length, index: i });
        break;
      }
    }
  });

  // Explicit references: "clue 2", "pin 3", "#4".
  const re = /\b(?:clue|pin)\s*#?(\d+)\b|#(\d+)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = parseInt(m[1] ?? m[2], 10) - 1;
    if (n >= 0 && n < clues.length && clues[n]?.at) {
      hits.push({ start: m.index, end: m.index + m[0].length, index: n });
    }
  }
  if (hits.length === 0) return text;

  hits.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start < pos) continue; // drop overlaps
    out.push(text.slice(pos, h.start));
    out.push(
      <button
        key={`${h.start}-${h.index}`}
        onClick={() => openPin(h.index)}
        title="Show on the photo"
        className="inline text-sky-300 transition-colors hover:text-sky-200"
      >
        <span className="mr-1 inline-flex h-[15px] w-[15px] items-center justify-center align-middle rounded-full bg-sky-500 text-[9px] font-bold leading-none text-white">
          {h.index + 1}
        </span>
        <span className="underline decoration-sky-400/50 decoration-dotted underline-offset-2">
          {text.slice(h.start, h.end)}
        </span>
      </button>,
    );
    pos = h.end;
  }
  out.push(text.slice(pos));
  return out;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  text: string;
  ts: number;
  type?: "status" | "normal";
  image?: string;
  /** Candidate this message cites: renders sourced nearby photos under it. */
  evidence?: Marker;
  /** The best guess's photo clues - mentions become jump-to-pin links. */
  clues?: GeoClue[];
}

function ChatMessageComponent({ role, text, type = "normal", image, evidence, clues }: ChatMessageProps) {
  const isUser = role === "user";

  if (type === "status") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex w-full justify-center py-1 mb-1"
      >
        <p className="text-[11px] italic text-white/30">{text}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="mb-2 w-full"
    >
      <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
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
            <p className="whitespace-pre-wrap break-words px-3.5 py-2.5">
              {isUser ? text : linkifyClues(text, clues)}
            </p>
          )}
        </div>
      </div>
      {evidence && !isUser && (
        <div className="mt-0.5 px-3.5">
          <EvidenceStrip marker={evidence} />
        </div>
      )}
    </motion.div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
