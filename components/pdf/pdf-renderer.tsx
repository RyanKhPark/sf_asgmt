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
  highlightPhrases?: string[];
}

export function PDFRenderer({
  fileUrl,
  currentPage,
  onDocumentLoad,
  onError,
  onPageRender,
  highlightPhrases = [],
}: PDFRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [pageTextItems, setPageTextItems] = useState<any[]>([]);

  // Utility function to normalize text for matching
  const normalizeText = (text: string): string => {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[""'']/g, '"')
      .trim()
      .toLowerCase();
  };

  // Check if a text item should be highlighted
  const shouldHighlight = (textItem: any): boolean => {
    if (!highlightPhrases.length) return false;

    const itemText = normalizeText(textItem.str);
    return highlightPhrases.some(phrase => {
      const normalizedPhrase = normalizeText(phrase);
      return itemText.includes(normalizedPhrase) || normalizedPhrase.includes(itemText);
    });
  };

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
      .then(async (page: any) => {
        if (isCancelled) return;
        console.log("Rendering page:", currentPage);

        const viewport = page.getViewport({ scale: 1 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        // Extract text content for highlighting
        try {
          const textContent = await page.getTextContent();
          setPageTextItems(textContent.items);
          console.log(`Extracted ${textContent.items.length} text items from page ${currentPage}`);
        } catch (textError) {
          console.warn("Failed to extract text content:", textError);
        }

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
    <div className="bg-white shadow-lg border border-gray-300 rounded p-4 relative">
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto block"
      />

      {/* Text overlay for highlighting */}
      <div
        ref={textLayerRef}
        className="absolute top-4 left-4 pointer-events-none"
        style={{
          width: canvasRef.current?.width || 0,
          height: canvasRef.current?.height || 0,
        }}
      >
        {pageTextItems.map((item, index) => {
          if (!shouldHighlight(item)) return null;

          const transform = item.transform;
          // PDF.js transform matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
          const x = transform[4];
          const y = transform[5];
          const fontSize = transform[0]; // scaleX as font size approximation

          return (
            <div
              key={index}
              className="absolute bg-yellow-300 bg-opacity-50 pointer-events-none animate-pulse"
              style={{
                left: x,
                top: (canvasRef.current?.height || 0) - y - fontSize, // Flip Y coordinate
                fontSize: fontSize,
                height: fontSize,
                minWidth: item.width || 'auto',
              }}
            >
              {/* Invisible text for positioning */}
              <span className="opacity-0">{item.str}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}