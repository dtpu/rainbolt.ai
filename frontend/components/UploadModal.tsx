"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { useChatStore } from "./useChatStore";

interface UploadResult {
  message: string;
  session_id: string;
  filename: string;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  file_path: string;
}

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

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    // Use a default title if none provided
    const sessionTitle =
      title.trim() || `Session ${new Date().toLocaleDateString()}`;

    setUploading(true);
    setError(null);

    try {
      // --- Call external session creation first and get the session ID ---
      const firebaseSessionId = await onCreateSession(sessionTitle);

      if (!firebaseSessionId) {
        throw new Error("Failed to create session - no session ID returned");
      }

      // --- Upload file to API with the Firebase session ID ---
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("session_id", firebaseSessionId); // Pass Firebase session ID to backend

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Upload failed");

      const store = useChatStore.getState();
      store.clear();
      if (preview) useChatStore.setState({ uploadedImageUrl: preview });

      handleClose();
      // Use the Firebase session ID for navigation
      router.push(`/chat/${firebaseSessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setTitle("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  // Reset state when modal closes
  const handleClose = () => {
    clearFile();
    setError(null);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Session"
      description="Name your session and upload an image to begin"
    >
      <div
        className="space-y-6 max-h-[70vh] overflow-y-auto pr-2"
        onWheel={(e) => e.stopPropagation()}
        style={{
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Session Title Input */}
        <div>
          <label
            htmlFor="sessionTitle"
            className="block text-sm font-medium text-white/80 mb-2"
          >
            Session Title{" "}
            <span className="text-white/50 text-xs">(optional)</span>
          </label>
          <input
            id="sessionTitle"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your learning session (or leave blank for default)..."
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={uploading}
            autoFocus
          />
        </div>

        {/* Upload Box */}
        <div
          className={`
            relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer
            ${
              dragActive
                ? "border-[#00a3ff] bg-[#00a3ff]/5 scale-[1.02]"
                : "border-white/20 hover:border-[#00a3ff]/50 hover:bg-white/5"
            }
            ${file ? "border-[#00a3ff] bg-[#00a3ff]/5" : ""}
            group backdrop-blur-sm bg-black/20
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="text-center space-y-3">
            {!file ? (
              <>
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-medium text-white mb-1">
                    Drop your image here
                  </p>
                  <p className="text-sm text-white/60">
                    or{" "}
                    <span className="text-[#00a3ff] font-medium">
                      browse files
                    </span>
                  </p>
                  <p className="text-xs text-white/40 mt-2">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-medium text-white mb-1">
                    {file.name}
                  </p>
                  <p className="text-sm text-white/60">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="mt-2"
                >
                  Change File
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Image Preview */}
        {preview && (
          <div className="border border-white/10 rounded-lg p-3 bg-black/30">
            <p className="text-sm font-medium mb-2 text-white/80">Preview</p>
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-48 object-contain rounded bg-black/50"
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="border border-red-500/20 rounded-lg p-4 bg-red-500/5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-3 h-3 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">
                  Upload Failed
                </p>
                <p className="text-xs text-white/60 mt-0.5">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`flex-1 font-semibold transition-all duration-300 ${
              !file || uploading
                ? "bg-gradient-to-r from-blue-500/30 to-purple-600/30 cursor-not-allowed opacity-60"
                : "bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98]"
            } text-white`}
            size="lg"
          >
            {uploading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Upload & Start Session
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleClose}
            disabled={uploading}
            className="border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
