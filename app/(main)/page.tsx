"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { AuthModal } from "@/components/auth/auth-modal";

export default function Home() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { requireAuth, showAuthModal, setShowAuthModal } = useAuthGuard();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === "application/pdf") {
      setPdfFile(files[0]);
      setPdfUrl("");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && files[0].type === "application/pdf") {
      setPdfFile(files[0]);
      setPdfUrl("");
      setError(""); // Clear any previous errors
    }
  };

  const handleTextareaFocus = () => {
    requireAuth();
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!requireAuth()) return;

    if (!pdfFile) {
      setPdfUrl(e.target.value);
    }
  };

  const handleSubmit = async () => {
    if (!requireAuth()) return;

    if (!pdfFile && !pdfUrl) return;

    setIsUploading(true);
    setError("");

    try {
      let documentId = "";

      if (pdfFile) {
        setUploadProgress("Uploading PDF...");

        // Upload file
        const formData = new FormData();
        formData.append("file", pdfFile);
        formData.append("filename", pdfFile.name);
        formData.append("title", pdfFile.name.replace(/\.pdf$/i, ""));

        const uploadResponse = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Upload failed");
        }

        const uploadResult = await uploadResponse.json();
        documentId = uploadResult.document.id;

        setUploadProgress("Processing PDF text...");

        // Process PDF
        const processResponse = await fetch(`/api/documents/${documentId}/process`, {
          method: "POST",
        });

        if (!processResponse.ok) {
          console.warn("PDF processing failed, but continuing...");
        }

        setUploadProgress("Complete! Opening chat...");

      } else if (pdfUrl) {
        setError("URL upload not implemented yet. Please upload a file instead.");
        return;
      }

      // Navigate to chat
      router.push(`/pdfchat/${documentId}`);

    } catch (error) {
      console.error("Error uploading PDF:", error);
      setError(error instanceof Error ? error.message : "Failed to upload PDF");
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="max-w-2xl w-full space-y-8">
        <div className="relative">
          <label
            htmlFor="pdf-input"
            className="block text-4xl font-bold text-center text-gray-800 mb-8"
          >
            Throw in Your PDF and Chat!
          </label>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {uploadProgress && (
            <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded">
              {uploadProgress}
            </div>
          )}

          <div className="relative">
            <textarea
              id="pdf-input"
              value={pdfFile ? `Selected file: ${pdfFile.name}` : pdfUrl}
              onChange={handleUrlChange}
              onFocus={handleTextareaFocus}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              placeholder="Drag and drop a PDF file here &#10; Or Paste a PDF URL"
              rows={3}
              readOnly={!!pdfFile}
              className={`w-full px-6 py-4 pb-12 border-2 border-dashed rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-center transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : pdfFile
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            />

            <button
              onClick={() => document.getElementById("pdf-upload")?.click()}
              disabled={isUploading}
              className={`absolute bottom-3 left-3 inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isUploading
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <svg
                className="w-4 h-4 mr-1"
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
              Upload
            </button>

            {/* Hidden file input */}
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="pdf-upload"
            />

            {/* Let's Chat button in bottom right */}
            <button
              onClick={handleSubmit}
              disabled={!pdfFile && !pdfUrl || isUploading}
              className={`absolute bottom-3 right-3 inline-flex items-center px-4 py-2 rounded-md text-white font-semibold transition-colors ${
                (pdfFile || pdfUrl) && !isUploading
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                "Let's Chat!"
              )}
            </button>

            {/* Clear button when file is selected */}
            {pdfFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPdfFile(null);
                }}
                className="absolute top-2 right-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode="signin"
      />
    </div>
  );
}
