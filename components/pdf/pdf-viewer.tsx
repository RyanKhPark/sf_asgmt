"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { HighlightLayer } from "./highlight-layer";
import {
  normalizeText,
  toWords,
  sentenceSplit,
  jaccard,
} from "@/lib/pdf-text-utils";
import { useImageRects } from "@/hooks/use-image-rects";
import { useAnnotations } from "@/hooks/use-annotations";
import { useAiHighlights } from "@/hooks/use-ai-highlights";
import { useTextHighlighter } from "@/hooks/use-text-highlighter";
import type { Highlight } from "@/types/pdf";
import { Loader2 } from "lucide-react";

interface PDFViewport {
  width: number;
  height: number;
  scale: number;
  rotation: number;
  transform: number[];
}

interface PDFTextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
}

interface PDFTextContent {
  items: PDFTextItem[];
}

interface PDFPageProxy {
  getViewport: (params: { scale: number; rotation?: number }) => PDFViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFViewport;
  }) => { promise: Promise<void> };
  getTextContent: () => Promise<PDFTextContent>;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

interface PDFPage {
  pageNumber: number;
  viewport: PDFViewport;
  canvas?: HTMLCanvasElement;
  textLayer?: HTMLDivElement;
  rendered: boolean;
}

// Highlight type imported from @/types/pdf

interface PDFViewerAdvancedProps {
  fileUrl: string;
  documentId?: string;
  onTextSelected?: (text: string, pageNumber: number) => void;
  onHighlightCreated?: (highlight: Highlight) => void;
  aiHighlightPhrases?: string[];
  activeMessageId?: string; // Optional: link AI highlights to this message
  aiTopK?: number; // Optional: number of top matches to highlight
  aiMinScore?: number; // Optional: minimum score threshold
  onDocumentLoad?: (numPages: number) => void;
  onError?: (error: string) => void;
  onNoMatchFound?: (message: string) => void;
}

