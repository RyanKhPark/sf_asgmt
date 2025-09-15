"use client";

import { useRef, useEffect, useState, useCallback } from "react";
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
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PDFViewport }) => { promise: Promise<void> };
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

interface Highlight {
  id: string;
  pageNumber: number;
  text: string;
  rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  color: string;
  type: "manual" | "ai";
}

interface PDFViewerAdvancedProps {
  fileUrl: string;
  documentId?: string;
  onTextSelected?: (text: string, pageNumber: number) => void;
  onHighlightCreated?: (highlight: Highlight) => void;
  aiHighlightPhrases?: string[];
  onDocumentLoad?: (numPages: number) => void;
  onError?: (error: string) => void;
}

export function PDFViewerAdvanced({
  fileUrl,
  onTextSelected,
  onHighlightCreated,
  aiHighlightPhrases = [],
  onDocumentLoad,
  onError,
}: PDFViewerAdvancedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [scale] = useState(1);
  const renderingPages = useRef(new Set<number>());
  const renderedPages = useRef(new Set<number>());
  const visiblePagesRef = useRef(new Set<number>());

  // Load PDF.js library
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!(window as any).pdfjsLib) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js";
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
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
        console.log("Starting PDF load from URL:", fileUrl);
        const pdfjsLib = (window as unknown as { pdfjsLib: { getDocument: (params: { url: string; cMapUrl: string; cMapPacked: boolean; withCredentials: boolean }) => { promise: Promise<PDFDocumentProxy> } } }).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument({
          url: fileUrl,
          cMapUrl: "https://unpkg.com/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
          withCredentials: false,
        });

        const pdf = await loadingTask.promise;
        console.log(`PDF loaded successfully with ${pdf.numPages} pages`);
        setPdfDocument(pdf);
        onDocumentLoad?.(pdf.numPages);

        // Initialize pages structure
        const pageStructures: PDFPage[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });

          console.log(
            `Page ${i} viewport: ${viewport.width}x${viewport.height}`
          );

          pageStructures.push({
            pageNumber: i,
            viewport,
            rendered: false,
          });
        }
        setPages(pageStructures);
        console.log("All page structures initialized");
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
        console.log(
          `Page ${pageIndex + 1} skipped - already rendering or rendered`
        );
        return;
      }

      console.log(`Starting to render page ${pageIndex + 1}`);
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

        console.log(`Found canvas for page ${pageIndex + 1}`);

        const context = canvas.getContext("2d");
        if (!context) {
          renderingPages.current.delete(pageIndex);
          return;
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        console.log(
          `Canvas ${pageIndex + 1} dimensions set: ${canvas.width}x${
            canvas.height
          }`
        );

        // Fill with white background first
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Render PDF page
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        await renderTask.promise;

        console.log(`Page ${pageIndex + 1} rendered successfully`);

        // Double check canvas actually has content
        const imageData = context.getImageData(0, 0, 1, 1);
        console.log(`First pixel of page ${pageIndex + 1}:`, imageData.data);

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
      console.log("Triggering initial render for first page");
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
            console.log(`Page ${pageIndex + 1} is now visible`);
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

  // Handle text selection
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const text = selection.toString().trim();
    if (text.length > 0) {
      setSelectedText(text);

      // Find which page the selection is on
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const pageElement =
        (container as Node).nodeType === Node.TEXT_NODE
          ? (container as Node).parentElement?.closest(".pdf-page-container")
          : (container as Element).closest(".pdf-page-container");

      if (pageElement) {
        const pageNumber =
          parseInt(pageElement.getAttribute("data-page-index") || "0") + 1;
        onTextSelected?.(text, pageNumber);
      }
    }
  }, [onTextSelected]);

  // Mouse event handlers for text selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (isSelecting) {
        handleTextSelection();
        setIsSelecting(false);
      }
    };

    const handleMouseDown = () => {
      setIsSelecting(true);
      setSelectedText("");
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isSelecting, handleTextSelection]);

  // Create manual highlight from selection
  const createHighlight = useCallback(
    (color: string = "#ffff00") => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !selectedText) return;

      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();

      // Find page number
      const container = range.commonAncestorContainer;
      const pageElement =
        (container as Node).nodeType === Node.TEXT_NODE
          ? (container as Node).parentElement?.closest(".pdf-page-container")
          : (container as Element).closest(".pdf-page-container");

      if (!pageElement) return;

      const pageNumber =
        parseInt(pageElement.getAttribute("data-page-index") || "0") + 1;
      const pageRect = pageElement.getBoundingClientRect();

      // Convert client rects to page-relative coordinates
      const highlightRects = Array.from(rects).map((rect) => ({
        x: rect.left - pageRect.left,
        y: rect.top - pageRect.top,
        width: rect.width,
        height: rect.height,
      }));

      const highlight: Highlight = {
        id: `highlight-${Date.now()}`,
        pageNumber,
        text: selectedText,
        rects: highlightRects,
        color,
        type: "manual",
      };

      setHighlights((prev) => [...prev, highlight]);
      onHighlightCreated?.(highlight);

      // Clear selection
      selection.removeAllRanges();
      setSelectedText("");
    },
    [selectedText, onHighlightCreated]
  );

  // Process AI highlight phrases using AI analysis
  useEffect(() => {
    if (!pdfDocument || aiHighlightPhrases.length === 0) return;

    const processAIHighlights = async () => {
      console.log("🎯 Processing AI highlights:", aiHighlightPhrases);

      for (const aiResponse of aiHighlightPhrases) {
        try {
          // Extract all PDF text for analysis
          let fullPdfText = "";
          for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: PDFTextItem) => item.str).join(" ");
            fullPdfText += `Page ${pageNum}: ${pageText}\n\n`;
          }

          console.log("🤖 Sending AI response to analysis API");

          // Use AI analysis API to find relevant PDF content
          const response = await fetch("/api/pdf-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              aiAnswer: aiResponse,
              pdfText: fullPdfText.substring(0, 15000), // Limit size
            }),
          });

          if (!response.ok) {
            console.error("PDF analysis failed:", response.status);
            continue;
          }

          const data = await response.json();
          console.log("📄 AI analysis result:", data);

          if (data.matchedText) {
            console.log(`🤖 AI found relevant phrase: "${data.matchedText}"`);

            // Now use AI to find the actual location in PDF and extract the real text
            const findResponse = await fetch("/api/pdf-location", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                aiMatchedPhrase: data.matchedText,
                pdfText: fullPdfText,
              }),
            });

            if (findResponse.ok) {
              const locationData = await findResponse.json();
              console.log("🎯 AI location result:", locationData);

              if (locationData.pageNumber && locationData.actualText) {
                const pageNum = locationData.pageNumber;
                console.log(`📍 AI found content on page ${pageNum}: "${locationData.actualText}"`);

                // Create highlight with actual PDF text
                const highlight: Highlight = {
                  id: `ai-highlight-${Date.now()}-${pageNum}`,
                  pageNumber: pageNum,
                  text: locationData.actualText,
                  rects: [{ x: 50, y: 150, width: 400, height: 25 }],
                  color: "#ffff00",
                  type: "ai",
                };

                setHighlights((prev) => [...prev, highlight]);

                // Store in database
                if (onHighlightCreated) {
                  onHighlightCreated(highlight);
                  console.log(`💾 Stored highlight in database`);
                }

                // Navigate to the page
                const pageElement = document.querySelector(`[data-page-index="${pageNum - 1}"]`);
                if (pageElement) {
                  console.log(`🔄 Navigating to page ${pageNum}`);
                  pageElement.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }
              } else {
                console.log("❌ AI could not locate the content in PDF");
              }
            } else {
              console.error("Failed to get AI location analysis");
            }

          } else {
            console.log("❌ No matching content found in PDF");
          }
        } catch (error) {
          console.error("Error processing AI highlight:", error);
        }
      }
    };

    processAIHighlights();
  }, [pdfDocument, aiHighlightPhrases, onHighlightCreated]);

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
      {/* Selection toolbar */}
      {selectedText && (
        <div className="absolute top-4 right-4 z-50 bg-white shadow-lg rounded-lg p-2 flex gap-2">
          <button
            onClick={() => createHighlight("#ffff00")}
            className="px-3 py-1 bg-yellow-300 rounded hover:bg-yellow-400"
            title="Highlight Yellow"
          >
            Highlight
          </button>
          <button
            onClick={() => createHighlight("#90EE90")}
            className="px-3 py-1 bg-green-300 rounded hover:bg-green-400"
            title="Highlight Green"
          >
            Highlight
          </button>
          <button
            onClick={() => {
              window.getSelection()?.removeAllRanges();
              setSelectedText("");
            }}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      )}

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
                className="absolute top-0 left-0"
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
              <div className="absolute top-0 left-0 pointer-events-none">
                {highlights
                  .filter((h) => h.pageNumber === index + 1)
                  .map((highlight) => (
                    <div key={highlight.id}>
                      {highlight.rects.map((rect, rectIndex) => (
                        <div
                          key={rectIndex}
                          className={`absolute ${
                            highlight.type === "ai" ? "animate-pulse" : ""
                          }`}
                          style={{
                            left: `${rect.x}px`,
                            top: `${rect.y}px`,
                            width: `${rect.width}px`,
                            height: `${rect.height}px`,
                            backgroundColor: highlight.color,
                            opacity: 0.3,
                            mixBlendMode: "multiply",
                          }}
                        />
                      ))}
                    </div>
                  ))}
              </div>

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
