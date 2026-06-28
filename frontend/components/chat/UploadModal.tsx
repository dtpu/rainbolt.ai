"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { useChatStore } from "../useChatStore";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSession: (title: string) => Promise<string | void>;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onCreateSession,
}) => {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    const sessionTitle = title.trim() || `Session ${new Date().toLocaleDateString()}`;
    setUploading(true);
    setError(null);

    try {
      const firebaseSessionId = await onCreateSession(sessionTitle);
      if (!firebaseSessionId) throw new Error("Couldn't create the session.");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("session_id", firebaseSessionId);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");

      const store = useChatStore.getState();
      store.clear();
      if (preview) useChatStore.setState({ uploadedImageUrl: preview });

      handleClose();
      router.push(`/chat/${firebaseSessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setTitle("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    clearFile();
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="New session"
      description="Upload a photo and rainbolt.ai will place it on the map."
    >
      <div className="space-y-4">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Session name (optional)"
          disabled={uploading}
          autoFocus
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-muted/60 focus:border-white/20 focus:outline-none focus:ring-0 disabled:opacity-50"
        />

        {/* Drop zone / preview */}
        {!preview ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 transition-colors ${
              dragActive
                ? "border-star-400/60 bg-star-400/[0.04]"
                : "border-white/[0.12] hover:border-white/25 hover:bg-white/[0.02]"
            }`}
          >
            <ImagePlus className="h-7 w-7 text-fg-muted/60" />
            <div className="text-center">
              <p className="text-sm text-fg">
                Drop an image, or <span className="text-star-400">browse</span>
              </p>
              <p className="mt-1 text-xs text-fg-muted/60">PNG or JPG, up to 10MB</p>
            </div>
          </button>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-white/[0.08]">
            <img src={preview} alt="" className="max-h-64 w-full object-cover" />
            <button
              onClick={clearFile}
              disabled={uploading}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:text-white disabled:opacity-40"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
            {file && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                <p className="truncate text-xs text-white/80">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-star-400 px-5 py-2.5 text-sm font-semibold text-space-950 transition-colors hover:bg-star-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? "Uploading…" : "Start session"}
          </button>
        </div>
      </div>
    </Dialog>
  );
};
