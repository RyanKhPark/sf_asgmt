"use client";

import { useEffect, useRef } from "react";
import { normalizeText, toWords, sentenceSplit, jaccard } from "@/lib/pdf-text-utils";
import type { Highlight } from "@/types/pdf";

interface PDFDocumentProxy { numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: Array<{ str: string }> }> }>; }

export function useAiHighlights(params: {
  pdfDocument: PDFDocumentProxy | null;
  aiHighlightPhrases: string[];
  renderPage: (pageIndex: number) => Promise<void>;
  selectAndHighlightText: (page: number, text: string, options?: { saveToDatabase?: boolean; type?: "manual" | "ai" }) => Promise<void>;
  createManualHighlight: (page: number, text: string) => void;
  onNoMatchFound?: (message: string) => void;
  pages: Array<{ pageNumber: number; viewport: { width: number; height: number } }>;
  getRects: (pageNumber: number) => Array<{ x: number; y: number; width: number; height: number }>;
  onHighlightCreated?: (h: Highlight) => void;
  setHighlights: React.Dispatch<React.SetStateAction<Highlight[]>>;
  aiTopK: number;
  aiMinScore: number;
  waitForTextLayer?: (pageNumber: number, maxRetries?: number, delay?: number) => Promise<HTMLElement | null>;
}) {
  const { pdfDocument, aiHighlightPhrases, renderPage, selectAndHighlightText, createManualHighlight, onNoMatchFound, pages, getRects, onHighlightCreated, setHighlights, aiTopK, aiMinScore, waitForTextLayer } = params;

  const lastProcessedSignatureRef = useRef<string | null>(null);
  const circledPagesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!pdfDocument || aiHighlightPhrases.length === 0) return;
    const currentSignature = aiHighlightPhrases.join("||");
    if (lastProcessedSignatureRef.current === currentSignature) return;
    lastProcessedSignatureRef.current = currentSignature;

    const run = async () => {
      // Build page text cache
      type PageText = { page: number; text: string };
      const pagesText: PageText[] = [];
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((i: any) => i.str).join(" ");
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
              if (sNorm && aiNorm.includes(sNorm)) score += 0.2;
              if (sNorm.includes(aiNorm)) score += 0.2;
              const lenBoost = Math.min(sWords.size / 12, 0.2);
              score += lenBoost;
              if (score > 0) candidates.push({ page: pt.page, sentence: sent, score });
            }
          }
          candidates.sort((a, b) => b.score - a.score);
          const top = candidates.slice(0, aiTopK).filter((c) => c.score > aiMinScore);
          if (top.length === 0) {
            onNoMatchFound?.("I couldn't find relevant content for that answer in this PDF.");
            continue;
          }

          for (let i = 0; i < top.length; i++) {
            const { page, sentence } = top[i];
            try { await renderPage(page - 1); } catch {}
            const pageElement = document.querySelector(`[data-page-index="${page - 1}"]`);
            if (i === 0 && pageElement) pageElement.scrollIntoView({ behavior: "smooth", block: "center" });
            await new Promise((r) => setTimeout(r, i === 0 ? 600 : 200));
            try {
              await selectAndHighlightText(page, sentence, { saveToDatabase: true, type: "ai" });
            } catch (e) {
              createManualHighlight(page, sentence);
            }

            // Circle images conditionally
            if (i === 0 && !circledPagesRef.current.has(page)) {
              const rects = getRects(page) || [];
              if (rects.length > 0) {
                const keywordRe = /(fig(?:ure)?\.?|image|diagram|chart|graph|table|photo|picture)/i;
                const hasKeywords = keywordRe.test(aiResponse);
                const vp = pages[page - 1]?.viewport;
                const pageArea = vp ? vp.width * vp.height : 0;
                const largest = rects.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
                const largestRatio = pageArea ? (largest.width * largest.height) / pageArea : 0;
                const allowBySize = largestRatio >= 0.12;
                if (hasKeywords || allowBySize) {
                  // Try to find a figure-like caption and pick nearest image; else use largest
                  let chosen = largest;
                  if (waitForTextLayer) {
                    try {
                      const textLayer = await waitForTextLayer(page, 10, 200);
                      if (textLayer) {
                        const spans = Array.from(textLayer.querySelectorAll("span")) as HTMLElement[];
                        const pageElement = textLayer.closest(".pdf-page-container") as HTMLElement | null;
                        const pageRect = pageElement?.getBoundingClientRect();
                        const figMatch = aiResponse.match(/fig(?:ure)?\.?\s*(\d{1,3})/i);
                        const figNum = figMatch ? figMatch[1] : null;
                        let captionY: number | null = null;
                        for (const span of spans) {
                          const txt = (span.textContent || "").trim();
                          if (!txt) continue;
                          const isFigureLine = /^(fig(?:ure)?\.?|image|diagram|chart|graph|table)\s*\d*[:).\-]?/i.test(txt) || /^(figure|fig\.)/i.test(txt);
                          if (!isFigureLine) continue;
                          if (figNum && !new RegExp(`(fig(?:ure)?\.?\s*${figNum})`, "i").test(txt)) continue;
                          const r = span.getBoundingClientRect();
                          captionY = pageRect ? r.top - pageRect.top : parseFloat(span.style.top || "0");
                          break;
                        }
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
                      }
                    } catch {}
                  }
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

          // Figure number targeting
          const figMatch = aiResponse.match(/fig(?:ure)?\.?\s*(\d{1,3})(?:[-–]\s*(\d{1,3}))?/i);
          if (figMatch) {
            const figNum = figMatch[1];
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

    run();
  }, [pdfDocument, aiHighlightPhrases, renderPage, selectAndHighlightText, createManualHighlight, onNoMatchFound, pages, getRects, onHighlightCreated, setHighlights, aiTopK, aiMinScore]);
}
