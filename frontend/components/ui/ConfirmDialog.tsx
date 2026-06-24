"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ConfirmDialog({
  title,
  confirmLabel,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-space-950/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-white/10 bg-space-900 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
            <Trash2 className="h-6 w-6 text-destructive" />
          </div>
          <h3
            id="confirm-dialog-title"
            className="mt-5 text-xl font-bold text-fg"
          >
            {title}
          </h3>
          <div className="mt-3">{children}</div>
          <div className="mt-8 flex gap-3">
            <Button
              autoFocus
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-white/15 bg-transparent text-fg hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-destructive text-white hover:bg-destructive/85"
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
