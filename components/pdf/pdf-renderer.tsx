/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface PDFRendererProps {
  fileUrl: string;
  currentPage: number;
  onDocumentLoad: (numPages: number) => void;
  onError: (error: string) => void;
  onPageRender: () => void;
}

export function PDFRenderer({
  fileUrl,
  currentPage,
  onDocumentLoad,
  onError,
  onPageRender,
}: PDFRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Simple script loading approach from PDF.js FAQ
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load PDF.js script if not already loaded
    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        setIsReady(true);
      };
      script.onerror = () => onError("Failed to load PDF.js");
      document.head.appendChild(script);
    } else {
      setIsReady(true);
    }
  }, [onError]);

  // Load and render PDF - simplified approach from FAQ
  useEffect(() => {
    if (!isReady || !fileUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    console.log("Loading PDF:", fileUrl);

    let isCancelled = false;
    let renderTask: any = null;

    // Simple PDF.js approach from FAQ
    (window as any).pdfjsLib.getDocument(fileUrl).promise
      .then((pdf: any) => {
        if (isCancelled) return;
        console.log("PDF loaded, pages:", pdf.numPages);
        onDocumentLoad(pdf.numPages);

        // Get the requested page
        return pdf.getPage(currentPage);
      })
      .then((page: any) => {
        if (isCancelled) return;
        console.log("Rendering page:", currentPage);

        const viewport = page.getViewport({ scale: 1 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        renderTask = page.render(renderContext);
        return renderTask.promise;
      })
      .then(() => {
        if (isCancelled) return;
        console.log("Page rendered successfully");
        onPageRender();
      })
      .catch((error: any) => {
        if (isCancelled) return;
        console.error("Error:", error);
        onError(error.message || "Failed to load PDF");
      });

    // Cleanup function to prevent infinite rendering
    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [isReady, fileUrl, currentPage]);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-gray-600">Loading PDF...</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg border border-gray-300 rounded p-4">
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto block"
      />
    </div>
  );
}