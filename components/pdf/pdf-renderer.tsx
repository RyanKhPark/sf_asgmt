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
  documentId?: string;
  onNavigateToPage?: (pageNumber: number) => void;
  highlightStyle?: 'box' | 'underline';
  highlightColor?: string;
  persistHighlights?: boolean; // if true, save annotations to DB
  annotations?: Array<{
    id: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    highlightText?: string;
  }>;
}

export function PDFRenderer({
  fileUrl,
  currentPage,
  onDocumentLoad,
  onError,
  onPageRender,
  highlightPhrases = [],
  documentId,
  onNavigateToPage,
  highlightStyle = 'box',
  highlightColor,
  persistHighlights = false,
  annotations = [],
}: PDFRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [pageTextItems, setPageTextItems] = useState<any[]>([]);
  const [allPagesText, setAllPagesText] = useState<Map<number, any[]>>(
    new Map()
  );
  const processedPhrasesRef = useRef<Set<string>>(new Set());

  // Utility functions to normalize text
  const normalizeTight = (text: string): string => {
    return text
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[""'']/g, '"')
      .trim()
      .toLowerCase();
  };
  const normalizeLoose = (text: string): string => {
    return normalizeTight(text)
      .replace(/[^\w\s]/g, "") // strip punctuation for fuzzy contains
      .replace(/\s+/g, " ")
      .trim();
  };

  // Find text coordinates for highlighting and storage (using absolute coordinates)
  const findTextCoordinates = (
    searchPhrase: string
  ): Array<{
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  }> => {
    const phraseCoords = findPhraseCoordinates(searchPhrase);
    return phraseCoords.map((coord) => ({
      pageNumber: coord.pageNumber,
      x: coord.x,
      y: coord.y,
      width: coord.width,
      height: coord.height,
      text: coord.text, // Use the actual matched text
    }));
  };

  // Store highlight in database
  const storeHighlight = async (highlight: {
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  }) => {
    if (!documentId || !persistHighlights) return;

    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          type: "ai_highlight",
          highlightText: highlight.text,
          pageNumber: highlight.pageNumber,
          x: highlight.x,
          y: highlight.y,
          width: highlight.width,
          height: highlight.height,
          color: highlightStyle === 'underline' ? (highlightColor || '#ff3333') : (highlightColor || '#ffff00'),
          createdBy: "ai",
        }),
      });

      if (response.ok) {
        console.log(
          `✅ Stored highlight: "${highlight.text}" on page ${highlight.pageNumber}`
        );
      }
    } catch (error) {
      console.error("Failed to store highlight:", error);
    }
  };

  // Find consecutive text items that make up a phrase
  const findPhraseCoordinates = (
    searchPhrase: string
  ): Array<{
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    textItems: any[];
  }> => {
    const results: Array<{
      pageNumber: number;
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      textItems: any[];
    }> = [];

    const normalizedSearch = normalizeLoose(searchPhrase);
    const searchWords = normalizedSearch.split(/\s+/);

    // Build full text from all items to find phrase location
    let fullText = "";
    let wordToItemMap: number[] = []; // Maps word index to item index

    pageTextItems.forEach((item, itemIndex) => {
      const itemWords = normalizeLoose(item.str)
        .split(/\s+/)
        .filter((w) => w.length > 0);
      itemWords.forEach(() => {
        wordToItemMap.push(itemIndex);
      });
      fullText += " " + normalizeLoose(item.str);
    });

    const fullTextWords = fullText.trim().split(/\s+/);

    // Find where the search phrase starts in the full text
    for (let i = 0; i <= fullTextWords.length - searchWords.length; i++) {
      const slice = fullTextWords.slice(i, i + searchWords.length).join(" ");
      if (slice === normalizedSearch) {
        // Found the phrase! Now get the corresponding text items
        const startItemIndex = wordToItemMap[i];
        const endItemIndex = wordToItemMap[i + searchWords.length - 1];

        if (startItemIndex !== undefined && endItemIndex !== undefined) {
          const matchingItems = pageTextItems.slice(
            startItemIndex,
            endItemIndex + 1
          );

          if (matchingItems.length > 0) {
            // Calculate bounding box for all matching items
            const firstItem = matchingItems[0];
            const lastItem = matchingItems[matchingItems.length - 1];

            const startX = firstItem.transform[4];
            const startY = firstItem.transform[5];
            const endX = lastItem.transform[4] + (lastItem.width || 100);

            results.push({
              pageNumber: currentPage,
              x: startX,
              y: startY,
              width: endX - startX,
              height: firstItem.transform[0] || 12, // Font size
              text: matchingItems.map((item) => item.str).join(" "),
              textItems: matchingItems,
            });
          }
        }
        break; // Only find first match
      }
    }

    return results;
  };

  // Simple script loading approach from PDF.js FAQ
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load PDF.js script if not already loaded
    if (!(window as any).pdfjsLib) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js";
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
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
    const context = canvas.getContext("2d");
    if (!context) return;

    console.log("Loading PDF:", fileUrl);

    let isCancelled = false;
    let renderTask: any = null;

    // Simple PDF.js approach from FAQ
    (window as any).pdfjsLib
      .getDocument(fileUrl)
      .promise.then(async (pdf: any) => {
        if (isCancelled) return;
        console.log("PDF loaded, pages:", pdf.numPages);
        onDocumentLoad(pdf.numPages);

        // Extract text from ALL pages for search functionality
        console.log("🔍 Extracting text from all pages for search...");
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            setAllPagesText((prev) => {
              const newMap = new Map(prev);
              newMap.set(pageNum, textContent.items);
              return newMap;
            });

            console.log(
              `📄 Extracted text from page ${pageNum} (${textContent.items.length} items)`
            );
          } catch (error) {
            console.warn(`Failed to extract text from page ${pageNum}:`, error);
          }
        }

        // Get the requested page for display
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
          viewport: viewport,
        };

        // Extract text content for highlighting
        try {
          const textContent = await page.getTextContent();
          setPageTextItems(textContent.items);

          // Store text for all pages
          setAllPagesText((prev) => {
            const newMap = new Map(prev);
            newMap.set(currentPage, textContent.items);
            return newMap;
          });

          console.log(
            `Extracted ${textContent.items.length} text items from page ${currentPage}`
          );
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

  // Search for phrase across all pages
  const findPhraseAcrossPages = (
    searchPhrase: string
  ): { pageNumber: number; found: boolean } => {
    const normalizedSearch = normalizeLoose(searchPhrase);
    const searchSet = new Set(
      normalizedSearch
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    // Convert Map to array to avoid TypeScript iteration issues
    const pages = Array.from(allPagesText.entries());
    let bestPage = currentPage;
    let bestScore = 0;

    for (const [pageNum, textItems] of pages) {
      // Build full text for this page
      const pageTextRaw = textItems.map((item: any) => item.str).join(" ");
      const pageTextTight = normalizeTight(pageTextRaw);
      const pageTextLoose = normalizeLoose(pageTextRaw);

      // Exact loose contains
      if (pageTextLoose.includes(normalizedSearch)) {
        console.log(`📍 Found phrase "${searchPhrase}" on page ${pageNum}`);
        return { pageNumber: pageNum, found: true };
      }

      // Score by word overlap
      const pageSet = new Set(
        pageTextLoose
          .split(/\s+/)
          .filter((w: string) => w.length > 3)
      );
      let overlap = 0;
      searchSet.forEach((w) => { if (pageSet.has(w)) overlap++; });

      if (overlap > bestScore) {
        bestScore = overlap;
        bestPage = pageNum;
      }
    }

    if (bestScore >= Math.max(3, Math.ceil(searchSet.size * 0.3))) {
      console.log(`➕ Using best-overlap page ${bestPage} (score ${bestScore}) for phrase "${searchPhrase}"`);
      return { pageNumber: bestPage, found: true };
    }

    console.log(`❌ Phrase "${searchPhrase}" not found with sufficient overlap (best score ${bestScore})`);
    return { pageNumber: currentPage, found: false };
  };

  // Process new highlight phrases (limited to prevent database spam)
  useEffect(() => {
    if (!highlightPhrases.length) return;

    console.log(`🎯 Processing ${highlightPhrases.length} highlight phrases`);

    // Process only the first phrase to prevent database spam
    const firstPhrase = highlightPhrases[0];
    const phraseKey = normalizeLoose(firstPhrase);
    if (processedPhrasesRef.current.has(phraseKey)) {
      return;
    }
    const words = firstPhrase.split(/\s+/);

    // Skip if phrase is too long (>50 words)
    if (words.length > 50) {
      console.log(
        `⚠️ Skipping phrase - too long (${
          words.length
        } words): "${firstPhrase.substring(0, 50)}..."`
      );
      return;
    }

    // First, find which page contains this phrase
    const searchResult = findPhraseAcrossPages(firstPhrase);

    if (searchResult.found) {
      // Navigate to the page that contains the phrase
      if (searchResult.pageNumber !== currentPage) {
        console.log(
          `📍 Navigating to page ${searchResult.pageNumber} for highlight: "${firstPhrase}"`
        );
        onNavigateToPage?.(searchResult.pageNumber);
        return; // Wait for page to load before processing coordinates
      }

      // If we're already on the right page, process coordinates
      let coordinates = findTextCoordinates(firstPhrase);

      // Fallback: if exact phrase not found, select best matching item on page
      if (coordinates.length === 0 && pageTextItems.length > 0) {
        const target = normalizeLoose(firstPhrase);
        let bestIdx = -1;
        let bestScore = 0;
        const score = (a: string, b: string) => {
          const setA = new Set(a.split(/\s+/).filter((w) => w.length > 3));
          const setB = new Set(b.split(/\s+/).filter((w) => w.length > 3));
          let inter = 0;
          setA.forEach((w) => { if (setB.has(w)) inter++; });
          return inter;
        };
        pageTextItems.forEach((it, idx) => {
          const s = score(target, normalizeLoose(it.str || ""));
          if (s > bestScore) { bestScore = s; bestIdx = idx; }
        });
        if (bestIdx >= 0) {
          const it = pageTextItems[bestIdx];
          const x = it.transform[4];
          const y = it.transform[5];
          const width = (it.width || (it.str?.length || 10) * 6);
          const height = (it.transform[0] || 12);
          coordinates = [{ pageNumber: currentPage, x, y, width, height, text: it.str }];
        }
      }

      if (coordinates.length > 0) {
        const coord = coordinates[0];

        // Store ONE highlight in database (optional)
        storeHighlight(coord);

        // Mark phrase as processed to avoid duplicates
        processedPhrasesRef.current.add(phraseKey);

        console.log(
          `✅ Processed highlight: "${firstPhrase}" (${words.length} words) on page ${searchResult.pageNumber}`
        );
      } else {
        console.log(
          `❌ No coordinates found for: "${firstPhrase}" on page ${searchResult.pageNumber}`
        );
      }
    }
  }, [highlightPhrases, allPagesText, currentPage]);

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
      <canvas ref={canvasRef} className="block" />

      {/* Text overlay for highlighting */}
      <div
        ref={textLayerRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          // match overlay size to displayed canvas size
          width: canvasRef.current?.offsetWidth || 0,
          height: canvasRef.current?.offsetHeight || 0,
          left: 0,
          top: 0,
        }}
      >
        {/* Persisted annotations (rectangles) for current page */}
        {annotations
          .filter((a) => a.pageNumber === currentPage)
          .map((a) => {
            const canvas = canvasRef.current;
            if (!canvas) return null;

            const scale = canvas.width / canvas.offsetWidth;
            const padLeft = parseFloat(getComputedStyle(canvas.parentElement as HTMLElement).paddingLeft || '0') || 0;
            const padTop = parseFloat(getComputedStyle(canvas.parentElement as HTMLElement).paddingTop || '0') || 0;
            const left = padLeft + (a.x / scale);
            const top = padTop + ((canvas.height - a.y - a.height) / scale);
            const width = a.width / scale;
            const height = a.height / scale;

            return (
              <div
                key={a.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${Math.max(width, 2)}px`,
                  height: `${Math.max(height, 2)}px`,
                  borderRadius: '2px',
                  backgroundColor: a.color || 'rgba(255, 235, 59, 0.5)',
                  outline: `1px solid ${a.color || '#F59E0B'}`,
                  opacity: 0.5,
                  zIndex: 9,
                }}
                title={a.highlightText ? `"${a.highlightText}"` : undefined}
              />
            );
          })}

        {highlightPhrases.map((phrase, index) => {
          const phraseCoords = findPhraseCoordinates(phrase);
          if (phraseCoords.length === 0) return null;

          const coord = phraseCoords[0];
          const canvas = canvasRef.current;
          if (!canvas) return null;

          // Convert PDF coordinates to screen coordinates
          const scale = canvas.width / canvas.offsetWidth; // PDF scale factor
          const padLeft = parseFloat(getComputedStyle(canvas.parentElement as HTMLElement).paddingLeft || '0') || 0;
          const padTop = parseFloat(getComputedStyle(canvas.parentElement as HTMLElement).paddingTop || '0') || 0;
          const left = padLeft + (coord.x / scale);
          const top = padTop + ((canvas.height - coord.y - coord.height) / scale); // Flip Y and adjust for height
          const width = coord.width / scale;
          const height = coord.height / scale;

          const styleMode = highlightStyle;
          if (styleMode === 'underline') {
            const lineThickness = Math.max(2, Math.min(4, Math.round(height * 0.18)));
            return (
              <div
                key={index}
                className="absolute pointer-events-none"
                style={{
                  left: `${left}px`,
                  top: `${top + Math.max(height - lineThickness, 0)}px`,
                  width: `${Math.max(width, 30)}px`,
                  height: `${lineThickness}px`,
                  backgroundColor: highlightColor || '#ff3333',
                  borderRadius: '1px',
                  opacity: 0.9,
                  zIndex: 10,
                }}
                title={`"${coord.text}"`}
              />
            );
          }

          // Default: translucent yellow box
          return (
            <div
              key={index}
              className="absolute pointer-events-none"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${Math.max(width, 50)}px`,
                height: `${Math.max(height, 16)}px`,
                borderRadius: "2px",
                backgroundColor: highlightColor || 'rgba(255, 235, 59, 0.6)',
                outline: `1px solid ${highlightColor || '#F59E0B'}`,
                boxShadow: "0 0 4px rgba(255, 235, 59, 0.5)",
                zIndex: 10,
              }}
              title={`"${coord.text}"`}
            />
          );
        })}
      </div>
    </div>
  );
}
