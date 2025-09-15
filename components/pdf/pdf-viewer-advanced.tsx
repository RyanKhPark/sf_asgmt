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
  onNoMatchFound?: (message: string) => void;
}

export function PDFViewerAdvanced({
  fileUrl,
  documentId,
  onTextSelected,
  onHighlightCreated,
  aiHighlightPhrases = [],
  onDocumentLoad,
  onError,
  onNoMatchFound,
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
  // Helper function to wait for text layer to be available
  const waitForTextLayer = async (pageNumber: number, maxRetries = 20, delay = 500): Promise<HTMLElement | null> => {
    for (let i = 0; i < maxRetries; i++) {
      const textLayerDiv = document.querySelector(`[data-page-index="${pageNumber - 1}"] .textLayer`) as HTMLElement;
      if (textLayerDiv && textLayerDiv.children.length > 0) {
        console.log(`✅ Text layer found for page ${pageNumber} after ${i + 1} attempts`);
        return textLayerDiv;
      }

      console.log(`⏳ Waiting for text layer page ${pageNumber}, attempt ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    console.warn(`❌ Text layer not found for page ${pageNumber} after ${maxRetries} attempts`);
    return null;
  };

  // Function to programmatically select and highlight text
  const selectAndHighlightText = useCallback(async (pageNumber: number, searchText: string, saveToDatabase = true) => {
    console.log(`🔍 Attempting to select text on page ${pageNumber}: "${searchText}"`);

    // Wait for text layer to be available with retry logic
    const textLayerDiv = await waitForTextLayer(pageNumber);
    if (!textLayerDiv) {
      console.error(`Text layer still not found for page ${pageNumber} after waiting`);
      return; // Don't throw error, just skip this highlight
    }

    // Find text spans that contain our search text
    const spans = textLayerDiv.querySelectorAll('span');
    const normalizedSearch = searchText.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

    console.log(`🔍 Searching in ${spans.length} text spans for exact PDF text: "${searchText}"`);
    console.log(`🔍 Normalized search: "${normalizedSearch}"`);

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
      console.log(`✅ Found matching span (${matchType}): "${bestMatch}" (score: ${bestScore})`);

      // Create a text selection programmatically
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(foundSpan);
        selection.addRange(range);

        // Set selected text state
        setSelectedText(searchText);

        // Trigger the existing text selection handler
        onTextSelected?.(searchText, pageNumber);

        // Create highlight using the existing createHighlight function
        setTimeout(() => {
          console.log(`🎯 Creating highlight for: "${searchText}" (save: ${saveToDatabase})`);

          if (saveToDatabase) {
            // For new highlights, use the button click to save to database
            const highlightButton = document.querySelector('button[title="Highlight Yellow"]') as HTMLButtonElement;
            if (highlightButton) {
              highlightButton.click(); // Trigger the existing highlight creation
            }
          } else {
            // For restored highlights, just create the visual highlight without saving
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const rects = range.getClientRects();

              const highlightRects = Array.from(rects).map(rect => ({
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
              }));

              const highlight: Highlight = {
                id: `restored-highlight-${Date.now()}-${pageNumber}`,
                pageNumber,
                text: searchText,
                rects: highlightRects.length > 0 ? highlightRects : [{ x: 50, y: 150, width: 400, height: 25 }],
                color: "#ffff00",
                type: "manual",
              };

              setHighlights((prev) => [...prev, highlight]);
              console.log(`✨ Created restored highlight visually`);
            }
          }

          console.log(`📊 Current highlights count: ${highlights.length}`);
          selection.removeAllRanges(); // Clear selection after highlighting
          setSelectedText(""); // Clear selected text
        }, 200);
      }
    } else {
      console.log(`❌ Could not find matching text span for: "${normalizedSearch}"`);
      throw new Error("Text not found in spans");
    }
  }, [onTextSelected, setSelectedText, highlights.length, setHighlights]);

  // Fallback function to create manual highlight
  const createManualHighlight = useCallback((pageNumber: number, text: string) => {
    console.log(`🎯 Creating manual highlight on page ${pageNumber}: "${text}"`);

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
      console.log(`💾 Stored manual highlight in database`);
    }
  }, [onHighlightCreated]);

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

  // Load existing highlights from database when PDF loads
  const [highlightsLoaded, setHighlightsLoaded] = useState(false);

  useEffect(() => {
    if (!pdfDocument || !documentId || highlightsLoaded || pages.length === 0) return;

    const loadExistingHighlights = async () => {
      try {
        console.log(`📂 Loading existing highlights for document: ${documentId}`);
        const response = await fetch(`/api/annotations?documentId=${documentId}`);

        if (response.ok) {
          const data = await response.json();
          const annotations = data.annotations || [];

          console.log(`📊 Found ${annotations.length} existing annotations`);

          // Use existing selectAndHighlightText function to restore highlights
          for (const annotation of annotations) {
            if (annotation.highlightText && annotation.pageNumber) {
              console.log(`🔍 Restoring highlight on page ${annotation.pageNumber}: "${annotation.highlightText}"`);

              // Use the existing text selection system with a longer delay to ensure text layers are rendered
              setTimeout(() => {
                selectAndHighlightText(
                  annotation.pageNumber,
                  annotation.highlightText,
                  false // Don't save to database again
                );
              }, 3000 + (annotation.pageNumber * 500)); // Longer delays for text layer rendering
            }
          }

          console.log(`✅ Queued ${annotations.length} highlights for restoration using text selection`);

          setHighlightsLoaded(true); // Prevent re-loading
        }
      } catch (error) {
        console.error("Failed to load existing highlights:", error);
        setHighlightsLoaded(true); // Prevent infinite retries
      }
    };

    // Wait for pages to be rendered before loading highlights
    setTimeout(loadExistingHighlights, 2000);
  }, [pdfDocument, documentId, highlightsLoaded, pages.length]);

  // Process AI highlight phrases using AI analysis
  useEffect(() => {
    if (!pdfDocument || aiHighlightPhrases.length === 0) return;

    const processAIHighlights = async () => {
      console.log("🎯 Processing AI highlights:", aiHighlightPhrases);

      for (const aiResponse of aiHighlightPhrases) {
        try {
          // Extract all PDF text per page
          type PageText = { page: number; text: string };
          const pagesText: PageText[] = [];
          for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: PDFTextItem) => item.str).join(" ");
            pagesText.push({ page: pageNum, text: pageText });
          }

          // Build bounded-size chunks while preserving coverage
          const buildChunks = (maxChars = 35000, maxPages = 25) => {
            const chunks: string[] = [];
            let current = "";
            let count = 0;
            for (const pt of pagesText) {
              const pageBlock = `Page ${pt.page}: ${pt.text}\n\n`;
              const wouldOverflow = current.length + pageBlock.length > maxChars;
              const tooManyPages = count >= maxPages;
              if ((wouldOverflow || tooManyPages) && current.length > 0) {
                chunks.push(current);
                current = "";
                count = 0;
              }
              current += pageBlock;
              count += 1;
            }
            if (current.length > 0) chunks.push(current);
            return chunks;
          };

          const chunks = buildChunks();
          console.log(`🧩 Built ${chunks.length} PDF chunks for analysis`);

          // 1) Find a matched phrase by scanning chunks
          let matchedPhrase: string | null = null;
          for (const [idx, chunk] of chunks.entries()) {
            console.log(`🤖 Analyzing chunk ${idx + 1}/${chunks.length}`);
            const response = await fetch("/api/pdf-analysis", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ aiAnswer: aiResponse, pdfText: chunk }),
            });
            if (!response.ok) continue;
            const data = await response.json();
            console.log("📄 AI analysis result:", data);
            if (data.matchedText) {
              matchedPhrase = data.matchedText as string;
              break;
            }
          }

          if (!matchedPhrase) {
            console.log("❌ No matching content found in any chunk");
            onNoMatchFound?.("I couldn't find relevant content for that answer in this PDF.");
            continue;
          }

          console.log(`🤖 AI found relevant phrase: "${matchedPhrase}"`);

          // 2) Locate the matched phrase across chunks, with deterministic fallback
          let located = { pageNumber: null as number | null, actualText: null as string | null };
          for (const [idx, chunk] of chunks.entries()) {
            console.log(`📍 Locating in chunk ${idx + 1}/${chunks.length}`);
            const findResponse = await fetch("/api/pdf-location", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ aiMatchedPhrase: matchedPhrase, pdfText: chunk }),
            });
            if (!findResponse.ok) continue;
            const locationData = await findResponse.json();
            console.log("🎯 AI location result:", locationData);
            if (locationData.pageNumber && locationData.actualText) {
              located = { pageNumber: locationData.pageNumber, actualText: locationData.actualText };
              break;
            }
          }

          // Client-side deterministic fallback if still not located
          if (!located.pageNumber || !located.actualText) {
            const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
            const nPhrase = norm(matchedPhrase);
            for (const pt of pagesText) {
              if (norm(pt.text).includes(nPhrase)) {
                located = { pageNumber: pt.page, actualText: matchedPhrase };
                break;
              }
            }
          }

          if (located.pageNumber && located.actualText) {
            const pageNum = located.pageNumber;
            console.log(`📍 Found content on page ${pageNum}: "${located.actualText}"`);

            // Proactively render the target page to ensure text layer is ready
            try {
              await renderPage(pageNum - 1);
            } catch (e) {
              console.warn("Render page call failed (will rely on observer):", e);
            }

            // Navigate to the page first
            const pageElement = document.querySelector(`[data-page-index="${pageNum - 1}"]`);
            if (pageElement) {
              console.log(`🔄 Navigating to page ${pageNum}`);
              pageElement.scrollIntoView({ behavior: "smooth", block: "center" });

              // Wait for page to be visible, then programmatically select and highlight the text
              setTimeout(async () => {
                try {
                  // Ensure render attempt just before selection as well
                  try { await renderPage(pageNum - 1); } catch {}
                  await selectAndHighlightText(pageNum, located.actualText!);
                } catch (error) {
                  console.error("Error selecting text:", error);
                  // Fallback to manual highlight
                  createManualHighlight(pageNum, located.actualText!);
                }
              }, 1000);
            } else {
              // Fallback if page element not found
              createManualHighlight(pageNum, located.actualText!);
            }
          } else {
            console.log("❌ Could not locate the content after chunked search");
            onNoMatchFound?.("I couldn't locate the referenced content in this PDF.");
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
