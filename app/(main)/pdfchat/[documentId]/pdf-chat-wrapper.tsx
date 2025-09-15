"use client";

import { useState, useCallback } from "react";
import { PDFViewerAdvanced } from "@/components/pdf/pdf-viewer-advanced";
import { PDFChat } from "@/components/pdf/pdf-chat";
import { toast } from "sonner";

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

interface PDFChatWrapperProps {
  document: {
    id: string;
    title: string;
    fileUrl: string;
    extractedText: string | null;
    totalPages: number | null;
  };
}

export function PDFChatWrapper({ document }: PDFChatWrapperProps) {
  const [selectedText, setSelectedText] = useState<string>("");
  const [, setCurrentPage] = useState(1);
  const [aiHighlightPhrases, setAiHighlightPhrases] = useState<string[]>([]);
  const [, setManualHighlights] = useState<Highlight[]>([]);
  const [externalNotice, setExternalNotice] = useState<string | null>(null);

  const handleTextSelected = useCallback((text: string, pageNumber: number) => {
    console.log(`Text selected on page ${pageNumber}: "${text}"`);
    setSelectedText(text);
    setCurrentPage(pageNumber);
  }, []);

  const handleHighlightCreated = useCallback(
    async (highlight: Highlight) => {
      console.log("New highlight created:", highlight);
      setManualHighlights((prev) => [...prev, highlight]);

      // Store highlight in database
      try {
        const response = await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: document.id,
            type: highlight.type === "manual" ? "highlight" : "ai_highlight",
            highlightText: highlight.text,
            pageNumber: highlight.pageNumber,
            x: highlight.rects[0]?.x || 0,
            y: highlight.rects[0]?.y || 0,
            width: highlight.rects[0]?.width || 100,
            height: highlight.rects[0]?.height || 20,
            color: highlight.color,
            createdBy: highlight.type === "manual" ? "user" : "ai",
          }),
        });

        if (response.ok) {
          toast.success("Highlight saved");
        }
      } catch (error) {
        console.error("Failed to save highlight:", error);
        toast.error("Failed to save highlight");
      }
    },
    [document.id]
  );

  const handleAIHighlight = useCallback((phrases: string[]) => {
    console.log("AI highlighting phrases:", phrases);
    setAiHighlightPhrases(phrases);
  }, []);

  const handleNoMatchFound = useCallback((message: string) => {
    // Show toast and notify chat via external notice
    toast.message(message);
    setExternalNotice(message + " (This was checked against the current PDF.)");
  }, []);

  const handleDocumentLoad = useCallback((numPages: number) => {
    console.log(`Document loaded with ${numPages} pages`);
  }, []);

  const handleError = useCallback((error: string) => {
    console.error("PDF Error:", error);
    toast.error(error);
  }, []);

  return (
    <div className="flex h-screen bg-white">
      {/* PDF Viewer with advanced features */}
      <div className="fit-content border-r border-gray-300 overflow-hidden">
        <div className="h-full flex flex-col relative">
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">{document.title}</h2>
            <p className="text-sm text-gray-500">
              {selectedText
                ? `Selected: "${selectedText.substring(0, 50)}..."`
                : "Select text to highlight"}
            </p>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-hidden">
            <PDFViewerAdvanced
              fileUrl={document.fileUrl}
              documentId={document.id}
              onTextSelected={handleTextSelected}
              onHighlightCreated={handleHighlightCreated}
              aiHighlightPhrases={aiHighlightPhrases}
              onDocumentLoad={handleDocumentLoad}
              onError={handleError}
              onNoMatchFound={handleNoMatchFound}
            />
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 min-w-[400px] flex flex-col">
        <PDFChat
          documentId={document.id}
          pdfContent={document.extractedText || ""}
          onHighlightText={handleAIHighlight}
          externalNotice={externalNotice || undefined}
        />
      </div>
    </div>
  );
}
