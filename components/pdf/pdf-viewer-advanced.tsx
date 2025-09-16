"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { HighlightLayer } from "./highlight-layer";
import { normalizeText, toWords, sentenceSplit, jaccard } from "@/lib/pdf-text-utils";
import { useImageRects } from "@/hooks/use-image-rects";
import { useAnnotations } from "@/hooks/use-annotations";
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
        
        const pdfjsLib = (window as unknown as { pdfjsLib: { getDocument: (params: { url: string; cMapUrl: string; cMapPacked: boolean; withCredentials: boolean }) => { promise: Promise<PDFDocumentProxy> } } }).pdfjsLib;
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

  // Handle text selection
  // Helper function to wait for text layer to be available
  const waitForTextLayer = async (pageNumber: number, maxRetries = 20, delay = 500): Promise<HTMLElement | null> => {
    for (let i = 0; i < maxRetries; i++) {
      const textLayerDiv = document.querySelector(`[data-page-index="${pageNumber - 1}"] .textLayer`) as HTMLElement;
      if (textLayerDiv && textLayerDiv.children.length > 0) {
        
        return textLayerDiv;
      }

      
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    console.warn(`❌ Text layer not found for page ${pageNumber} after ${maxRetries} attempts`);
    return null;
  };

  // Function to programmatically select and highlight text
  type SelectOptions = { saveToDatabase?: boolean; type?: "manual" | "ai" };
  const selectAndHighlightText = useCallback(async (pageNumber: number, searchText: string, options: SelectOptions = { saveToDatabase: true, type: "manual" }) => {
    

    // Wait for text layer to be available with retry logic
    const textLayerDiv = await waitForTextLayer(pageNumber);
    if (!textLayerDiv) {
      console.error(`Text layer still not found for page ${pageNumber} after waiting`);
      return; // Don't throw error, just skip this highlight
    }

    // Find text spans that contain our search text
    const spans = textLayerDiv.querySelectorAll('span');
    const normalizedSearch = searchText.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

    

    // Try exact text matching first, then fuzzy matching
    let foundSpan: HTMLElement | null = null;
    let bestMatch = '';
    let bestScore = 0;
    let matchType = '';

    // First pass: try to find exact or near-exact matches
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const spanText = span.textContent || '';
      const normalizedSpanText = spanText.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

      // Check for exact match
      if (normalizedSpanText.includes(normalizedSearch)) {
        foundSpan = span;
        bestMatch = spanText;
        bestScore = 1.0;
        matchType = 'exact';
        break;
      }

      // Check for partial exact phrase match
      const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
      const spanWords = normalizedSpanText.split(' ');

      for (let j = 0; j < spanWords.length - searchWords.length + 1; j++) {
        const spanPhrase = spanWords.slice(j, j + searchWords.length).join(' ');
        if (spanPhrase === normalizedSearch) {
          foundSpan = span;
          bestMatch = spanText;
          bestScore = 1.0;
          matchType = 'phrase';
          break;
        }
      }
      if (foundSpan) break;
    }

    // Second pass: fuzzy matching if no exact match found
    if (!foundSpan) {
      for (let i = 0; i < spans.length; i++) {
        const span = spans[i];
        const spanText = span.textContent || '';
        const normalizedSpanText = spanText.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

        // Check if this span contains part of our search text
        const words = normalizedSearch.split(' ').filter(w => w.length > 2);
        let matchingWords = 0;

        for (const word of words) {
          if (normalizedSpanText.includes(word)) {
            matchingWords++;
          }
        }

        const score = words.length > 0 ? matchingWords / words.length : 0;
        if (score > bestScore && score > 0.4) { // At least 40% word match for fuzzy
          bestScore = score;
          bestMatch = spanText;
          foundSpan = span;
          matchType = 'fuzzy';
        }
      }
    }

    if (foundSpan) {
      

      // Create a text selection programmatically
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(foundSpan);
        selection.addRange(range);

        // Trigger the existing text selection handler
        onTextSelected?.(searchText, pageNumber);

        // Create highlight now depending on options
        setTimeout(() => {
          const saveToDatabase = options.saveToDatabase ?? true;
          const type = options.type ?? "manual";
          

          const selectionNow = window.getSelection();
          if (selectionNow && selectionNow.rangeCount > 0) {
            const selRange = selectionNow.getRangeAt(0);
            const rects = selRange.getClientRects();

            // Find page element and page-relative rects
            const container = selRange.commonAncestorContainer;
            const pageElement =
              (container as Node).nodeType === Node.TEXT_NODE
                ? (container as Node).parentElement?.closest(".pdf-page-container")
                : (container as Element).closest(".pdf-page-container");

            let pageRelativeRects: Array<{ x: number; y: number; width: number; height: number }>
              = Array.from(rects).map(rect => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height }));
            if (pageElement) {
              const pageRect = pageElement.getBoundingClientRect();
              pageRelativeRects = Array.from(rects).map(rect => ({
                x: rect.left - pageRect.left,
                y: rect.top - pageRect.top,
                width: rect.width,
                height: rect.height,
              }));
            }

            if (saveToDatabase) {
              const highlight: Highlight = {
                id: `${type}-highlight-${Date.now()}-${pageNumber}`,
                pageNumber,
                text: searchText,
                rects: pageRelativeRects.length > 0 ? pageRelativeRects : [{ x: 50, y: 150, width: 400, height: 25 }],
                color: "#ffff00",
                type,
              };
              setHighlights((prev) => [...prev, highlight]);
              onHighlightCreated?.(highlight);
            } else {
              // Visual only (restoring)
              const highlight: Highlight = {
                id: `restored-highlight-${Date.now()}-${pageNumber}`,
                pageNumber,
                text: searchText,
                rects: pageRelativeRects.length > 0 ? pageRelativeRects : [{ x: 50, y: 150, width: 400, height: 25 }],
                color: "#ffff00",
                type: "manual",
              };
              setHighlights((prev) => [...prev, highlight]);
              
            }
          }

          
          selection.removeAllRanges(); // Clear selection after highlighting
        }, 200);
      }
    } else {
      
      throw new Error("Text not found in spans");
    }
  }, [onTextSelected, highlights.length, setHighlights, onHighlightCreated]);

  // Fallback function to create manual highlight (used programmatically)
  const createManualHighlight = useCallback((pageNumber: number, text: string) => {
    

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
  }, [onHighlightCreated]);

  // Removed manual selection handlers and selection-to-highlight UI

  // Load existing highlights from database when PDF loads
  const [highlightsLoaded, setHighlightsLoaded] = useState(false);

  useEffect(() => {
    if (!pdfDocument || !documentId || highlightsLoaded || pages.length === 0) return;

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

  // Process AI highlight phrases using AI analysis
  // Guard against unnecessary reprocessing using a content signature
  const lastProcessedSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pdfDocument || aiHighlightPhrases.length === 0) return;

    const currentSignature = aiHighlightPhrases.join("||");
    if (lastProcessedSignatureRef.current === currentSignature) {
      return;
    }
    lastProcessedSignatureRef.current = currentSignature;

    const processAIHighlights = async () => {
      

          // Extract page texts once
      type PageText = { page: number; text: string };
      const pagesText: PageText[] = [];
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: PDFTextItem) => item.str).join(" ");
        pagesText.push({ page: pageNum, text: pageText });
      }

      for (const aiResponse of aiHighlightPhrases) {
        try {
          const aiNorm = normalizeText(aiResponse);
          const aiWords = new Set(toWords(aiResponse));

          type Candidate = { page: number; sentence: string; score: number };
          const candidates: Candidate[] = [];

          for (const pt of pagesText) {
            const sentences = sentenceSplit(pt.text);
            for (const sent of sentences) {
              const sNorm = normalizeText(sent);
              if (!sNorm) continue;
              const sWords = new Set(toWords(sent));
              let score = jaccard(aiWords, sWords);
              // Boost if exact phrase overlap
              if (sNorm && aiNorm.includes(sNorm)) score += 0.2;
              if (sNorm.includes(aiNorm)) score += 0.2;
              // Length regularization to avoid extremely short matches
              const lenBoost = Math.min(sWords.size / 12, 0.2);
              score += lenBoost;
              if (score > 0) candidates.push({ page: pt.page, sentence: sent, score });
            }
          }

          candidates.sort((a, b) => b.score - a.score);
          const top = candidates.slice(0, aiTopK).filter(c => c.score > aiMinScore);

          if (top.length === 0) {
            
            onNoMatchFound?.("I couldn't find relevant content for that answer in this PDF.");
            continue;
          }

          

          // Scroll to the best match and highlight it first, then others
          for (let i = 0; i < top.length; i++) {
            const { page, sentence } = top[i];
            try {
              await renderPage(page - 1);
            } catch {}

            const pageElement = document.querySelector(`[data-page-index="${page - 1}"]`);
            if (i === 0 && pageElement) {
              pageElement.scrollIntoView({ behavior: "smooth", block: "center" });
            }

            // Let the text layer settle a bit
            await new Promise(r => setTimeout(r, i === 0 ? 600 : 200));

            try {
              await selectAndHighlightText(page, sentence, { saveToDatabase: true, type: "ai" });
            } catch (e) {
              console.warn("Fallback to manual highlight for:", sentence.substring(0, 60));
              createManualHighlight(page, sentence);
            }

            // Additionally, try to circle the most relevant image on the page (once per page)
            if (i === 0 && !circledPagesRef.current.has(page)) {
            const rects = getRects(page) || [];
              if (rects.length > 0) {
                // Gate on keywords or "massive" image size
                const keywordRe = /(fig(?:ure)?\.?|image|diagram|chart|graph|table|photo|picture)/i;
                const hasKeywords = keywordRe.test(aiResponse);
                const vp = pages[page - 1]?.viewport;
                const pageArea = vp ? vp.width * vp.height : 0;
                const largest = rects.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
                const largestRatio = pageArea ? (largest.width * largest.height) / pageArea : 0;
                const allowBySize = largestRatio >= 0.12; // consider as massive content

                if (hasKeywords || allowBySize) {
                  // Heuristic: prefer image nearest to a caption if present; else use largest
                  const findCaptionY = async (): Promise<number | null> => {
                    try {
                      const textLayer = await waitForTextLayer(page, 10, 200);
                      if (!textLayer) return null;
                      const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[];
                      const pageElement = textLayer.closest('.pdf-page-container') as HTMLElement | null;
                      const pageRect = pageElement?.getBoundingClientRect();
                      const figMatch = aiResponse.match(/fig(?:ure)?\.?\s*(\d{1,3})/i);
                      const figNum = figMatch ? figMatch[1] : null;
                      let bestY: number | null = null;
                      for (const span of spans) {
                        const txt = (span.textContent || '').trim();
                        if (!txt) continue;
                        const isFigureLine = /^(fig(?:ure)?\.?|image|diagram|chart|graph|table)\s*\d*[:).\-]?/i.test(txt) || /^(figure|fig\.)/i.test(txt);
                        if (!isFigureLine) continue;
                        if (figNum && !new RegExp(`(fig(?:ure)?\.?\s*${figNum})`, 'i').test(txt)) {
                          continue;
                        }
                        const r = span.getBoundingClientRect();
                        const y = pageRect ? r.top - pageRect.top : parseFloat(span.style.top || '0');
                        bestY = y;
                        break;
                      }
                      return bestY;
                    } catch {
                      return null;
                    }
                  };

                  let chosen: { x: number; y: number; width: number; height: number } | null = null;
                  const captionY = await findCaptionY();
                  if (captionY != null) {
                    let bestDelta = Infinity;
                    for (const r of rects) {
                      const cy = r.y + r.height / 2;
                      const delta = Math.abs(cy - captionY);
                      if (delta < bestDelta) {
                        bestDelta = delta;
                        chosen = r;
                      }
                    }
                  }
                  if (!chosen) chosen = largest;

                  if (chosen && chosen.width > 2 && chosen.height > 2) {
                    const imageHighlight: Highlight = {
                      id: `image-highlight-${Date.now()}-${page}`,
                      pageNumber: page,
                      text: "image",
                      rects: [chosen],
                      color: "transparent",
                      type: "image",
                      shape: "circle",
                      strokeColor: "#ff0000",
                      strokeWidth: 2,
                    };
                    setHighlights((prev) => [...prev, imageHighlight]);
                    onHighlightCreated?.(imageHighlight);
                    circledPagesRef.current.add(page);
                  }
                }
              }
            }
          }

          // If AI mentions a specific figure number, attempt to circle on that page too
          const figMatch = aiResponse.match(/fig(?:ure)?\.?\s*(\d{1,3})(?:[-–]\s*(\d{1,3}))?/i);
          if (figMatch) {
            const figNum = figMatch[1];
            // Find the first page whose text mentions that figure
            const findPageForFigure = (num: string) => {
              const target = `figure ${num}`;
              for (const pt of pagesText) {
                if (normalizeText(pt.text).includes(target)) return pt.page;
              }
              return null;
            };
            const figPage = findPageForFigure(figNum);
            if (figPage && !circledPagesRef.current.has(figPage)) {
              try { await renderPage(figPage - 1); } catch {}
              const rects = getRects(figPage) || [];
              if (rects.length > 0) {
                const chosen = rects.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
                const imageHighlight: Highlight = {
                  id: `image-highlight-${Date.now()}-${figPage}`,
                  pageNumber: figPage,
                  text: "image",
                  rects: [chosen],
                  color: "transparent",
                  type: "image",
                  shape: "circle",
                  strokeColor: "#ff0000",
                  strokeWidth: 2,
                };
                setHighlights((prev) => [...prev, imageHighlight]);
                onHighlightCreated?.(imageHighlight);
                circledPagesRef.current.add(figPage);
              }
            }
          }
        } catch (err) {
          console.error("Error in client-side AI highlighting:", err);
        }
      }
    };

    processAIHighlights();
  }, [pdfDocument, aiHighlightPhrases, renderPage, selectAndHighlightText, createManualHighlight, onNoMatchFound]);

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