export function PDFViewerAdvanced({
  fileUrl,
  documentId,
  onTextSelected,
  onHighlightCreated,
  aiHighlightPhrases = [],
  activeMessageId,
  aiTopK = 3,
  aiMinScore = 0.15,
  onDocumentLoad,
  onError,
  onNoMatchFound,
}: PDFViewerAdvancedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  // Removed manual selection state
  const [scale] = useState(1);
  const renderingPages = useRef(new Set<number>());
  const renderedPages = useRef(new Set<number>());
  const visiblePagesRef = useRef(new Set<number>());
  const { interceptDrawImage, getRects } = useImageRects();
  const { loadExisting } = useAnnotations();
  const circledPagesRef = useRef(new Set<number>());

  // Load PDF.js library
  useEffect(() => {
    if (typeof window === "undefined") return;

    type PDFJSLib = {
      getDocument: (params: {
        url: string;
        cMapUrl: string;
        cMapPacked: boolean;
        withCredentials: boolean;
      }) => { promise: Promise<PDFDocumentProxy> };
      GlobalWorkerOptions: { workerSrc: string };
    };

    const w = window as unknown as { pdfjsLib?: PDFJSLib };

    if (!w.pdfjsLib) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js";
      script.onload = () => {
        const w2 = window as unknown as { pdfjsLib: PDFJSLib };
        w2.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
        setIsReady(true);
      };
      script.onerror = () => onError?.("Failed to load PDF.js");
      document.head.appendChild(script);
    } else {
      setIsReady(true);
    }
  }, [onError]);

  // Load PDF document
  useEffect(() => {
    if (!isReady || !fileUrl) return;

    // Clear any previously rendered pages
    renderedPages.current.clear();
    renderingPages.current.clear();

    const loadPdf = async () => {
      try {
        const pdfjsLib = (
          window as unknown as {
            pdfjsLib: {
              getDocument: (params: {
                url: string;
                cMapUrl: string;
                cMapPacked: boolean;
                withCredentials: boolean;
              }) => { promise: Promise<PDFDocumentProxy> };
            };
          }
        ).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument({
          url: fileUrl,
          cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
          withCredentials: false,
        });

        const pdf = await loadingTask.promise;

        setPdfDocument(pdf);
        onDocumentLoad?.(pdf.numPages);

        // Initialize pages structure
        const pageStructures: PDFPage[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });

          pageStructures.push({
            pageNumber: i,
            viewport,
            rendered: false,
          });
        }
        setPages(pageStructures);
      } catch (error) {
        console.error("Error loading PDF:", error);
        onError?.("Failed to load PDF document");
      }
    };

    loadPdf();
  }, [isReady, fileUrl, scale, onDocumentLoad, onError]);

  // Render a single page
  const renderPage = useCallback(
    async (pageIndex: number) => {
      if (
        !pdfDocument ||
        renderingPages.current.has(pageIndex) ||
        renderedPages.current.has(pageIndex)
      ) {
        return;
      }

      renderingPages.current.add(pageIndex);

      try {
        const page = await pdfDocument.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale });

        // Create or get canvas
        const canvasId = `pdf-canvas-${pageIndex}`;
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;

        if (!canvas) {
          console.error(`Canvas not found for page ${pageIndex + 1}`);
          renderingPages.current.delete(pageIndex);
          return;
        }

        const context = canvas.getContext("2d");
        if (!context) {
          renderingPages.current.delete(pageIndex);
          return;
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Fill with white background first
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Render PDF page
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // Intercept drawImage to capture image rectangles via hook
        const restore = interceptDrawImage(context, pageIndex + 1);
        const renderTask = page.render(renderContext);
        await renderTask.promise;

        // Double check canvas actually has content

        // Restore drawImage
        if (restore) restore();

        // Mark as rendered
        renderedPages.current.add(pageIndex);

        // Create text layer for selection
        const textLayerId = `pdf-text-${pageIndex}`;
        const textLayerDiv = document.getElementById(
          textLayerId
        ) as HTMLDivElement;

        if (textLayerDiv) {
          const textContent = await page.getTextContent();
          textLayerDiv.innerHTML = "";

          // Set the CSS scale factor as required by PDF.js
          textLayerDiv.style.setProperty("--scale-factor", scale.toString());

          // Simple text rendering for now
          textContent.items.forEach((item: PDFTextItem) => {
            if (item.str.trim()) {
              const textSpan = document.createElement("span");
              textSpan.textContent = item.str;
              textSpan.style.position = "absolute";
              textSpan.style.left = `${item.transform[4]}px`;
              textSpan.style.top = `${
                viewport.height - item.transform[5] - item.transform[0]
              }px`;
              textSpan.style.fontSize = `${item.transform[0]}px`;
              textSpan.style.fontFamily = item.fontName || "sans-serif";
              textSpan.style.transformOrigin = "0% 0%";
              textLayerDiv.appendChild(textSpan);
            }
          });
        }

        // Mark page as rendered
        setPages((prev) =>
          prev.map((p, idx) =>
            idx === pageIndex ? { ...p, rendered: true } : p
          )
        );
      } catch (error) {
        console.error(`Error rendering page ${pageIndex + 1}:`, error);
      } finally {
        renderingPages.current.delete(pageIndex);
      }
    },
    [pdfDocument, scale]
  );

  // Trigger initial page render
  useEffect(() => {
    if (pages.length > 0 && pdfDocument) {
      renderPage(0);
    }
  }, [pages, pdfDocument, renderPage]);

  // Intersection Observer for viewport detection
  useEffect(() => {
    if (!containerRef.current || pages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageIndex = parseInt(
            entry.target.getAttribute("data-page-index") || "0"
          );

          if (entry.isIntersecting) {
            visiblePagesRef.current.add(pageIndex);

            // Render visible page and adjacent pages for smooth scrolling
            renderPage(pageIndex);
            if (pageIndex > 0) renderPage(pageIndex - 1);
            if (pageIndex < pages.length - 1) renderPage(pageIndex + 1);
          } else {
            visiblePagesRef.current.delete(pageIndex);
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: "100px",
        threshold: 0.01,
      }
    );

    // Observe all page containers
    const pageElements = containerRef.current.querySelectorAll(
      ".pdf-page-container"
    );
    pageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [pages, renderPage]);

  const { waitForTextLayer, selectAndHighlightText } = useTextHighlighter({
    onTextSelected,
    onHighlightCreated,
    setHighlights,
  });

  // Fallback function to create manual highlight (used programmatically)
  const createManualHighlight = useCallback(
    (pageNumber: number, text: string) => {
      const highlight: Highlight = {
        id: `ai-highlight-${Date.now()}-${pageNumber}`,
        pageNumber: pageNumber,
        text: text,
        rects: [{ x: 50, y: 150, width: 400, height: 25 }], // Fallback coordinates
        color: "#ffff00",
        type: "ai",
      };

      setHighlights((prev) => [...prev, highlight]);

      // Store in database
      if (onHighlightCreated) {
        onHighlightCreated(highlight);
      }
    },
    [onHighlightCreated]
  );

  // Removed manual selection handlers and selection-to-highlight UI

  // Load existing highlights from database when PDF loads
  const [highlightsLoaded, setHighlightsLoaded] = useState(false);

  useEffect(() => {
    if (!pdfDocument || !documentId || highlightsLoaded || pages.length === 0)
      return;

    const loadExistingHighlights = async () => {
      try {
        const mapped = await loadExisting(documentId);
        if (mapped.length > 0) setHighlights((prev) => [...prev, ...mapped]);
        setHighlightsLoaded(true);
      } catch (error) {
        console.error("Failed to load existing highlights:", error);
        setHighlightsLoaded(true);
      }
    };

    // Load immediately; overlay rendering does not depend on canvas/text layer
    loadExistingHighlights();
  }, [pdfDocument, documentId, highlightsLoaded, pages.length]);

  useAiHighlights({
    pdfDocument,
    aiHighlightPhrases,
    renderPage,
    selectAndHighlightText,
    createManualHighlight,
    onNoMatchFound,
    pages,
    getRects,
    onHighlightCreated,
    setHighlights,
    aiTopK,
    aiMinScore,
    waitForTextLayer,
  });

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-gray-600">Loading PDF viewer...</p>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* PDF container with vertical scroll */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto overflow-x-hidden bg-gray-100"
        style={
          {
            scrollBehavior: "smooth",
            "--scale-factor": scale,
            maxWidth: pages[0] ? `${pages[0].viewport.width + 40}px` : "100%",
            margin: "0 auto",
          } as React.CSSProperties
        }
      >
        <div className="flex flex-col items-center py-4 gap-4">
          {pages.map((page, index) => (
            <div
              key={index}
              data-page-index={index}
              className="pdf-page-container relative bg-white shadow-lg"
              style={{
                width: `${page.viewport.width}px`,
                height: `${page.viewport.height}px`,
              }}
            >
              {/* Canvas for PDF rendering */}
              <canvas
                id={`pdf-canvas-${index}`}
                className="absolute top-0 left-0"
              />

              {/* Text layer for selection */}
              <div
                id={`pdf-text-${index}`}
                className="absolute top-0 left-0 textLayer"
                style={
                  {
                    width: "100%",
                    height: "100%",
                    lineHeight: 1,
                    userSelect: "text",
                    cursor: "text",
                    color: "transparent",
                    overflow: "hidden",
                    "--scale-factor": scale,
                  } as React.CSSProperties
                }
              />

              {/* Highlights layer */}
              <HighlightLayer
                items={highlights
                  .filter((h) => h.pageNumber === index + 1)
                  .map((h) => ({
                    id: h.id,
                    rects: h.rects,
                    color: h.color,
                    type: h.type,
                    shape: h.shape,
                    strokeColor: h.strokeColor,
                    strokeWidth: h.strokeWidth,
                  }))}
              />

              {/* Page number */}
              <div className="absolute bottom-2 right-2 bg-gray-800 text-white px-2 py-1 rounded text-xs">
                Page {index + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
