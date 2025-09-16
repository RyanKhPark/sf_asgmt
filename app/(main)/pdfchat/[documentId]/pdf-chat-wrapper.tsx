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
  const [aiHighlightPhrases, setAiHighlightPhrases] = useState<string[]>([]);
  const [, setManualHighlights] = useState<Highlight[]>([]);
  const [externalNotice, setExternalNotice] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const handleHighlightCreated = useCallback(
    async (highlight: Highlight) => {
      
      setManualHighlights((prev) => [...prev, highlight]);

      // Store highlight in database
      try {
        const response = await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: document.id,
            type:
              highlight.shape === "circle"
                ? "image_highlight"
                : highlight.type === "manual"
                ? "highlight"
                : "ai_highlight",
            highlightText: highlight.text,
            pageNumber: highlight.pageNumber,
            x: highlight.rects[0]?.x || 0,
            y: highlight.rects[0]?.y || 0,
            width: highlight.rects[0]?.width || 100,
            height: highlight.rects[0]?.height || 20,
            color: highlight.shape === "circle" ? "#ff0000" : highlight.color,
            createdBy: highlight.type === "manual" ? "user" : "ai",
            messageId: activeMessageId || undefined,
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
    [document.id, activeMessageId]
  );

  const handleAIHighlight = useCallback((phrases: string[]) => {
    
    setAiHighlightPhrases(phrases);
  }, []);

  const handleNoMatchFound = useCallback((message: string) => {
    // Show toast and notify chat via external notice
    toast.message(message);
    setExternalNotice(message + " (This was checked against the current PDF.)");
  }, []);

  const handleDocumentLoad = useCallback((numPages: number) => {
    
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
          <div className="px-4 h-14 flex items-center justify-center border-b border-gray-200 bg-gray-50 ">
            <h2 className="font-semibold text-gray-900">{document.title}</h2>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-hidden">
            <PDFViewerAdvanced
              fileUrl={document.fileUrl}
              documentId={document.id}
              onHighlightCreated={handleHighlightCreated}
              aiHighlightPhrases={aiHighlightPhrases}
              activeMessageId={activeMessageId || undefined}
              aiTopK={3}
              aiMinScore={0.15}
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
          onAIMessageSaved={(messageId: string) =>
            setActiveMessageId(messageId)
          }
        />
      </div>
    </div>
  );
}
