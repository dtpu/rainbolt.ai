"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { useChatStore, type GeoClue } from "@/components/useChatStore";

const EASE = [0.22, 1, 0.36, 1] as const;

// Map-marker pin: flat colour, crisp white ring, tight drop shadow.
const pinBase =
  "relative flex h-6 w-6 items-center justify-center rounded-full leading-none tabular-nums ring-2 ring-white/90 shadow-[0_1px_6px_rgba(0,0,0,0.55)] transition-transform duration-150 hover:scale-110";

// Detached card, flipped above the pin when it sits low in the photo.
// Module-scope (not re-created per render) so open cards never re-mount
// - and re-animate - while unrelated state changes.
const Card = ({ children, above }: { children: React.ReactNode; above?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.92, y: above ? 5 : -5 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: above ? 4 : -4 }}
    transition={{ duration: 0.16, ease: EASE }}
    className={`absolute left-1/2 z-10 w-56 -translate-x-1/2 rounded-lg border border-white/[0.1] bg-space-900 p-3 text-left shadow-[0_10px_36px_rgba(0,0,0,0.65)] ${
      above ? "bottom-[34px]" : "top-[34px]"
    }`}
  >
    {children}
  </motion.div>
);

const numBadge = (n: number, cls = "") => (
  <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold leading-none tabular-nums text-white ${cls}`}>
    {n}
  </span>
);

interface Note {
  id: string;
  x: number; // width fraction
  y: number; // height fraction
  text: string;
}

/** Chat messages dispatch this to jump to a pin (see ChatMessage). */
export interface PinFocus {
  index: number;
  nonce: number;
}

/**
 * The analyzed photo with annotations: numbered pins for the AI's clues
 * (positions ship with the clue data) and amber pins the user drops
 * themselves. A chip bar under the photo lists everything compactly, so the
 * pane has no dead space and the clues read as a checklist. User notes persist per session in
 * localStorage and are fed to the model as chat context. Pins are placed in
 * width/height fractions inside a wrapper that shrink-wraps the img, so
 * they stay glued at any size.
 */
export function ImageAnnotator({
  src,
  clues,
  sessionId,
  focus,
}: {
  src: string;
  clues: GeoClue[];
  sessionId: string;
  /** Bumping this opens the given AI pin (used by clue links in the chat). */
  focus?: PinFocus | null;
}) {
  const storageId = `rainbolt-notes-${sessionId}`;
  const [notes, setNotes] = useState<Note[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number; text: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null); // clue-N or note id
  const draftInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageId);
      setNotes(raw ? JSON.parse(raw) : []);
    } catch {
      setNotes([]);
    }
    setDraft(null);
    setAdding(false);
    setOpenId(null);
  }, [storageId]);

  // A clue link in the chat pops its pin open.
  useEffect(() => {
    if (focus) setOpenId(`clue-${focus.index}`);
  }, [focus]);

  const persist = (next: Note[]) => {
    setNotes(next);
    try {
      localStorage.setItem(storageId, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (draft) draftInputRef.current?.focus();
  }, [draft]);

  const placeDraft = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!adding) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDraft({
      x: Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)),
      y: Math.min(0.98, Math.max(0.02, (e.clientY - r.top) / r.height)),
      text: "",
    });
    setAdding(false);
  };

  const saveDraft = () => {
    if (!draft) return;
    const text = draft.text.trim();
    if (text) {
      persist([...notes, { id: `n-${Math.round(performance.now())}`, x: draft.x, y: draft.y, text }]);
      // Tee the note up in the chat input so the user can ask about it -
      // they finish the question there; nothing sends on its own.
      useChatStore.setState({ draft: `About the spot I marked "${text}":` });
    }
    setDraft(null);
  };

  const pinned = clues.filter((c) => c.at);
  const unpinned = clues.filter((c) => !c.at);

  return (
    <div className="relative flex h-full min-h-0 flex-col items-center p-6 pb-5 pt-16">
      {/* One obvious way in: drop your own pin on the photo. */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2.5">
        <AnimatePresence>
        {adding && (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="rounded-md bg-space-900/85 px-2.5 py-1.5 text-[11px] text-star-300 backdrop-blur-md"
          >
            Click anywhere on the photo to drop it
          </motion.span>
        )}
        </AnimatePresence>
        <button
          onClick={() => { setAdding((a) => !a); setDraft(null); setOpenId(null); }}
          className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-md transition-colors ${
            adding
              ? "border-star-400/60 bg-star-400 text-space-950"
              : "border-white/[0.1] bg-space-900/85 text-fg hover:bg-white/[0.08]"
          }`}
        >
          <Pencil className="h-3.5 w-3.5" />
          {adding ? "Cancel" : "Add pin"}
        </button>
      </div>
      {/* ── photo + pins ── */}
      <div className="relative my-auto min-h-0 max-w-full overflow-visible">
        <div
          className={`relative overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl ${adding ? "cursor-crosshair" : ""}`}
          onClick={placeDraft}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Analyzed photo" className="max-h-[64vh] w-auto max-w-full object-contain" draggable={false} />
        </div>

        {/* AI clue pins */}
        {pinned.map((c, i) => {
          const id = `clue-${i}`;
          const on = openId === id;
          return (
            <motion.div
              key={id}
              className="absolute"
              initial={false}
              animate={{ left: `${c.at![0] * 100}%`, top: `${c.at![1] * 100}%` }}
              transition={{ duration: 0.45, ease: EASE }}
              style={{ x: "-50%", y: "-50%" }}
            >
              {/* Pop-in lives on a wrapper: framer's inline transform would
                  otherwise clobber the button's CSS hover/active scaling. */}
              <motion.span
                className="block"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.12 + i * 0.06, duration: 0.25, ease: EASE }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenId(on ? null : id); }}
                  aria-label={`Clue ${i + 1}: ${c.sign}`}
                  className={`${pinBase} text-[11px] font-semibold ${
                    on ? "scale-125 bg-sky-400 text-white ring-white" : "bg-sky-500 text-white"
                  }`}
                >
                  {i + 1}
                </button>
              </motion.span>
              <AnimatePresence>
              {on && (
                <Card above={c.at![1] > 0.72}>
                  <div className="flex items-start gap-2">
                    {numBadge(i + 1, "mt-px")}
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-snug text-fg">{c.sign}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{c.implies}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useChatStore.setState({ draft: `About clue ${i + 1} ("${c.sign}"):` });
                    }}
                    className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-sky-300 transition-colors hover:text-sky-200"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Ask in chat
                  </button>
                </Card>
              )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* user note pins */}
        {notes.map((n) => {
          const on = openId === n.id;
          return (
            <div
              key={n.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
            >
              <motion.span
                className="block"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenId(on ? null : n.id); }}
                  aria-label={`Your note: ${n.text}`}
                  className={`${pinBase} ${
                    on ? "scale-125 bg-star-300 text-space-950 ring-white" : "bg-star-400 text-space-950"
                  }`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </motion.span>
              <AnimatePresence>
              {on && (
                <Card above={n.y > 0.72}>
                  <div className="flex items-start gap-2">
                    <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-star-400 text-space-950">
                      <Pencil className="h-2.5 w-2.5" />
                    </span>
                    <p className="min-w-0 flex-1 text-xs leading-snug text-fg">{n.text}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        persist(notes.filter((x) => x.id !== n.id));
                        setOpenId(null);
                      }}
                      aria-label="Remove note"
                      className="shrink-0 text-fg-muted/60 transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useChatStore.setState({ draft: `About the spot I marked "${n.text}":` });
                    }}
                    className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-sky-300 transition-colors hover:text-sky-200"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Ask in chat
                  </button>
                </Card>
              )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* draft note being typed */}
        <AnimatePresence>
        {draft && (
          <div
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.span
              className={`${pinBase} bg-star-400 text-space-950`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <Pencil className="h-3 w-3" />
            </motion.span>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: draft.y > 0.72 ? 5 : -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.16, ease: EASE }}
              className={`absolute left-1/2 z-10 w-60 -translate-x-1/2 rounded-lg border border-white/[0.1] bg-space-900 p-2.5 shadow-[0_10px_36px_rgba(0,0,0,0.65)] ${draft.y > 0.72 ? "bottom-[34px]" : "top-[34px]"}`}>
              <input
                ref={draftInputRef}
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveDraft();
                  if (e.key === "Escape") setDraft(null);
                }}
                placeholder="What do you see here?"
                className="w-full rounded-md bg-white/[0.06] px-2.5 py-1.5 text-xs text-fg placeholder:text-fg-muted/50 focus:outline-none focus:ring-1 focus:ring-star-400/60"
              />
              <div className="mt-2 flex justify-end gap-3 text-[11px]">
                <button onClick={() => setDraft(null)} className="text-fg-muted transition-colors hover:text-fg">Cancel</button>
                <button onClick={saveDraft} className="font-semibold text-star-300 transition-colors hover:text-star-200">Save</button>
              </div>
            </motion.div>
          </div>
        )}
        </AnimatePresence>
      </div>

      {/* Figure caption, not a widget: a quiet clue line, notes underneath. */}
      <div className="w-full max-w-4xl space-y-2 px-2 pt-6 text-xs">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        {pinned.map((c, i) => {
          const id = `clue-${i}`;
          const on = openId === id;
          return (
            <button
              key={id}
              onClick={() => setOpenId(on ? null : id)}
              title={c.implies}
              className={`flex items-center gap-1.5 transition-colors ${on ? "text-fg" : "text-fg-muted hover:text-fg"}`}
            >
              <span className={`font-semibold tabular-nums ${on ? "text-sky-300" : "text-sky-400/90"}`}>{i + 1}</span>
              {c.sign}
            </button>
          );
        })}
        {unpinned.map((c, i) => (
          <span key={`u-${i}`} title={c.implies} className="text-fg-muted/50">
            {c.sign}
          </span>
        ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        {notes.map((n) => {
          const on = openId === n.id;
          return (
            <span key={n.id} className={`group flex min-w-0 max-w-56 items-center gap-1.5 ${on ? "text-fg" : "text-fg-muted"}`}>
              <button onClick={() => setOpenId(on ? null : n.id)} className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-fg">
                <Pencil className={`h-3 w-3 shrink-0 ${on ? "text-star-300" : "text-star-400/90"}`} />
                <span className="truncate">{n.text}</span>
              </button>
              <button
                onClick={() => { persist(notes.filter((x) => x.id !== n.id)); if (on) setOpenId(null); }}
                aria-label="Remove note"
                className="shrink-0 text-fg-muted/0 transition-colors group-hover:text-fg-muted/50 hover:!text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <button
          onClick={() => { setAdding((a) => !a); setDraft(null); setOpenId(null); }}
          className={`flex items-center gap-1 transition-colors ${adding ? "text-star-300" : "text-fg-muted/70 hover:text-fg"}`}
        >
          <Plus className="h-3 w-3" />
          {adding ? "click the photo to place it" : "Add pin"}
        </button>
        </div>
      </div>
    </div>
  );
}
