"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();

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
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!pdfFile) {
      setPdfUrl(e.target.value);
    }
  };

  const handleSubmit = () => {
    if (pdfFile || pdfUrl) {
      // TODO: Process PDF and navigate to chat
      console.log("Processing PDF:", pdfFile || pdfUrl);
      router.push("/pdfchat/new");
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

          <div className="relative">
            <textarea
              id="pdf-input"
              value={pdfFile ? `Selected file: ${pdfFile.name}` : pdfUrl}
              onChange={handleUrlChange}
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
              className="absolute bottom-3 left-3 inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              disabled={!pdfFile && !pdfUrl}
              className={`absolute bottom-3 right-3 inline-flex items-center px-4 py-2 rounded-md text-white font-semibold transition-colors ${
                pdfFile || pdfUrl
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              Let&apos;s Chat!
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
    </div>
  );
}
