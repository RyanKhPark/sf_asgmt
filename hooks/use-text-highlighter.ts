"use client";

import { useCallback } from "react";
import type { Highlight } from "@/types/pdf";

export function useTextHighlighter(params: {
  onTextSelected?: (text: string, pageNumber: number) => void;
  onHighlightCreated?: (highlight: Highlight) => void;
  setHighlights: React.Dispatch<React.SetStateAction<Highlight[]>>;
}) {
  const { onTextSelected, onHighlightCreated, setHighlights } = params;

  const waitForTextLayer = useCallback(
    async (pageNumber: number, maxRetries = 20, delay = 500): Promise<HTMLElement | null> => {
      for (let i = 0; i < maxRetries; i++) {
        const textLayerDiv = document.querySelector(
          `[data-page-index="${pageNumber - 1}"] .textLayer`
        ) as HTMLElement;
        if (textLayerDiv && textLayerDiv.children.length > 0) {
          return textLayerDiv;
        }
        await new Promise((r) => setTimeout(r, delay));
      }
      return null;
    },
    []
  );

  type SelectOptions = { saveToDatabase?: boolean; type?: "manual" | "ai" };
  const selectAndHighlightText = useCallback(
    async (pageNumber: number, searchText: string, options: SelectOptions = { saveToDatabase: true, type: "manual" }) => {
      const textLayerDiv = await waitForTextLayer(pageNumber);
      if (!textLayerDiv) return;

      // Find spans matching searchText (normalized)
      const spans = textLayerDiv.querySelectorAll("span");
      const normalizedSearch = searchText
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      let foundSpan: HTMLElement | null = null;
      let bestMatch = "";
      let bestScore = 0;
      let matchType = "";

      for (let i = 0; i < spans.length; i++) {
        const span = spans[i] as HTMLElement;
        const spanText = span.textContent || "";
        const normalizedSpanText = spanText
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (normalizedSpanText.includes(normalizedSearch)) {
          foundSpan = span;
          bestMatch = spanText;
          bestScore = 1.0;
          matchType = "exact";
          break;
        }
        const searchWords = normalizedSearch.split(" ").filter((w) => w.length > 2);
        const spanWords = normalizedSpanText.split(" ");
        for (let j = 0; j < spanWords.length - searchWords.length + 1; j++) {
          const spanPhrase = spanWords.slice(j, j + searchWords.length).join(" ");
          if (spanPhrase === normalizedSearch) {
            foundSpan = span;
            bestMatch = spanText;
            bestScore = 1.0;
            matchType = "phrase";
            break;
          }
        }
        if (foundSpan) break;
      }

      if (!foundSpan) {
        for (let i = 0; i < spans.length; i++) {
          const span = spans[i] as HTMLElement;
          const spanText = span.textContent || "";
          const normalizedSpanText = spanText
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const words = normalizedSearch.split(" ").filter((w) => w.length > 2);
          let matchingWords = 0;
          for (const w of words) if (normalizedSpanText.includes(w)) matchingWords++;
          const score = words.length > 0 ? matchingWords / words.length : 0;
          if (score > bestScore && score > 0.4) {
            bestScore = score;
            bestMatch = spanText;
            foundSpan = span as HTMLElement;
            matchType = "fuzzy";
          }
        }
      }

      if (!foundSpan) throw new Error("Text not found in spans");

      const selection = window.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(foundSpan);
      selection.addRange(range);

      onTextSelected?.(searchText, pageNumber);

      setTimeout(() => {
        const saveToDatabase = options.saveToDatabase ?? true;
        const type = options.type ?? "manual";
        const selectionNow = window.getSelection();
        if (selectionNow && selectionNow.rangeCount > 0) {
          const selRange = selectionNow.getRangeAt(0);
          const rects = selRange.getClientRects();
          const container = selRange.commonAncestorContainer;
          const pageElement =
            (container as Node).nodeType === Node.TEXT_NODE
              ? (container as Node).parentElement?.closest(".pdf-page-container")
              : (container as Element).closest(".pdf-page-container");

          let pageRelativeRects = Array.from(rects).map((r) => ({ x: r.left, y: r.top, width: r.width, height: r.height }));
          if (pageElement) {
            const pageRect = pageElement.getBoundingClientRect();
            pageRelativeRects = Array.from(rects).map((r) => ({
              x: r.left - pageRect.left,
              y: r.top - pageRect.top,
              width: r.width,
              height: r.height,
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
        selection.removeAllRanges();
      }, 200);
    },
    [onTextSelected, onHighlightCreated, setHighlights, waitForTextLayer]
  );

  return { waitForTextLayer, selectAndHighlightText };
}

