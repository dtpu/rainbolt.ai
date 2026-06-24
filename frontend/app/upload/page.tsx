"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useChatStore } from "@/components/useChatStore";
import "../glow.css";

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

export default function UploadPage() {
  const router = useRouter();
  const connectWebSocket = useChatStore((state) => state.connectWebSocket);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
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

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setResult(data);

      // Clear previous session and store the upload info
      const store = useChatStore.getState();
      store.clear(); // Clear previous messages and session

      // Store image directly in zustand (don't pass via URL - too large)
      if (preview) {
        useChatStore.setState({ uploadedImageUrl: preview });
      }

      // Redirect to chat with session ID only (file path is always uploads/{session_id}.extension)
      router.push(`/chat/${data.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden flex items-center justify-center">
      {/* Dark background with vignette effect */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#12121a] to-[#0a0a0f] pointer-events-none" />
      <div className="vignette" />

      {/* Subtle animated background pattern */}
      <div className="fixed inset-0 opacity-5">
        <div
          className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent animate-pulse"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)",
            animation: "float 6s ease-in-out infinite",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white [text-shadow:0_0_10px_#fff,0_0_20px_#00a3ff]">
            Image Upload
          </h1>
          <p className="text-white/60 text-lg">
            Upload your images with our secure, fast processing system. Drag &
            drop or click to select files.
          </p>
        </div>

        {/* Main Upload Area - Centered */}
        <div className="space-y-8">
          {/* Upload Box */}
          <div className="space-y-6">
            <div
              className={`
                relative border-2 border-dashed rounded-xl p-12 transition-all duration-300 cursor-pointer
                ${
                  dragActive
                    ? "border-[#00a3ff] bg-[#00a3ff]/5 scale-105"
                    : "border-white/10 hover:border-[#00a3ff]/50 hover:bg-white/5"
                }
                ${file ? "border-[#00a3ff] bg-[#00a3ff]/5" : ""}
                group backdrop-blur-sm bg-black/30
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={openFileDialog}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="relative z-10 text-center space-y-4">
                {!file ? (
                  <>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <svg
                        className="w-8 h-8 text-white"
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
                      <p className="text-lg font-medium text-white mb-2">
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
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-green-500"
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
                      <p className="text-lg font-medium text-white mb-1">
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

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex-1 h-12 text-base font-medium"
                size="lg"
              >
                {uploading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5"
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
                  "Upload Image"
                )}
              </Button>

              {file && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={clearFile}
                  className="h-12"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Preview & Results */}
          <div className="space-y-6">
            {/* Image Preview */}
            {preview && (
              <div className="border border-white/10 rounded-xl p-4 bg-black/30 backdrop-blur-sm">
                <h3 className="text-lg font-medium mb-4 text-white">Preview</h3>
                <div className="relative group">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full max-h-64 object-contain rounded-lg bg-black/50"
                  />
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}

            {/* Success Result */}
            {result && (
              <div className="border border-green-500/20 rounded-xl p-6 bg-green-500/5 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-500"
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
                  <h3 className="text-lg font-semibold text-green-400">
                    Upload Successful!
                  </h3>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-white/60">Filename:</span>
                      <p className="font-medium text-white">
                        {result.filename}
                      </p>
                    </div>
                    <div>
                      <span className="text-white/60">Size:</span>
                      <p className="font-medium text-white">
                        {(result.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div>
                      <span className="text-white/60">Dimensions:</span>
                      <p className="font-medium text-white">
                        {result.dimensions.width} × {result.dimensions.height}px
                      </p>
                    </div>
                    <div>
                      <span className="text-white/60">Format:</span>
                      <p className="font-medium text-white">{result.format}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-white/60">Saved to:</span>
                    <p className="font-medium text-white font-mono text-xs bg-black/30 p-2 rounded mt-1">
                      {result.file_path}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="border border-red-500/20 rounded-xl p-6 bg-red-500/5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-red-500"
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
                    <h3 className="text-lg font-semibold text-red-400">
                      Upload Failed
                    </h3>
                    <p className="text-sm text-white/60 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          33% {
            transform: translateY(-10px) rotate(1deg);
          }
          66% {
            transform: translateY(5px) rotate(-1deg);
          }
        }
      `}</style>
    </div>
  );
}
